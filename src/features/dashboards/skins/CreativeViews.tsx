"use client";

// A aba Criativos de cada visual, do jeito dele (os mesmos criativos e as mesmas contas; muda a
// apresentação). Todos os cards mostram as métricas escolhidas no botão "Métricas" e abrem o
// detalhe com todas as métricas e o post original.
//   - Pulso (ação): a fila de decisão, escalar / manter / pausar, com o motivo;
//   - Noturno (tendência): a curva de vida de cada criativo, do 1º dia com entrega até hoje, e o cansaço;
//   - Areia (lead): o caminho de cada criativo, do clique ao resultado;
//   - Fachada (empreendimento): os criativos por campanha (empreendimento ou oferta), quando há mais de uma;
//   - Lavanda (relatório): o capítulo, com o texto e o destaque.

import { ArrowRight, Flame, Pause, Rocket, Scale } from "lucide-react";
import type { ReactNode } from "react";
import { CardMetricsButton, CreativeCard } from "@/features/analytics/creatives/CardMetrics";
import type { CardCreative } from "@/features/analytics/creatives/card-metrics";
import { CompareView } from "@/features/analytics/creatives/CompareView";
import type { CreativesData } from "@/features/analytics/types";
import { decimal, int, pct } from "@/lib/format";
import { MiniSpark } from "./extras";

export type CreativeViewKind = "pulso" | "noturno" | "areia" | "fachada" | "lavanda";

const sum = (xs: readonly (number | null)[]) => xs.reduce<number>((a, v) => a + (v ?? 0), 0);
const grid = "grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]";

/** Cabeçalho da aba: o título, o que ela responde e o botão "Métricas". */
function Head({ title, text }: { title: string; text: string }) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-[16px] font-bold tracking-tight text-fg">{title}</h3>
        <p className="mt-0.5 max-w-[70ch] text-[12.5px] text-fg-2">{text}</p>
      </div>
      <CardMetricsButton />
    </header>
  );
}

// ---- Pulso: fila de decisão ----------------------------------------------------------------------

export type Decision = { c: CardCreative; action: "escalar" | "manter" | "pausar"; reason: string };

/** Escalar, manter ou pausar, pelo custo contra a média dos criativos, a frequência e o cansaço do CTR. */
export function decide(list: readonly CardCreative[]): Decision[] {
  const results = sum(list.map((c) => c.result.value));
  const spend = sum(list.map((c) => c.spend));
  const avg = results > 0 ? spend / results : null;
  return list.map((c): Decision => {
    const r = c.result.value ?? 0;
    const cost = r > 0 && c.spend != null ? c.spend / r : null;
    const freq = c.frequency ?? 0;
    if (avg && (c.spend ?? 0) >= 2 * avg && r === 0) return { c, action: "pausar", reason: "gastou o custo de 2 resultados médios sem nenhum resultado" };
    if (avg && cost && cost > 1.5 * avg && freq >= 3) return { c, action: "pausar", reason: `custo ${pct(cost / avg - 1, 0)} acima da média e frequência ${decimal(freq, 1)}` };
    if (c.fatigue && c.fatigue.ctrChange <= -0.2) return { c, action: "pausar", reason: `cansando: CTR ${pct(Math.abs(c.fatigue.ctrChange), 0)} menor na 2ª metade do período` };
    if (avg && cost && r >= 3 && cost <= 0.8 * avg && freq < 2.5) return { c, action: "escalar", reason: `custo ${pct(1 - cost / avg, 0)} abaixo da média, frequência ${decimal(freq, 1)}` };
    if (!r && avg && (c.spend ?? 0) < 0.5 * avg) return { c, action: "manter", reason: "pouco investimento ainda para decidir" };
    return { c, action: "manter", reason: cost && avg ? `custo perto da média (${pct(cost / avg - 1, 0)})` : "sem resultado no período, ainda abaixo do custo médio" };
  });
}

const DECISION = {
  escalar: { title: "Escalar", icon: Rocket, text: "Mais barato que a média e sem repetir demais: dá para pôr mais verba." },
  manter: { title: "Manter", icon: Scale, text: "Na média, ou com pouco dado ainda." },
  pausar: { title: "Pausar ou trocar", icon: Pause, text: "Caro, repetido demais ou cansando." },
} as const;

