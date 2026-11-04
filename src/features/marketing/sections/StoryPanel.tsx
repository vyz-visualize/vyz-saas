"use client";

// Painel do "Como funciona". O palco (moldura, rótulo do passo, selo) é fixo e
// não remonta; só a cena troca, pela faixa do corte. Tudo em tamanho de
// leitura: os gráficos medem o espaço (FitChart) e desenham em px reais.

import { Check, FileText, Link2 } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "@/components/brand/Icon";
import { BarList } from "@/components/charts/BarList";
import { FitChart } from "@/components/charts/FitChart";
import { Funnel } from "@/components/charts/Funnel";
import { textWidth } from "@/components/charts/labels";
import { LineChart, LineLegend } from "@/components/charts/LineChart";
import { Scatter } from "@/components/charts/Scatter";
import { Sparkline } from "@/components/charts/Sparkline";
import { barData, Kpi, lineData, makeContext } from "@/features/dashboards/widgets/Widgets";
import { MockSource } from "@/features/metrics/source";
import { dashboardTemplate } from "@/features/templates/dashboards";
import { PAGES } from "@/features/templates/pages";

const EASE = [0.22, 1, 0.36, 1] as const;
/** Saída e entrada pela faixa do corte. */
const CUT_CLOSED = "inset(50% 0% 50% 0%)";
const CUT_OPEN = "inset(0% 0% 0% 0%)";

export type SceneKey = "ecommerce" | "imob";
export const SCENES: Record<SceneKey, { template: string; label: string; client: string }> = {
  ecommerce: { template: "ecommerce-visao-geral", label: "E-commerce", client: "Loja Verde" },
  imob: { template: "imobiliario-leads", label: "Imobiliário", client: "Incorporadora Sul" },
};

type Mode = "sticky" | "inline";

type StageProps = {
  step: number;
  mode: Mode;
  /** Monta o conteúdo só depois que o painel aparece. */
  ready: boolean;
  template: SceneKey;
  onPickTemplate: (k: SceneKey) => void;
};

