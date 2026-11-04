"use client";

import { ArrowRight, Check, LayoutTemplate } from "lucide-react";
import Link from "next/link";
import { type PointerEvent, type ReactNode } from "react";
import { CutReveal } from "@/components/motion/CutReveal";
import { Reveal } from "@/components/motion/Reveal";
import { SectionWipe } from "@/components/motion/SectionWipe";
import { Odometer } from "@/components/ui/Odometer";
import { Segmented } from "@/components/ui/Segmented";
import { btn } from "@/components/ui/styles";
import { SHOW_LANDING_PAGES } from "@/features/marketing/config";
import { usePlan } from "@/features/marketing/state/PlanProvider";
import { ENTITLEMENTS } from "@/features/pricing/entitlements";
import {
  ANNUAL_SAVING_PCT,
  DEFAULT_STATE,
  LP_PLAN_PAGES,
  PLAN_LABEL,
  lpMonthly,
  lpSetup,
  startingPrice,
  toQuery,
  type Period,
  type PlanId,
  type Product,
} from "@/features/pricing/pricing";
import { brl } from "@/lib/format";
import { MSG_SPECIALIST, waLink } from "@/lib/whatsapp";
import { AudioWave } from "./AudioWave";
import { SoonBadge } from "./SoonBadge";

// Planos: dois produtos (dashboards e landing pages, esta atrás de
// SHOW_LANDING_PAGES), três planos cada, e um clique até o checkout. Contas a mais, extras e marca própria ficam dentro do app.

const TIERS: PlanId[] = ["base", "pro", "avancado"];

// Em todos os cartões: o que vale para qualquer plano.
const COMMON: ReactNode[] = [
  <>
    Integre com sua IA (MCP)
    <SoonBadge />
  </>,
  <>
    App nativo iOS e Android
    <SoonBadge />
  </>,
  "Dashboards responsivos",
];

type Card = {
  pitch: string;
  templates: string;
  features: ReactNode[];
  /** Linha pequena abaixo do preço. */
  caption: string;
  price: number;
  /** Cobrança única na entrada (LP). */
  setup?: number;
  top?: ReactNode;
};

function dashCard(tier: PlanId, period: Period): Card {
  const e = ENTITLEMENTS[tier];
  const base = {
    price: startingPrice(tier, period),
    caption: `${period === "anual" ? "no anual" : "no mensal"} · 1 conta conectada`,
    templates: `${e.dashboardTemplates} templates de dashboard`,
  };
  if (tier === "base") {
    return {
      ...base,
      pitch: "Você conecta as contas e escolhe o template. Pronto em minutos.",
      features: ["Meta e Google por login; GA4 em breve", `${e.maxDashboards} dashboards, um para cada plataforma`, "Criativos em lista", "Link para o cliente e PDF", "1 usuário", ...COMMON],
    };
  }
  if (tier === "pro") {
    return {
      ...base,
      pitch: "Tudo do Básico, com o tracking ligado pelo nosso time.",
      features: [
        "Tudo do Básico",
        <>
          Mais plataformas: mídia, marketplaces e CRMs
          <SoonBadge />
        </>,
        "Criativos em galeria, com previews",
        "API de Conversões da Meta, conversões otimizadas e GA4 configurados pelo time",
        `${e.maxDashboards} dashboards · ${e.maxMembers} usuários`,
        ...COMMON,
      ],
    };
  }
  return {
    ...base,
    top: <AudioWave />,
    pitch: "Tudo do Padrão, com análise por voz e comparativo de criativos.",
    features: ["Tudo do Padrão", "Análise por voz: pergunte e ouça a leitura dos números", "Comparativo de criativos", `${e.maxDashboards} dashboards · ${e.maxMembers} usuários`, ...COMMON],
  };
}

function lpCard(tier: PlanId): Card {
  const pages = LP_PLAN_PAGES[tier];
  const e = ENTITLEMENTS[tier];
  const base = {
    price: lpMonthly(tier),
    setup: lpSetup(tier),
    caption: `hospedagem e ajustes · ${pages} ${pages === 1 ? "página" : "páginas"}`,
    templates: `${e.landingTemplates} templates de landing page`,
  };
  if (tier === "base") {
    return { ...base, pitch: "Uma landing page feita pelo time, pronta para anúncio.", features: ["1 landing page feita pelo time", "GTM e pixel configurados", "Formulário com os leads no painel", "Link lps.vyzualize.com.br"] };
  }
  if (tier === "pro") {
    return { ...base, pitch: "Três páginas para testar ofertas e públicos.", features: ["Tudo do Básico", "3 landing pages feitas pelo time", "Leads com a origem do clique (UTM)", `${e.maxMembers} usuários`] };
  }
  return { ...base, pitch: "Cinco páginas para quem roda várias campanhas.", features: ["Tudo do Padrão", "5 landing pages feitas pelo time", "Todos os templates", `${e.maxMembers} usuários`] };
}

