"use client";

// Visual "Monocromo": vidro fosco em cinza claro com peças pretas. Menu lateral
// com texto, linha do tempo das campanhas, card de tendência, prévia do melhor
// criativo em preto, lista de relatórios e o bloco da equipe por plataforma.

import { CreativeImage, isVideoFormat } from "../widgets/CreativeImage";
import {
  BarChart3,
  Bell,
  CalendarDays,
  Clock,
  FileText,
  Folder,
  Home,
  LayoutGrid,
  Mail,
  MessageCircle,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  TrendingUp,
  Users,
  Video,
} from "lucide-react";
import { useMemo, useState, type ComponentType } from "react";
import { PAGES } from "@/features/templates/pages";
import { ChartTheme, dayDates, FlowLines, PatternBars, SkinBar, SkinChrome, SkinPage, Spark, type SkinPalette } from "./bklit-blocks";
import { SkinGrid } from "./SkinGrid";
import {
  buckets,
  change,
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
  bg: "linear-gradient(135deg,#ececec 0%,#dcdcdc 50%,#e9e9e9 100%)",
  glass: "rgba(255,255,255,.55)",
  glassStrong: "rgba(255,255,255,.82)",
  black: "#0d0d0d",
  fg: "#111",
  fg2: "#6d6d6d",
  line: "rgba(0,0,0,.12)",
};

// cores dos gráficos (Bklit UI): preto sobre o vidro claro, branco sobre o painel preto
const CHART: SkinPalette = { scheme: "light", bg: "#ffffff", card: "#ffffff", fg: C.fg, fg2: C.fg2, line: "#d9d9d9", accent: "#111111", accentSoft: "#e6e6e6", onAccent: "#ffffff", muted: "#9b9b9b", error: "#b3261e", errorSoft: "#f6dcd6", good: "#111111" };
const CHART_DARK: SkinPalette = { ...CHART, scheme: "dark", bg: "#1c1c1c", card: "#0d0d0d", fg: "#ffffff", fg2: "rgb(255 255 255 / 0.7)", line: "rgb(255 255 255 / 0.2)", accent: "#ffffff", onAccent: "#0d0d0d" };

const ICONS: ComponentType<{ size?: number }>[] = [
  Home,
  CalendarDays,
  Users,
  TrendingUp,
  BarChart3,
  Folder,
  Settings2,
  LayoutGrid,
];
type Scale = "Dia" | "Semana" | "Mês" | "Ano";

