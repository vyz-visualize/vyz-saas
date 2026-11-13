"use client";

// Contas · Importação por planilha: para as plataformas sem API (Shopee, Spotify,
// Globo, ChatGPT Ads). A pessoa sobe um CSV ou cola o link de uma planilha do
// Google Sheets compartilhada por link. O arquivo é conferido no navegador antes
// de enviar (mesma regra do servidor); o link é lido pelo servidor e, salvo na
// conta, atualiza sozinho todo dia.

import { CircleCheck, FileSpreadsheet, Link2, RefreshCw, Trash2, Upload } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { EmptyState, Modal, SelectField, TextField } from "@/components/ui/kit";
import { PlatformIcon } from "@/components/brand/PlatformIcon";
import { btn } from "@/components/ui/styles";
import { btnSmallGhost, errorBox, iconBtnDanger, modalFooter } from "@/features/integrations/ui";
import { IMPORT_MAX_BYTES, IMPORT_TEMPLATE_CSV, readSpreadsheet, sheetsCsvUrl, type ImportResult, type ImportSummary } from "@/features/import/spreadsheet";
import { relativeTime } from "@/features/integrations/sync-label";
import type { AdAccountDTO } from "@/features/integrations/types";
import { availableIn, canUse, type Tier } from "@/features/pricing/entitlements";
import { useWorkspace } from "@/features/workspace/workspace";
import { brl, int } from "@/lib/format";
import { importSpreadsheet } from "@/server/import/actions";
import { IMPORT_PLATFORMS } from "./connection-modes";
import { PLATFORMS, type PlatformId } from "./platforms";

type ImportSectionProps = {
  accounts: AdAccountDTO[];
  canManage: boolean;
  now: string;
  timeZone: string;
  onRemove: (a: AdAccountDTO) => void;
};

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** O que a planilha traz, em uma frase. */
function summaryText(s: ImportSummary): string {
  return `${int(s.rows)} ${s.rows === 1 ? "linha" : "linhas"}, ${int(s.campaigns)} ${s.campaigns === 1 ? "campanha" : "campanhas"}, de ${ddmm(s.from)} a ${ddmm(s.to)}. Investimento de ${brl(Math.round(s.spend * 100))}.`;
}

