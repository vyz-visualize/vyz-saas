"use client";

// Visual "Pulso": barra lateral roxa com ícones, card de visão geral com onda e
// marcador, dois blocos coloridos (roxo e rosa), cards de progresso com ícone
// flutuante e a coluna da direita com a lista e o mapa.

import { CreativeImage, isVideoFormat } from "../widgets/CreativeImage";
import {
  BarChart3,
  Bell,
  ChevronDown,
  ChevronRight,
  FileText,
  Home,
  LineChart,
  LogOut,
  Mail,
  MapPin,
  PlayCircle,
  Search,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useMemo, useState, type ComponentType } from "react";
import type { DayRow } from "@/features/metrics/source";
import { PAGES } from "@/features/templates/pages";
import { ChartTheme, dayDates, FlowLines, SkinBar, SkinChrome, SkinPage, Spark, type SkinPalette } from "./bklit-blocks";
import { SkinGrid } from "./SkinGrid";
import {
  buckets,
  chrono,
  dayLabel,
  decimal,
  goalOf,
  initials,
  int,
  label,
  money,
  pct,
  platformName,
  value,
  type SkinProps,
} from "./shared";

const C = {
  bg: "#c5cbe0",
  frame: "#ffffff",
  side: "#7464c0",
  purple: "linear-gradient(160deg,#6f5fbf 0%,#5b4ca8 100%)",
  purpleFlat: "#6a5bb8",
  pink: "linear-gradient(160deg,#f58fb2 0%,#ef6c97 100%)",
  pinkFlat: "#f0739c",
  fg: "#3a3566",
  fg2: "#9a98b4",
  green: "#2fbf5a",
};

// cores dos gráficos (Bklit UI) sobre o roxo: tooltip escuro, texto branco
const CHART: SkinPalette = { scheme: "dark", bg: "#463b8a", card: "#5b4ca8", fg: "#ffffff", fg2: "rgb(255 255 255 / 0.75)", line: "rgb(255 255 255 / 0.25)", accent: "#f47aa2", accentSoft: "#fde4ec", onAccent: "#ffffff", muted: "rgb(255 255 255 / 0.3)", error: "#ffd0c8", errorSoft: "#5a2a3a", good: "#8ff0b0" };

// controles e outras abas: os componentes padrão em roxo, sobre o branco da moldura
const PAGE: SkinPalette = { scheme: "light", bg: "#ffffff", card: "#f6f5fb", fg: "#3a3566", fg2: "#8f8cab", line: "#e7e4f2", accent: "#6a5bb8", accentSoft: "#e6e2f6", onAccent: "#ffffff", muted: "#cfcbe6", error: "#d8366f", errorSoft: "#fde4ec", good: "#2fbf5a" };

const ICONS: ComponentType<{ size?: number }>[] = [
  Home,
  FileText,
  BarChart3,
  LineChart,
  PlayCircle,
  Target,
  Users,
  Zap,
];
const CARD_ICONS: ComponentType<{ size?: number; strokeWidth?: number }>[] = [
  Target,
  TrendingUp,
  Zap,
];

