"use client";

// Janelas da capa do Fachada: trocar a imagem e o endereço (CoverDialog) e ligar a
// planilha do lançamento (SheetDialog). As duas só existem para quem pode editar o
// dashboard: no link público, na miniatura e no PDF a capa é só leitura.

import { Check, Copy, Download, FileSpreadsheet, Globe, ImagePlus, Link2, ShieldCheck, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Modal, TextField } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { LAUNCH_COLUMNS, launchSummaryText, launchTemplateCsv, launchTemplateTsv } from "@/features/import/launch-sheet";
import { sheetsCsvUrl } from "@/features/import/spreadsheet";
import { COVER_ADDRESS_MAX, COVER_HINT, coverFileError, type CoverControl, type CoverFit, type LaunchSheetControl } from "../../cover";

// ---- capa -----------------------------------------------------------------------------

export function CoverDialog({ open, onClose, cover }: { open: boolean; onClose: () => void; cover: CoverControl }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const { value, onChange, pickImage } = cover;
  if (!onChange) return null;

  function pick(file: File | undefined) {
    setError(null);
    if (!file || !pickImage) return;
    const bad = coverFileError(file);
    if (bad) return setError(bad);
    start(async () => {
      const res = await pickImage(file);
      if (res.ok) onChange?.({ ...value, image: res.url, fit: res.fit });
      else setError(res.error);
    });
  }

  const fits: { id: CoverFit; label: string; text: string }[] = [
    { id: "recorte", label: "Recorte", text: "Imagem sem fundo, solta na capa" },
    { id: "foto", label: "Foto", text: "Preenche um quadro arredondado" },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Capa do dashboard">
      <div className="space-y-5">
        <section className="space-y-2">
          <h3 className="text-[13px] font-medium">Imagem do empreendimento</h3>
          <div className="flex items-center gap-3">
            <div className="grid size-[72px] shrink-0 place-items-center overflow-hidden rounded-card border border-line bg-field">
              {value.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- imagem que a pessoa subiu (Storage ou memória), tamanho livre
                <img src={value.image} alt="" className={`size-full ${value.fit === "foto" ? "object-cover" : "object-contain"}`} />
              ) : (
                <ImagePlus size={22} className="text-fg-2" aria-hidden />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <input ref={input} type="file" accept="image/png,image/webp,image/jpeg" className="sr-only" aria-label="Imagem da capa" onChange={(e) => pick(e.target.files?.[0])} />
              <button type="button" className={btn.small} disabled={busy || !pickImage} onClick={() => input.current?.click()}>
                <ImagePlus size={15} aria-hidden /> {busy ? "Enviando..." : value.image ? "Trocar imagem" : "Escolher imagem"}
              </button>
              {value.image && (
                <button type="button" className={`${btn.ghost} h-9 text-sm`} disabled={busy} onClick={() => onChange({ ...value, image: null })}>
                  <Trash2 size={15} aria-hidden /> Voltar para a padrão
                </button>
              )}
            </div>
          </div>
          <p className="text-[12.5px] text-fg-2">{COVER_HINT}</p>
          {value.image && (
            <div role="group" aria-label="Como a imagem aparece" className="flex gap-1 rounded-control border border-line p-1 text-[13px] font-medium">
              {fits.map((f) => (
                <button key={f.id} type="button" aria-pressed={value.fit === f.id} title={f.text} onClick={() => onChange({ ...value, fit: f.id })} className={`flex-1 rounded-[6px] px-3 py-1.5 ${value.fit === f.id ? "bg-accent text-on-accent" : "text-fg-2 hover:text-fg"}`}>
                  {f.label}
                </button>
              ))}
            </div>
          )}
          {error && (
            <p role="alert" className="rounded-control border border-error/60 bg-error-soft p-2.5 text-[13px] text-error-fg">
              {error}
            </p>
          )}
        </section>

        <TextField label="Endereço (linha embaixo do título)" value={value.address} onChange={(v) => onChange({ ...value, address: v.slice(0, COVER_ADDRESS_MAX) })} placeholder="Av. Beira-Mar, 2875 · Meireles, Fortaleza" hint="Em branco, aparece o nome do cliente." />

        <div className="flex justify-end">
          <button type="button" className={btn.small} onClick={onClose}>
            Pronto
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---- planilha do lançamento -----------------------------------------------------------

function CopyButton({ text, label, done = "Copiado" }: { text: string; label: string; done?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={`${btn.ghost} h-9 border border-line text-sm`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        } catch {
          // sem permissão de área de transferência: o texto continua visível para copiar à mão
        }
      }}
    >
      {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />} {copied ? done : label}
    </button>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent text-[12px] font-bold text-on-accent" aria-hidden>
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <h3 className="text-[14px] font-semibold">{title}</h3>
        {children}
      </div>
    </li>
  );
}

type Mode = "link" | "paste";

export function SheetDialog({ open, onClose, sheet }: { open: boolean; onClose: () => void; sheet: LaunchSheetControl }) {
  const [mode, setMode] = useState<Mode>("link");
  const [link, setLink] = useState("");
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { state, code, serviceEmail, connect, disconnect } = sheet;
  if (!connect) return null;

  const linkCheck = link.trim() ? sheetsCsvUrl(link) : null;
  const ready = mode === "link" ? !!linkCheck?.ok : pasted.trim().length > 0;

  function submit() {
    setError(null);
    start(async () => {
      const res = await connect!(mode === "link" ? { link: link.trim() } : { pasted });
      if (res.ok) {
        setLink("");
        setPasted("");
      } else setError(res.error);
    });
  }

  function download() {
    const url = URL.createObjectURL(new Blob([`﻿${launchTemplateCsv(code)}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-lancamento-vyz.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal open={open} onClose={onClose} title="Planilha do lançamento" wide>
      <div className="space-y-5">
        <p className="text-[13.5px] text-fg-2">
          As plataformas de anúncio enxergam até o lead. O que acontece depois (atendimento, visita, proposta e venda) vem de uma planilha do Google que o seu time preenche. O dashboard relê a planilha todo dia.
        </p>

        {state.summary && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-card p-3.5">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[13.5px] font-semibold">
                <FileSpreadsheet size={16} aria-hidden /> Planilha ligada
              </p>
              <p className="mt-0.5 text-[12.5px] text-fg-2">
                {launchSummaryText(state.summary)}
                {state.summary.missing.length > 0 && ` Sem a coluna ${state.summary.missing.map((k) => `"${LAUNCH_COLUMNS.find((c) => c.key === k)!.label}"`).join(", ")}: essas etapas ficam fora do funil.`}
                {!state.link && " Dados colados: não atualizam sozinhos."}
              </p>
              {state.error && (
                <p role="alert" className="mt-1 text-[12.5px] text-error-fg">
                  Última atualização falhou: {state.error}
                </p>
              )}
            </div>
            {disconnect && (
              <button type="button" className={`${btn.ghost} h-9 text-sm`} onClick={disconnect} disabled={pending}>
                <Trash2 size={15} aria-hidden /> Desligar
              </button>
            )}
          </div>
        )}

        <ol className="space-y-5">
          <Step n={1} title="Crie a planilha com este modelo">
            <p className="text-[13px] text-fg-2">
              Abra uma planilha nova no Google Sheets, clique na célula A1 e cole. Uma linha por dia (ou por dia e origem). Só contagens: nada de nome, telefone ou e-mail de cliente.
            </p>
            <div className="overflow-x-auto rounded-control border border-line">
              <table className="w-full min-w-[560px] text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-line bg-field">
                    <th className="px-2.5 py-1.5 font-semibold">Coluna</th>
                    <th className="px-2.5 py-1.5 font-semibold">O que entra</th>
                    <th className="px-2.5 py-1.5 font-semibold">Precisa?</th>
                  </tr>
                </thead>
                <tbody>
                  {LAUNCH_COLUMNS.map((c) => (
                    <tr key={c.key} className="border-b border-line last:border-0">
                      <td className="px-2.5 py-1.5 font-medium whitespace-nowrap">{c.label}</td>
                      <td className="px-2.5 py-1.5 text-fg-2">{c.hint}</td>
                      <td className="px-2.5 py-1.5 whitespace-nowrap">{c.required ? "Sim" : "Opcional"}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="px-2.5 py-1.5 font-medium whitespace-nowrap">{code}</td>
                    <td className="px-2.5 py-1.5 text-fg-2">Só o título da coluna, sem nada embaixo. É o código que liga a planilha a esta conta.</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{serviceEmail ? "Sim" : "Opcional"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={launchTemplateTsv(code)} label="Copiar modelo" done="Copiado: cole na célula A1" />
              <button type="button" className={`${btn.ghost} h-9 border border-line text-sm`} onClick={download}>
                <Download size={15} aria-hidden /> Baixar CSV
              </button>
            </div>
          </Step>

          <Step n={2} title={serviceEmail ? "Compartilhe com a VYZ" : "Abra a planilha para quem tiver o link"}>
            {serviceEmail ? (
              <>
                <p className="text-[13px] text-fg-2">No Google Sheets, clique em Compartilhar e adicione este e-mail como Leitor. A planilha continua fechada para todo o resto.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="min-w-0 rounded-control border border-line bg-field px-2.5 py-1.5 text-[12.5px] break-all">{serviceEmail}</code>
                  <CopyButton text={serviceEmail} label="Copiar e-mail" />
                </div>
                <p className="flex items-start gap-1.5 text-[12px] text-fg-2">
                  <ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden />
                  Este e-mail é de um leitor automático da VYZ: só lê planilhas compartilhadas com ele, não edita nada e não acessa mais nada da sua conta Google.
                </p>
              </>
            ) : (
              // o passo que mais falha: em destaque, com o caminho exato no Google Sheets
              <div role="note" className="rounded-card border-2 border-accent bg-accent-soft/50 p-3.5">
                <p className="flex items-center gap-2 text-[14px] font-semibold text-fg">
                  <Globe size={17} className="shrink-0 text-accent" aria-hidden />A planilha precisa estar em &ldquo;Qualquer pessoa com o link&rdquo;
                </p>
                <p className="mt-1 text-[12.5px] text-fg-2">Se ela ficar como &ldquo;Restrito&rdquo; (o padrão do Google), o VYZ não consegue ler os números e a planilha não liga.</p>
                <ol className="mt-3 space-y-2 text-[13px] text-fg">
                  {[
                    <>No Google Sheets, clique em <strong className="font-semibold">Compartilhar</strong> (botão no canto de cima, à direita).</>,
                    <>Em <strong className="font-semibold">Acesso geral</strong>, troque &ldquo;Restrito&rdquo; por <strong className="font-semibold">Qualquer pessoa com o link</strong>.</>,
                    <>Deixe a permissão como <strong className="font-semibold">Leitor</strong> e clique em <strong className="font-semibold">Copiar link</strong>. É esse link que entra no passo 3.</>,
                  ].map((text, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="grid size-5 shrink-0 place-items-center rounded-full border border-accent text-[11px] font-semibold text-accent" aria-hidden>
                        {i + 1}
                      </span>
                      <span className="min-w-0">{text}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-3 flex items-start gap-1.5 text-[12px] text-fg-2">
                  <ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden />
                  Quem tiver o link consegue ver a planilha. Por isso ela leva só contagens: nada de nome, telefone ou e-mail de cliente.
                </p>
              </div>
            )}
          </Step>

          <Step n={3} title="Ligue a planilha">
            <div role="group" aria-label="Como ligar" className="flex gap-1 rounded-control border border-line p-1 text-[13px] font-medium">
              {(
                [
                  ["link", "Link do Google Sheets", Link2],
                  ["paste", "Colar as células", Copy],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={mode === id}
                  onClick={() => {
                    setMode(id);
                    setError(null);
                  }}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-[6px] px-3 py-1.5 ${mode === id ? "bg-accent text-on-accent" : "text-fg-2 hover:text-fg"}`}
                >
                  <Icon size={15} aria-hidden /> {label}
                </button>
              ))}
            </div>
            {mode === "link" ? (
              <TextField label="Link da planilha" value={link} onChange={setLink} placeholder="https://docs.google.com/spreadsheets/d/..." disabled={pending} error={linkCheck && !linkCheck.ok ? linkCheck.error : undefined} hint={serviceEmail ? "O VYZ lê a aba que estiver aberta no link e relê todo dia." : "Cole o link copiado no passo 2, de uma planilha em “Qualquer pessoa com o link”. O VYZ lê a aba que estiver aberta no link e relê todo dia."} />
            ) : (
              <div className="space-y-1">
                <label htmlFor="fachada-paste" className="block text-[13px] font-medium">
                  Células da planilha (com o cabeçalho)
                </label>
                <textarea
                  id="fachada-paste"
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  disabled={pending}
                  rows={6}
                  placeholder={launchTemplateTsv()}
                  className="w-full rounded-control border border-line bg-field p-2.5 font-mono text-[12px] text-fg outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
                <p className="text-[12px] text-fg-2">Selecione as células no Google Sheets, copie e cole aqui. Serve para conferir o modelo; para atualizar sozinho, use o link.</p>
              </div>
            )}
            {error && (
              <p role="alert" className="rounded-control border border-error/60 bg-error-soft p-2.5 text-[13px] whitespace-pre-line text-error-fg">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button type="button" className={btn.small} disabled={!ready || pending} onClick={submit}>
                {pending ? "Lendo..." : state.summary ? "Trocar planilha" : "Ligar planilha"}
              </button>
              <button type="button" className={`${btn.ghost} h-9 text-sm`} onClick={onClose} disabled={pending}>
                Fechar
              </button>
            </div>
          </Step>
        </ol>
      </div>
    </Modal>
  );
}