export function ImportSection({ accounts, canManage, now, timeZone, onRemove }: ImportSectionProps) {
  const tier = useWorkspace().ws.tier;
  const [form, setForm] = useState<{ account?: AdAccountDTO } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const byPlatform = IMPORT_PLATFORMS.filter((p) => accounts.some((a) => a.platformId === p));

  function refreshFromLink(a: AdAccountDTO) {
    setFailure(null);
    setNotice(null);
    setBusyId(a.id);
    startRefresh(async () => {
      const res = await importSpreadsheet({ platformId: a.platformId, accountId: a.id });
      setBusyId(null);
      if (res.ok) setNotice(`${a.name} atualizada: ${summaryText(res.data.summary)}`);
      else setFailure({ id: a.id, message: res.error.message });
    });
  }

  const add = canManage ? (
    <button type="button" onClick={() => setForm({})} className={btn.small}>
      <Upload size={16} aria-hidden /> Importar planilha
    </button>
  ) : undefined;

  return (
    <section aria-labelledby="pl-import" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 id="pl-import" className="text-[17px] font-semibold tracking-[-0.015em]">
            Importação por planilha
          </h2>
          <p className="mt-0.5 text-[13.5px] leading-snug text-fg-2">
            Para {IMPORT_PLATFORMS.map((p) => PLATFORMS[p].short).join(", ")}, que não têm conexão direta. Suba um CSV ou cole o link de uma planilha do Google Sheets. Cada conta entra no limite do plano.
          </p>
        </div>
        {add && <div className="shrink-0 max-sm:[&>*]:w-full">{add}</div>}
      </div>

      {notice && (
        <p role="status" className="flex items-start gap-2 rounded-control border border-accent/40 bg-accent-soft px-3 py-2.5 text-[13.5px] leading-snug">
          <CircleCheck size={15} aria-hidden className="mt-0.5 shrink-0 text-accent" />
          {notice}
        </p>
      )}

      {accounts.length === 0 ? (
        <EmptyState title="Nenhuma planilha importada" text="Importe os dados de uma plataforma sem conexão direta e use no modelo Planilha · Mídia paga." action={add} />
      ) : (
        <div className="space-y-5">
          {byPlatform.map((p) => (
            <div key={p}>
              <h3 className="mb-2 flex items-center gap-2 text-[12.5px] font-medium text-fg-2">
                <PlatformIcon id={p} size={18} /> {PLATFORMS[p].name}
              </h3>
              <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
                {accounts
                  .filter((a) => a.platformId === p)
                  .map((a) => {
                    const failed = a.lastSync?.status === "failed" ? a.lastSync.error : null;
                    return (
                      <li key={a.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        <div className="min-w-0">
                          <p className="text-[14px] leading-snug font-semibold break-words">{a.name}</p>
                          <p className="mt-0.5 text-[12.5px] leading-snug text-fg-2">
                            {a.imported?.sheet ? "Google Sheets, atualiza todo dia" : "Arquivo CSV"}
                            {a.lastSyncedAt ? ` · última importação ${relativeTime(a.lastSyncedAt, now, timeZone)}` : ""}
                          </p>
                          <p className="mt-0.5 text-[12.5px] leading-snug text-fg-2">{a.dashboards.length ? `Usada em: ${a.dashboards.map((d) => d.name).join(", ")}` : "Não usada em nenhum dashboard"}</p>
                          {(failure?.id === a.id || failed) && (
                            <p role="alert" className="mt-1.5 text-[12.5px] leading-snug whitespace-pre-line text-error-fg">
                              {failure?.id === a.id ? failure.message : `Última atualização falhou: ${failed}`}
                            </p>
                          )}
                        </div>
                        {canManage && (
                          <div className="flex shrink-0 items-center gap-1.5">
                            {a.imported?.sheet && (
                              <button type="button" onClick={() => refreshFromLink(a)} disabled={refreshing} className={`${btnSmallGhost} max-sm:h-10 max-sm:flex-1`}>
                                <RefreshCw size={15} className={busyId === a.id ? "animate-spin motion-reduce:animate-none" : ""} aria-hidden /> Atualizar
                              </button>
                            )}
                            <button type="button" onClick={() => setForm({ account: a })} disabled={refreshing} className={`${btnSmallGhost} max-sm:h-10 max-sm:flex-1`}>
                              <Upload size={15} aria-hidden /> Nova planilha
                            </button>
                            <button type="button" aria-label={`Remover ${a.name}`} title="Remover" onClick={() => onRemove(a)} className={iconBtnDanger}>
                              <Trash2 size={15} aria-hidden />
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </div>
      )}

      <Modal open={form !== null} onClose={() => setForm(null)} title={form?.account ? `Nova planilha para ${form.account.name}` : "Importar planilha"}>
        {form && (
          <ImportForm
            account={form.account}
            tier={tier}
            onCancel={() => setForm(null)}
            onDone={(text) => {
              setForm(null);
              setFailure(null);
              setNotice(text);
            }}
          />
        )}
      </Modal>
    </section>
  );
}

type Source = "csv" | "sheet";

function ImportForm({ account, tier, onDone, onCancel }: { account?: AdAccountDTO; tier: Tier; onDone: (notice: string) => void; onCancel: () => void }) {
  const [platform, setPlatform] = useState<PlatformId>(account?.platformId ?? IMPORT_PLATFORMS[0]);
  const [name, setName] = useState(account?.name ?? "");
  const [source, setSource] = useState<Source>(account?.imported?.sheet ? "sheet" : "csv");
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const allowed = canUse(tier, PLATFORMS[platform].tier);

  // o arquivo é conferido aqui antes de enviar: a pessoa vê o resumo ou a linha com erro
  const check: ImportResult | null = useMemo(() => (file ? readSpreadsheet(file.text) : null), [file]);
  const linkCheck = link.trim() ? sheetsCsvUrl(link) : null;
  const ready = allowed && (account || name.trim()) && (source === "csv" ? !!check?.ok : !!linkCheck?.ok);

  async function pick(f: File | undefined) {
    setError(null);
    if (!f) return setFile(null);
    if (f.size > IMPORT_MAX_BYTES) {
      setFile(null);
      return setError("O arquivo passa de 2 MB. Divida o período em arquivos menores.");
    }
    setFile({ name: f.name, text: await f.text() });
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([`﻿${IMPORT_TEMPLATE_CSV}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-vyz.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function submit() {
    setError(null);
    start(async () => {
      const res = await importSpreadsheet({
        platformId: platform,
        ...(account ? { accountId: account.id } : { name: name.trim() }),
        ...(source === "csv" ? { csv: file?.text ?? "" } : { sheetLink: link.trim() }),
      });
      if (res.ok) onDone(`${res.data.name}: ${summaryText(res.data.summary)}${res.data.source === "sheet" ? " O link fica salvo e atualiza todo dia." : ""}`);
      else setError(res.error.message);
    });
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready && !pending) submit();
      }}
    >
      {!account && (
        <>
          <SelectField
            label="Plataforma"
            value={platform}
            onChange={(v) => setPlatform(v as PlatformId)}
            options={IMPORT_PLATFORMS.map((id) => ({ value: id, label: `${PLATFORMS[id].name}${canUse(tier, PLATFORMS[id].tier) ? "" : ` · ${availableIn(PLATFORMS[id].tier)}`}` }))}
          />
          <TextField label="Nome da conta (para você reconhecer)" value={name} onChange={setName} placeholder={`Ex.: ${PLATFORMS[platform].short} · Loja Verde`} disabled={pending} />
        </>
      )}

      {!allowed ? (
        <p className="rounded-card border border-line bg-card p-4 text-[14px] leading-snug">
          {PLATFORMS[platform].name} está {availableIn(PLATFORMS[platform].tier).toLowerCase()}.
        </p>
      ) : (
        <>
          <div role="group" aria-label="De onde vem a planilha" className="flex gap-1 rounded-[calc(var(--r-control)+4px)] bg-surface-2 p-1 text-[13.5px] font-medium">
            {(
              [
                ["csv", "Arquivo CSV", FileSpreadsheet],
                ["sheet", "Google Sheets", Link2],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                aria-pressed={source === id}
                onClick={() => {
                  setSource(id);
                  setError(null);
                }}
                className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-control px-3 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent ${source === id ? "bg-card text-fg shadow-card" : "text-fg-2 hover:text-fg"}`}
              >
                <Icon size={15} aria-hidden /> {label}
              </button>
            ))}
          </div>

          {source === "csv" ? (
            <div className="space-y-2">
              <input ref={input} type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} aria-label="Arquivo CSV" />
              <button
                type="button"
                onClick={() => input.current?.click()}
                disabled={pending}
                className={`flex w-full flex-col items-center justify-center gap-2 rounded-card border border-dashed px-4 py-6 text-[14px] outline-none transition-colors duration-150 hover:border-accent hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent ${file ? "border-accent/60 bg-accent-soft/40" : "border-line"}`}
              >
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-surface-2 text-fg-2">{file ? <FileSpreadsheet size={17} aria-hidden /> : <Upload size={17} aria-hidden />}</span>
                <span className="max-w-full truncate font-medium">{file ? file.name : "Escolher arquivo CSV"}</span>
                <span className="text-[12px] text-fg-2">{file ? "Toque para trocar o arquivo" : "Até 2 MB"}</span>
              </button>
              <p className="text-[12.5px] text-fg-2">
                Colunas: data, campanha e investimento (obrigatórias); impressões, cliques, conversões e receita (opcionais).{" "}
                <button type="button" onClick={downloadTemplate} className="font-semibold text-accent underline-offset-4 hover:underline">
                  Baixar modelo
                </button>
              </p>
              {check?.ok && (
                <p role="status" className="rounded-control bg-surface-2 px-3 py-2.5 text-[13px] leading-snug">
                  {summaryText(check.summary)}
                  {check.summary.missing.length > 0 && " Colunas opcionais ausentes entram zeradas."}
                  {check.summary.merged > 0 && ` ${int(check.summary.merged)} ${check.summary.merged === 1 ? "linha repetida foi somada" : "linhas repetidas foram somadas"}.`}
                </p>
              )}
              {check && !check.ok && (
                <ul role="alert" className={`space-y-0.5 ${errorBox} text-[13px]`}>
                  {check.errors.map((e, i) => (
                    <li key={i}>{e.line > 0 ? `Linha ${e.line}: ${e.message}` : e.message}</li>
                  ))}
                  {check.more > 0 && <li>E mais {int(check.more)} com erro.</li>}
                </ul>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <TextField label="Link da planilha" value={link} onChange={setLink} placeholder="https://docs.google.com/spreadsheets/d/..." disabled={pending} error={linkCheck && !linkCheck.ok ? linkCheck.error : undefined} />
              <p className="text-[12.5px] text-fg-2">
                No Google Sheets: Compartilhar, &quot;Qualquer pessoa com o link&quot; como leitor. O VYZ lê a aba que estiver aberta no link, com as mesmas colunas do modelo, e relê todo dia.
                {account?.imported?.sheet && " Deixe em branco e use Atualizar para reler o link já salvo."}
              </p>
            </div>
          )}
        </>
      )}

      {error && (
        <p role="alert" className={`${errorBox} whitespace-pre-line`}>
          {error}
        </p>
      )}

      <p className="text-[12px] leading-snug text-fg-2">A planilha substitui os dados da conta no período que ela cobre. Dias fora dela ficam como estão.</p>
      <div className={modalFooter}>
        <button type="button" onClick={onCancel} disabled={pending} className={btnSmallGhost}>
          Cancelar
        </button>
        <button type="submit" disabled={!ready || pending} className={btn.small}>
          {pending ? "Importando..." : "Importar"}
        </button>
      </div>
    </form>
  );
}