export function PulsoSkin({
  ctx,
  name,
  client,
  pages,
  active,
  onPage,
  periodLabel,
  grid,
  controls,
  note,
  children,
  screen,
  bar,
}: SkinProps) {
  const days = chrono(ctx.ds.current);
  // vendas, leads, agendamentos...: pelo objetivo do modelo
  const { sales, conv, cost } = goalOf(ctx.profile, ctx.cur.leads);
  const result = (d: DayRow) => d[conv];
  const [mode, setMode] = useState<"dia" | "semana">("semana");
  const points =
    mode === "dia"
      ? days.slice(-10).map(result)
      : buckets(
          days.map(result),
          10,
        );
  const labels =
    mode === "dia"
      ? days.slice(-10).map((d) => dayLabel(d.ago, ctx.today))
      : points.map((_, i) => `S${i + 1}`);
  // período anterior, no mesmo agrupamento (a linha clara atrás)
  const before = chrono(ctx.ds.previous);
  const prevPoints =
    mode === "dia"
      ? before.slice(-10).map(result)
      : buckets(
          before.map(result),
          10,
        );
  const size = Math.max(1, Math.ceil(days.length / 10));
  const pointDays = mode === "dia" ? days.slice(-10) : days.filter((_, i) => i % size === 0);
  const pointDates = dayDates(pointDays.map((d) => d.ago), ctx.today);
  const peak = points.indexOf(Math.max(...points));
  const [hover, setHover] = useState<number | null>(null);
  const mark = hover ?? peak;
  const campaigns = useMemo(
    () => [...ctx.ds.campaigns].sort((a, b) => b.conversions - a.conversions),
    [ctx.ds.campaigns],
  );
  const best = campaigns[0];
  const { budget } = ctx.ds;
  const left = Math.max(0, budget.daysInMonth - budget.day);
  const creatives = useMemo(
    () => [...ctx.ds.creatives].sort((a, b) => b.conversions - a.conversions),
    [ctx.ds.creatives],
  );
  const [crTab, setCrTab] = useState<"todos" | "video">("todos");
  const crList = (
    crTab === "todos"
      ? creatives
      : creatives.filter((c) => /v[íi]deo|reels/i.test(c.format))
  ).slice(0, 5);
  const costSeries = buckets(
    days.map((d) => d.spend),
    8,
  ).map(
    (s, i) =>
      s /
      Math.max(
        1,
        buckets(
          days.map(result),
          8,
        )[i],
      ),
  );
  const target = Math.round(ctx.cur[conv] * 1.08);

  const progCard = (k: number) => {
    const c = campaigns[k];
    if (!c) return null;
    const Icon = CARD_ICONS[k % CARD_ICONS.length];
    const goal = Math.max(
      c.conversions,
      Math.round(c.conversions / (0.45 + ((k * 0.23) % 0.5)) || 1),
    );
    const share = Math.min(1, c.conversions / Math.max(1, goal));
    // o ícone flutua acima do card: o espaço dele fica dentro do bloco da grade
    return (
      <div className="flex flex-col pt-7">
        <section
          className="relative flex flex-1 flex-col rounded-[22px] px-4 pt-11 pb-4 shadow-[0_10px_30px_rgba(60,50,120,.08)]"
          style={{ background: "#fff" }}
        >
          <span
            className="absolute -top-7 left-1/2 grid size-[58px] -translate-x-1/2 place-items-center rounded-[16px] text-white"
            style={{ background: C.purpleFlat }}
          >
            <Icon size={26} strokeWidth={1.8} />
          </span>
          <span
            className="absolute top-3 right-4 text-[16px] leading-none"
            style={{ color: C.fg2 }}
          >
            ⋮
          </span>
          <p className="truncate text-center text-[15px] font-bold">{c.name}</p>
          <p className="text-center text-[11px]" style={{ color: C.fg2 }}>
            {platformName(c.platform)} · {money(ctx, c.spend, true)}
          </p>
          {/* o progresso fica na base do card: sobra de altura vira respiro no meio, não um vazio embaixo */}
          <p className="mt-auto flex justify-between pt-4 text-[11.5px] font-semibold">
            <span>Progresso</span>
            <span>{Math.round(share * 100)}%</span>
          </p>
          <div
            className="mt-1.5 h-[7px] rounded-full"
            style={{ background: "#ececf3" }}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${share * 100}%`, background: C.green }}
            />
          </div>
          <p
            className="mt-3 flex items-center justify-between text-[10.5px]"
            style={{ color: C.fg2 }}
          >
            <span className="tnum">
              {int(c.conversions)} / {int(goal)}
            </span>
            <span
              className="rounded-full px-3 py-1 font-semibold"
              style={{ background: "#fde4ec", color: C.pinkFlat }}
            >
              {left} dias restantes
            </span>
          </p>
        </section>
      </div>
    );
  };

  return (
    // na tela do dashboard (screen) não há moldura de fora: o painel vai de ponta a ponta e ocupa a altura da tela
    <div
      className={screen ? "@container flex min-h-dvh flex-col" : "@container rounded-[32px] p-3 @[700px]:p-8"}
      style={{ background: screen ? C.frame : C.bg, color: C.fg }}
    >
      <SkinBar palette={PAGE} bar={bar} className="px-4 pt-3 @[700px]:px-5" />
      <div
        className={`grid overflow-hidden ${screen ? "flex-1" : "rounded-[28px]"} ${children ? "" : "@[1000px]:grid-cols-[minmax(0,1fr)_260px]"}`}
        style={{ background: C.frame }}
      >
        <div className={`flex gap-5 p-4 @[700px]:p-5 ${screen ? "pb-[var(--screen-pb,7rem)] @[700px]:pb-[var(--screen-pb,7rem)]" : ""}`}>
          {/* barra lateral */}
          <aside
            className="sticky top-4 hidden max-h-[calc(100dvh-2rem)] w-[76px] shrink-0 flex-col items-center gap-3 self-start rounded-[26px] py-5 text-white @[700px]:flex"
            style={{ background: C.side }}
          >
            <span className="grid size-11 place-items-center rounded-[14px] border border-white/30">
              <Bell size={18} />
            </span>
            <span className="h-px w-10 shrink-0 bg-white/20" />
            {/* uma aba por página: com muitas, a lista rola dentro da barra (que nunca passa da altura da tela) */}
            <nav aria-label="Páginas" data-tour="abas" className="flex min-h-0 w-full flex-1 flex-col items-center gap-3 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {pages.map((p, i) => {
              const Icon = ICONS[i % ICONS.length];
              return (
                <button
                  key={p}
                  type="button"
                  title={PAGES[p].name}
                  aria-label={PAGES[p].name}
                  onClick={() => onPage?.(p)}
                  aria-current={p === active ? "page" : undefined}
                  className="grid size-11 shrink-0 place-items-center rounded-[14px] transition-colors"
                  style={
                    p === active
                      ? {
                          background: "#5a4ca5",
                          boxShadow: "inset 0 0 0 1px rgba(255,255,255,.25)",
                        }
                      : undefined
                  }
                >
                  <Icon size={19} />
                </button>
              );
            })}
            </nav>
            <span className="mt-auto grid size-11 shrink-0 place-items-center rounded-[14px]">
              <LogOut size={19} />
            </span>
          </aside>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[12px]" style={{ color: C.fg2 }}>
                  {client}
                </p>
                <h2 className="truncate text-[20px] font-bold">{name}</h2>
              </div>
              {/* sem os controles (galeria, PDF), o período aparece só como etiqueta */}
              {!controls && (
              <span
                className="hidden h-10 w-[180px] items-center gap-2 rounded-[12px] px-3 text-[12px] @[640px]:flex"
                style={{ background: "#f0f1f6", color: C.fg2 }}
              >
                <Search size={15} /> {periodLabel}
              </span>
              )}
              <span
                className="grid size-10 place-items-center rounded-full text-[12px] font-bold text-white"
                style={{ background: C.purpleFlat }}
              >
                {initials(client)}
              </span>
            </div>

            <SkinChrome palette={PAGE} controls={controls} note={note} screen={screen} className="mt-4" />

            <div className="mt-5">
              {children ? <SkinPage palette={PAGE}>{children}</SkinPage> : (
              <SkinGrid
                skin="pulso"
                palette={PAGE}
                ctx={ctx}
                grid={grid}
                // nada em branco: com menos de 3 campanhas no período, os cards que sobrariam vazios saem
                hide={[0, 1, 2].filter((k) => !campaigns[k]).map((k) => `s-prog${k + 1}`)}
                nodes={{
                  "s-visao": (
                    <section
                      className="relative overflow-hidden rounded-[24px] text-white"
                      style={{ background: C.purple }}
                    >
                      <div className="flex items-center justify-between px-5 pt-5">
                        <h3 className="text-[15px] font-semibold">
                          Visão geral
                        </h3>
                        <button
                          type="button"
                          onClick={() =>
                            setMode(mode === "dia" ? "semana" : "dia")
                          }
                          className="flex items-center gap-1.5 rounded-[10px] border border-white/40 px-3 py-1.5 text-[11px]"
                        >
                          {mode === "dia" ? "Diário" : "Semanal"}{" "}
                          <ChevronDown size={13} />
                        </button>
                      </div>
                      <ChartTheme palette={CHART} className="mt-2 flex h-[150px] min-h-0 flex-col">
                        <FlowLines
                          className="flex-1"
                          wavy
                          points={points.map((v, i) => ({ atual: v, anterior: prevPoints[i] ?? 0 }))}
                          dates={pointDates}
                          series={[
                            { key: "anterior", label: "Período anterior", color: "rgb(255 255 255 / 0.28)", width: 2 },
                            { key: "atual", label: label(ctx, conv), color: "#f47aa2", width: 3, area: 0.16 },
                          ]}
                          format={(_, v) => int(v)}
                          pin={{ index: peak, key: "atual", color: "#f47aa2", ring: "#ffffff", column: true, caption: { value: int(points[peak] ?? 0), label: label(ctx, conv), bg: "#463b8a", fg: "#ffffff" } }}
                          onHover={setHover}
                          summary={`${label(ctx, conv)} por ${mode === "dia" ? "dia" : "semana"}: pico de ${int(points[peak] ?? 0)}.`}
                        />
                      </ChartTheme>
                      <div className="flex justify-between px-5 pb-1 text-[10.5px] text-white/70">
                        {labels.map((l, i) => (
                          <span
                            key={i}
                            className={
                              i === mark
                                ? "rounded-full bg-white px-2 font-semibold text-[#5b4ca8]"
                                : ""
                            }
                          >
                            {l}
                          </span>
                        ))}
                      </div>
                      <div className="relative mt-3 grid grid-cols-3 items-end text-center">
                        <div className="pb-5">
                          <p className="text-[10.5px] text-white/70">
                            Investimento
                          </p>
                          <p className="text-[22px] leading-tight font-semibold tnum">
                            {money(ctx, ctx.cur.spend, true)}
                          </p>
                          <p className="text-[11px] text-white/70">
                            {periodLabel}
                          </p>
                        </div>
                        <div className="mx-1 rounded-t-[22px] border border-b-0 border-white/20 bg-white/12 px-2 pt-4 pb-5">
                          <p className="text-[10.5px] text-white/70">
                            Total de {label(ctx, conv).toLowerCase()}
                          </p>
                          <p className="text-[24px] leading-tight font-bold tnum">
                            {int(ctx.cur[conv])}
                          </p>
                          <p className="text-[11px] text-white/70">
                            {days.length} dias
                          </p>
                        </div>
                        {sales ? (
                          // objetivo de venda: a receita e o ROAS no lugar do alvo
                          <div className="pb-5">
                            <p className="text-[10.5px] text-white/70">{label(ctx, "revenue")}</p>
                            <p className="text-[22px] leading-tight font-semibold tnum">
                              {value(ctx, "revenue")}
                            </p>
                            <p className="text-[11px] text-white/70">
                              {label(ctx, "roas")} {value(ctx, "roas")}
                            </p>
                          </div>
                        ) : (
                          <div className="pb-5">
                            <p className="text-[10.5px] text-white/70">Alvo</p>
                            <p className="text-[22px] leading-tight font-semibold tnum">
                              {int(target)}
                            </p>
                            <p className="text-[11px] text-white/70">
                              +8% do atual
                            </p>
                          </div>
                        )}
                      </div>
                    </section>
                  ),
                  "s-melhor": (
                    <section
                      className="flex items-center gap-4 rounded-[22px] p-4 text-white"
                      style={{ background: C.purple }}
                    >
                      <span className="grid size-[60px] shrink-0 place-items-center rounded-[16px] border border-white/25 bg-white/15">
                        <Zap size={26} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] text-white/70">
                          Melhor campanha
                        </p>
                        <p className="truncate text-[16px] font-semibold">
                          {best?.name ?? "—"}
                        </p>
                      </div>
                    </section>
                  ),
                  "s-custo": (
                    <section
                      className="relative overflow-hidden rounded-[22px] text-white"
                      style={{ background: C.pink }}
                    >
                      <div
                        className="flex items-center gap-4 rounded-[22px] p-4"
                        style={{ background: "rgba(255,255,255,.12)" }}
                      >
                        <span className="grid size-[60px] shrink-0 place-items-center rounded-[16px] border border-white/30 bg-white/15">
                          <TrendingUp size={26} />
                        </span>
                        <p className="text-[16px] font-semibold">
                          {label(ctx, cost)}
                        </p>
                      </div>
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[90px] opacity-40" aria-hidden>
                        <Spark values={costSeries} color="#ffffff" variant="solid" strokeWidth={0} endDot={false} className="h-full" />
                      </div>
                      <div className="relative flex items-end justify-between p-4 pt-2">
                        <div>
                          <p className="text-[11px] text-white/80">Período</p>
                          <p className="text-[26px] leading-tight font-bold tnum">
                            {value(ctx, cost)}
                          </p>
                          <p className="text-[11px] text-white/80">
                            {periodLabel}
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-label="Ver campanhas"
                          onClick={() =>
                            onPage?.(pages.find((p) => p !== active) ?? active)
                          }
                          className="grid size-9 place-items-center rounded-full border-2 border-white/80"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </section>
                  ),
                  "s-prog1": progCard(0),
                  "s-prog2": progCard(1),
                  "s-prog3": progCard(2),
                }}
              />
              )}
            </div>
          </div>
        </div>

        {/* coluna da direita: só na primeira aba (as outras usam a largura toda) */}
        {!children && (
        <aside
          // na tela do dashboard a coluna da direita não dita a altura: acompanha a dos blocos e rola dentro
          className={`border-t p-5 @[1000px]:border-t-0 @[1000px]:border-l ${screen ? "@[1000px]:overflow-y-auto @[1000px]:[contain:size] @[1000px]:[scrollbar-width:thin]" : ""}`}
          style={{ borderColor: "#eceef4" }}
        >
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[15px] font-bold">
              <Users size={17} style={{ color: C.purpleFlat }} /> Criativos
            </h3>
            <button
              type="button"
              onClick={() =>
                pages.includes("criativos") && onPage?.("criativos")
              }
              className="text-[11px] font-semibold"
              style={{ color: C.purpleFlat }}
            >
              Ver todos
            </button>
          </div>
          <div
            className="mt-4 grid grid-cols-2 rounded-[14px] p-1 text-[12px]"
            style={{ background: "#eef0f5" }}
          >
            {(["todos", "video"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setCrTab(t)}
                className="rounded-[10px] py-2 font-semibold"
                style={
                  t === crTab
                    ? { background: C.purpleFlat, color: "#fff" }
                    : { color: C.fg2 }
                }
              >
                {t === "todos" ? "Ativos" : "Vídeos"}
              </button>
            ))}
          </div>
          <ul className="mt-4 space-y-4">
            {crList.length === 0 && (
              <li className="text-[12px]" style={{ color: C.fg2 }}>
                Nenhum vídeo no período.
              </li>
            )}
            {crList.map((c, i) => (
              <li key={c.id} className="flex items-center gap-3">
                {/* dados reais: a imagem do anúncio; amostra ou sem imagem: as iniciais */}
                <CreativeImage
                  src={c.imageUrl}
                  video={isVideoFormat(c.format)}
                  compact
                  className="size-10 shrink-0 rounded-full"
                  fallback={
                    <span
                      className="grid size-full place-items-center text-[11px] font-bold text-white"
                      style={{
                        background: [
                          "#4fb3e8",
                          "#c98a4b",
                          "#9aa3b5",
                          "#e2475b",
                          "#56606e",
                        ][i % 5],
                      }}
                    >
                      {initials(c.name)}
                    </span>
                  }
                />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[12.5px] font-bold">
                    {c.name}
                  </span>
                  <span
                    className="block text-[10.5px]"
                    style={{ color: C.fg2 }}
                  >
                    {c.format} · {platformName(c.platform)}
                  </span>
                  <span className="block text-[10px]" style={{ color: C.fg2 }}>
                    {int(c.conversions)}{" "}
                    {label(ctx, "conversions").toLowerCase()}
                  </span>
                </span>
                <Mail size={16} style={{ color: C.fg }} />
              </li>
            ))}
          </ul>

          <div
            className="mt-6 border-t pt-5"
            style={{ borderColor: "#eceef4" }}
          >
            <h3 className="flex items-center justify-between text-[15px] font-bold">
              <span className="flex items-center gap-2">
                <MapPin size={17} style={{ color: C.purpleFlat }} /> Público
              </span>
              <span
                className="text-[11px] font-semibold"
                style={{ color: C.purpleFlat }}
              >
                {pct(ctx.cur.ctr)} CTR
              </span>
            </h3>
            <MapArt rows={ctx.ds.audience.slice(0, 3)} />
            <ul className="mt-3 space-y-1 text-[11px]" style={{ color: C.fg2 }}>
              {ctx.ds.audience.slice(0, 3).map((a) => (
                <li key={a.label} className="flex justify-between">
                  <span>{a.label}</span>
                  <span className="font-semibold tnum" style={{ color: C.fg }}>
                    {decimal(a.share * 100, 0)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
        )}
      </div>
    </div>
  );
}

/** Mapa estilizado (ruas) com pinos para os maiores públicos. */
function MapArt({ rows }: { rows: { label: string; share: number }[] }) {
  const pins: [number, number][] = [
    [62, 30],
    [28, 62],
    [78, 70],
  ];
  return (
    <div
      className="relative mt-3 h-[120px] overflow-hidden rounded-[14px]"
      style={{ background: "#eef0f3" }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full"
        aria-hidden
      >
        {[
          "M0 20 L100 35",
          "M0 55 L100 48",
          "M0 85 L100 78",
          "M20 0 L30 100",
          "M55 0 L48 100",
          "M80 0 L88 100",
          "M0 0 L100 100",
        ].map((p) => (
          <path
            key={p}
            d={p}
            stroke="#fff"
            strokeWidth="3"
            fill="none"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <rect x="58" y="52" width="14" height="10" fill="#dfe3e8" />
        <rect x="8" y="30" width="10" height="16" fill="#dfe3e8" />
      </svg>
      {rows.map((r, i) => (
        <span
          key={r.label}
          title={r.label}
          className="absolute grid size-7 -translate-x-1/2 -translate-y-full place-items-center rounded-full rounded-br-none border-2 border-white text-[9px] font-bold text-white shadow"
          style={{
            left: `${pins[i][0]}%`,
            top: `${pins[i][1]}%`,
            background: i === 0 ? "#f0642c" : "#5b4ca8",
            transform: "translate(-50%,-100%) rotate(45deg)",
          }}
        >
          <span style={{ transform: "rotate(-45deg)" }}>
            {decimal(r.share * 100, 0)}
          </span>
        </span>
      ))}
    </div>
  );
}
