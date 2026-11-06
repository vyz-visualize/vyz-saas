// Resumo do pedido no checkout, no visual de cupom (picote e linhas
// pontilhadas). Em cima, o preço em destaque (no anual, a parcela em 12x);
// depois o período, os projetos (com a explicação para quem nunca ouviu o
// termo), o que entra no pedido e o que sai hoje. Sem motion: só marcação.

import { Check, CircleHelp } from "lucide-react";
import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { PendingChip } from "@/components/ui/kit";
import { brl } from "@/lib/format";
import {
  EXTRA_PLATFORM_PRICE,
  EXTRA_PROJECT,
  INCLUDED_PROJECTS,
  LP_PLAN_PAGES,
  MAX_EXTRA,
  MAX_PROJECTS_IN_PLAN,
  PLAN_LABEL,
  annualSavingPct,
  type Period,
  type PlanId,
  type PlanState,
  type Quote,
} from "@/features/pricing/pricing";

type OrderSummaryProps = {
  state: PlanState;
  quote: Quote;
  amountDueNowCents: number;
  recurringCents: number;
  /** "Alterar pedido": volta aos planos com a mesma seleção. */
  editHref?: string;
  simulated?: boolean;
  className?: string;
  /** Link do mesmo pedido com outra seleção: liga período, projetos e plataforma extra. */
  adjustHref?: (patch: Partial<PlanState>) => string;
};

const stepBtn =
  "inline-flex size-9 items-center justify-center rounded-full border border-line text-[17px] font-semibold text-fg transition-colors hover:border-accent hover:text-accent";
const off = "pointer-events-none opacity-30";

function Stepper({ label, value, min, max, href }: { label: string; value: number; min: number; max: number; href: (n: number) => string }) {
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <Link
        href={href(value - 1)}
        scroll={false}
        replace
        aria-label={`Menos: ${label}`}
        aria-disabled={value <= min}
        className={`${stepBtn} ${value <= min ? off : ""}`}
      >
        −
      </Link>
      <span className="w-8 text-center text-[20px] font-bold tnum" aria-live="polite">
        {value}
      </span>
      <Link
        href={href(value + 1)}
        scroll={false}
        replace
        aria-label={`Mais: ${label}`}
        aria-disabled={value >= max}
        className={`${stepBtn} ${value >= max ? off : ""}`}
      >
        +
      </Link>
    </div>
  );
}