function PlanCard({ tier, product, period, card, featured, delay }: { tier: PlanId; product: Product; period: Period; card: Card; featured: boolean; delay: number }) {
  // checkout direto: o plano, o período e 1 conta (contas a mais ficam no app)
  const href = `/assinar?${toQuery({ ...DEFAULT_STATE, produto: product, plano: tier, periodo: product === "lp" ? "mensal" : period, meta: 1, google: 0 })}`;

  function spotlight(e: PointerEvent<HTMLElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  }

  const id = `plano-${product}-${tier}`;
  return (
    <Reveal delay={delay} className={featured ? "" : "lg:my-8"}>
      <article
        aria-labelledby={id}
        onPointerMove={spotlight}
        className={`group relative flex h-full flex-col overflow-hidden rounded-card border p-6 transition-colors duration-300 sm:p-7 ${
          featured ? "border-accent bg-accent text-on-accent lg:py-12" : "border-line bg-card text-fg hover:border-accent"
        }`}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: `radial-gradient(260px circle at var(--mx, 50%) var(--my, 0%), color-mix(in srgb, ${featured ? "var(--on-accent)" : "var(--accent)"} 14%, transparent), transparent 70%)`,
          }}
        />
        <div className="relative flex h-full flex-col">
          {card.top}
          <div className="flex items-center justify-between gap-3">
            <h3 id={id} className="title text-2xl">
              {PLAN_LABEL[tier]}
            </h3>
            {featured && <span className="rounded-chip bg-on-accent px-2.5 py-0.5 text-[12px] font-semibold text-accent">Mais escolhido</span>}
          </div>
          <p className={`mt-2 text-[15px] leading-relaxed ${featured ? "" : "text-fg-2"}`}>{card.pitch}</p>

          <div className="mt-6">
            <p className={`label-caps ${featured ? "" : "text-fg-2"}`}>{product === "dash" ? "a partir de" : "mensal"}</p>
            <p className="mt-1 flex items-baseline gap-1">
              <span className="text-[2.6rem] leading-none font-extrabold tracking-[-0.03em]">
                <Odometer value={brl(card.price)} />
              </span>
              <span className={`text-sm ${featured ? "" : "text-fg-2"}`}>/mês</span>
            </p>
            <p className={`mt-1.5 text-[13px] ${featured ? "" : "text-fg-2"}`}>{card.caption}</p>
            {card.setup ? (
              <p className={`mt-1 text-[13px] font-semibold ${featured ? "" : "text-fg"}`}>+ {brl(card.setup, { decimals: false })} na criação, uma vez</p>
            ) : null}
          </div>

          <p className={`mt-5 flex items-center gap-2 rounded-control border px-3 py-2 text-[13.5px] font-semibold ${featured ? "border-current/25" : "border-line text-fg"}`}>
            <LayoutTemplate size={16} aria-hidden className={featured ? "" : "text-accent"} />
            {card.templates}
          </p>

          <ul className="mt-5 flex-1 space-y-2.5 text-[15px]">
            {card.features.map((f, i) => (
              <li key={i} className="flex gap-2.5">
                <Check size={18} aria-hidden className={`mt-0.5 shrink-0 ${featured ? "" : "text-accent"}`} />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <Link
            href={href}
            className={`${featured ? "bg-on-accent text-accent hover:opacity-90" : "bg-accent text-on-accent hover:opacity-90"} mt-7 inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-control font-semibold transition-[opacity,transform] duration-200 active:scale-[0.98]`}
          >
            Assinar o {PLAN_LABEL[tier]}
            <ArrowRight size={17} aria-hidden />
          </Link>
        </div>
      </article>
    </Reveal>
  );
}

export function Planos() {
  const { state, update } = usePlan();
  // com as LPs fora do site, ?produto=lp na URL também cai nos dashboards
  const product: Product = SHOW_LANDING_PAGES ? state.produto : "dash";

  return (
    <section id="planos" aria-labelledby="planos-title" className="relative">
      <SectionWipe />
      <div className="mx-auto max-w-[1360px] px-4 pt-20 pb-24 sm:px-6 lg:px-10 lg:pt-28">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="label-caps text-fg-2">Planos</p>
            <CutReveal
              as="h2"
              id="planos-title"
              className="display mt-5 text-[clamp(2.4rem,6.4vw,5.6rem)] text-fg"
              lineClassName={(i) => (i === 1 ? "text-accent" : "")}
              lines={["Escolha o plano.", "Comece hoje."]}
            />
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            {SHOW_LANDING_PAGES && (
              <Segmented
                label="Produto"
                value={product}
                onChange={(produto) => update({ produto })}
                options={[
                  { value: "dash", label: "Dashboards" },
                  { value: "lp", label: "Landing pages" },
                ]}
              />
            )}
            {product === "dash" ? (
              <Segmented
                size="sm"
                label="Período de cobrança"
                value={state.periodo}
                onChange={(periodo) => update({ periodo })}
                options={[
                  { value: "mensal", label: "Mensal" },
                  {
                    value: "anual",
                    label: "Anual",
                    badge: <span className="rounded-chip bg-accent-soft px-1.5 py-px text-[11px] font-semibold text-fg">−{ANNUAL_SAVING_PCT}%</span>,
                  },
                ]}
              />
            ) : (
              <p className="text-[13px] text-fg-2">Cobrança mensal · criação paga uma vez</p>
            )}
          </div>
        </div>

        <div key={product} className="mt-12 grid items-stretch gap-4 lg:mt-14 lg:grid-cols-[1fr_1.12fr_1fr]">
          {TIERS.map((tier, i) => (
            <PlanCard
              key={tier}
              tier={tier}
              product={product}
              period={state.periodo}
              card={product === "dash" ? dashCard(tier, state.periodo) : lpCard(tier)}
              featured={tier === "pro"}
              delay={i * 110}
            />
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 text-sm text-fg-2 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {product === "dash"
              ? "Valores em reais · contas a mais, dashboards extras e marca própria você liga dentro do painel"
              : "Valores em reais · mais páginas e domínio próprio você liga dentro do painel"}
          </p>
          <a href={waLink(MSG_SPECIALIST)} target="_blank" rel="noopener noreferrer" className={`${btn.ghost} -ml-3 w-fit sm:ml-0`}>
            Dúvida? Fale com um especialista →
          </a>
        </div>
      </div>
    </section>
  );
}