/** Moldura fixa + cena do passo. */
export function StoryStage({ step, mode, ready, template, onPickTemplate }: StageProps) {
  const reduce = useReducedMotion();
  const fill = mode === "sticky";
  return (
    <div
      data-story-panel
      role="group"
      aria-label={`Ilustração do passo ${step + 1}`}
      className={`@container relative flex flex-col overflow-hidden rounded-card border border-line bg-bg ${fill ? "h-full" : ""}`}
    >
      <header className="flex min-h-12 items-center justify-between gap-3 px-4 pt-3">
        <span data-step-label className="text-[12px] font-medium tracking-[0.08em] text-fg-2 uppercase">
          Passo 0{step + 1}
        </span>
        {step === 1 && (
          <div className="flex gap-1.5" role="radiogroup" aria-label="Template">
            {(Object.keys(SCENES) as SceneKey[]).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={template === k}
                onClick={() => onPickTemplate(k)}
                className={`rounded-chip px-3 py-1 text-[12.5px] transition-colors duration-200 ${template === k ? "bg-accent font-semibold text-on-accent" : "border border-line text-fg-2 hover:text-fg"}`}
              >
                {SCENES[k].label}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className={`relative px-4 pt-2 ${fill ? "min-h-0 flex-1" : ""}`}>
        {ready && (
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={step}
              className={fill ? "absolute inset-x-4 top-2 bottom-0" : ""}
              initial={reduce ? false : { clipPath: CUT_CLOSED }}
              animate={{ clipPath: CUT_OPEN }}
              exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { clipPath: CUT_CLOSED }}
              transition={{ duration: reduce ? 0 : 0.34, ease: EASE }}
            >
              {step === 0 && <ConnectScene fill={fill} />}
              {step === 1 && <TemplateScene fill={fill} template={template} />}
              {step === 2 && <SendScene fill={fill} />}
            </m.div>
          </AnimatePresence>
        )}
      </div>

      <footer className="px-4 pt-2 pb-3">
        <span className="inline-block rounded-chip border border-line bg-bg px-2.5 py-0.5 text-[11.5px] text-fg-2">Amostra · dados fictícios</span>
      </footer>
    </div>
  );
}

/** Altura fixa no celular (painel inline), para não pular o layout ao montar. */
export const INLINE_HEIGHT = ["h-[340px]", "", "h-[340px]"];

// ---- passo 01 · contas --------------------------------------------------------

const CHIPS: { label: string; soon?: boolean }[][] = [
  [{ label: "Meta Ads" }, { label: "Google Ads" }, { label: "GA4 em breve", soon: true }],
  [{ label: "Mais em breve", soon: true }],
];

function ConnectScene({ fill }: { fill: boolean }) {
  return (
    <FitChart className={fill ? "h-full" : INLINE_HEIGHT[0]} minHeight={fill ? 220 : 300}>
      {({ width: W, height: H }) => <ConnectArt W={W} H={H} />}
    </FitChart>
  );
}

function ConnectArt({ W, H }: { W: number; H: number }) {
  const reduce = useReducedMotion();
  const play = !reduce;
  const fs = W < 460 ? 12 : 13.5;
  const chipH = fs + 16;
  // largura ocupada pelo chip (folgada) e o ponto onde o traço encosta (um pouco para dentro, por baixo do chip opaco)
  const chipW = (c: { label: string }) => textWidth(c.label, fs) + 26;
  const leftEdge = Math.max(...CHIPS[0].map(chipW));
  const rightEdge = W - Math.max(...CHIPS[1].map(chipW));
  // o hub fica no vão entre as duas colunas, nunca por baixo dos chips
  const hubW = Math.max(64, Math.min(200, W * 0.26, rightEdge - leftEdge - 28));
  const hubH = Math.min(220, H * 0.56);
  const hub = { x: (leftEdge + rightEdge) / 2 - hubW / 2, y: (H - hubH) / 2 };
  const place = (col: number) =>
    CHIPS[col].map((c, i, arr) => {
      const w = chipW(c) - 10;
      const gap = (H - 24) / arr.length;
      const y = 12 + gap * i + (gap - chipH) / 2;
      const x = col === 0 ? 0 : W - w;
      return { ...c, x, y, w, side: col === 0 ? -1 : 1 };
    });
  const chips = [...place(0), ...place(1)];

  return (
    <div className="relative h-full w-full">
      <svg className="absolute inset-0" width={W} height={H} aria-hidden>
        {chips.map((c, i) => {
          const fromX = c.side < 0 ? c.x + c.w : c.x;
          const toX = c.side < 0 ? hub.x : hub.x + hubW;
          const y1 = c.y + chipH / 2;
          const y2 = hub.y + hubH / 2;
          const mx = (fromX + toX) / 2;
          return (
            <m.path
              key={c.label}
              d={`M${fromX},${y1} C${mx},${y1} ${mx},${y2} ${toX},${y2}`}
              fill="none"
              stroke={c.soon ? "var(--muted)" : "var(--accent)"}
              strokeWidth="1.6"
              initial={play ? { pathLength: 0 } : false}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.5 + i * 0.07, duration: 0.6, ease: EASE }}
            />
          );
        })}
      </svg>
      <div className="absolute rounded-card border border-line bg-card" style={{ left: hub.x, top: hub.y, width: hubW, height: hubH, padding: hubW < 110 ? 10 : 16 }}>
        <div className={`mx-auto ${hubW < 110 ? "w-7" : "w-10"}`}>
          <Icon className="text-accent" />
        </div>
        <p className="mt-2 text-center text-[12px] leading-tight font-semibold text-fg @[560px]:text-[13px]">Seu painel</p>
        <div className="mt-3 space-y-2">
          {[86, 60, 72].map((w, i) => (
            <m.div
              key={w}
              className="h-2 origin-left rounded-full bg-accent"
              style={{ width: `${w}%`, opacity: 1 - i * 0.25 }}
              initial={play ? { scaleX: 0 } : false}
              animate={{ scaleX: 1 }}
              transition={{ delay: 1 + i * 0.12, duration: 0.6, ease: EASE }}
            />
          ))}
        </div>
      </div>
      {chips.map((c, i) => (
        <m.span
          key={c.label}
          className={`absolute inline-flex items-center gap-1.5 rounded-chip border px-3 font-medium whitespace-nowrap ${c.soon ? "border-line bg-card text-fg-2" : "border-transparent bg-accent text-on-accent"}`}
          style={{ ...(c.side < 0 ? { left: 0 } : { right: 0 }), top: c.y, height: chipH, fontSize: fs }}
          initial={play ? { x: c.side * 160, opacity: 0 } : false}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 150, damping: 18, delay: i * 0.05 }}
        >
          {c.label}
        </m.span>
      ))}
    </div>
  );
}