/** Mensal × anual, com o desconto do anual no próprio botão. */
function PeriodSwitch({ plan, period, href }: { plan: PlanId; period: Period; href: (p: Period) => string }) {
  const item = (p: Period, label: string, badge?: string) => (
    <Link
      href={href(p)}
      scroll={false}
      replace
      aria-current={period === p ? "true" : undefined}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[13.5px] font-semibold transition-colors ${
        period === p ? "bg-accent text-on-accent" : "text-fg-2 hover:text-fg"
      }`}
    >
      {label}
      {badge && <span className={`rounded-chip px-1.5 py-px text-[11px] ${period === p ? "bg-on-accent/15" : "bg-accent-soft text-fg"}`}>{badge}</span>}
    </Link>
  );
  return (
    <div className="flex rounded-full border border-line bg-bg p-1" role="group" aria-label="Período de cobrança">
      {item("mensal", "Mensal")}
      {item("anual", "Anual", `−${annualSavingPct(plan)}%`)}
    </div>
  );
}

/** O que é um projeto, em linguagem de quem nunca ouviu o termo. */
function ProjectHelp() {
  return (
    <details className="group mt-2 text-[13px]">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-semibold text-accent underline-offset-4 hover:underline">
        <CircleHelp size={14} aria-hidden /> O que é um projeto?
      </summary>
      <div className="mt-2 space-y-2 rounded-control border border-line bg-bg p-3 leading-relaxed text-fg-2">
        <p>
          <strong className="font-semibold text-fg">Projeto é cada empresa que você acompanha</strong>: a sua loja, ou cada cliente, se você é agência ou gestor
          de tráfego.
        </p>
        <p>
          Exemplo: você cuida da <span className="text-fg">Padaria do João</span>, da <span className="text-fg">Loja da Maria</span> e da{" "}
          <span className="text-fg">Clínica Sorriso</span>. São 3 projetos. Em cada um você conecta o Meta Ads e o Google Ads daquela empresa e monta os
          dashboards dela.
        </p>
        <p>Começou um cliente novo? Some um projeto quando quiser, no painel.</p>
      </div>
    </details>
  );
}

export function OrderSummary({
  state,
  quote: q,
  amountDueNowCents,
  recurringCents,
  editHref,
  simulated = false,
  className = "",
  adjustHref,
}: OrderSummaryProps) {
  const noPlan = state.plano === "sem";
  const annual = state.periodo === "anual";
  const lp = state.produto === "lp";
  const plan = noPlan ? null : (state.plano as PlanId);
  const pages = !plan || !lp ? 0 : LP_PLAN_PAGES[plan];
  const dash = !!plan && !lp;
  const extraProjects = Math.max(0, q.projects - INCLUDED_PROJECTS);
  // no anual, a parcela em 12x é o que todo mês custaria (sem juros)
  const installment = annual && recurringCents > 0 ? Math.round(recurringCents / 12) : 0;
  const lines = q.lines.filter((l) => l.kind !== "included");

  return (
    <div className={className}>
      <section aria-labelledby="pedido-titulo" className="receipt relative bg-card px-5 pt-7 pb-8 text-fg sm:px-7">
        <div className="flex items-center justify-between">
          <h2 id="pedido-titulo" className="label-caps text-fg-2">
            Seu pedido
          </h2>
          <Wordmark className="w-10 text-fg-2" decorative />
        </div>

        <p className="mt-3 text-[13px] text-fg-2">{lp ? "Landing pages" : noPlan ? "Sem plano" : "Plano"}</p>
        <p className="title text-[26px] leading-tight text-fg">{plan ? PLAN_LABEL[plan] : "Só extras"}</p>

        {/* preço em destaque */}
        {recurringCents > 0 && (
          <div className="mt-4 rounded-[16px] border border-accent/40 bg-[linear-gradient(150deg,color-mix(in_srgb,var(--accent)_16%,transparent),transparent_70%)] p-4">
            {annual ? (
              <>
                <p className="text-[13px] font-semibold text-fg-2">12x sem juros de</p>
                <p className="mt-0.5 flex items-baseline gap-1">
                  <span className="text-[2.6rem] leading-none font-extrabold tracking-[-0.03em] tnum">{brl(installment)}</span>
                </p>
                <p className="mt-2 text-[13px] text-fg-2">
                  ou <strong className="font-semibold text-fg tnum">{brl(recurringCents)}</strong> à vista · cobrado uma vez por ano
                </p>
              </>
            ) : (
              <>
                <p className="flex items-baseline gap-1">
                  <span className="text-[2.6rem] leading-none font-extrabold tracking-[-0.03em] tnum">{brl(q.monthly)}</span>
                  <span className="text-[15px] font-semibold text-fg-2">/mês</span>
                </p>
                <p className="mt-2 text-[13px] text-fg-2">Cobrado todo mês. Cancele quando quiser.</p>
              </>
            )}
            {dash && annual && q.annualSaving > 0 && (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-chip bg-accent px-2.5 py-1 text-[12.5px] font-semibold text-on-accent">
                <Check size={13} strokeWidth={3} aria-hidden /> Você economiza {brl(q.annualSaving)} por ano
              </p>
            )}
            {dash && !annual && plan && (
              <p className="mt-3 text-[13px] text-fg">
                No anual sai por <strong className="font-semibold tnum">{brl(q.monthlyAnual)}/mês</strong> ({annualSavingPct(plan)}% a menos).
              </p>
            )}
          </div>
        )}

        {dash && adjustHref && (
          <div className="mt-4">
            <PeriodSwitch plan={plan} period={state.periodo} href={(periodo) => adjustHref({ periodo })} />
          </div>
        )}

        {/* projetos */}
        {dash && (
          <div className="dotted mt-5 pt-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-fg">Projetos</p>
                <p className="text-[12.5px] leading-snug text-fg-2">
                  {INCLUDED_PROJECTS} inclusos · cada um a mais, <span className="whitespace-nowrap tnum">{brl(EXTRA_PROJECT[plan][state.periodo])}/mês</span>
                </p>
              </div>
              {adjustHref ? (
                <Stepper label="projetos" value={q.projects} min={INCLUDED_PROJECTS} max={MAX_PROJECTS_IN_PLAN} href={(n) => adjustHref({ projetos: n })} />
              ) : (
                <span className="text-[20px] font-bold tnum">{q.projects}</span>
              )}
            </div>
            <ProjectHelp />
            {plan === "base" && adjustHref && (
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-fg">Plataforma extra</p>
                  <p className="text-[12.5px] leading-snug text-fg-2">TikTok, LinkedIn e outras fora do Básico · {brl(EXTRA_PLATFORM_PRICE)}/mês cada</p>
                </div>
                <Stepper label="plataformas extras" value={state.plataformas} min={0} max={MAX_EXTRA} href={(n) => adjustHref({ plataformas: n })} />
              </div>
            )}
          </div>
        )}
        {lp && plan && (
          <p className="dotted mt-5 pt-4 text-[13.5px] text-fg-2">
            {pages} {pages === 1 ? "landing page feita" : "landing pages feitas"} pelo time, com hospedagem e ajustes.
          </p>
        )}

        {/* o que entra no pedido */}
        <ul className="dotted mt-5 space-y-1 pt-3" aria-label="O que entra no pedido">
          {lines.map((l) => (
            <li key={l.id} className="flex items-baseline justify-between gap-3 py-1 text-[13.5px]">
              <span className="min-w-0 text-fg">
                {l.id === "plan" && dash ? `Plano ${PLAN_LABEL[plan]} · ${INCLUDED_PROJECTS} projetos` : l.label}
                {l.detail && l.id !== "plan" && <span className="block text-[12px] text-fg-2">{l.detail}</span>}
              </span>
              <span className="shrink-0 text-right font-medium text-fg-2 tnum">
                {brl(l.amount)}
                {l.kind === "monthly" && "/mês"}
                {l.kind === "once" && <span className="block text-[11.5px] font-normal">uma vez</span>}
              </span>
            </li>
          ))}
          {dash && extraProjects === 0 && (
            <li className="text-[12px] text-fg-2">
              Tem mais clientes? Use o + em Projetos: {brl(EXTRA_PROJECT[plan][state.periodo])}/mês cada, sem pacote fechado.
            </li>
          )}
        </ul>

        {/* hoje */}
        <div className="dotted mt-4 flex items-end justify-between gap-3 pt-4">
          <div>
            <p className="text-[13px] text-fg-2">Total hoje</p>
            <p className="text-[1.6rem] leading-tight font-extrabold tracking-[-0.02em] tnum">{brl(amountDueNowCents)}</p>
          </div>
          <p className="max-w-[55%] text-right text-[12.5px] leading-snug text-fg-2">
            {recurringCents > 0
              ? annual
                ? `Renova em 12 meses por ${brl(recurringCents)}${q.oneTime > 0 ? ` · ${brl(q.oneTime)} de itens únicos hoje` : ""}`
                : `Depois, ${brl(recurringCents)} todo mês${q.oneTime > 0 ? ` · ${brl(q.oneTime)} de itens únicos hoje` : ""}`
              : "Pagamento único, sem mensalidade."}
          </p>
        </div>
      </section>
      {/* fora do cupom: a máscara do picote cortaria o tooltip */}
      {(editHref || simulated) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1">
          {simulated ? (
            <PendingChip label="Pagamento simulado" detail="Nesta versão nenhum valor é cobrado. A cobrança real (cartão, PIX e boleto) entra com a Stripe." />
          ) : (
            <span />
          )}
          {editHref && (
            <Link href={editHref} className="text-[14px] font-semibold text-accent underline-offset-4 hover:underline">
              Alterar pedido
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
