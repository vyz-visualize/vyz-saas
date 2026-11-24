"use client";

// Visual "Fachada" (lançamento imobiliário e geração de leads): cinza de concreto com
// coral, cartões de vidro e a imagem do empreendimento na capa. A primeira aba é a capa:
// título, endereço, campanhas em destaque, o funil do período e quatro medidores (o
// resultado e de onde ele vem, o ritmo por dia, a verba do mês e o custo contra o alvo).
// As outras abas entram na mesma moldura, com o menu de ícones à esquerda.
//
// Os números seguem o objetivo do modelo (goalOf): leads e visitas no imobiliário,
// vendas e receita em venda, agendamentos em saúde. Com a planilha do lançamento ligada
// (features/import/launch-sheet.ts), o funil e a origem dos leads passam a ser os dela.

import {
  ArrowLeftRight,
  ArrowUpRight,
  CalendarDays,
  Camera,
  ChartColumn,
  ChartPie,
  CircleCheck,
  FileSpreadsheet,
  Funnel,
  Globe,
  Handshake,
  House,
  ImagePlus,
  Images,
  LayoutGrid,
  ListChecks,
  Megaphone,
  Search,
  Swords,
  Target,
  TextSearch,
  ThumbsUp,
  TrendingUp,
  TriangleAlert,
  Users,
  Wallet,
  Waypoints,
  type LucideIcon,
  Clock,
  MapPin,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useElementSize } from "@/components/charts/useSize";
import type { PlatformId } from "@/features/accounts/platforms";
import { platformPart } from "@/features/metrics/compute";
import { metric, type MetricId } from "@/features/metrics/definitions";
import { funnelRows, type FunnelRow } from "@/features/metrics/funnel";
import { BUDGET_INVITE, GOAL_INVITE, hasBudget, hasGoal } from "@/features/metrics/targets";
import { PAGES } from "@/features/templates/pages";
import type { PageId } from "@/features/templates/types";
import { brlCompact } from "@/lib/format";
import { NO_COVER, type DashboardCover } from "../cover";
import { DeltaChip, SkinBar, SkinChrome, SkinPage, themeVars, type Delta, type SkinPalette } from "./bklit-blocks";
import { CoverDialog, SheetDialog } from "./fachada/CoverPanel";
import { ArcMeter, CapsuleBars, DialMeter, TrackMeter } from "./fachada/meters";
import { Tower } from "./fachada/Tower";
import { BrTiles, HourBars } from "./extras";
import { FullName } from "./FullName";
import { stateBasis, stateShares } from "./insights";
import { BR_STATES } from "@/features/sync/breakdowns";
import { SkinGrid } from "./SkinGrid";
import { SkinCreatives } from "./CreativeViews";
import { skinGrid } from "./blocks";
import { brl, change, chrono, dayLabel, goalOf, int, label, pct, platformName, platformShort, value, type SkinProps } from "./shared";

const P: SkinPalette = {
  scheme: "light",
  bg: "#dcdbd9",
  card: "#ebebe9",
  fg: "#1f1f1e",
  fg2: "#5e5d5a",
  line: "#cfcecb",
  accent: "#d4432e",
  accentSoft: "#f3d3cc",
  onAccent: "#ffffff",
  muted: "#bdbcb8",
  error: "#a3231b",
  errorSoft: "#f1d4d0",
  good: "#22764f",
};
// Cores de identidade (plataformas e origens), na ordem fixa: coral, azul, ocre e ameixa.
// Conferidas contra daltonismo e contraste no cartão claro; a quinta em diante vira cinza.
const CAT = [P.accent, "#2f6fb0", "#b07610", "#80549a"];
const colorAt = (i: number) => CAT[i] ?? P.muted;
const BG = "linear-gradient(180deg, #dfdedc 0%, #dad9d7 58%, #d8d0cd 100%)";
const OUTER = "linear-gradient(180deg, #c8c7c5 0%, #bfb3b0 62%, #b29490 100%)";
// vidro: translúcido sobre a imagem da capa, com a borda clara de cima
const GLASS = "rounded-[26px] border border-white/60 bg-white/[0.56] shadow-[inset_0_1px_0_rgb(255_255_255/0.65),0_22px_44px_-30px_rgb(0_0_0/0.4)] backdrop-blur-2xl backdrop-saturate-[0.55]";
const ROUND = "grid shrink-0 place-items-center rounded-full border border-white/60 bg-white/[0.45] shadow-[inset_0_1px_0_rgb(255_255_255/0.7)]";

// Cards de número das abas padrão com mais respiro: 18 px de lado, 16 px em cima e embaixo,
// rótulo sem a altura mínima de duas linhas (sobrava um vão entre o rótulo e o número).
const FACHADA_PAGE_CSS = `
.fachada-page .group\\/kpi { padding: 16px 18px 15px; border-radius: 20px; }
.fachada-page .group\\/kpi > p:first-child { min-height: 0; margin-bottom: 10px; }
.fachada-page .group\\/kpi > h3 { margin-bottom: 4px; }
.fachada-page [data-kpi-row], .fachada-page .grid:has(> .group\\/kpi) { gap: 10px; }
`;

const PAGE_ICON: Partial<Record<PageId, LucideIcon>> = {
  "visao-geral": House,
  "meta-ads": Megaphone,
  criativos: Images,
  publico: Users,
  "google-ads": Search,
  termos: TextSearch,
  site: Globe,
  "canais-site": Waypoints,
  crm: Handshake,
  instagram: Camera,
  "pagina-facebook": ThumbsUp,
  conteudo: LayoutGrid,
  "criativos-ao-vivo": Swords,
  previsao: TrendingUp,
  mmm: ChartPie,
  metas: Target,
  comparativo: ArrowLeftRight,
  funil: Funnel,
  campanhas: ListChecks,
};