export function MonocromoSkin({
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
  const campaigns = useMemo(
    () => [...ctx.ds.campaigns].sort((a, b) => b.spend - a.spend).slice(0, 5),
    [ctx.ds.campaigns],
  );
  const creative = useMemo(
    () =>
      [...ctx.ds.creatives].sort((a, b) => b.conversions - a.conversions)[0],
    [ctx.ds.creatives],
  );
  const [scale, setScale] = useState<Scale>("Semana");
  const cols =
    scale === "Dia" ? 8 : scale === "Semana" ? 8 : scale === "Mês" ? 6 : 4;
  const axis = Array.from({ length: cols }, (_, i) => {
    const ago = Math.round(((cols - 1 - i) / (cols - 1)) * (days.length - 1));
    return scale === "Dia" ? `${8 + i * 2}h` : dayLabel(ago, ctx.today);
  });
  const conv = change(ctx, "conversions");
  const curLine = buckets(
    days.map((d) => d.conversions),
    12,
  );
  const prevLine = buckets(
    chrono(ctx.ds.previous).map((d) => d.conversions),
    12,
  );
  const lineStep = Math.max(1, Math.ceil(days.length / 12));
  const lineDates = dayDates(days.filter((_, i) => i % lineStep === 0).map((d) => d.ago), ctx.today);
  const platforms = ctx.ds.adPlatforms;
  const platTotals = platforms.map((p) => {
    const cs = ctx.ds.campaigns.filter((c) => c.platform === p);
    return {
      id: p,
      spend: cs.reduce((a, c) => a + c.spend, 0),
      conv: cs.reduce((a, c) => a + c.conversions, 0),
      n: cs.length,
    };
  });
  const maxSpend = Math.max(1, ...platTotals.map((p) => p.spend));
  const bars = buckets(
    days.map((d) => d.clicks),
    5,
  );
  const reports = pages.map((p) => `${PAGES[p].name} · ${client}.pdf`);
  const alerts = ctx.ds.alerts.length;
  const ctrSpark = buckets(
    days.map((d) => d.clicks / Math.max(1, d.impressions)),
    10,
  );

  return (
    // na tela do dashboard (screen) não há moldura de fora: o painel vai de ponta a ponta e ocupa a altura da tela
    <div
      className={`@container relative overflow-hidden ${screen ? "" : "rounded-[32px] p-3 @[700px]:p-8"}`}
      style={{ background: C.bg, color: C.fg }}
    >
      <Blob className="pointer-events-none absolute -top-24 left-1/2 h-[300px] w-[380px] -translate-x-1/2 opacity-60 blur-[2px]" />
      <div
        className={`relative backdrop-blur-xl ${screen ? "min-h-dvh px-3 pt-3 pb-[var(--screen-pb,7rem)] @[700px]:px-4" : "rounded-[30px] border border-white/70 p-3 @[700px]:p-4"}`}
        style={{ background: "rgba(255,255,255,.35)" }}
      >
        <SkinBar palette={CHART} bar={bar} className="mb-3 px-1" />
        <div className="flex gap-4">
          {/* menu lateral */}
          <aside
            className="hidden w-[150px] shrink-0 flex-col rounded-[24px] border border-white/80 p-4 @[860px]:flex"
            style={{ background: C.glassStrong }}
          >
            <p className="flex items-center gap-1.5 text-[14px] font-bold">
              <span className="text-[20px] leading-none font-black">
                {initials(client).slice(0, 1)}
              </span>
              {client}
            </p>
            <nav className="mt-14 space-y-1.5">
              {pages.map((p, i) => {
                const Icon = ICONS[i % ICONS.length];
                const on = p === active;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onPage?.(p)}
                    className="flex w-full items-center gap-2.5 rounded-full px-3 py-2.5 text-left text-[11.5px]"
                    style={
                      on ? { background: C.black, color: "#fff" } : undefined
                    }
                  >
                    <Icon size={15} />
                    <span className="truncate">{PAGES[p].name}</span>
                  </button>
                );
              })}
            </nav>
            <div className="mt-auto pt-8 text-center">
              <span
                className="mx-auto grid size-14 place-items-center rounded-full text-[15px] font-bold text-white"
                style={{
                  background: "linear-gradient(135deg,#3a1d3f,#c25a8a)",
                }}
              >
                {initials(client)}
              </span>
              <p className="mt-2 text-[11.5px]">{client}</p>
              <SlidersHorizontal
                size={13}
                className="mx-auto mt-1 opacity-60"
              />
            </div>
          </aside>

          <div className="min-w-0 flex-1 space-y-4">
            {/* topo */}
            <div className="flex flex-wrap items-center gap-2">
              <Chip dark icon={<Video size={15} />}>
                Relatório
              </Chip>
              <span
                className="flex h-11 items-center gap-2 rounded-full border border-white/80 px-4 text-[11px]"
                style={{ background: C.glassStrong }}
              >
                <Clock size={14} />
                <span className="leading-tight">
                  {dayLabel(0, ctx.today)}
                  <br />
                  <span className="text-[10px]" style={{ color: C.fg2 }}>
                    {periodLabel}
                  </span>
                </span>
              </span>
              <span
                className="flex h-11 min-w-[200px] flex-1 items-center gap-3 rounded-full border border-white/80 pr-4 text-[11.5px]"
                style={{ background: C.glassStrong, color: C.fg2 }}
              >
                <span
                  className="grid size-11 place-items-center rounded-full text-white"
                  style={{ background: C.black }}
                >
                  <Search size={15} />
                </span>
                {name}
              </span>
              <span
                className="grid size-11 place-items-center rounded-full text-white"
                style={{ background: C.black }}
              >
                <Bell size={16} />
              </span>
              <span
                className="relative grid size-11 place-items-center rounded-full border border-white/80"
                style={{ background: C.glassStrong }}
              >
                <Mail size={16} />
                {alerts > 0 && (
                  <span
                    className="absolute -top-1 -right-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white"
                    style={{ background: C.black }}
                  >
                    +{alerts}
                  </span>
                )}
              </span>
            </div>

            <SkinChrome palette={CHART} controls={controls} note={note} screen={screen} className="mt-4" />

            {children ? <SkinPage palette={CHART} className="mt-5">{children}</SkinPage> : (
            <SkinGrid
              skin="monocromo"
              ctx={ctx}
              grid={grid}
              // nada em branco: sem anúncio no período, o melhor criativo sai
              hide={creative ? [] : ["s-criativo"]}
              nodes={{
                "s-gantt": (
                  <section className="min-w-0">
                    <h2 className="text-[34px] leading-none font-medium tracking-[-0.03em]">
                      Gestão
                    </h2>
                    <div
                      className="mt-5 flex flex-wrap items-center justify-between gap-2 border-b pb-2"
                      style={{ borderColor: C.line }}
                    >
                      <span className="flex items-center gap-2 text-[11px] font-medium uppercase">
                        <CalendarDays size={14} />{" "}
                        {dayLabel(days.length - 1, ctx.today)} →{" "}
                        {dayLabel(0, ctx.today)}
                      </span>
                      <span className="flex gap-1 text-[11px]">
                        {(["Dia", "Semana", "Mês", "Ano"] as Scale[]).map(
                          (s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setScale(s)}
                              className="rounded-full px-3 py-1"
                              style={
                                s === scale
                                  ? {
                                      background: "#fff",
                                      boxShadow: "0 1px 4px rgba(0,0,0,.08)",
                                    }
                                  : { color: C.fg2 }
                              }
                            >
                              {s}
                            </button>
                          ),
                        )}
                      </span>
                    </div>
                    <div className="relative mt-3">
                      <div
                        className="pointer-events-none absolute inset-y-0 right-0 left-[96px] grid"
                        style={{ gridTemplateColumns: `repeat(${cols},1fr)` }}
                      >
                        {axis.map((a) => (
                          <span
                            key={a}
                            className="border-l border-dotted"
                            style={{ borderColor: C.line }}
                          />
                        ))}
                      </div>
                      <ul className="relative space-y-3.5">
                        {campaigns.map((c, i) => {
                          const start =
                            ((i * 17 + c.name.length * 7) % 45) / 100;
                          const len =
                            0.22 +
                            (c.spend / Math.max(1, campaigns[0].spend)) * 0.32;
                          return (
                            <li key={c.id} className="flex items-center gap-2">
                              <span className="w-[88px] shrink-0 truncate text-[10.5px]">
                                {c.name}
                              </span>
                              <div className="relative h-7 flex-1">
                                <span
                                  className="absolute inset-y-0 flex items-center justify-between gap-2 rounded-full pr-1 pl-3 text-[10px] text-white"
                                  style={{
                                    left: `${start * 100}%`,
                                    width: `${Math.min(1 - start, len) * 100}%`,
                                    background: C.black,
                                  }}
                                >
                                  <span className="truncate">
                                    {money(ctx, c.spend, true)}
                                  </span>
                                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white text-[8px] font-bold text-black">
                                    {platformName(c.platform).slice(0, 1)}
                                  </span>
                                </span>
                                {i % 2 === 0 && (
                                  <span
                                    className="absolute top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full border border-dashed"
                                    style={{
                                      left: `calc(${Math.min(0.94, start + len) * 100}% + 6px)`,
                                      borderColor: C.fg2,
                                    }}
                                  >
                                    <Plus size={11} />
                                  </span>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                      <div
                        className="mt-4 ml-[96px] flex justify-between text-[9.5px]"
                        style={{ color: C.fg2 }}
                      >
                        {axis.map((a) => (
                          <span key={a}>{a}</span>
                        ))}
                      </div>
                    </div>
                  </section>
                ),
                "s-tendencia": (
                  <section
                    className="rounded-[24px] border border-white/80 p-4"
                    style={{ background: C.glassStrong }}
                  >
                    <header className="flex items-start justify-between">
                      <h3 className="text-[14px] font-medium">
                        Campanhas em andamento
                      </h3>
                      <LayoutGrid size={15} />
                    </header>
                    <p className="mt-3 text-[11px]" style={{ color: C.fg2 }}>
                      {label(ctx, "conversions")}
                    </p>
                    <p className="text-[26px] leading-tight font-medium tnum">
                      {conv.up ? "+" : "−"}
                      {conv.text}
                    </p>
                    <p className="text-[10.5px]" style={{ color: C.fg2 }}>
                      Contra o período anterior
                    </p>
                    <ChartTheme palette={CHART} className="mt-3 flex min-h-[80px] flex-1 flex-col">
                      <FlowLines
                        className="flex-1"
                        wavy
                        points={curLine.map((v, i) => ({ atual: v, anterior: prevLine[i] ?? 0 }))}
                        dates={lineDates}
                        series={[
                          { key: "anterior", label: "Período anterior", color: "#9b9b9b", width: 1 },
                          { key: "atual", label: label(ctx, "conversions"), color: "#111111", width: 1.4 },
                        ]}
                        format={(_, v) => int(v)}
                        pin={{ index: Math.floor(curLine.length * 0.55), key: "atual", color: "#ffffff", ring: "#111111", r: 3.5 }}
                        summary={`${label(ctx, "conversions")} no período contra o anterior: ${conv.up ? "+" : "−"}${conv.text}.`}
                      />
                    </ChartTheme>
                    <ul className="mt-3 space-y-2 text-[10.5px]">
                      {(
                        [
                          "spend",
                          // receita só nos objetivos de venda (pelo objetivo do modelo, não pelos números)
                          goalOf(ctx.profile, ctx.cur.leads).sales ? "revenue" : "ctr",
                          goalOf(ctx.profile, ctx.cur.leads).cost,
                        ] as const
                      ).map((id) => (
                        <li
                          key={id}
                          className="flex items-center justify-between"
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className="size-1.5 rounded-full"
                              style={{ background: C.black }}
                            />
                            {label(ctx, id)}
                          </span>
                          <span className="tnum">{value(ctx, id)}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ),
                "s-criativo": (
                  <section
                    className="flex flex-col rounded-[24px] p-4 text-white"
                    style={{ background: C.black }}
                  >
                    <h3 className="flex items-center gap-2 text-[13px]">
                      <FileText size={14} /> Melhor criativo
                    </h3>
                    {/* dados reais: a imagem do anúncio; amostra ou sem imagem: a forma decorativa */}
                    <CreativeImage
                      src={creative?.imageUrl}
                      video={isVideoFormat(creative?.format)}
                      className="mx-auto my-3 h-[150px] w-full rounded-[16px]"
                      fallback={<Blob className="h-full w-full" dark />}
                    />
                    <p className="truncate text-[12px]">
                      {creative?.name ?? "—"}
                    </p>
                    <p className="text-[10px] text-white/60">
                      {creative
                        ? `${creative.format} · ${int(creative.impressions)} impressões · ${int(creative.conversions)} ${label(ctx, "conversions").toLowerCase()}`
                        : ""}
                    </p>
                    <div className="mt-3 flex items-center gap-2 border-t border-white/20 pt-3 text-[11.5px]">
                      <span className="grid size-8 place-items-center rounded-full bg-white text-[10px] font-bold text-black">
                        {creative
                          ? platformName(creative.platform).slice(0, 2)
                          : "·"}
                      </span>
                      {creative ? platformName(creative.platform) : ""}
                    </div>
                  </section>
                ),
                "s-relatorios": (
                  <section
                    className="rounded-[24px] border border-white/80 p-4"
                    style={{ background: C.glassStrong }}
                  >
                    <header className="flex items-center gap-2">
                      <span
                        className="grid size-11 place-items-center rounded-full text-white"
                        style={{ background: C.black }}
                      >
                        <Folder size={16} />
                      </span>
                      <span className="text-[11px]">Todos os relatórios</span>
                      <LayoutGrid size={14} className="ml-auto" />
                    </header>
                    <ul className="mt-4 space-y-2">
                      {reports.slice(0, 4).map((r, i) => (
                        <li key={r}>
                          <button
                            type="button"
                            onClick={() => onPage?.(pages[i])}
                            className="flex w-full items-center gap-3 rounded-[16px] border px-3 py-2.5 text-left text-[10.5px]"
                            style={{ borderColor: "rgba(0,0,0,.55)" }}
                          >
                            <FileText size={15} className="shrink-0" />
                            <span className="truncate">{r}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ),
                "s-canais": (
                  <section
                    className="rounded-[24px] border border-white/80 p-4"
                    style={{ background: C.glass }}
                  >
                    <header className="flex flex-wrap items-center gap-x-6 gap-y-3">
                      <h3 className="flex items-center gap-2 text-[24px] font-medium tracking-tight">
                        Canais
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] text-white"
                          style={{ background: C.black }}
                        >
                          +{platforms.length}
                        </span>
                      </h3>
                      <Stat
                        icon={<Users size={13} />}
                        title="Impressões"
                        v={int(ctx.cur.impressions)}
                        d={signed(ctx.cur.impressions - ctx.prev.impressions)}
                      />
                      <Stat
                        icon={<Users size={13} />}
                        title="Cliques"
                        v={int(ctx.cur.clicks)}
                        d={signed(ctx.cur.clicks - ctx.prev.clicks)}
                      />
                      <span className="flex items-center gap-2 text-[10px]">
                        <span
                          className="grid size-7 place-items-center rounded-full border"
                          style={{ borderColor: C.line }}
                        >
                          <TrendingUp size={13} />
                        </span>
                        <span>
                          CTR
                          <br />
                          <span className="text-[13px] tnum">
                            {pct(ctx.cur.ctr)}
                          </span>
                        </span>
                        <span className="block h-6 w-[90px]" aria-hidden>
                          <Spark values={ctrSpark} color="#111111" variant="line" strokeWidth={1} endDot={false} className="h-full" />
                        </span>
                      </span>
                    </header>
                    <div
                      className="relative mt-4 overflow-hidden rounded-[20px] p-4 text-white"
                      style={{ background: C.black }}
                    >
                      <Waves />
                      <div className="relative grid gap-5 @[640px]:grid-cols-3">
                        {platTotals.slice(0, 2).map((p, i) => (
                          <div key={p.id}>
                            <p className="text-[13px] font-medium">
                              {platformName(p.id)}
                            </p>
                            <p className="text-[9.5px] text-white/60">
                              {p.n} campanhas · {money(ctx, p.spend, true)}
                            </p>
                            <div className="mt-4 flex -space-x-2">
                              {ctx.ds.campaigns
                                .filter((c) => c.platform === p.id)
                                .slice(0, 3)
                                .map((c) => (
                                  <span
                                    key={c.id}
                                    className="grid size-8 place-items-center rounded-full border-2 border-black text-[9px] font-bold"
                                    style={{
                                      background: [
                                        "#d9d9d9",
                                        "#9a9a9a",
                                        "#5e5e5e",
                                      ][i % 3],
                                      color: "#000",
                                    }}
                                  >
                                    {initials(c.name)}
                                  </span>
                                ))}
                            </div>
                            <p className="mt-6 flex justify-between text-[8.5px] tracking-wide uppercase">
                              <span>Participação</span>
                              <span>
                                {decimal(
                                  (p.spend / Math.max(1, ctx.cur.spend)) * 100,
                                  0,
                                )}
                                %
                              </span>
                            </p>
                            <div className="mt-1 h-[3px] rounded-full bg-white/20">
                              <div
                                className="h-full rounded-full bg-white"
                                style={{
                                  width: `${(p.spend / maxSpend) * 100}%`,
                                }}
                              />
                            </div>
                            <p className="mt-3 flex gap-4 text-[10px] text-white/80">
                              <span className="flex items-center gap-1">
                                <MessageCircle size={12} /> {int(p.conv)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users size={12} /> {p.n}
                              </span>
                            </p>
                          </div>
                        ))}
                        <div>
                          <p className="text-[13px] font-medium">
                            Cliques por semana
                          </p>
                          {/* barras em traços: o padrão vem de um <pattern> e a barra é da Bklit */}
                          <svg width="0" height="0" className="absolute" aria-hidden>
                            <defs>
                              <pattern id="mono-tracos" width="8" height="8" patternUnits="userSpaceOnUse">
                                <rect width="8" height="5" rx="1" fill="#ffffff" />
                              </pattern>
                            </defs>
                          </svg>
                          <ChartTheme palette={CHART_DARK} className="mt-3 flex h-[110px] flex-col">
                            <PatternBars
                              className="flex-1"
                              values={bars}
                              labels={bars.map((_, i) => `Semana ${i + 1}`)}
                              fill="url(#mono-tracos)"
                              what="Cliques"
                              format={int}
                              summary={`Cliques por semana: ${bars.map((b) => int(b)).join(", ")}.`}
                            />
                          </ChartTheme>
                        </div>
                      </div>
                    </div>
                  </section>
                ),
              }}
            />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const signed = (n: number) => `${n >= 0 ? "+" : ""}${int(n)}`;

function Chip({
  children,
  icon,
  dark,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <span
      className="flex h-11 items-center gap-2 rounded-full border border-white/80 pr-4 text-[11px]"
      style={{ background: C.glassStrong }}
    >
      <span
        className="grid size-11 place-items-center rounded-full"
        style={dark ? { background: C.black, color: "#fff" } : undefined}
      >
        {icon}
      </span>
      {children}
    </span>
  );
}

function Stat({
  icon,
  title,
  v,
  d,
}: {
  icon: React.ReactNode;
  title: string;
  v: string;
  d: string;
}) {
  return (
    <span className="flex items-center gap-2 text-[10px]">
      <span
        className="grid size-7 place-items-center rounded-full border"
        style={{ borderColor: C.line }}
      >
        {icon}
      </span>
      <span>
        {title}
        <br />
        <span className="flex items-center gap-2 text-[13px] tnum">
          {v}
          <span className="inline-block h-[3px] w-10 rounded-full bg-black" />
          <span className="text-[9.5px]">{d}</span>
        </span>
      </span>
    </span>
  );
}

function Waves() {
  return (
    <svg
      viewBox="0 0 400 200"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 size-full opacity-30"
      aria-hidden
    >
      {Array.from({ length: 14 }, (_, i) => (
        <path
          key={i}
          d={`M${120 + i * 8} 200 C ${180 + i * 6} 120, ${220 - i * 4} 80, ${300 + i * 6} 0`}
          stroke="#fff"
          strokeWidth="0.6"
          fill="none"
        />
      ))}
    </svg>
  );
}

/** Forma orgânica em degradê (a "gota" das referências), em SVG. */
function Blob({ className, dark }: { className?: string; dark?: boolean }) {
  return (
    <svg viewBox="0 0 200 160" className={className} aria-hidden>
      <defs>
        <radialGradient
          id={dark ? "mono-blob-d" : "mono-blob-l"}
          cx="40%"
          cy="35%"
          r="70%"
        >
          <stop offset="0" stopColor={dark ? "#ffffff" : "#ffffff"} />
          <stop offset="0.55" stopColor={dark ? "#9a9a9a" : "#d4d4d4"} />
          <stop offset="1" stopColor={dark ? "#1a1a1a" : "#bdbdbd"} />
        </radialGradient>
      </defs>
      {dark && (
        <circle
          cx="100"
          cy="80"
          r="70"
          fill="none"
          stroke="rgba(255,255,255,.25)"
          strokeDasharray="2 4"
        />
      )}
      <path
        d="M100 18 C140 16 176 46 170 86 C164 126 132 146 96 142 C58 138 28 114 32 78 C36 44 64 20 100 18 Z"
        fill={`url(#${dark ? "mono-blob-d" : "mono-blob-l"})`}
      />
      {dark && (
        <path
          d="M86 70 C96 50 116 50 122 70 C130 96 112 116 100 118 C84 118 76 92 86 70 Z"
          fill="rgba(255,255,255,.85)"
        />
      )}
    </svg>
  );
}
