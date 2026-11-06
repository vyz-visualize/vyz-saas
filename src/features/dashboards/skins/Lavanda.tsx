"use client";

// Visual "Lavanda": cards claros com gráfico em cima, barra de filtros e o
// painel escuro com a lista de campanhas e o detalhe da escolhida em lilás.

import { AlertCircle, ArrowDownRight, ArrowLeft, ArrowUpRight, Bell, CalendarDays, ChevronDown, Clock, FileText, Link2, Plus, Search, SlidersHorizontal, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import type { PlatformId } from "@/features/accounts/platforms";
import { PAGES } from "@/features/templates/pages";
import { buckets, change, chrono, dayLabel, decimal, fit, initials, int, label, money, platformName, value, type SkinProps } from "./shared";

const C = {
  bg: "#eef0f7",
  card: "#ffffff",
  line: "#e6e8f0",
  fg: "#16172b",
  fg2: "#8a8da3",
  accent: "#5b4ff0",
  accentSoft: "#c9c4fb",
  dark: "#1d1e2c",
  dark2: "#2a2b3c",
  panel: "linear-gradient(140deg,#5d55d8 0%,#6f63e6 55%,#5a4fd2 100%)",
};

type Tab = "todas" | PlatformId;

export function LavandaSkin({ ctx, name, client, pages, active, onPage, periodLabel }: SkinProps) {
  const campaigns = useMemo(() => [...ctx.ds.campaigns].sort((a, b) => b.spend - a.spend), [ctx.ds.campaigns]);
  const platforms = ctx.ds.adPlatforms;
  const [tab, setTab] = useState<Tab>("todas");
  const list = tab === "todas" ? campaigns : campaigns.filter((c) => c.platform === tab);
  const [picked, setPicked] = useState<string | null>(null);
  const sel = list.find((c) => c.id === picked) ?? list[0];
  const days = chrono(ctx.ds.current);
  const revenueBars = buckets(days.map((d) => d.revenue), 6);
  const roasLine = buckets(days.map((d) => d.revenue), 9).map((r, i) => r / Math.max(1, buckets(days.map((d) => d.spend), 9)[i]));
  const cpa = change(ctx, "cpa");
  const rev = change(ctx, "revenue");
  const roas = change(ctx, "roas");
  const byPlat = platforms.map((p) => ({ id: p, spend: campaigns.filter((c) => c.platform === p).reduce((a, c) => a + c.spend, 0) }));
  const topPlat = [...byPlat].sort((a, b) => b.spend - a.spend)[0]?.id;
  const status = (i: number) => (i % 3 === 0 ? "Ativa" : i % 3 === 1 ? "Aprendizado" : "Limitada");

  return (
    <div className="@container rounded-[28px] p-3 @[700px]:p-6" style={{ background: C.bg, color: C.fg }}>
      <div className="rounded-[24px] p-4 @[700px]:p-6" style={{ background: "#f8f9fd" }}>
        {/* topo: marca, navegação em pílulas e ícones */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-[10px] text-white" style={{ background: C.accent }}>
              <Wallet size={16} />
            </span>
            <div className="leading-tight">
              <p className="text-[15px] font-bold tracking-tight uppercase">{client}</p>
              <p className="text-[10px]" style={{ color: C.fg2 }}>
                Mídia paga, decisões melhores
              </p>
            </div>
          </div>
          <span className="grid size-9 place-items-center rounded-full border text-[12px] font-semibold" style={{ borderColor: C.line, background: C.card }}>
            {days.length}
          </span>
          <nav className="flex flex-wrap gap-1 rounded-full p-1" style={{ background: C.dark }}>
            {pages.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPage?.(p)}
                className="rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-colors"
                style={p === active ? { background: C.accent, color: "#fff" } : { color: "#d6d7e4" }}
              >
                {p === active ? "+ " : ""}
                {PAGES[p].name}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            {[FileText, CalendarDays, Link2].map((Icon, i) => (
              <span key={i} className="hidden size-9 place-items-center rounded-full border @[900px]:grid" style={{ borderColor: C.line, background: C.card }}>
                <Icon size={15} />
              </span>
            ))}
            <span className="relative grid size-9 place-items-center rounded-full border" style={{ borderColor: C.line, background: C.card }}>
              <Bell size={15} />
              <span className="absolute top-2 right-2.5 size-1.5 rounded-full bg-red-500" />
            </span>
            <span className="grid size-9 place-items-center rounded-full text-[12px] font-bold text-white" style={{ background: C.dark }}>
              {initials(client)}
            </span>
          </div>
        </div>

        {/* título */}
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <span className="grid size-10 place-items-center rounded-full border" style={{ borderColor: C.line, background: C.card }}>
            <ArrowLeft size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[30px] leading-none font-bold tracking-[-0.03em]">{name}</h2>
            <p className="mt-1 text-[13px]" style={{ color: C.fg2 }}>
              Acompanhe receita, investimento e campanhas num lugar só · {periodLabel}
            </p>
          </div>
          <span className="grid size-11 place-items-center rounded-[14px] border" style={{ borderColor: C.line, background: C.card }}>
            <SlidersHorizontal size={16} />
          </span>
          <span className="flex h-11 items-center gap-2 rounded-[14px] px-5 text-[13px] font-semibold text-white" style={{ background: C.accent }}>
            <Plus size={16} /> {label(ctx, "revenue")}: {value(ctx, "revenue")}
          </span>
        </div>

        {/* quatro cards */}
        <div className="mt-6 grid gap-3 @[640px]:grid-cols-2 @[1000px]:grid-cols-4">
          <section className="flex min-h-[230px] flex-col overflow-hidden rounded-[20px] border p-4" style={{ borderColor: C.line, background: C.card }}>
            <header className="flex items-center justify-between text-[13px] font-semibold">
              {label(ctx, "cpa")}
              <AlertCircle size={16} className="text-red-500" />
            </header>
            <p className="mt-3 text-[28px] font-bold tracking-tight tnum">{value(ctx, "cpa")}</p>
            <Trend c={cpa} />
            <DeskArt />
          </section>

          <section className="flex min-h-[230px] flex-col rounded-[20px] border p-4" style={{ borderColor: C.line, background: C.card }}>
            <header className="flex items-center justify-between text-[13px] font-semibold">
              {label(ctx, "revenue")}
              <span className="grid size-7 place-items-center rounded-full" style={{ background: "#eeedfd", color: C.accent }}>
                <CalendarDays size={14} />
              </span>
            </header>
            <p className="mt-3 text-[28px] font-bold tracking-tight tnum">{money(ctx, ctx.cur.revenue)}</p>
            <Trend c={rev} />
            <div className="mt-auto flex h-[88px] items-end gap-2 pt-3">
              {revenueBars.map((v, i) => {
                const max = Math.max(...revenueBars, 1);
                return (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-[6px]"
                      style={{ height: `${Math.max(10, (v / max) * 70)}px`, background: i === revenueBars.length - 1 ? C.accent : `color-mix(in srgb, ${C.accent} ${30 + i * 10}%, white)` }}
                    />
                    <span className="text-[9px]" style={{ color: C.fg2 }}>
                      S{i + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="flex min-h-[230px] flex-col rounded-[20px] border p-4" style={{ borderColor: C.line, background: C.card }}>
            <header className="flex items-center justify-between text-[13px] font-semibold">
              {label(ctx, "roas")} médio
              <Clock size={16} style={{ color: "#3b9bdc" }} />
            </header>
            <p className="mt-3 text-[28px] font-bold tracking-tight tnum">{value(ctx, "roas")}</p>
            <Trend c={roas} />
            <LineDots values={roasLine} />
          </section>

          <section className="flex min-h-[230px] flex-col rounded-[20px] border p-4" style={{ borderColor: C.line, background: C.card }}>
            <header className="flex items-center justify-between text-[13px] font-semibold">
              Investimento por plataforma
              <span className="grid size-7 place-items-center rounded-full border" style={{ borderColor: C.line }}>
                <ArrowUpRight size={14} />
              </span>
            </header>
            <div className="mt-3 flex items-center gap-2">
              <p className="text-[26px] font-bold tracking-tight whitespace-nowrap tnum">{money(ctx, ctx.cur.spend, true)}</p>
              <span className="rounded-full border px-2.5 py-1 text-[11px]" style={{ borderColor: C.line }}>
                {int(ctx.cur.conversions)} {label(ctx, "conversions").toLowerCase()}
              </span>
            </div>
            <div className="mt-auto flex items-end gap-1.5 pt-3">
              {byPlat.slice(0, 3).map((p) => {
                const hi = p.id === topPlat;
                return (
                  <div
                    key={p.id}
                    className="flex flex-1 flex-col justify-between rounded-[12px] p-2 text-[10px]"
                    style={{ height: hi ? 104 : 82, background: hi ? C.accent : "#f2f3f8", color: hi ? "#fff" : C.fg2 }}
                  >
                    <span className="font-semibold tnum" style={{ color: hi ? "#fff" : C.fg }}>
                      {money(ctx, p.spend, true)}
                    </span>
                    <span>{platformName(p.id)}</span>
                  </div>
                );
              })}
              <span className="self-end rounded-full px-3 py-2 text-[10.5px] font-semibold whitespace-nowrap text-white" style={{ background: C.dark }}>
                {Math.round(((byPlat.find((p) => p.id === topPlat)?.spend ?? 0) / Math.max(1, ctx.cur.spend)) * 100)}% na maior
              </span>
            </div>
          </section>
        </div>

        {/* filtros */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="mr-2 flex items-center gap-2 text-[13px] font-semibold">
            Filtros ativos
            <span className="grid size-5 place-items-center rounded-full text-[10px] text-white" style={{ background: C.dark }}>
              {tab === "todas" ? 1 : 2}
            </span>
          </span>
          <Pill>
            {tab === "todas" ? "Todas as plataformas" : platformName(tab)} <ChevronDown size={14} />
          </Pill>
          <Pill>
            {sel ? sel.name : "Todas as campanhas"} <ChevronDown size={14} />
          </Pill>
          <Pill>
            {dayLabel(days.length, ctx.today)} <CalendarDays size={14} />
          </Pill>
          <Pill>
            {dayLabel(0, ctx.today)} <CalendarDays size={14} />
          </Pill>
          <Pill grow>
            <span style={{ color: C.fg2 }}>Buscar campanha</span> <Search size={14} />
          </Pill>
        </div>

        {/* painel escuro */}
        <div className="relative mt-4 rounded-[24px] p-4 @[700px]:p-5" style={{ background: C.dark, color: "#fff" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-[14px] font-semibold">Campanhas no período</h3>
            <div className="flex gap-1 rounded-full bg-white p-1 text-[12px]" style={{ color: C.fg }}>
              {(["todas", ...platforms] as Tab[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setTab(p);
                    setPicked(null);
                  }}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium"
                  style={p === tab ? { background: C.accent, color: "#fff" } : undefined}
                >
                  {p === "todas" ? "Todas" : platformName(p)}
                  {p !== "todas" && (
                    <span className="grid size-5 place-items-center rounded-full text-[10px]" style={{ background: p === tab ? "#fff" : "#eceaf9", color: C.accent }}>
                      {campaigns.filter((c) => c.platform === p).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-4 @[900px]:grid-cols-[minmax(0,0.85fr)_minmax(0,1.5fr)]">
            <ul className="space-y-1.5">
              {list.slice(0, 6).map((c, i) => {
                const on = c.id === sel?.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setPicked(c.id)}
                      className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors"
                      style={on ? { background: C.accent } : { background: "transparent" }}
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-full text-[11px] font-bold" style={{ background: on ? "#fff" : C.dark2, color: on ? C.accent : "#cfd0e0" }}>
                        {initials(c.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-semibold">{c.name}</span>
                        <span className="block text-[10.5px] opacity-60">{platformName(c.platform)}</span>
                      </span>
                      <span className="rounded-full px-2.5 py-1 text-[10px] font-medium" style={on ? { background: "#fff", color: C.fg } : { background: C.dark2, color: "#cfd0e0" }}>
                        {status(i)}
                      </span>
                      <span className="w-[86px] shrink-0 text-right text-[12.5px] font-semibold tnum">{money(ctx, c.spend, true)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {sel && (
              <div className="rounded-[20px] p-4 @[700px]:p-5" style={{ background: C.panel }}>
                <div className="grid gap-3 text-[11px] @[700px]:grid-cols-3">
                  <div>
                    <p className="opacity-70">Campanha</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-[22px] font-bold tracking-tight">{sel.name}</span>
                      <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px]">{status(list.indexOf(sel))}</span>
                    </p>
                  </div>
                  <div>
                    <p className="opacity-70">Plataforma</p>
                    <p className="mt-1 text-[20px] font-bold tracking-tight">{platformName(sel.platform)}</p>
                  </div>
                  <div>
                    <p className="opacity-70">Cliente</p>
                    <p className="mt-1 flex items-center gap-2">
                      <span className="grid size-8 place-items-center rounded-full bg-white text-[11px] font-bold" style={{ color: C.accent }}>
                        {initials(client)}
                      </span>
                      <span className="leading-tight">
                        <span className="block text-[12.5px] font-semibold">{client}</span>
                        <span className="block opacity-70">Conta de anúncios</span>
                      </span>
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2.5 @[700px]:grid-cols-4">
                  {[
                    { v: money(ctx, sel.spend), l: "Investimento" },
                    { v: money(ctx, sel.revenue), l: label(ctx, "revenue") },
                    { v: int(sel.conversions), l: label(ctx, "conversions") },
                  ].map((tile) => (
                    <div key={tile.l} className="flex min-h-[96px] flex-col justify-between rounded-[14px] bg-white/12 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[16px] font-bold tnum">{tile.v}</span>
                        <ArrowUpRight size={14} className="opacity-70" />
                      </div>
                      <span className="text-[11px] opacity-80">{tile.l}</span>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => onPage?.(pages.includes("campanhas") ? "campanhas" : pages[1] ?? active)}
                    className="flex min-h-[96px] flex-col items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-white/50 text-[11px]"
                  >
                    <span className="grid size-7 place-items-center rounded-full bg-white/15">
                      <Plus size={14} />
                    </span>
                    Ver mais detalhes
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-3 border-t border-white/20 pt-4">
                  {[
                    { l: label(ctx, "cpa"), v: ctx.hideSpend ? "•••" : money(ctx, sel.spend / Math.max(1, sel.conversions)) },
                    { l: label(ctx, "roas"), v: ctx.hideSpend ? "•••" : decimal(sel.revenue / Math.max(1, sel.spend), 2) },
                    { l: "CTR", v: `${decimal((sel.clicks / Math.max(1, sel.impressions)) * 100, 2)}%` },
                  ].map((s) => (
                    <div key={s.l}>
                      <p className="text-[10.5px] opacity-70">{s.l}</p>
                      <p className="text-[18px] font-bold tnum">{s.v}</p>
                    </div>
                  ))}
                  <div className="ml-auto flex items-center gap-2">
                    {[Link2, CalendarDays].map((Icon, i) => (
                      <span key={i} className="grid size-9 place-items-center rounded-full border border-white/30">
                        <Icon size={14} />
                      </span>
                    ))}
                    <span className="rounded-full bg-white px-4 py-2.5 text-[12px] font-semibold" style={{ color: C.fg }}>
                      {int(sel.clicks)} cliques
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Trend({ c }: { c: ReturnType<typeof change> }) {
  const color = c.good === null ? C.fg2 : c.good ? "#3b9bdc" : "#e5484d";
  const Icon = c.up ? ArrowUpRight : ArrowDownRight;
  return (
    <p className="mt-1 flex items-center gap-1 text-[11px]" style={{ color: C.fg2 }}>
      <Icon size={13} style={{ color }} />
      <span className="font-semibold" style={{ color }}>
        {c.text}
      </span>
      em relação ao período anterior
    </p>
  );
}

function Pill({ children, grow }: { children: React.ReactNode; grow?: boolean }) {
  return (
    <span className={`flex h-10 items-center justify-between gap-3 rounded-[12px] border px-3 text-[12px] ${grow ? "min-w-[180px] flex-1" : "min-w-[150px]"}`} style={{ borderColor: C.line, background: C.card }}>
      {children}
    </span>
  );
}

function LineDots({ values }: { values: number[] }) {
  const w = 220;
  const h = 90;
  const pts = fit(values, w, h);
  const line = pts.map((p) => p.join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-auto h-[96px] w-full overflow-visible pt-2" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="lav-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={C.accent} stopOpacity="0.25" />
          <stop offset="1" stopColor={C.accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${line} ${w},${h}`} fill="url(#lav-area)" />
      <polyline points={line} fill="none" stroke={C.accent} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 4 : 3} fill={i === pts.length - 1 ? "#fff" : C.accent} stroke={C.accent} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

/** Ilustração da mesa (planta, notebook, luminária), feita em SVG. */
function DeskArt() {
  return (
    <svg viewBox="0 0 240 100" className="mt-auto -mx-4 -mb-4 h-[104px] w-[calc(100%+2rem)]" aria-hidden>
      <rect x="0" y="0" width="240" height="100" fill="#f1f1f4" />
      <rect x="0" y="78" width="240" height="22" fill="#e4e3e8" />
      <rect x="0" y="76" width="240" height="4" fill="#d6d5dc" />
      {/* planta */}
      <path d="M38 76 L44 56 L58 56 L64 76 Z" fill="#fafafa" stroke="#d9d9de" />
      <path d="M51 56 C40 40 30 36 26 22 C38 26 46 36 51 56" fill="#3d6b4f" />
      <path d="M51 56 C56 38 64 30 74 24 C70 38 62 46 51 56" fill="#4f8462" />
      <path d="M51 56 C48 40 50 28 54 14 C58 28 56 42 51 56" fill="#2f5a40" />
      {/* notebook */}
      <rect x="100" y="52" width="40" height="24" rx="2" fill="#2b2c33" />
      <rect x="94" y="75" width="52" height="3" rx="1" fill="#3a3b44" />
      {/* xícara */}
      <rect x="152" y="66" width="10" height="10" rx="2" fill="#2b2c33" />
      {/* luminária */}
      <rect x="182" y="74" width="26" height="4" rx="2" fill="#2b2c33" />
      <path d="M195 74 L188 48 L206 30" stroke="#2b2c33" strokeWidth="3" fill="none" />
      <path d="M200 28 L218 22 L222 38 Z" fill="#2b2c33" />
      <circle cx="216" cy="36" r="5" fill="#fff6c9" opacity="0.8" />
    </svg>
  );
}