/** A marca do canto: uma estrela de quatro pontas, na cor de destaque. */
function Mark({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d="M12 1.5c.7 5.6 4.9 9.8 10.5 10.5-5.6.7-9.8 4.9-10.5 10.5C11.3 16.9 7.1 12.7 1.5 12 7.1 11.3 11.3 7.1 12 1.5Z" fill="var(--accent)" />
    </svg>
  );
}

// ---- moldura --------------------------------------------------------------------------

/** Seções da página do empreendimento (a primeira aba), com o ícone do atalho na barra. */
const SECTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "capa", label: "Capa e resultado", icon: House },
  { id: "lancamento", label: "Lançamento", icon: FileSpreadsheet },
  { id: "regiao", label: "De onde vêm e quando chamam", icon: MapPin },
];

function Rail({ pages, active, onPage, sections }: { pages: PageId[]; active: PageId; onPage?: (p: PageId) => void; /** Na primeira aba: atalhos para as seções dela. */ sections?: { id: string; label: string; icon: LucideIcon }[] }) {
  return (
    // no largo, a barra de ícones fica no meio da altura da tela (coluna fixa da altura da tela, centralizada)
    <div className="contents @[900px]:sticky @[900px]:top-0 @[900px]:flex @[900px]:h-[calc(100dvh-6rem)] @[900px]:w-10 @[900px]:shrink-0 @[900px]:items-center @[900px]:self-start">
    <nav data-tour="abas" aria-label="Páginas do dashboard" className="flex min-w-0 shrink-0 gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] @[900px]:max-h-full @[900px]:w-10 @[900px]:flex-col @[900px]:overflow-visible @[900px]:pb-0">
      {sections && sections.length > 1 && (
        <>
          {sections.map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => document.getElementById(`secao-${sec.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              aria-label={`Ir para ${sec.label}`}
              className="group relative hidden size-10 shrink-0 place-items-center rounded-full border border-dashed border-fg/25 text-fg-2 outline-none transition-colors hover:bg-white/60 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent @[900px]:grid"
            >
              <sec.icon size={16} strokeWidth={1.8} aria-hidden />
              <span className="pointer-events-none absolute left-[calc(100%+8px)] z-30 hidden rounded-full bg-[var(--fg)] px-2.5 py-1 text-[11.5px] whitespace-nowrap text-[var(--bg)] group-hover:block group-focus-visible:block">{sec.label}</span>
            </button>
          ))}
          <span className="my-1 hidden h-px w-full bg-fg/15 @[900px]:block" aria-hidden />
        </>
      )}
      {pages.map((p) => {
        const Icon = PAGE_ICON[p] ?? ChartColumn;
        const on = p === active;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onPage?.(p)}
            aria-current={on ? "page" : undefined}
            aria-label={PAGES[p].name}
            className={`group relative flex h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-[12.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent @[900px]:w-10 @[900px]:justify-center @[900px]:px-0 ${
              on ? "bg-accent text-on-accent shadow-[0_8px_18px_-10px_var(--accent)]" : "border border-white/60 bg-white/[0.42] text-fg hover:bg-white/70"
            }`}
          >
            <Icon size={17} strokeWidth={1.8} aria-hidden />
            {/* no estreito, o nome ao lado do ícone; no largo, só ao apontar ou focar */}
            <span className="whitespace-nowrap @[900px]:pointer-events-none @[900px]:absolute @[900px]:left-[calc(100%+8px)] @[900px]:z-30 @[900px]:hidden @[900px]:rounded-full @[900px]:bg-[var(--fg)] @[900px]:px-2.5 @[900px]:py-1 @[900px]:text-[11.5px] @[900px]:text-[var(--bg)] @[900px]:group-hover:block @[900px]:group-focus-visible:block">
              {PAGES[p].name}
            </span>
          </button>
        );
      })}
    </nav>
    </div>
  );
}

/** A imagem do empreendimento, atrás dos blocos da capa: a que a pessoa subiu ou a ilustração padrão. */
function CoverArt({ cover, inside = false }: { cover: DashboardCover; /** Dentro do bloco da capa (na edição ou com a capa fora do lugar padrão): acompanha o bloco. */ inside?: boolean }) {
  return (
    // no celular a imagem fica numa faixa no topo e o texto da capa começa embaixo dela (não cobre o título)
    <div className={`pointer-events-none absolute z-0 ${inside ? "top-0 right-0 h-[170px] w-[64%] @[720px]:inset-y-0 @[720px]:h-auto @[720px]:w-[44%]" : "top-0 right-0 h-[170px] w-[64%] @[720px]:bottom-0 @[720px]:h-auto @[720px]:w-[45%]"}`}>
      {!cover.image ? (
        <Tower className="size-full" />
      ) : cover.fit === "foto" ? (
        <div className="absolute inset-y-1 right-0 left-[10%] overflow-hidden rounded-[30px] border border-white/60 shadow-[0_30px_60px_-40px_rgb(0_0_0/0.5)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- imagem que a pessoa subiu (Storage), tamanho livre */}
          <img src={cover.image} alt="" className="size-full object-cover" />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- imagem que a pessoa subiu (Storage), tamanho livre
        <img src={cover.image} alt="" className="size-full object-contain object-bottom" />
      )}
    </div>
  );
}

// ---- peças dos blocos -----------------------------------------------------------------

function SectionTitle({ icon: Icon, title, note }: { icon: LucideIcon; title: string; note?: string }) {
  return (
    <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className={`${ROUND} size-9`}>
        <Icon size={16} strokeWidth={1.8} aria-hidden />
      </span>
      <h3 className="text-[22px] leading-tight font-normal tracking-[-0.03em]">{title}</h3>
      {note && <span className="text-[12px] text-fg-2">{note}</span>}
    </header>
  );
}

/** Seção do lançamento (planilha ligada): os números do funil de vendas e cada origem, com a conversão em venda. */
function LaunchSection({ launch, hideMoney, onSheet }: { launch: NonNullable<SkinProps["ctx"]["ds"]["launch"]>; hideMoney: boolean; onSheet?: () => void }) {
  const leads = launch.origins.reduce((a, o) => a + o.leads, 0);
  const tiles = [
    { l: "Leads", v: int(leads) },
    { l: "Propostas", v: int(launch.proposals), note: leads > 0 ? `${pct(launch.proposals / leads, 0)} dos leads` : undefined },
    { l: "Vendas", v: int(launch.sales), note: launch.proposals > 0 ? `${pct(launch.sales / launch.proposals, 0)} das propostas` : undefined },
    ...(launch.value > 0 && !hideMoney ? [{ l: "Valor vendido", v: brlCompact(launch.value), note: launch.sales > 0 ? `${brlCompact(launch.value / launch.sales)} por venda` : undefined }] : []),
  ];
  const top = Math.max(1, ...launch.origins.map((o) => o.leads));
  const fmt = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  return (
    <div className="grid gap-4 @[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]" data-lancamento>
      <section className={`${GLASS} flex min-w-0 flex-col px-4 py-4`}>
        <dl className="grid grid-cols-2 gap-3">
          {tiles.map((t) => (
            <div key={t.l} className="min-w-0 rounded-[18px] border border-white/60 bg-white/40 px-3 py-2.5">
              <dt className="text-[11.5px] text-fg-2">{t.l}</dt>
              <dd className="text-[26px] leading-tight font-normal tracking-[-0.03em]">{t.v}</dd>
              {t.note && <dd className="text-[11px] text-fg-2">{t.note}</dd>}
            </div>
          ))}
        </dl>
        <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-[11px] text-fg-2">
          Planilha: {fmt(launch.from)} a {fmt(launch.to)}
          {onSheet && (
            <button type="button" onClick={onSheet} className="font-medium text-accent underline-offset-2 hover:underline">
              Ver a planilha
            </button>
          )}
        </p>
      </section>
      <section className={`${GLASS} min-w-0 px-4 py-4`}>
        <h4 className="text-[14.5px] font-medium tracking-tight">De onde vêm os leads e as vendas</h4>
        <table className="mt-3 w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-[11px] text-fg-2">
              <th className="pb-1.5 font-medium">Origem</th>
              <th className="pb-1.5 text-right font-medium">Leads</th>
              <th className="pb-1.5 text-right font-medium">Vendas</th>
              <th className="pb-1.5 text-right font-medium">Lead → venda</th>
            </tr>
          </thead>
          <tbody>
            {launch.origins.map((o) => (
              <tr key={o.name} className="border-t border-white/60">
                <td className="py-2 pr-2">
                  <span className="block truncate">{o.name}</span>
                  <span className="mt-1 block h-1.5 rounded-full bg-accent" style={{ width: `${Math.max(4, (o.leads / top) * 100)}%` }} aria-hidden />
                </td>
                <td className="py-2 text-right tnum">{int(o.leads)}</td>
                <td className="py-2 text-right tnum">{int(o.sales)}</td>
                <td className="py-2 text-right tnum">{o.leads > 0 ? pct(o.sales / o.leads, 1) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Card({ icon: Icon, title, onOpen, openLabel, children }: { icon: LucideIcon; title: string; onOpen?: () => void; openLabel?: string; children: ReactNode }) {
  return (
    <section className={`${GLASS} flex h-full min-h-[250px] min-w-0 flex-col px-3.5 pt-3 pb-3 @[720px]:min-h-0`}>
      <header className="flex shrink-0 items-center gap-2.5">
        <span className={`${ROUND} size-9`}>
          <Icon size={16} strokeWidth={1.8} aria-hidden />
        </span>
        <h3 className="min-w-0 flex-1 truncate text-[14.5px] font-medium tracking-tight">{title}</h3>
        {onOpen && (
          <button type="button" onClick={onOpen} aria-label={openLabel} title={openLabel} className="grid size-8 shrink-0 place-items-center rounded-full text-fg-2 outline-none transition-colors hover:bg-white/60 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent">
            <ArrowUpRight size={16} aria-hidden />
          </button>
        )}
      </header>
      {children}
    </section>
  );
}

/** O número do bloco, a variação e uma nota curta. Algarismos proporcionais: é número de destaque, não coluna. */
function Headline({ v, delta, note }: { v: string; delta?: Delta; note?: ReactNode }) {
  return (
    <div className="mt-2.5 flex shrink-0 flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="text-[30px] leading-none font-normal tracking-[-0.03em]">{v}</span>
      {delta && <DeltaChip delta={delta} />}
      {note && <span className="min-w-0 truncate text-[11.5px] text-fg-2">{note}</span>}
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string; note?: string }[] }) {
  if (!items.length) return null;
  return (
    <ul className="mt-1.5 flex shrink-0 flex-wrap justify-center gap-x-3 gap-y-0.5 text-[10.5px] text-fg-2">
      {items.map((i) => (
        <li key={i.label} className="flex min-w-0 items-center gap-1.5">
          <span className="size-2 shrink-0 rounded-full" style={{ background: i.color }} aria-hidden />
          <span className="truncate">{i.label}</span>
          {i.note && <span className="text-fg">{i.note}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Estado com ícone e texto (nunca só cor): dentro ou acima do alvo, verba no ritmo ou estourando. */
function Status({ good, children }: { good: boolean; children: ReactNode }) {
  const Icon = good ? CircleCheck : TriangleAlert;
  return (
    <span className="inline-flex items-center gap-1 text-[11.5px] font-medium" style={{ color: good ? "var(--good)" : "var(--error-fg)" }}>
      <Icon size={13} aria-hidden /> {children}
    </span>
  );
}

/** Soma em trechos iguais, só com trechos completos (um trecho pela metade pareceria uma queda). */
function chunks<T>(days: T[], pick: (d: T) => number): { size: number; values: number[]; firsts: T[] } {
  const size = Math.max(1, Math.ceil(days.length / 12));
  const start = days.length % size;
  const values: number[] = [];
  const firsts: T[] = [];
  for (let i = start; i < days.length; i += size) {
    values.push(days.slice(i, i + size).reduce((a, d) => a + pick(d), 0));
    firsts.push(days[i]);
  }
  return { size, values, firsts };
}

// ---- capa -----------------------------------------------------------------------------

type CapaProps = {
  client: string;
  name: string;
  subtitle: string;
  campaigns: { id: string; name: string; note: string }[];
  /** Quanto do resultado as campanhas em destaque trazem ("64%"). */
  campaignShare: string;
  funnel: FunnelRow[];
  funnelSource: string;
  funnelValue: string;
  funnelUnit: string;
  platforms: { id: string; name: string; color: string }[];
  /** A planilha do lançamento: com onOpen, o botão que abre a janela dela. */
  sheet?: { label: string; onOpen?: () => void };
  /** Período como etiqueta (galeria, PDF); com os controles do dashboard na tela, não aparece. */
  period?: string;
  onEdit?: () => void;
  /** A imagem dentro do bloco (quando ela não pode ficar atrás da grade inteira). */
  art?: ReactNode;
};

/** "lead" → "leads"; "impressões" fica. */
const plural = (w: string) => (w.endsWith("s") ? w : `${w}s`);

const PILL = "flex h-9 items-center gap-2 rounded-full border border-white/60 bg-white/[0.46] px-3.5 text-[12px]";

/**
 * O bloco da capa: título, endereço, campanhas em destaque, o funil do período (sobre a
 * imagem) e as plataformas ligadas. Componente próprio porque mede a própria altura: no
 * encaixe da tela, a capa encolhe e o que não cabe sai (primeiro as campanhas, depois a
 * lista do funil) em vez de criar rolagem dentro do bloco.
 */
function Capa({ client, name, subtitle, campaigns, campaignShare, funnel, funnelSource, funnelValue, funnelUnit, platforms, sheet, period, onEdit, art }: CapaProps) {
  const [ref, size] = useElementSize<HTMLElement>();
  // no celular (bloco estreito) a capa cresce para baixo: destaques e funil sempre aparecem, um embaixo do outro
  const narrow = !!size && size.width < 700;
  const roomy = !size || size.height >= 340 || narrow;
  const tall = !size || size.height >= 250 || narrow;
  return (
    <section ref={ref} className="relative isolate flex h-full min-h-[330px] flex-col @[720px]:min-h-0">
      {art}
      <div className="relative z-10 flex min-h-0 max-w-full flex-1 flex-col justify-center pt-[150px] pl-1 @[720px]:max-w-[49%] @[720px]:pt-0 @[1100px]:pl-3">
        <p className="truncate text-[11.5px] font-medium tracking-[0.14em] text-fg-2 uppercase">{client}</p>
        <h1 className="mt-1.5 text-[34px] leading-[1.03] font-normal tracking-[-0.035em] text-balance @[720px]:text-[clamp(34px,4.3cqw,60px)]">{name}</h1>
        <p className="mt-2.5 max-w-[38ch] text-[13px] leading-snug text-fg-2">{subtitle}</p>
        {roomy && campaigns.length > 0 && (
          <div className={`${GLASS} mt-5 w-fit max-w-full px-4 py-3`}>
            <p className="text-[12.5px] font-medium">Campanhas em destaque</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-2">
              <span className="grid h-11 shrink-0 place-items-center rounded-[14px] bg-white/55 px-2.5">
                <span className="rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap text-on-accent">{campaignShare} do total</span>
              </span>
              {campaigns.map((c, i) => (
                <div key={c.id} className={`min-w-0 max-w-[132px] ${i === 2 && !narrow ? "hidden @[1100px]:block" : ""}`}>
                  <FullName text={c.name} className="text-[12px]" />
                  <p className="truncate text-[10.5px] text-fg-2">{c.note}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* o funil do período, sobre a imagem (só quando a grade está lado a lado) */}
      {funnel.length > 1 && (
        <div className={`${GLASS} p-3.5 ${narrow ? "relative z-10 mt-3" : "absolute top-[5%] left-[52%] hidden w-[min(238px,25%)] @[720px]:block"}`}>
          <div className="flex items-center gap-2.5">
            <span className={`${ROUND} size-9`}>
              <Funnel size={15} strokeWidth={1.8} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium">Funil do período</p>
              <p className="truncate text-[11px] text-fg-2">{funnelSource}</p>
            </div>
          </div>
          {tall && (
            <ul className="mt-3 space-y-1.5">
              {funnel.slice(1, 4).map((r) => (
                <li key={r.label} className="flex items-center gap-2 text-[12px]">
                  <span className="size-2.5 shrink-0 rounded-full border-2" style={{ borderColor: "var(--accent)" }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-fg-2">{r.label}</span>
                  <span className="font-medium">{r.display}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 flex items-baseline gap-1.5">
            <span className="text-[24px] leading-none font-normal tracking-[-0.03em]">{funnelValue}</span>
            <span className="truncate text-[11.5px] text-fg-2">{funnelUnit}</span>
          </p>
        </div>
      )}

      {/* plataformas ligadas, a planilha e o período */}
      <div className="relative z-10 mt-3 flex shrink-0 flex-wrap items-center gap-1.5 pb-0.5">
        {platforms.map((p) => (
          <span key={p.id} className={PILL}>
            <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
            {p.name}
          </span>
        ))}
        {sheet?.onOpen ? (
          <button type="button" onClick={sheet.onOpen} className={`${PILL} outline-none transition-colors hover:bg-white/75 focus-visible:ring-2 focus-visible:ring-accent`}>
            <FileSpreadsheet size={14} aria-hidden /> {sheet.label}
          </button>
        ) : (
          sheet && (
            <span className={PILL}>
              <FileSpreadsheet size={14} aria-hidden /> {sheet.label}
            </span>
          )
        )}
        {period && (
          <span className={`${PILL} ml-auto text-fg-2`}>
            <CalendarDays size={14} aria-hidden /> {period}
          </span>
        )}
      </div>

      {onEdit && (
        <button type="button" onClick={onEdit} aria-label="Trocar a imagem e o endereço da capa" title="Trocar a imagem e o endereço da capa" className={`${ROUND} absolute top-1 right-1 size-10 text-fg outline-none transition-colors hover:bg-white/80 focus-visible:ring-2 focus-visible:ring-accent`}>
          <ImagePlus size={16} strokeWidth={1.8} aria-hidden />
        </button>
      )}
    </section>
  );
}

// ---- o visual -------------------------------------------------------------------------

export function FachadaSkin({ ctx, name, client, pages, active, onPage, periodLabel, grid, controls, note, children, screen, bar, cover, sheet, cards }: SkinProps) {
  const [dialog, setDialog] = useState<"capa" | "planilha" | null>(null);
  const hide = !!ctx.hideSpend;
  // com o Comparar desligado, as variações contra o período anterior saem
  const cmp = ctx.compare !== false;
  const versus = cmp ? "vs. período anterior" : undefined;
  const ds = ctx.ds;
  const current = ds.current;
  const days = useMemo(() => chrono(current), [current]);
  // o resultado do objetivo do modelo (leads, vendas, agendamentos...), nunca o que os números sugerem
  const g = useMemo(() => goalOf(ctx.profile, ctx.cur.leads), [ctx.profile, ctx.cur.leads]);
  const resultName = metric(g.conv, ctx.profile).label;
  const resultLower = resultName.toLowerCase();
  const total = ctx.cur[g.conv];
  const launch = ds.launch;
  const coverValue = cover?.value ?? NO_COVER;
  const go = (p: PageId) => (onPage && pages.includes(p) ? () => onPage(p) : undefined);
  const openOf = (...candidates: PageId[]) => {
    const p = candidates.find((c) => pages.includes(c));
    return p ? { onOpen: go(p), openLabel: `Abrir ${PAGES[p].name}` } : {};
  };

  // de onde vem o resultado: as origens da planilha do lançamento ou as plataformas de anúncio
  const sources = useMemo(() => {
    if (launch && launch.origins.length > 1) {
      // as três maiores origens e o resto em "Outras". A origem que é uma plataforma ligada fica com a cor
      // dela (a mesma das etiquetas e da verba); as outras pegam as cores livres em ordem alfabética, não pelo ranking
      const shown = launch.origins.slice(0, 3);
      const asPlatform = (origin: string) => {
        const i = ds.adPlatforms.findIndex((id) => [platformName(id), platformShort(id)].some((n) => n.toLowerCase() === origin.trim().toLowerCase()));
        return i >= 0 && i < CAT.length ? CAT[i] : null;
      };
      const taken = shown.map((o) => asPlatform(o.name));
      const free = CAT.filter((c) => !taken.includes(c));
      const others = shown.filter((o) => !asPlatform(o.name)).map((o) => o.name).sort((x, y) => x.localeCompare(y, "pt-BR"));
      const top = shown.map((o) => ({ label: o.name, short: o.name, value: o.leads, color: asPlatform(o.name) ?? free[others.indexOf(o.name)] ?? P.muted }));
      const rest = launch.origins.slice(3).reduce((a, o) => a + o.leads, 0);
      return rest > 0 ? [...top, { label: "Outras", short: "Outras", value: rest, color: P.muted }] : top;
    }
    if (ds.adPlatforms.length > 1) return ds.adPlatforms.map((id: PlatformId, i) => ({ label: platformName(id), short: platformName(id), value: platformPart(ds, id, "current")[g.conv], color: colorAt(i) })).filter((s) => s.value > 0);
    return [];
  }, [ds, g.conv, launch]);
  const sourceTotal = sources.reduce((a, s) => a + s.value, 0);
  const biggest = sources.reduce<(typeof sources)[number] | null>((a, s) => (!a || s.value > a.value ? s : a), null);
  const topCampaigns = useMemo(() => [...ds.campaigns].filter((c) => c.conversions > 0).sort((a, b) => b.conversions - a.conversions).slice(0, 3), [ds.campaigns]);
  const campaignTotal = ds.campaigns.reduce((a, c) => a + c.conversions, 0);
  const qualified = ctx.cur.qualified;
  const showQualified = !g.sales && qualified > 0 && qualified < total;

  // o ritmo: a segunda métrica do objetivo, em trechos iguais do período
  const paceKey: MetricId = g.sales ? "revenue" : ctx.profile === "imob" && ctx.cur.visits > 0 ? "visits" : showQualified ? "qualified" : "clicks";
  const pace = useMemo(() => chunks(days, (d) => d[paceKey] as number), [days, paceKey]);
  const paceFormat = (v: number) => (paceKey === "revenue" ? brlCompact(v) : int(v));
  const paceLabels = pace.firsts.map((d) => dayLabel(d.ago, ctx.today));

  const { budget } = ds;
  const withBudget = hasBudget(ds);
  const projected = budget.day > 0 ? Math.round((budget.spent / budget.day) * budget.daysInMonth) : 0;
  const spendBy = ds.adPlatforms.map((id, i) => ({ label: platformName(id), color: colorAt(i), value: platformPart(ds, id, "current").spend }));
  const spendTotal = spendBy.reduce((a, s) => a + s.value, 0);

  const cost = ctx.cur[g.cost];
  const withGoal = hasGoal(ds);
  const costLabel = label(ctx, g.cost);

  const funnel = useMemo(() => funnelRows(ds.funnel), [ds.funnel]);
  const counted = ds.funnel.some((s) => s.count != null);

  // sem o investimento (link que esconde a verba), os dois medidores de dinheiro saem e os outros ocupam a fileira
  // negócio local: de onde vêm (estados) e a hora de pico (as quebras da Meta; sem elas, os blocos saem)
  const states = useMemo(() => stateShares(ds.breakdowns?.region), [ds.breakdowns]);
  const stateBy = stateBasis(ds.breakdowns?.region);
  const hours = useMemo(() => {
    const out = Array.from({ length: 24 }, () => 0);
    for (const r of ds.breakdowns?.hour ?? []) {
      const h = Number.parseInt(r.key, 10);
      if (h >= 0 && h < 24) out[h] += r.conversions;
    }
    return out;
  }, [ds.breakdowns]);
  const peakHour = hours.some((v) => v > 0) ? hours.indexOf(Math.max(...hours)) : null;
  const topStates = [...states].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const tone = { fg: P.fg, fg2: P.fg2, line: P.line, accent: P.accent, good: P.good, bad: P.error };

  // sem planilha e sem como ligar (link público), a seção do lançamento sai
  const hidden = [...(hide ? ["s-verba", "s-custo"] : []), ...(states.size ? [] : ["s-estados"]), ...(peakHour === null ? ["s-horas"] : []), ...(launch || sheet?.connect ? [] : ["s-lancamento"])];
  // a imagem do prédio fica atrás da grade (passando por trás dos medidores) só com a capa no lugar
  // padrão (em cima, de ponta a ponta) e fora da edição; senão ela vai dentro do bloco da capa e o acompanha
  const capaAt = (grid?.items ?? []).find((it) => it.id === "s-capa");
  const artBehind = !grid?.editing && (!capaAt || (capaAt.x === 0 && capaAt.y === 0 && capaAt.w === 12));

  const nodes = {
    "s-capa": (
      <Capa
        client={client}
        name={name}
        subtitle={coverValue.address || `${int(total)} ${resultLower} · ${periodLabel.toLowerCase()}`}
        campaigns={topCampaigns.map((c) => ({ id: c.id, name: c.name, note: `${platformName(c.platform)} · ${int(c.conversions)} ${resultLower}` }))}
        campaignShare={campaignTotal > 0 ? pct(topCampaigns.reduce((a, c) => a + c.conversions, 0) / campaignTotal, 0) : "—"}
        funnel={funnel}
        funnelSource={launch ? "Planilha do lançamento" : funnel[0] ? `% sobre o total de ${plural(funnel[0].label.toLowerCase())}` : ""}
        funnelValue={launch ? (launch.value > 0 ? brlCompact(launch.value) : int(launch.sales)) : counted && funnel[0] ? funnel[0].display : int(total)}
        funnelUnit={launch ? (launch.value > 0 ? "em vendas" : "vendas") : counted && funnel[0] ? funnel[0].label.toLowerCase() : resultLower}
        platforms={ds.adPlatforms.map((id, i) => ({ id, name: platformName(id), color: colorAt(i) }))}
        sheet={sheet?.connect ? { label: sheet.state.summary ? "Planilha ligada" : "Ligar a planilha do lançamento", onOpen: () => setDialog("planilha") } : launch ? { label: "Planilha do lançamento" } : undefined}
        period={controls ? undefined : periodLabel}
        onEdit={cover?.onChange ? () => setDialog("capa") : undefined}
        art={artBehind ? undefined : <CoverArt cover={coverValue} inside />}
      />
    ),

    "s-resultado": (
      <Card icon={Users} title={resultName} {...openOf("crm", "funil", "campanhas")}>
        <Headline v={value(ctx, g.conv)} delta={cmp ? change(ctx, g.conv) : undefined} note={versus} />
        {sources.length > 1 && biggest ? (
          <>
            <ArcMeter
              className="mt-1 flex-1"
              parts={sources.map((s) => ({ value: s.value, color: s.color }))}
              label={biggest.short}
              value={int(biggest.value)}
              summary={`${resultName} por ${launch ? "origem" : "plataforma"}: ${sources.map((s) => `${s.label} ${int(s.value)}`).join(", ")}.`}
            />
            <Legend items={sources.map((s) => ({ label: s.short, color: s.color, note: sourceTotal > 0 ? pct(s.value / sourceTotal, 0) : undefined }))} />
          </>
        ) : showQualified ? (
          <>
            <ArcMeter className="mt-1 flex-1" parts={[{ value: qualified, color: P.accent }]} total={total} label="Qualificados" value={int(qualified)} summary={`${int(qualified)} qualificados de ${int(total)} ${resultLower}.`} />
            <Legend items={[{ label: "Qualificados", color: P.accent, note: pct(qualified / total, 0) }]} />
          </>
        ) : (
          <>
            <ArcMeter
              className="mt-1 flex-1"
              parts={topCampaigns[0] ? [{ value: topCampaigns[0].conversions, color: P.accent }] : []}
              total={campaignTotal}
              label="Maior campanha"
              value={topCampaigns[0] ? int(topCampaigns[0].conversions) : "—"}
              summary={topCampaigns[0] ? `A maior campanha, ${topCampaigns[0].name}, trouxe ${int(topCampaigns[0].conversions)} de ${int(campaignTotal)} ${resultLower}.` : `Sem campanhas com ${resultLower} no período.`}
            />
            {topCampaigns[0] && <Legend items={[{ label: topCampaigns[0].name, color: P.accent, note: campaignTotal > 0 ? pct(topCampaigns[0].conversions / campaignTotal, 0) : undefined }]} />}
          </>
        )}
      </Card>
    ),

    "s-ritmo": (
      <Card icon={CalendarDays} title={label(ctx, paceKey)} {...openOf("campanhas", "meta-ads", "google-ads", "funil")}>
        <Headline v={value(ctx, paceKey)} delta={cmp ? change(ctx, paceKey) : undefined} note={pace.size > 1 ? `a cada ${pace.size} dias` : "por dia"} />
        <CapsuleBars
          className="mt-2 flex-1"
          values={pace.values}
          labels={paceLabels}
          format={paceFormat}
          what={label(ctx, paceKey).toLowerCase()}
          summary={`${label(ctx, paceKey)} ${pace.size > 1 ? `a cada ${pace.size} dias` : "por dia"}: ${pace.values.map((v, i) => `${paceLabels[i]} ${paceFormat(v)}`).join(", ")}.`}
        />
      </Card>
    ),

    "s-verba": (
      <Card icon={Wallet} title="Verba do mês" {...openOf("metas", "campanhas")}>
        {withBudget ? (
          <Headline v={pct(budget.spent / budget.monthly, 0)} note={`usada · dia ${budget.day} de ${budget.daysInMonth}`} />
        ) : (
          // sem verba: o convite (o investimento do período não é a verba do mês)
          <Headline v="—" note="sem verba definida" />
        )}
        <TrackMeter
          className="mt-1 flex-1"
          share={withBudget ? budget.spent / budget.monthly : 0}
          label={withBudget ? "Investido no mês" : "Sem verba definida"}
          value={withBudget ? brlCompact(budget.spent) : "—"}
          summary={withBudget ? `Verba do mês: ${brlCompact(budget.spent)} de ${brlCompact(budget.monthly)}, dia ${budget.day} de ${budget.daysInMonth}.` : "Verba do mês não definida."}
        />
        <div className="mt-1.5 flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-0.5">
          {withBudget ? (
            <Status good={projected <= budget.monthly}>
              fecha em {brlCompact(projected)} de {brlCompact(budget.monthly)}
            </Status>
          ) : (
            <span className="text-[11.5px] font-medium text-accent">{BUDGET_INVITE}</span>
          )}
        </div>
        {spendBy.length > 1 && <Legend items={spendBy.map((s) => ({ label: s.label, color: s.color, note: spendTotal > 0 ? pct(s.value / spendTotal, 0) : undefined }))} />}
      </Card>
    ),

    "s-lancamento": launch ? (
      <LaunchSection launch={launch} hideMoney={hide} onSheet={sheet?.connect ? () => setDialog("planilha") : undefined} />
    ) : sheet?.connect ? (
      <section className={`${GLASS} flex h-full min-w-0 flex-col items-start justify-center gap-2 px-5 py-5`} data-convite-planilha>
        <p className="text-[15px] font-medium tracking-tight">{sheet.state.summary ? "A planilha está ligada, mas não tem linhas neste período" : "Ligue a planilha do lançamento"}</p>
        <p className="max-w-[60ch] text-[12.5px] text-fg-2">
          As plataformas não enxergam o que acontece depois do lead: com a planilha (origem, proposta, venda e valor), esta seção mostra de onde vêm as vendas e quanto o lançamento já vendeu.
        </p>
        <button type="button" onClick={() => setDialog("planilha")} className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-[12.5px] font-medium text-on-accent">
          <FileSpreadsheet size={14} aria-hidden /> {sheet.state.summary ? "Ver a planilha" : "Ligar a planilha"}
        </button>
      </section>
    ) : null,
    "s-estados": (
      <Card icon={MapPin} title={stateBy === "resultados" ? "De onde vêm os resultados" : "Onde os anúncios aparecem"}>
        <div className="flex min-h-0 flex-1 items-center gap-4">
          <BrTiles shares={states} color={P.accent} tone={tone} />
          <ol className="min-w-0 flex-1 space-y-1.5 text-[12px]">
            {topStates.map(([uf, share]) => (
              <li key={uf} className="flex items-center justify-between gap-2">
                <span className="truncate">{BR_STATES[uf] ?? uf}</span>
                <span className="font-medium tnum">{pct(share, 0)}</span>
              </li>
            ))}
          </ol>
        </div>
        <p className="mt-2 shrink-0 text-[10.5px] text-fg-2">{stateBy === "resultados" ? `${resultName} por estado, pela Meta.` : "A Meta não informa resultado por estado: a divisão é das impressões."}</p>
      </Card>
    ),
    "s-horas": (
      <Card icon={Clock} title="Horário de pico">
        <Headline v={peakHour !== null ? `${peakHour}h` : "—"} note={`mais ${resultLower} · bom para escalar o atendimento`} />
        <HourBars values={hours} color={P.accent} tone={tone} what={resultName} />
      </Card>
    ),
    "s-custo": (
      <Card icon={Target} title={costLabel} {...openOf("campanhas", "meta-ads", "google-ads")}>
        <Headline v={value(ctx, g.cost)} delta={cmp ? change(ctx, g.cost) : undefined} note={versus} />
        <DialMeter
          className="mt-1 flex-1"
          share={withGoal ? cost / (ds.goal * 2) : null}
          scale={withGoal ? [brl(ds.goal / 2, { decimals: false }), brl(ds.goal, { decimals: false }), brl(ds.goal * 1.5, { decimals: false })] : undefined}
          label={withGoal ? "do alvo" : "Sem alvo"}
          value={withGoal ? pct(cost / ds.goal, 0) : "—"}
          summary={withGoal ? `${costLabel}: ${value(ctx, g.cost)}, ${pct(cost / ds.goal, 0)} do alvo de ${brl(ds.goal, { decimals: false })}.` : `${costLabel}: ${value(ctx, g.cost)}. Alvo não definido.`}
        />
        <div className="mt-1 flex shrink-0 justify-center">
          {withGoal ? <Status good={cost <= ds.goal}>{cost <= ds.goal ? "dentro do alvo" : "acima do alvo"}</Status> : <span className="text-[11.5px] font-medium text-accent">{GOAL_INVITE}</span>}
        </div>
      </Card>
    ),
  };

  // seções: a capa com os quatro medidores (a primeira tela) vem da grade salva; lançamento e região descem na rolagem
  const saved = grid?.items ?? skinGrid("fachada");
  const below = new Set(["s-lancamento", "s-estados", "s-horas"]);
  const coverItems = saved.filter((it) => !below.has(it.id));
  const present = new Set(saved.map((it) => it.id).filter((id) => !hidden.includes(id)));
  const regionIds = ["s-estados", "s-horas"].filter((id) => present.has(id));
  const regionShown = regionIds.length > 0;
  const launchNode = present.has("s-lancamento") ? nodes["s-lancamento"] : null;

  return (
    // na tela do dashboard (screen) não há moldura de fora: o painel vai de ponta a ponta e ocupa a altura da tela
    <div data-chart-theme className={screen ? "@container" : "@container rounded-[32px] p-2.5 @[700px]:p-4"} style={{ ...themeVars(P), background: screen ? P.bg : OUTER }}>
      <div className={screen ? "min-h-dvh px-4 pt-3 pb-[var(--screen-pb,7rem)] @[700px]:px-6" : "rounded-[26px] p-4 @[700px]:p-6"} style={{ background: BG }}>
        <SkinBar palette={P} bar={bar} className="mb-3" />

        {/* fora da tela do painel (galeria, link público, PDF): a marca, o cliente e o período */}
        {!bar && (
          <div className="mb-4 flex items-center gap-2.5">
            <span className={`${ROUND} size-10`}>
              <Mark />
            </span>
            {/* o selo com o cliente e o período saiu: repetia o que a capa e os controles já mostram */}
          </div>
        )}

        <SkinChrome palette={P} controls={controls} note={note} screen={screen} className="mb-4" />

        <div className="flex flex-col gap-3 @[900px]:flex-row @[900px]:gap-4">
          <Rail pages={pages} active={active} onPage={onPage} sections={children || grid?.editing ? undefined : SECTIONS.filter((sec) => sec.id === "capa" || (sec.id === "lancamento" ? !!launchNode : regionShown))} />
          <div className="@container relative min-w-0 flex-1">
            {children ? (
              <>
                {/* nas outras abas: o nome da aba no lugar do título da capa */}
                <header className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium tracking-[0.14em] text-fg-2 uppercase">
                      {client} · {name}
                    </p>
                    <h2 className="mt-0.5 truncate text-[26px] leading-tight font-normal tracking-[-0.03em]">{PAGES[active].name}</h2>
                  </div>
                  {!(active === "criativos" && cards && cards.level !== "list") && <p className="hidden max-w-[46ch] text-right text-[12px] leading-snug text-fg-2 @[900px]:block">{PAGES[active].description}</p>}
                </header>
                {/* respiro dos cards de número e dos painéis nas abas padrão (só neste visual) */}
                <style>{FACHADA_PAGE_CSS}</style>
                {/* Público (e a aba da Meta): de onde vêm e quando chamam, no tamanho de leitura */}
                {(active === "publico" || active === "meta-ads") && regionIds.length > 0 && (
                  <div className="mb-4 grid gap-4 @[900px]:grid-cols-2" data-regiao-contato>
                    {regionIds.map((id) => (
                      <div key={id} className="h-[300px] min-w-0 [&>*]:h-full">
                        {nodes[id as keyof typeof nodes]}
                      </div>
                    ))}
                  </div>
                )}
                <SkinPage palette={P} className="fachada-page [--radius-card:20px] [&_.m-in]:rounded-[20px] [&_.m-in]:shadow-[inset_0_1px_0_rgb(255_255_255/0.7)]">
                  {active === "criativos" && cards && cards.level !== "list" ? <SkinCreatives kind="fachada" list={cards.source} data={cards.data} kpis={cards.kpis} /> : children}
                </SkinPage>
              </>
            ) : (
              grid?.editing ? (
                // no Personalizar, a grade de sempre (todos os blocos): esconder e adicionar valem nas seções
                <div className="relative z-10">
                  <SkinGrid skin="fachada" ctx={ctx} grid={grid} nodes={nodes} hide={hidden} />
                </div>
              ) : (
                <>
                  {/* a capa e o resultado: a primeira tela da página do empreendimento */}
                  <section id="secao-capa" className="relative scroll-mt-4">
                    {artBehind && <CoverArt cover={coverValue} />}
                    <div className="relative z-10">
                      <SkinGrid skin="fachada" ctx={ctx} grid={grid ? { ...grid, items: coverItems } : { items: coverItems }} nodes={nodes} hide={hidden} />
                    </div>
                  </section>
                  {launchNode && (
                    <section id="secao-lancamento" className="mt-8 scroll-mt-4" data-secao="lancamento">
                      <SectionTitle icon={FileSpreadsheet} title="Lançamento" note="da planilha do lançamento: origem dos leads, propostas, vendas e valor" />
                      {launchNode}
                    </section>
                  )}
                  {regionShown && (
                    <section id="secao-regiao" className="mt-8 scroll-mt-4" data-secao="regiao">
                      <SectionTitle icon={MapPin} title="De onde vêm e quando chamam" note={stateBy === "resultados" ? "pela Meta: estado e hora de cada resultado" : "pela Meta: onde os anúncios aparecem e a hora de cada resultado"} />
                      <div className="grid gap-4 @[900px]:grid-cols-2">
                        {regionIds.map((id) => (
                          <div key={id} className="h-[300px] min-w-0 [&>*]:h-full">
                            {nodes[id as keyof typeof nodes]}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )
            )}
          </div>
        </div>
      </div>

      {cover?.onChange && <CoverDialog open={dialog === "capa"} onClose={() => setDialog(null)} cover={cover} />}
      {sheet?.connect && <SheetDialog open={dialog === "planilha"} onClose={() => setDialog(null)} sheet={sheet} />}
    </div>
  );
}
