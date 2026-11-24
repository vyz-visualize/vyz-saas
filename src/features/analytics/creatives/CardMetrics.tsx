"use client";

// Métricas escolhidas nos cards de criativo dos visuais: o botão "Métricas" (o seletor de 1 a 4,
// agrupado, com arrastar para ordenar; no celular, folha de baixo para cima), o card com as
// métricas escolhidas e o detalhe do criativo com todas as métricas, a imagem grande e o post.
// A escolha vale para todos os cards de criativo do dashboard e fica salva nele (metric_prefs).

import { GripVertical, SlidersHorizontal } from "lucide-react";
import { createContext, useContext, useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/kit";
import { brl, brlCompact, decimal, int, pct } from "@/lib/format";
import { Thumb } from "../ui";
import { CARD_GROUP_LABEL, CARD_GROUPS, CARD_MAX, CARD_METRICS, CARD_MIN, cardLabel, cardShort, formatCard, metricsFor, type CardCreative, type CardMetric } from "./card-metrics";
import { PostLink } from "./PostLink";

/** A escolha dos cards no dashboard aberto: os ids, quem pode trocar e o que esconder (investimento oculto). */
export type CardPrefs = { ids: string[]; set?: (ids: string[]) => void; hideSpend?: boolean };
const Ctx = createContext<CardPrefs | null>(null);
export const CardPrefsProvider = Ctx.Provider;
export const useCardPrefs = () => useContext(Ctx);

const fmtFor = (c: CardCreative) => ({
  // acima de R$ 1.000, abreviado ("R$ 5,3 mil"): cabe no card sem quebrar a linha
  money: (v: number) => (Math.abs(c.cents ? v : v * 100) >= 100_000 ? brlCompact(c.cents ? v : v * 100) : brl(c.cents ? v : v * 100)),
  int: (v: number) => int(v),
  pct: (v: number) => pct(v, v < 0.1 ? 2 : 1),
  decimal: (v: number) => decimal(v, 2),
});
export const cardValue = (m: CardMetric, c: CardCreative, hideSpend?: boolean) => (hideSpend && m.spendDerived ? "•••" : formatCard(m, c, fmtFor(c)));

/** As métricas escolhidas de um criativo, em linha (o miolo do card). */
export function CardStats({ c, className = "" }: { c: CardCreative; className?: string }) {
  const prefs = useCardPrefs();
  const list = metricsFor(prefs?.ids ?? [], c);
  if (!list.length) return null;
  return (
    <dl className={`grid gap-x-3 gap-y-1.5 text-[11px] tnum ${list.length >= 3 ? "grid-cols-3" : "grid-cols-2"} ${className}`} data-card-metricas={list.map((m) => m.id).join(",")}>
      {list.map((m) => (
        <div key={m.id} className="min-w-0">
          <dt className="truncate text-fg-2" title={`${cardLabel(m, c)}: ${m.help}`}>
            {cardShort(m, c)}
          </dt>
          <dd className="font-semibold text-fg">{cardValue(m, c, prefs?.hideSpend)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Um card de criativo: a imagem, o nome, as métricas escolhidas e o post; clicar abre o detalhe. */
export function CreativeCard({ c, aside, footer, className = "" }: { c: CardCreative; aside?: ReactNode; footer?: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <article
        className={`flex h-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-[14px] border border-line bg-card text-fg transition-colors hover:border-fg-2/50 ${className}`}
        onClick={(e) => {
          if ((e.target as Element).closest("a, button")) return;
          setOpen(true);
        }}
        data-criativo={c.id}
      >
        <Thumb seed={c.id} url={c.thumbnailUrl} label={c.name} badge={c.format} className="aspect-[16/10]" />
        <div className="flex flex-1 flex-col gap-2 p-3">
          <div className="flex min-w-0 items-start gap-2">
            <button type="button" onClick={() => setOpen(true)} className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent" title={c.name}>
              <span className="line-clamp-2 text-[12.5px] leading-snug font-semibold">{c.name}</span>
              {c.campaignName && <span className="mt-0.5 block truncate text-[11px] text-fg-2">{c.campaignName}</span>}
            </button>
            {aside}
          </div>
          <CardStats c={c} />
          {footer}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
            <PostLink url={c.postUrl} short />
            <button type="button" onClick={() => setOpen(true)} className="ml-auto text-[11px] font-medium whitespace-nowrap text-fg-2 underline-offset-2 hover:text-fg hover:underline">
              Ver detalhe
            </button>
          </div>
        </div>
      </article>
      <CreativeDetailModal c={c} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** O detalhe do criativo: a imagem grande, todas as métricas (as de vídeo só no vídeo) e o post original. */
export function CreativeDetailModal({ c, open, onClose }: { c: CardCreative; open: boolean; onClose: () => void }) {
  const prefs = useCardPrefs();
  return (
    <Modal open={open} onClose={onClose} title={c.name} wide>
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]" data-detalhe-criativo={c.id}>
        <div>
          <Thumb seed={c.id} url={c.thumbnailUrl} label={c.name} badge={c.format} className="aspect-square rounded-[12px]" />
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-fg-2">
            {c.campaignName && <span className="min-w-0 truncate">{c.campaignName}</span>}
            <PostLink url={c.postUrl} className="ml-auto" />
          </div>
        </div>
        <div className="space-y-4">
          {CARD_GROUPS.map((g) => {
            const list = CARD_METRICS.filter((m) => m.group === g && !(m.videoOnly && !c.video));
            if (!list.length) return null;
            return (
              <section key={g}>
                <h3 className="mb-1.5 text-[11px] font-semibold tracking-[0.1em] text-fg-2 uppercase">{CARD_GROUP_LABEL[g]}</h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px] tnum sm:grid-cols-3">
                  {list.map((m) => (
                    <div key={m.id} className="min-w-0">
                      <dt className="truncate text-fg-2" title={m.help}>
                        {cardLabel(m, c)}
                      </dt>
                      <dd className="text-[15px] font-semibold">{cardValue(m, c, prefs?.hideSpend)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
          <p className="text-[11px] text-fg-2">Sem o dado para este criativo, a métrica fica em branco (—).</p>
        </div>
      </div>
    </Modal>
  );
}

/** O botão "Métricas" e o seletor: de 1 a 4, agrupadas, na ordem escolhida (arrastar ou as setas). */
export function CardMetricsButton({ className = "" }: { className?: string }) {
  const prefs = useCardPrefs();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  if (!prefs?.set) return null;
  const toggle = (id: string) => setDraft((d) => (d.includes(id) ? (d.length > CARD_MIN ? d.filter((x) => x !== id) : d) : d.length < CARD_MAX ? [...d, id] : d));
  const move = (from: number, to: number) =>
    setDraft((d) => {
      if (to < 0 || to >= d.length) return d;
      const next = [...d];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      return next;
    });
  const byId = new Map(CARD_METRICS.map((m) => [m.id, m]));
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDraft(prefs.ids);
          setOpen(true);
        }}
        className={`inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-[12.5px] font-medium text-fg outline-none hover:border-fg-2 focus-visible:ring-2 focus-visible:ring-accent ${className}`}
        data-botao-metricas
      >
        <SlidersHorizontal size={14} aria-hidden /> Métricas
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Métricas dos cards de criativo">
        <div className="space-y-5" data-seletor-metricas>
          <p className="text-[12.5px] text-fg-2">Escolha de 1 a 4. Elas aparecem em todos os cards de criativo deste dashboard, para quem vê pelo link também. As de vídeo só aparecem nos vídeos.</p>
          <section>
            <h3 className="mb-2 text-[12px] font-semibold">Ordem nos cards</h3>
            <ol className="space-y-1.5">
              {draft.map((id, i) => (
                <li
                  key={id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", String(i))}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    move(Number(e.dataTransfer.getData("text/plain")), i);
                  }}
                  className="flex items-center gap-2 rounded-control border border-line bg-card px-2.5 py-2 text-[13px]"
                  data-ordem={id}
                >
                  <GripVertical size={15} className="shrink-0 cursor-grab text-fg-2" aria-hidden />
                  <span className="w-4 text-[11px] font-bold text-fg-2 tnum">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{byId.get(id)?.label}</span>
                  <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Subir ${byId.get(id)?.label}`} className="grid size-7 place-items-center rounded-full text-fg-2 hover:bg-surface-2 disabled:opacity-30">
                    ↑
                  </button>
                  <button type="button" onClick={() => move(i, i + 1)} disabled={i === draft.length - 1} aria-label={`Descer ${byId.get(id)?.label}`} className="grid size-7 place-items-center rounded-full text-fg-2 hover:bg-surface-2 disabled:opacity-30">
                    ↓
                  </button>
                </li>
              ))}
            </ol>
          </section>
          {CARD_GROUPS.map((g) => (
            <fieldset key={g}>
              <legend className="mb-1.5 text-[11px] font-semibold tracking-[0.1em] text-fg-2 uppercase">{CARD_GROUP_LABEL[g]}</legend>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {CARD_METRICS.filter((m) => m.group === g && !(prefs.hideSpend && m.spendDerived)).map((m) => {
                  const on = draft.includes(m.id);
                  const full = !on && draft.length >= CARD_MAX;
                  return (
                    <label key={m.id} className={`flex cursor-pointer items-start gap-2 rounded-control border px-2.5 py-2 text-[12.5px] ${on ? "border-accent bg-accent-soft" : "border-line"} ${full ? "cursor-not-allowed opacity-50" : ""}`} title={m.help}>
                      <input type="checkbox" checked={on} disabled={full || (on && draft.length <= CARD_MIN)} onChange={() => toggle(m.id)} className="mt-0.5 accent-[var(--accent)]" />
                      <span className="min-w-0">
                        <span className="block font-medium">{m.label}</span>
                        <span className="block text-[11px] text-fg-2">{m.help}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
            <span className="mr-auto text-[12px] text-fg-2 tnum">
              {draft.length} de {CARD_MAX}
            </span>
            <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-full px-4 text-[13px] text-fg-2 hover:text-fg">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                prefs.set?.(draft);
                setOpen(false);
              }}
              className="h-9 rounded-full bg-accent px-4 text-[13px] font-semibold text-on-accent"
            >
              Aplicar
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
