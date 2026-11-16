"use client";

// Detalhe de um criativo (o "Ver detalhes" da galeria): os números só dele, o CTR dia a dia,
// como ele está contra a média dos anúncios do período, a retenção (vídeo) e o alerta de
// cansaço. Tudo sai do que a galeria já tem (CreativeVM): abrir não busca nada no servidor.

import { TrendSpark } from "@/components/charts/TrendSpark";
import { Modal } from "@/components/ui/kit";
import { decimal, int, pct } from "@/lib/format";
import { formatValue, money, moneyCompact } from "../format";
import type { CreativeVM, CreativesData } from "../types";
import { Roas, Thumb } from "../ui";
import { resultTitle } from "./objectives";

type Data = Pick<CreativesData, "gallery" | "hideSpend" | "currency" | "breakEvenRoas">;

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

export function CreativeDetail({ c, data, onClose }: { c: CreativeVM | null; data: Data; onClose: () => void }) {
  return (
    <Modal open={!!c} onClose={onClose} title={c?.name ?? "Criativo"} wide>
      {c && <Body c={c} data={data} />}
    </Modal>
  );
}

function Body({ c, data }: { c: CreativeVM; data: Data }) {
  const { gallery, hideSpend, currency, breakEvenRoas } = data;
  const others = gallery.filter((g) => g.id !== c.id);
  const mean = {
    ctr: avg(others.map((g) => g.linkCtr)),
    cpr: avg(others.map((g) => g.costPerResult)),
    roas: avg(others.map((g) => g.roas)),
    freq: avg(others.map((g) => g.frequency)),
    hook: avg(others.map((g) => g.hookRate)),
  };
  const ctrDays = c.ctrSpark.filter((v): v is number => v != null);
  const best = ctrDays.length ? Math.max(...ctrDays) : null;
  const worst = ctrDays.length ? Math.min(...ctrDays) : null;
  const spendShare = !hideSpend && c.spend != null ? c.spend / (gallery.reduce((a, g) => a + (g.spend ?? 0), 0) || 1) : null;

  const vs: { label: string; value: number | null; ref: number | null; better: "up" | "down"; fmt: (v: number) => string }[] = [
    { label: "CTR do link", value: c.linkCtr, ref: mean.ctr, better: "up", fmt: (v) => pct(v, 2) },
    ...(!hideSpend ? [c.hasRevenue ? { label: "ROAS", value: c.roas, ref: mean.roas, better: "up" as const, fmt: (v: number) => decimal(v) } : { label: "Custo por resultado", value: c.costPerResult, ref: mean.cpr, better: "down" as const, fmt: (v: number) => money(v, currency) }] : []),
    { label: "Frequência", value: c.frequency, ref: mean.freq, better: "down", fmt: (v) => decimal(v, 2) },
    ...(c.hookRate != null ? [{ label: "Retenção 3 s", value: c.hookRate, ref: mean.hook, better: "up" as const, fmt: (v: number) => pct(v, 0) }] : []),
  ];

  return (
    <div className="grid gap-5 md:grid-cols-[260px_minmax(0,1fr)]">
      <div className="space-y-3">
        <Thumb seed={c.id} url={c.thumbnailUrl} label={c.headline ?? c.name} badge={c.format} className="aspect-[4/5] rounded-[14px]" />
        <div className="text-[12.5px]">
          <p className="text-fg-2">Campanha</p>
          <p className="font-medium">{c.campaignName}</p>
          {c.headline && (
            <>
              <p className="mt-2 text-fg-2">Título</p>
              <p className="font-medium">{c.headline}</p>
            </>
          )}
          <p className="mt-2 inline-flex rounded-full border border-line px-2 py-0.5 text-[11.5px] text-fg-2">{c.status === "active" ? "Ativo" : c.status === "paused" ? "Pausado" : c.status}</p>
        </div>
      </div>

      <div className="min-w-0 space-y-4">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {!hideSpend && <Tile label="Investimento" value={moneyCompact(c.spend, currency)} note={spendShare != null ? `${pct(spendShare, 0)} dos anúncios` : undefined} />}
          <Tile label={resultTitle(c.result.label)} value={c.result.value == null ? "—" : int(c.result.value)} />
          {!hideSpend && (c.hasRevenue ? <Tile label="ROAS" value={<Roas value={c.roas} breakEven={breakEvenRoas} />} /> : <Tile label="Custo por resultado" value={money(c.costPerResult, currency)} />)}
          <Tile label="CTR do link" value={formatValue(c.linkCtr, "pct")} />
          <Tile label="Frequência média" value={c.frequency == null ? "—" : decimal(c.frequency, 2)} />
          <Tile label="Retenção 3 s" value={c.hookRate == null ? "—" : pct(c.hookRate, 0)} note={c.holdRate != null ? `${pct(c.holdRate, 0)} seguem até o ThruPlay` : undefined} />
        </dl>

        <section className="rounded-[14px] border border-line p-3.5">
          <header className="mb-2 flex items-baseline justify-between gap-2">
            <h4 className="text-[13px] font-semibold">CTR do link por dia</h4>
            {best != null && worst != null && (
              <span className="text-[11.5px] text-fg-2 tnum">
                melhor dia {pct(best, 2)} · pior {pct(worst, 2)}
              </span>
            )}
          </header>
          <TrendSpark values={c.ctrSpark} maturing={0} tone={c.fatigue ? "bad" : "good"} className="h-28" />
        </section>

        <section className="rounded-[14px] border border-line p-3.5">
          <h4 className="mb-3 text-[13px] font-semibold">Contra a média dos outros anúncios</h4>
          <ul className="space-y-3">
            {vs.map((m) => {
              const d = m.value != null && m.ref ? m.value / m.ref - 1 : null;
              const good = d == null ? null : m.better === "up" ? d >= 0 : d <= 0;
              const max = Math.max(m.value ?? 0, m.ref ?? 0) || 1;
              return (
                <li key={m.label} className="text-[12px]">
                  <p className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="font-medium">{m.label}</span>
                    <span className="tnum">
                      <strong>{m.value == null ? "—" : m.fmt(m.value)}</strong>
                      <span className="text-fg-2"> · média {m.ref == null ? "—" : m.fmt(m.ref)}</span>
                      {d != null && <span className={`ml-1.5 font-semibold ${good ? "text-accent" : "text-error-fg"}`}>{d >= 0 ? "+" : "−"}{pct(Math.abs(d), 0)}</span>}
                    </span>
                  </p>
                  <div className="space-y-1" aria-hidden>
                    <div className="h-2 rounded-full bg-[color-mix(in_srgb,var(--fg)_8%,transparent)]">
                      <div className={`h-full rounded-full ${good === false ? "bg-error-fg" : "bg-accent"}`} style={{ width: `${((m.value ?? 0) / max) * 100}%` }} />
                    </div>
                    <div className="h-1 rounded-full bg-[color-mix(in_srgb,var(--fg)_8%,transparent)]">
                      <div className="h-full rounded-full bg-fg-2/60" style={{ width: `${((m.ref ?? 0) / max) * 100}%` }} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-2.5 text-[11px] text-fg-2">Barra grossa: este anúncio. Barra fina: a média dos outros {others.length} anúncios do período.</p>
        </section>

        {c.hookRate != null && (
          <section className="rounded-[14px] border border-line p-3.5">
            <h4 className="mb-3 text-[13px] font-semibold">Quanto do vídeo as pessoas veem</h4>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ["Impressões", 1],
                ["Viram 3 s", c.hookRate],
                ["Chegaram ao ThruPlay", c.holdRate != null ? c.hookRate * c.holdRate : null],
              ].map(([l, v]) => (
                <div key={l as string} className="flex flex-col items-center gap-1.5">
                  <div className="flex h-24 w-full items-end justify-center">
                    <div className="w-12 rounded-t-[8px] bg-accent" style={{ height: `${Math.max(4, ((v as number | null) ?? 0) * 100)}%`, opacity: 0.4 + ((v as number | null) ?? 0) * 0.6 }} />
                  </div>
                  <span className="text-[14px] font-bold tnum">{v == null ? "—" : pct(v as number, 0)}</span>
                  <span className="text-[11px] text-fg-2">{l}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {c.fatigue && (
          <p className="rounded-[12px] bg-error-soft px-3 py-2.5 text-[12.5px] leading-snug text-error-fg">
            <strong>Sinal de cansaço:</strong> na segunda metade do período, a frequência subiu {pct(c.fatigue.frequencyChange, 0)} e o CTR caiu {pct(Math.abs(c.fatigue.ctrChange), 0)}. Hora de renovar o criativo ou abrir público.
          </p>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="rounded-[12px] border border-line/80 bg-[linear-gradient(165deg,color-mix(in_srgb,var(--fg)_4%,var(--card)),var(--card)_55%)] px-3 py-2.5">
      <dt className="truncate text-[10px] font-medium tracking-[0.06em] text-fg-2 uppercase">{label}</dt>
      <dd className="mt-1 text-[18px] leading-none font-bold tnum">{value}</dd>
      {note && <dd className="mt-1 truncate text-[10.5px] text-fg-2">{note}</dd>}
    </div>
  );
}