// ---- passo 02 · template --------------------------------------------------------

function Panel({ title, children, className = "", delay = 440 }: { title: string; children: ReactNode; className?: string; delay?: number }) {
  return (
    <section className={`m-in flex min-h-0 min-w-0 flex-col rounded-[10px] border border-line bg-card p-3.5 ${className}`} style={{ "--d": `${delay}ms` } as CSSProperties}>
      <h3 className="mb-2 text-[13px] leading-snug font-semibold text-fg">{title}</h3>
      {children}
    </section>
  );
}

function TemplateScene({ fill, template }: { fill: boolean; template: SceneKey }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={template}
        className={fill ? "h-full" : ""}
        initial={reduce ? false : { clipPath: CUT_CLOSED }}
        animate={{ clipPath: CUT_OPEN }}
        exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { clipPath: CUT_CLOSED }}
        transition={{ duration: reduce ? 0 : 0.34, ease: EASE }}
      >
        <TemplateBody fill={fill} scene={template} />
      </m.div>
    </AnimatePresence>
  );
}

/** Altura disponível do palco (para o modo denso em telas baixas). */
function useBoxHeight(ref: React.RefObject<HTMLDivElement | null>) {
  const [h, setH] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(el.clientHeight));
    ro.observe(el);
    setH(el.clientHeight);
    return () => ro.disconnect();
  }, [ref]);
  return h;
}

function TemplateBody({ fill, scene }: { fill: boolean; scene: SceneKey }) {
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const boxH = useBoxHeight(box);
  // em telas baixas (painel com menos de ~600 px úteis) tudo continua cabendo, sem corte
  const dense = fill && boxH > 0 && boxH < 600;
  const t = dashboardTemplate(SCENES[scene].template)!;
  const ctx = useMemo(() => makeContext(MockSource.load({ seed: SCENES[scene].client, profile: t.profile, sources: t.sources, days: 28 })), [scene, t]);
  const layout = PAGES["visao-geral"].build({ profile: t.profile, sources: t.sources });
  const isEcom = scene === "ecommerce";
  const chartBox = fill ? "min-h-0 flex-1" : "h-56";

  const kpis = (
    <div className="grid grid-cols-2 gap-2.5 @[560px]:grid-cols-4">
      {layout.kpis.map((k, i) => (
        <Kpi key={k.metric} spec={k} ctx={ctx} delay={200 + i * 70} size={dense ? "md" : "lg"} />
      ))}
    </div>
  );

  const lineSpec = layout.widgets.find((w) => w.type === "line");
  const line = lineSpec?.type === "line" ? lineData(lineSpec, ctx) : null;
  const barsSpec = layout.widgets.find((w) => w.type === "bars");
  const allBars = barsSpec?.type === "bars" ? barData(barsSpec, ctx) : null;
  const bars = allBars && dense ? { ...allBars, items: [...allBars.items].sort((a, b) => b.value - a.value).slice(0, 3) } : allBars;

  return (
    <div ref={box} className="relative h-full" data-anim={reduce ? "off" : "on"}>
      <div className={fill ? `grid h-full gap-2.5 ${isEcom ? "grid-rows-[auto_minmax(0,1fr)_auto]" : "grid-rows-[auto_minmax(0,1fr)]"}` : "space-y-2.5"}>
        {kpis}
        <div className={`grid gap-2.5 @[560px]:grid-cols-[2fr_1fr] ${fill ? "min-h-0" : ""}`}>
          {isEcom && line ? (
            <Panel title="Custo por venda · média móvel 7 dias">
              <LineLegend avg goal previous={false} maturing large />
              <FitChart className={chartBox} minHeight={140}>
                {({ width, height }) => <LineChart {...line} width={width} height={height} fontSize={11} showLegend={false} />}
              </FitChart>
            </Panel>
          ) : (
            <Panel title="Investimento × custo por lead, por empreendimento">
              <FitChart className={chartBox} minHeight={180}>
                {({ width, height }) => <Scatter points={ctx.ds.projects} width={width} height={height} fontSize={11} />}
              </FitChart>
            </Panel>
          )}
          <Panel title={isEcom ? "Onde o cliente desiste" : "Lead → visita → proposta"} delay={500}>
            <div className={fill ? "min-h-0 flex-1" : ""}>
              <Funnel steps={ctx.ds.funnel} title={isEcom ? "Funil de compra" : "Funil comercial"} size={dense ? "sm" : "lg"} fill={fill} />
            </div>
          </Panel>
        </div>
        {isEcom && bars && (
          <Panel title={dense ? "ROAS por campanha · 3 maiores" : "ROAS por campanha"} delay={560}>
            <BarList {...bars} size="lg" />
          </Panel>
        )}
      </div>
    </div>
  );
}

