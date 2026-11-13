"use client";

// Estado da capa de um dashboard (visuais com capa): a imagem, o endereço e a planilha
// do lançamento. Quem hospeda o dashboard diz como gravar (CoverHost): no painel, as
// ações do servidor; sem elas (bancada local, prévia), tudo fica na memória desta aba:
// a imagem como endereço local e a planilha só pelas células coladas.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { notify } from "@/components/ui/Toast";
import { launchCode, readLaunchSheet, type LaunchColumn, type LaunchRow, type LaunchSummary } from "@/features/import/launch-sheet";
import { coverFileError, fitFromPixels, parseCover, type CoverControl, type CoverFit, type DashboardCover, type LaunchSheetControl, type LaunchSheetInput, type LaunchSheetOutcome } from "./cover";

export type SheetRead = { ok: true; rows: LaunchRow[]; summary: LaunchSummary } | { ok: false; error: string };

export type CoverHost = {
  /** Grava a capa. Sem isso, a mudança vale só nesta aba. */
  save?: (cover: DashboardCover) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Sobe a imagem e devolve o endereço dela. Sem isso, a imagem fica na memória desta aba. */
  upload?: (file: File) => Promise<{ ok: true; url: string } | { ok: false; error: string }>;
  /** Lê a planilha pelo link (no servidor) e liga ao dashboard. Sem isso, só as células coladas. */
  readSheet?: (link: string) => Promise<SheetRead>;
  /** Desliga a planilha. */
  dropSheet?: () => Promise<unknown>;
  /** E-mail da conta de serviço que lê planilhas fechadas. */
  serviceEmail?: string | null;
  /** Código do workspace (vai no cabeçalho do modelo). */
  code?: string;
  /** Planilha já ligada: o link salvo e o que o servidor leu. */
  sheet?: { link: string | null; rows: LaunchRow[]; summary: LaunchSummary; error?: string | null } | null;
};

type Sheet = { link: string | null; rows: LaunchRow[]; summary: LaunchSummary; error?: string | null };

/** A imagem é um recorte (fundo transparente) ou uma foto? JPG não tem transparência. */
async function fitOfFile(file: File): Promise<CoverFit> {
  if (file.type === "image/jpeg" || typeof createImageBitmap !== "function") return "foto";
  try {
    const bmp = await createImageBitmap(file);
    const w = Math.min(64, bmp.width);
    const h = Math.min(64, bmp.height);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const c = canvas.getContext("2d");
    if (!c) return "foto";
    c.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    return fitFromPixels(c.getImageData(0, 0, w, h).data, w, h);
  } catch {
    return "foto";
  }
}

const errorsText = (errors: { line: number; message: string }[], more: number) => {
  const lines = errors.slice(0, 6).map((e) => (e.line > 0 ? `Linha ${e.line}: ${e.message}` : e.message));
  const rest = errors.length - lines.length + more;
  return [...lines, ...(rest > 0 ? [`E mais ${rest} ${rest === 1 ? "linha com erro" : "linhas com erro"}.`] : [])].join("\n");
};

export function useDashboardCover({ initial, editable, host, today }: { initial?: unknown; editable: boolean; host?: CoverHost; today: string }): {
  cover: CoverControl;
  sheet: LaunchSheetControl;
  /** As linhas da planilha ligada, para o Dataset (metrics/launch-dataset.ts). null = sem planilha. */
  launch: { rows: LaunchRow[]; missing: LaunchColumn[] } | null;
} {
  const [value, setValue] = useState<DashboardCover>(() => parseCover(initial));
  const [sheet, setSheet] = useState<Sheet | null>(host?.sheet ?? null);
  // endereço local da imagem escolhida sem servidor: liberado ao trocar e ao sair
  const local = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (local.current) URL.revokeObjectURL(local.current);
    },
    [],
  );

  const save = host?.save;
  const upload = host?.upload;
  const readSheet = host?.readSheet;
  const dropSheet = host?.dropSheet;

  const onChange = useCallback(
    (next: DashboardCover) => {
      setValue(next);
      if (local.current && next.image !== local.current) {
        URL.revokeObjectURL(local.current);
        local.current = null;
      }
      // imagem só em memória não vai para o banco (o endereço dela só vale nesta aba)
      if (save && !next.image?.startsWith("blob:")) void save(next).then((r) => !r.ok && notify(r.error));
    },
    [save],
  );

  const pickImage = useCallback(
    async (file: File) => {
      const bad = coverFileError(file);
      if (bad) return { ok: false as const, error: bad };
      const fit = await fitOfFile(file);
      if (upload) {
        const res = await upload(file);
        return res.ok ? { ok: true as const, url: res.url, fit } : res;
      }
      const url = URL.createObjectURL(file);
      local.current = url;
      return { ok: true as const, url, fit };
    },
    [upload],
  );

  const connect = useCallback(
    async (input: LaunchSheetInput): Promise<LaunchSheetOutcome> => {
      if ("pasted" in input) {
        const read = readLaunchSheet(input.pasted, { today });
        if (!read.ok) return { ok: false, error: errorsText(read.errors, read.more) };
        setSheet({ link: null, rows: read.rows, summary: read.summary });
        return { ok: true, summary: read.summary };
      }
      if (!readSheet) return { ok: false, error: "Nesta prévia o link não é lido (não há servidor por trás). Use Colar as células para ver os números; no painel, o link é lido e atualizado todo dia." };
      const res = await readSheet(input.link);
      if (!res.ok) return res;
      setSheet({ link: input.link, rows: res.rows, summary: res.summary });
      return { ok: true, summary: res.summary };
    },
    [readSheet, today],
  );

  const disconnect = useCallback(() => {
    setSheet(null);
    void dropSheet?.();
  }, [dropSheet]);

  const cover = useMemo<CoverControl>(() => (editable ? { value, onChange, pickImage } : { value }), [editable, onChange, pickImage, value]);
  const code = host?.code ?? launchCode("previa");
  const serviceEmail = host?.serviceEmail ?? null;
  const control = useMemo<LaunchSheetControl>(
    () => ({ state: { link: sheet?.link ?? null, summary: sheet?.summary ?? null, error: sheet?.error ?? null }, code, serviceEmail, ...(editable ? { connect, disconnect } : {}) }),
    [code, connect, disconnect, editable, serviceEmail, sheet],
  );
  const launch = useMemo(() => (sheet ? { rows: sheet.rows, missing: sheet.summary.missing } : null), [sheet]);
  return { cover, sheet: control, launch };
}