function PulsoQueue({ list }: { list: CardCreative[] }) {
  const decided = decide(list);
  return (
    <>
      <Head title="Fila de decisão" text="Cada criativo com a decisão e o motivo, pelo custo contra a média dos criativos, a frequência e a queda do CTR. Confira os últimos 3 dias antes de pausar (ainda em maturação)." />
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]" data-fila-decisao>
        {(["escalar", "manter", "pausar"] as const).map((a) => {
          const items = decided.filter((d) => d.action === a);
          const D = DECISION[a];
          return (
            <section key={a} className="min-w-0" data-decisao={a}>
              <h4 className="mb-1 flex items-center gap-2 text-[13.5px] font-bold text-fg">
                <D.icon size={15} aria-hidden className={a === "pausar" ? "text-error-fg" : a === "escalar" ? "text-accent" : "text-fg-2"} /> {D.title}
                <span className="ml-auto rounded-full bg-surface-2 px-2 text-[11px] tnum text-fg-2">{items.length}</span>
              </h4>
              <p className="mb-3 text-[11.5px] text-fg-2">{D.text}</p>
              <div className="grid gap-3">
                {items.length === 0 ? <p className="text-[12px] text-fg-2">Nenhum.</p> : items.map((d) => <CreativeCard key={d.c.id} c={d.c} footer={<p className="text-[11.5px] leading-snug text-fg-2" data-motivo>{d.reason}</p>} />)}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

// ---- Noturno: curva de vida ----------------------------------------------------------------------

/** O CTR por dia desde o 1º dia com entrega (os dias antes dele saem). */
export function lifeCurve(spark: readonly (number | null)[] | undefined): number[] {
  if (!spark?.length) return [];
  const first = spark.findIndex((v) => v != null && v > 0);
  return first < 0 ? [] : spark.slice(first).map((v) => v ?? 0);
}

function NoturnoLife({ list }: { list: CardCreative[] }) {
  const withCurve = list.map((c) => ({ c, curve: lifeCurve(c.ctrSpark) }));
  const any = withCurve.some((x) => x.curve.length >= 3);
  return (
    <>
      <Head title="Curva de vida dos criativos" text="O CTR do link de cada criativo dia a dia, do 1º dia com entrega até hoje (cada curva na escala dela, para mostrar a forma). Cansaço: frequência subindo e CTR caindo entre as metades do período." />
      {!any && <p className="mb-3 text-[12px] text-fg-2">A curva de cada criativo aparece com o dia a dia dos anúncios (contas ligadas).</p>}
      <div className={grid} data-curva-vida>
        {withCurve.map(({ c, curve }) => (
          <CreativeCard
            key={c.id}
            c={c}
            footer={
              curve.length >= 3 ? (
                <div>
                  <MiniSpark values={curve} color={c.fatigue ? "var(--error-fg)" : "var(--accent)"} className="h-12 w-full" label={`CTR do link por dia de ${c.name}`} />
                  <p className="mt-1 flex justify-between text-[10.5px] text-fg-2 tnum">
                    <span>dia 1 · {pct(curve[0] ?? 0, 2)}</span>
                    {c.fatigue ? (
                      <span className="flex items-center gap-1 font-semibold text-error-fg">
                        <Flame size={11} aria-hidden /> cansando
                      </span>
                    ) : null}
                    <span>
                      dia {curve.length} · {pct(curve.at(-1) ?? 0, 2)}
                    </span>
                  </p>
                </div>
              ) : null
            }
          />
        ))}
      </div>
    </>
  );
}

// ---- Areia: do clique ao resultado ----------------------------------------------------------------

function AreiaPath({ list }: { list: CardCreative[] }) {
  const word = list.find((c) => c.result.label)?.result.label ?? "resultados";
  const rows = [...list].sort((a, b) => (b.result.value ?? 0) - (a.result.value ?? 0));
  const best = rows.filter((c) => (c.linkClicks ?? 0) >= 20 && c.result.value).sort((a, b) => (b.result.value ?? 0) / (b.linkClicks ?? 1) - (a.result.value ?? 0) / (a.linkClicks ?? 1))[0];
  return (
    <>
      <Head
        title={`Qual criativo traz ${word}`}
        text={`O caminho de cada criativo: impressões, cliques no link e ${word}, com a passagem entre eles. A venda por criativo precisa do CRM com a origem de cada lead; aqui, até o ${word.replace(/s$/, "")}.`}
      />
      {best && (
        <p className="mb-3 text-[12.5px] text-fg" data-melhor-caminho>
          Quem mais converte o clique: <strong>{best.name}</strong>, {pct((best.result.value ?? 0) / (best.linkClicks ?? 1), 1)} dos cliques viram {word}.
        </p>
      )}
      <div className={grid} data-caminho>
        {rows.map((c) => (
          <CreativeCard
            key={c.id}
            c={c}
            footer={
              <p className="flex flex-wrap items-center gap-1 text-[11px] text-fg-2 tnum" aria-label="Caminho do criativo">
                <span>{c.impressions != null ? int(c.impressions) : "—"} imp.</span>
                <ArrowRight size={11} aria-hidden />
                <span>{c.linkClicks != null ? int(c.linkClicks) : "—"} cliques</span>
                {c.impressions && c.linkClicks != null ? <span className="text-fg">({pct(c.linkClicks / c.impressions, 2)})</span> : null}
                <ArrowRight size={11} aria-hidden />
                <span>
                  {c.result.value != null ? int(c.result.value) : "—"} {word}
                </span>
                {c.linkClicks && c.result.value != null ? <span className="font-semibold text-fg">({pct(c.result.value / c.linkClicks, 1)})</span> : null}
              </p>
            }
          />
        ))}
      </div>
    </>
  );
}

// ---- Fachada: por empreendimento ou oferta --------------------------------------------------------

function FachadaOffers({ list }: { list: CardCreative[] }) {
  const groups = new Map<string, CardCreative[]>();
  for (const c of list) groups.set(c.campaignName || "Sem campanha", [...(groups.get(c.campaignName || "Sem campanha") ?? []), c]);
  const byGroup = groups.size > 1;
  return (
    <>
      <Head title={byGroup ? "Criativos por empreendimento ou oferta" : "Criativos"} text={byGroup ? "Agrupados pela campanha (o empreendimento ou a oferta de cada uma), com o resultado de cada grupo." : "Os criativos do período."} />
      {byGroup ? (
        <div className="space-y-6" data-por-oferta>
          {[...groups.entries()]
            .sort((a, b) => sum(b[1].map((c) => c.result.value)) - sum(a[1].map((c) => c.result.value)))
            .map(([name, items]) => (
              <section key={name}>
                <h4 className="mb-2 flex flex-wrap items-baseline gap-x-3 border-b border-line pb-1.5 text-[14px] font-medium tracking-tight text-fg">
                  {name}
                  <span className="text-[11.5px] text-fg-2 tnum">
                    {items.length} {items.length === 1 ? "criativo" : "criativos"} · {int(sum(items.map((c) => c.result.value)))} {items[0]?.result.label}
                  </span>
                </h4>
                <div className={grid}>
                  {items.map((c) => (
                    <CreativeCard key={c.id} c={c} />
                  ))}
                </div>
              </section>
            ))}
        </div>
      ) : (
        <div className={grid}>
          {list.map((c) => (
            <CreativeCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </>
  );
}

// ---- Lavanda: o capítulo --------------------------------------------------------------------------

function LavandaChapter({ list }: { list: CardCreative[] }) {
  const ranked = [...list].sort((a, b) => (b.result.value ?? 0) - (a.result.value ?? 0));
  const best = ranked[0];
  const total = sum(list.map((c) => c.result.value));
  const word = best?.result.label ?? "resultados";
  return (
    <>
      <header className="mb-4">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-accent uppercase">Anexo · Criativos</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h3 className="text-[20px] font-bold tracking-tight text-fg">O que os criativos trouxeram</h3>
          <CardMetricsButton />
        </div>
        <p className="mt-1 max-w-[75ch] text-[13px] text-fg-2" data-texto-capitulo>
          {list.length} {list.length === 1 ? "criativo rodou" : "criativos rodaram"} no período e {total === 1 ? "trouxe" : "trouxeram"} {int(total)} {word}.
          {best && total > 0 ? ` O que mais trouxe foi “${best.name}”, com ${int(best.result.value ?? 0)} (${pct((best.result.value ?? 0) / total, 0)} do total).` : ""}
        </p>
      </header>
      {best && (
        <div className="mb-4 grid items-start gap-3 @[900px]:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          {/* o destaque tem a altura do conteúdo (não a da grade ao lado) e acompanha a rolagem */}
          <div className="@[900px]:sticky @[900px]:top-4" data-destaque-criativo>
            <CreativeCard c={best} aside={<span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-semibold text-on-accent">Destaque</span>} />
          </div>
          <div className={grid}>
            {ranked.slice(1).map((c) => (
              <CreativeCard key={c.id} c={c} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/** A aba Criativos do visual. Com o plano que libera o comparativo, ele vem embaixo (os mesmos anúncios lado a lado). */
export function SkinCreatives({ kind, list, data, kpis }: { kind: CreativeViewKind; list: CardCreative[]; data?: CreativesData; /** A fileira de cards da aba (a padrão, editável). */ kpis?: ReactNode }): ReactNode {
  if (!list.length)
    return (
      <>
        {kpis && <div className="mb-5">{kpis}</div>}
        <p className="py-10 text-center text-[12.5px] text-fg-2">Nenhum anúncio veiculou no período.</p>
      </>
    );
  return (
    <div data-criativos-visual={kind}>
      {kpis && <div className="mb-5">{kpis}</div>}
      {kind === "pulso" ? <PulsoQueue list={list} /> : kind === "noturno" ? <NoturnoLife list={list} /> : kind === "areia" ? <AreiaPath list={list} /> : kind === "fachada" ? <FachadaOffers list={list} /> : <LavandaChapter list={list} />}
      {data?.level === "compare" && data.compare.length >= 2 && (
        <section className="mt-8 border-t border-line pt-5">
          <h3 className="mb-3 text-[15px] font-bold tracking-tight text-fg">Comparar criativos lado a lado</h3>
          <CompareView data={data} />
        </section>
      )}
    </div>
  );
}