// ---- passo 03 · enviar ----------------------------------------------------------

function SendScene({ fill }: { fill: boolean }) {
  const reduce = useReducedMotion();
  const play = !reduce;
  return (
    <div className={`relative ${fill ? "h-full" : INLINE_HEIGHT[2]}`}>
      {/* folha de PDF: sai de trás do card e para ao lado (no estreito, por cima), sem cobrir o título */}
      <m.div
        className="absolute top-0 right-1 flex h-[60%] w-[56%] flex-col rounded-[10px] border border-line bg-card p-4 @[560px]:top-[5%] @[560px]:h-[90%] @[560px]:right-3 @[560px]:w-[43%] @[560px]:p-5"
        initial={play ? { x: "-50%", rotate: 0, opacity: 0 } : false}
        animate={{ x: 0, rotate: 3, opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.7, ease: EASE }}
        aria-hidden
      >
        <span className="inline-flex w-fit items-center gap-1 rounded-[4px] bg-error px-2 py-0.5 text-[12px] font-bold text-white">
          <FileText size={13} /> PDF
        </span>
        <p className="mt-3 text-[13px] font-semibold text-fg @[560px]:text-[15px]">Loja Verde · Outubro</p>
        <dl className="mt-2 hidden space-y-1.5 text-[12.5px] @[560px]:block">
          {[
            ["Custo por venda", "R$ 61,20"],
            ["Vendas confirmadas", "602"],
            ["ROAS", "4,3"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2 border-b border-line pb-1.5">
              <dt className="text-fg-2">{k}</dt>
              <dd className="font-semibold tnum text-fg">{v}</dd>
            </div>
          ))}
        </dl>
        {/* custo caindo: a linha desce */}
        <Sparkline values={[32, 28, 30, 20, 17, 9]} className="mt-auto h-[38%]" />
      </m.div>

      {/* o painel encolhe e vira um card de link */}
      <div className="absolute bottom-0 left-0 w-[84%] @[560px]:inset-y-0 @[560px]:flex @[560px]:w-[57%] @[560px]:items-center">
        <m.div
          className="relative w-full rounded-card border border-line bg-card p-5 @[560px]:p-6"
          initial={play ? { scale: 1.12, opacity: 0.4 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <p className="text-[12px] font-medium tracking-[0.06em] text-fg-2 uppercase">Relatório · Loja Verde</p>
          <p className="mt-1 text-[26px] font-bold tracking-[-0.02em] tnum @[560px]:text-[34px]">R$ 61,20</p>
          <p className="text-[13px] text-accent">▼ 8,2% no custo por venda</p>
          <div className="mt-3 hidden @[560px]:block">
            <Sparkline values={[18, 15, 17, 12, 10, 11, 6, 5]} className="h-14" />
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-control border border-line bg-bg px-3 py-2 text-[13px] text-fg-2">
            <Link2 size={15} aria-hidden className="shrink-0" />
            <span className="truncate tnum">vyz.app/r/loja-verde</span>
          </div>
          <m.div
            className="relative mt-3 inline-flex h-10 items-center overflow-hidden rounded-control bg-accent px-4 text-[14px] font-semibold text-on-accent"
            animate={play ? { scale: [1, 1, 0.94, 1] } : undefined}
            transition={{ delay: 0.75, duration: 0.35, times: [0, 0.01, 0.4, 1] }}
          >
            <m.span initial={play ? { opacity: 1 } : { opacity: 0 }} animate={{ opacity: 0 }} transition={{ delay: 0.9, duration: 0.15 }}>
              Copiar link
            </m.span>
            <m.span className="absolute inset-0 inline-flex items-center justify-center gap-1.5" initial={play ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.95, duration: 0.25 }}>
              <Check size={15} aria-hidden /> Copiado
            </m.span>
          </m.div>
        </m.div>
      </div>
    </div>
  );
}
