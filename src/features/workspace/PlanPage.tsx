"use client";

// Página Plano: o plano da sessão, o uso, a troca de plano/período/contas
// (prévia do ajuste com quotePlanChange e o mesmo bloqueio do servidor), o
// cancelamento e o histórico da cobrança (faturas, pagamentos, linha do
// tempo e pedidos de serviço). Só o dono troca e cancela; admin vê a
// cobrança; os demais veem o plano e o uso.
// Três abas: Plano (assinatura, uso, troca e cancelamento), Cobrança (faturas, pagamentos,
// linha do tempo e pedidos) e Limites (o comparativo dos planos).

import { CalendarClock, Check, CreditCard, Receipt } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { Badge, Modal, ModalActions, PageHeader, PendingChip, Tabs, type BadgeTone } from "@/components/ui/kit";
import { Segmented } from "@/components/ui/Segmented";
import { btn } from "@/components/ui/styles";
import { useToast } from "@/components/ui/Toast";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { CARD_BRAND_LABEL } from "@/features/checkout/card";
import {
  formatDate,
  INTERVAL_LABEL,
  INVOICE_STATUS_LABEL,
  invoiceDescription,
  PAYMENT_METHOD_LABEL,
  SERVICE_ORDER_STATUS_LABEL,
  SUBSCRIPTION_STATUS_LABEL,
  TRANSACTION_KIND_LABEL,
  TRANSACTION_STATUS_LABEL,
} from "@/features/checkout/labels";
import { planChangeBlocker, planSelection, quotePlanChange, samePlan, type PlanSelection, type PlanUsage } from "@/features/checkout/plan-change";
import { ENTITLEMENTS, LIMIT_ROWS, LIMIT_TIERS, TIER_LABEL, type Tier } from "@/features/pricing/entitlements";
import { annualSavingPct, LP_PLAN_PAGES, MAX_PROJECTS_IN_PLAN, PLAN_PROJECTS, lpMonthly, lpSetup, planMonthly, type Period, type PlanId } from "@/features/pricing/pricing";
import { brl } from "@/lib/format";
import { msgUpgrade, waLink } from "@/lib/whatsapp";
import { cancelSubscription, changePlan, resumeSubscription } from "@/server/billing/actions";
import type { BillingOverview } from "@/server/billing/queries";
import { SHOW_LANDING_PAGES } from "@/lib/flags";
import { useWorkspaceSession } from "./WorkspaceProvider";

const PLAN_IDS: PlanId[] = ["base", "pro", "avancado"];
const toPeriod = (interval: "month" | "year"): Period => (interval === "year" ? "anual" : "mensal");

type Subscription = NonNullable<BillingOverview["subscription"]>;

function Section({ id, title, aside, text, children, className = "" }: { id: string; title: string; aside?: ReactNode; text?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 space-y-5 rounded-card border border-line bg-card p-5 sm:p-6 ${className}`} aria-labelledby={id}>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={id} className="text-[16.5px] font-semibold tracking-[-0.015em]">
            {title}
          </h2>
          {aside}
        </div>
        {text && <p className="mt-1 text-[13.5px] leading-relaxed text-fg-2">{text}</p>}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12.5px] text-fg-2">{label}</dt>
      <dd className="mt-1 font-semibold tnum">{children}</dd>
    </div>
  );
}

const statusTone = (s: string): BadgeTone =>
  s === "active" || s === "trialing" || s === "paid" || s === "succeeded" || s === "delivered" ? "ok" : s === "failed" || s === "past_due" || s === "unpaid" ? "error" : "outline";

function StatusChip({ status, label }: { status: string; label: string }) {
  return <Badge tone={statusTone(status)}>{label}</Badge>;
}

/** Barra de uso do plano: quanto já foi do limite. */
function Meter({ used, limit, label }: { used: number; limit: number; label: string }) {
  const ratio = Math.min(1, used / Math.max(1, limit));
  const over = used > limit;
  return (
    <div>
      <p className="flex items-baseline justify-between gap-3 text-[13.5px]">
        <span className="text-fg-2">{label}</span>
        <span className={`font-semibold tnum ${over ? "text-error-fg" : "text-fg"}`}>
          {used} de {limit}
        </span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${label}: ${used} de ${limit}`}>
        <div className={`h-full rounded-full transition-[width] duration-500 ease-brand ${over || ratio >= 1 ? "bg-error" : ratio >= 0.8 ? "bg-warning" : "bg-accent"}`} style={{ width: `${Math.max(used ? 3 : 0, ratio * 100)}%` }} />
      </div>
    </div>
  );
}

// ---- troca de plano ---------------------------------------------------------------

function ChangePlan({
  sub,
  usage,
  now,
  onDone,
  unlock,
}: {
  sub: Subscription;
  usage: PlanUsage;
  now: string;
  onDone: (msg: string) => void;
  unlock?: PlanId | null;
}) {
  const current: PlanSelection = {
    tier: sub.tier,
    period: toPeriod(sub.interval),
    accounts: sub.accountsQuantity,
  };
  // "Liberar no Padrão" (vitrine do painel) já abre com o plano escolhido
  const [next, setNext] = useState<PlanSelection>(unlock && PLAN_IDS.indexOf(unlock) > PLAN_IDS.indexOf(sub.tier) ? planSelection(unlock, current.period) : current);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const unchanged = samePlan(current, next);
  const blocker = planChangeBlocker(next, usage);
  const quote = useMemo(
    () =>
      quotePlanChange({
        current: {
          ...current,
          periodStart: new Date(sub.currentPeriodStart),
          periodEnd: new Date(sub.currentPeriodEnd),
        },
        next,
        extrasMonthlyCents: sub.extrasMonthlyCents,
        now: new Date(now),
      }),
    // o atual vem da assinatura (muda só quando o servidor manda outra)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sub, next, now],
  );
  // o plano define os projetos (5, 15 ou 30): trocar o plano troca os dois
  const set = (patch: { tier?: PlanId; period?: Period }) => {
    setError(null);
    setNext((n) => planSelection(patch.tier ?? n.tier, patch.period ?? n.period));
  };
  const submit = () =>
    start(async () => {
      const res = await changePlan({ tier: next.tier, period: next.period });
      if (!res.ok) return setError(res.error.message);
      const { chargedCents, creditCents } = res.data;
      onDone(
        chargedCents > 0
          ? `Plano trocado. Cobrado ${brl(chargedCents)}.`
          : creditCents > 0
            ? `Plano trocado. ${brl(creditCents)} de crédito.`
            : "Plano trocado.",
      );
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] font-medium">Período</p>
        <Segmented<Period>
          label="Período"
          size="sm"
          value={next.period}
          onChange={(period) => set({ period })}
          options={[
            { value: "mensal", label: "Mensal" },
            { value: "anual", label: `Anual · ${annualSavingPct(next.tier)}% a menos` },
          ]}
        />
      </div>
      <div role="radiogroup" aria-label="Plano" className="grid gap-2.5 sm:grid-cols-3">
        {PLAN_IDS.map((t) => {
          const on = next.tier === t;
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => set({ tier: t })}
              className={`relative rounded-[calc(var(--r-card)-4px)] border p-4 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent ${on ? "border-accent bg-[color-mix(in_srgb,var(--accent-soft)_55%,transparent)]" : "border-line hover:border-fg-2/50"}`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-[14.5px] font-semibold">{TIER_LABEL[t]}</span>
                {on ? (
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-accent text-on-accent">
                    <Check size={13} aria-hidden strokeWidth={3} />
                  </span>
                ) : (
                  t === current.tier && <Badge tone="outline">atual</Badge>
                )}
              </span>
              <span className="mt-2.5 block text-[20px] leading-none font-bold tracking-[-0.025em] tnum">
                {brl(planMonthly(t, next.period))}
                <span className="text-[12px] font-medium tracking-normal text-fg-2">/mês</span>
              </span>
              <span className="mt-1.5 block text-[12.5px] text-fg-2">até {PLAN_PROJECTS[t]} projetos</span>
            </button>
          );
        })}
      </div>
      <p className="text-[13px] text-fg-2">
        O {TIER_LABEL[next.tier]} vai até <strong className="font-semibold text-fg">{PLAN_PROJECTS[next.tier]} projetos</strong> (clientes ou marcas); você usa{" "}
        {usage.projects}. Mais de {MAX_PROJECTS_IN_PLAN}?{" "}
        <a
          href={waLink(`Olá, VYZ! Tenho mais de ${MAX_PROJECTS_IN_PLAN} projetos e quero o plano Personalizado.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-accent underline-offset-4 hover:underline"
        >
          Plano Personalizado, sob consulta
        </a>
        .
      </p>

      {!unchanged && (
        <dl className="grid gap-3 rounded-[calc(var(--r-card)-4px)] bg-surface-2/70 p-4 text-[13.5px] sm:grid-cols-3" aria-live="polite">
          <Fact label={`Novo valor (${INTERVAL_LABEL[next.period === "anual" ? "year" : "month"]})`}>{brl(quote.recurringCents)}</Fact>
          <Fact label="Cobrado agora">{brl(quote.prorationCents)}</Fact>
          <Fact label={quote.resetsPeriod ? "Novo ciclo até" : "Crédito"}>{quote.resetsPeriod ? formatDate(quote.periodEnd) : brl(quote.creditCents)}</Fact>
          <p className="text-[12px] text-fg-2 sm:col-span-3">
            {quote.resetsPeriod
              ? "Trocar o período recomeça o ciclo hoje; o que sobrou do ciclo atual vira desconto."
              : "A diferença é proporcional aos dias que faltam no ciclo. Trocar para menos vira crédito, sem cobrança."}
          </p>
        </dl>
      )}

      {(blocker || error) && (
        <p role="alert" className="rounded-control bg-error-soft px-3 py-2 text-[13px] text-error-fg">
          {error ?? blocker?.message}
        </p>
      )}
      <button type="button" className={`${btn.small} max-sm:h-11 max-sm:w-full`} disabled={unchanged || !!blocker || pending} onClick={submit}>
        {pending ? "Trocando…" : quote.prorationCents > 0 && !unchanged ? `Trocar e pagar ${brl(quote.prorationCents)}` : "Trocar plano"}
      </button>
    </div>
  );
}

/** Plano de landing pages: as páginas novas são feitas pelo time, então a troca passa por ele. */
function LpChangePlan({ current, unlock }: { current: PlanId; unlock: PlanId | null }) {
  const [pick, setPick] = useState<PlanId>(
    unlock && unlock !== current ? unlock : current === "avancado" ? "avancado" : PLAN_IDS[PLAN_IDS.indexOf(current) + 1],
  );
  const pages = LP_PLAN_PAGES[pick] - LP_PLAN_PAGES[current];
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        {PLAN_IDS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setPick(t)}
            aria-pressed={pick === t}
            className={`rounded-[calc(var(--r-card)-4px)] border p-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${pick === t ? "border-accent bg-[color-mix(in_srgb,var(--accent-soft)_55%,transparent)]" : "border-line hover:border-fg-2/50"}`}
          >
            <span className="flex items-center justify-between gap-2 text-[14.5px] font-semibold">
              {TIER_LABEL[t]}
              {t === current && <Badge tone="outline">atual</Badge>}
            </span>
            <span className="block text-[13px] text-fg-2">
              {LP_PLAN_PAGES[t]} {LP_PLAN_PAGES[t] === 1 ? "página" : "páginas"} · {brl(lpMonthly(t))}/mês
            </span>
          </button>
        ))}
      </div>
      {pick !== current && (
        <p className="text-[13.5px] text-fg-2">
          {pages > 0
            ? `${pages} ${pages === 1 ? "página nova feita" : "páginas novas feitas"} pelo time (${brl(lpSetup(pick) - lpSetup(current), { decimals: false })}, uma vez) e a hospedagem passa a ${brl(lpMonthly(pick))}/mês.`
            : `A hospedagem passa a ${brl(lpMonthly(pick))}/mês. Despublique as páginas acima do novo limite antes.`}
        </p>
      )}
      <a
        href={waLink(msgUpgrade(TIER_LABEL[current], TIER_LABEL[pick], "Quero trocar o plano de landing pages."))}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={pick === current}
        className={`${btn.small} max-sm:h-11 max-sm:w-full ${pick === current ? "pointer-events-none opacity-50" : ""}`}
      >
        <WhatsAppIcon size={15} /> Trocar para o {TIER_LABEL[pick]} com o time
      </a>
    </div>
  );
}

function CancelControls({ sub, onDone }: { sub: Subscription; onDone: (msg: string) => void }) {
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: typeof cancelSubscription, msg: (end: string) => string) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) return setError(res.error.message);
      setConfirm(false);
      onDone(msg(formatDate(res.data.periodEnd)));
    });

  return (
    <div className="space-y-2">
      {sub.cancelAtPeriodEnd ? (
        <>
          <p className="text-[13.5px] text-fg-2">O cancelamento está agendado para {formatDate(sub.currentPeriodEnd)}. Até lá tudo continua funcionando.</p>
          <button type="button" className={btn.small} disabled={pending} onClick={() => run(resumeSubscription, () => "Assinatura retomada.")}>
            {pending ? "Retomando…" : "Retomar assinatura"}
          </button>
        </>
      ) : (
        <button type="button" className={btn.subtle} onClick={() => setConfirm(true)}>
          Cancelar assinatura
        </button>
      )}
      {error && !confirm && (
        <p role="alert" className="text-[13px] text-error-fg">
          {error}
        </p>
      )}
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Cancelar a assinatura">
        <div className="space-y-4 text-[14px]">
          <p>
            A assinatura fica ativa até <strong>{formatDate(sub.currentPeriodEnd)}</strong> e não renova. Os dashboards, as contas e o histórico continuam
            guardados; dá para retomar antes dessa data.
          </p>
          {error && (
            <p role="alert" className="text-[13px] text-error-fg">
              {error}
            </p>
          )}
          <ModalActions>
            <button type="button" className={`${btn.quiet} max-sm:h-11`} onClick={() => setConfirm(false)}>
              Manter assinatura
            </button>
            <button type="button" className={`${btn.danger} max-sm:h-11`} disabled={pending} onClick={() => run(cancelSubscription, (end) => `Cancelamento agendado para ${end}.`)}>
              {pending ? "Cancelando…" : "Cancelar no fim do período"}
            </button>
          </ModalActions>
        </div>
      </Modal>
    </div>
  );
}

// ---- histórico ----------------------------------------------------------------------

/** Linha de cobrança: data e descrição à esquerda; valor e situação à direita. Cabe do celular ao computador. */
function Row({ date, title, sub, status, amount }: { date: string; title: ReactNode; sub?: ReactNode; status: ReactNode; amount: string }) {
  return (
    <li className="flex items-center justify-between gap-4 py-3 text-[13.5px]">
      <span className="min-w-0">
        <span className="block truncate font-medium">{title}</span>
        <span className="block truncate text-[12px] text-fg-2 tnum">
          {date}
          {sub ? <> · {sub}</> : null}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="font-semibold whitespace-nowrap tnum">{amount}</span>
        {status}
      </span>
    </li>
  );
}

function History({ overview }: { overview: BillingOverview }) {
  const { invoices, transactions, timeline, serviceOrders } = overview;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-2">
      <Section id="h-faturas" title="Faturas" aside={<Receipt size={18} aria-hidden className="text-fg-2" />}>
        {invoices.length === 0 ? (
          <p className="text-[13.5px] text-fg-2">Nenhuma fatura ainda.</p>
        ) : (
          <ul className="-my-1 divide-y divide-line">
            {invoices.map((i) => (
              <Row
                key={i.id}
                date={formatDate(i.paidAt ?? i.createdAt)}
                title={invoiceDescription(i.description) ?? i.lines[0]?.label ?? "Fatura"}
                sub={i.periodStart && i.periodEnd ? `${formatDate(i.periodStart)} a ${formatDate(i.periodEnd)}` : undefined}
                status={<StatusChip status={i.status} label={INVOICE_STATUS_LABEL[i.status]} />}
                amount={brl(i.totalCents)}
              />
            ))}
          </ul>
        )}
      </Section>
      <Section id="h-pagamentos" title="Pagamentos" aside={<CreditCard size={18} aria-hidden className="text-fg-2" />}>
        {transactions.length === 0 ? (
          <p className="text-[13.5px] text-fg-2">Nenhum pagamento ainda.</p>
        ) : (
          <ul className="-my-1 divide-y divide-line">
            {transactions.map((t) => (
              <Row
                key={t.id}
                date={formatDate(t.processedAt ?? t.createdAt)}
                title={t.cardBrand ? `${CARD_BRAND_LABEL[t.cardBrand]} •••• ${t.cardLast4 ?? ""}` : t.method ? PAYMENT_METHOD_LABEL[t.method] : "—"}
                sub={t.failureMessage ?? TRANSACTION_KIND_LABEL[t.kind]}
                status={<StatusChip status={t.status} label={TRANSACTION_STATUS_LABEL[t.status]} />}
                amount={brl(t.kind === "charge" ? t.amountCents : -t.amountCents)}
              />
            ))}
          </ul>
        )}
      </Section>
      <Section id="h-linha" title="Linha do tempo da assinatura" aside={<CalendarClock size={18} aria-hidden className="text-fg-2" />}>
        {timeline.length === 0 ? (
          <p className="text-[13.5px] text-fg-2">Nada registrado ainda.</p>
        ) : (
          <ol className="ml-1 space-y-4 border-l border-line pl-5">
            {timeline.map((t) => (
              <li key={t.id} className="relative text-[13.5px]">
                <span className="absolute top-1 -left-[25.5px] size-2.5 rounded-full border-2 border-card bg-accent" aria-hidden />
                <span className="block font-medium">{t.label}</span>
                <span className="text-[12px] text-fg-2">
                  {formatDate(t.createdAt)}
                  {t.actorName ? ` · ${t.actorName}` : ""}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Section>
      <Section id="h-servicos" title="Pedidos de serviço">
        {serviceOrders.length === 0 ? (
          <p className="text-[13.5px] text-fg-2">{SHOW_LANDING_PAGES ? "Nenhum pedido de serviço (landing page feita pelo time, dashboard sob medida)." : "Nenhum pedido de serviço (dashboard sob medida)."}</p>
        ) : (
          <ul className="divide-y divide-line">
            {serviceOrders.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-2.5 text-[13.5px]">
                <span className="min-w-0">
                  <span className="block font-medium">
                    {o.label}
                    {o.quantity > 1 ? ` × ${o.quantity}` : ""}
                  </span>
                  <span className="text-[12px] text-fg-2">
                    Pedido em {formatDate(o.createdAt)}
                    {o.deliveredAt ? ` · entregue em ${formatDate(o.deliveredAt)}` : ""}
                  </span>
                </span>
                <StatusChip status={o.status} label={SERVICE_ORDER_STATUS_LABEL[o.status]} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

// ---- página ---------------------------------------------------------------------------

export function PlanPage({
  overview,
  usage,
  now,
  inactive = false,
  unlock = null,
}: {
  overview: BillingOverview | null;
  usage: PlanUsage;
  now: string;
  inactive?: boolean;
  /** Plano pedido pelo "Liberar no …" da vitrine. */
  unlock?: PlanId | null;
}) {
  const session = useWorkspaceSession();
  const { access, role } = session;
  const toast = useToast();
  const sub = overview?.subscription ?? null;
  const tier: Tier | null = access.hasAccess ? access.tier : null;
  const ent = access.entitlements ?? ENTITLEMENTS[tier ?? "base"];
  const canManage = !!overview?.canManage;
  const custom = tier === "personalizado";
  const lp = session.workspace.product === "lp";
  const [tab, setTab] = useState<"plano" | "cobranca" | "limites">("plano");

  const subtitle = sub
    ? `${SUBSCRIPTION_STATUS_LABEL[sub.status]} · ${INTERVAL_LABEL[sub.interval]} · ${brl(sub.recurringCents)} por ${sub.interval === "year" ? "ano" : "mês"}`
    : tier
      ? lp
        ? `${ent.maxLandingPages} landing pages no plano`
        : `${access.accountsQuantity} ${access.accountsQuantity === 1 ? "projeto contratado" : "projetos contratados"}`
      : lp
        ? "Escolha um plano para publicar as landing pages."
        : "Escolha um plano para usar os dashboards.";

  const TABS = [
    { value: "plano" as const, label: "Plano" },
    ...(overview ? [{ value: "cobranca" as const, label: "Cobrança" }] : []),
    ...(!lp ? [{ value: "limites" as const, label: "Limites" }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={tier ? `Plano ${TIER_LABEL[tier]}${lp ? " · Landing pages" : ""}` : "Sem plano ativo"}
        text={subtitle}
        actions={
          overview?.provider === "mock" ? (
            <PendingChip label="Pagamento simulado" detail="Nenhum valor é cobrado. A cobrança real entra com a Stripe." />
          ) : undefined
        }
      />

      {inactive && !tier && (
        <p role="status" className="rounded-card bg-error-soft px-4 py-3 text-[14px]">
          Para abrir essa página o workspace precisa de uma assinatura ativa. Os dados continuam guardados.
        </p>
      )}

      {TABS.length > 1 && <Tabs label="Seções do plano" items={TABS} value={tab} onChange={setTab} />}

      {tab === "plano" && (
        <div className="space-y-4" role="tabpanel" aria-label="Plano">
          {!tier && (
            <Section id="h-assinar" title="Assinar" text={role === "owner" ? "Assine um dos planos. O pagamento libera o painel na hora." : "Peça ao dono do workspace para assinar um plano."}>
              {role === "owner" && (
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Link href={lp ? "/assinar?produto=lp&plano=pro&periodo=mensal" : "/assinar?plano=pro&periodo=anual&meta=1&google=0"} className={`${btn.small} max-sm:h-11`}>
                    Assinar o {TIER_LABEL.pro}
                  </Link>
                  <Link href={`/?produto=${lp ? "lp" : "dash"}&plano=pro&periodo=${lp ? "mensal" : "anual"}#planos`} className={`${btn.subtle} max-sm:h-11`}>
                    Ver os planos
                  </Link>
                </div>
              )}
            </Section>
          )}

          {tier && (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
              <Section id="h-assinatura" title="Assinatura" aside={sub && <StatusChip status={sub.status} label={SUBSCRIPTION_STATUS_LABEL[sub.status]} />}>
                {sub ? (
                  <>
                    <div>
                      <p className="text-[12.5px] text-fg-2">Valor por {sub.interval === "year" ? "ano" : "mês"}</p>
                      <p className="mt-1 text-[28px] leading-none font-bold tracking-[-0.03em] tnum">{brl(sub.recurringCents)}</p>
                    </div>
                    <dl className="grid grid-cols-2 gap-4 border-t border-line pt-4 text-[14px]">
                      <Fact label={sub.cancelAtPeriodEnd ? "Termina em" : "Renova em"}>{formatDate(sub.currentPeriodEnd)}</Fact>
                      <Fact label="Período">{INTERVAL_LABEL[sub.interval]}</Fact>
                    </dl>
                    <ul className="divide-y divide-line border-t border-line text-[13.5px]">
                      {sub.items.map((i) => (
                        <li key={i.id} className="flex justify-between gap-3 py-2.5">
                          <span>
                            {i.label}
                            {i.kind === "extra" && i.quantity > 1 ? ` × ${i.quantity}` : ""}
                          </span>
                          <span className="shrink-0 text-fg-2 tnum">{brl(i.monthlyCents)}/mês</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-[14px] text-fg-2">
                    {custom
                      ? "O Personalizado é combinado com o time da VYZ."
                      : role === "owner" || role === "admin"
                        ? "Não encontramos a assinatura."
                        : "Só o dono e os admins veem os detalhes da cobrança."}
                  </p>
                )}
              </Section>
              <Section id="h-uso" title="Uso atual" text={lp ? undefined : `Cada cliente ou marca é um projeto, com até ${ent.maxAccountsPerPlatform} ${ent.maxAccountsPerPlatform === 1 ? "conta" : "contas"} de cada plataforma.`}>
                {lp ? (
                  <Meter used={usage.publishedLandingPages} limit={ent.maxLandingPages} label="Landing pages publicadas" />
                ) : (
                  <div className="space-y-5">
                    <Meter used={usage.projects} limit={access.accountsQuantity} label="Projetos" />
                    <Meter used={usage.dashboards} limit={ent.maxDashboards} label="Dashboards" />
                  </div>
                )}
              </Section>
            </div>
          )}

          {sub && canManage && !custom && (
            <>
              {lp ? (
                <Section id="h-trocar" title="Trocar de plano" text="As páginas novas são feitas pelo time: a troca passa por ele.">
                  <LpChangePlan current={sub.tier} unlock={unlock} />
                </Section>
              ) : (
                <Section id="h-trocar" title="Trocar plano ou período" text="A troca vale na hora. O ajuste é proporcional aos dias que faltam no ciclo.">
                  <ChangePlan key={`${sub.tier}:${sub.interval}:${sub.accountsQuantity}`} sub={sub} usage={usage} now={now} onDone={toast.show} unlock={unlock} />
                </Section>
              )}
              <Section id="h-cancelar" title="Cancelamento" text="A assinatura fica ativa até o fim do período pago. Os dados continuam guardados.">
                <CancelControls sub={sub} onDone={toast.show} />
              </Section>
            </>
          )}
          {sub && !canManage && overview && <p className="text-[13.5px] text-fg-2">Só o dono do workspace troca o plano ou cancela a assinatura.</p>}
        </div>
      )}

      {tab === "cobranca" && overview && (
        <div role="tabpanel" aria-label="Cobrança">
          <History overview={overview} />
        </div>
      )}

      {tab === "limites" && !lp && (
        <section aria-labelledby="h-limites" className="space-y-4" role="tabpanel">
          <h2 id="h-limites" className="sr-only">
            Limites por plano
          </h2>
          <div className="overflow-x-auto rounded-card border border-line bg-card">
            <table className="w-full min-w-[600px] text-left text-[13.5px]">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="sticky left-0 bg-card px-4 py-3.5 font-medium text-fg-2">
                    &nbsp;
                  </th>
                  {LIMIT_TIERS.map((t) => (
                    <th key={t} scope="col" className={`px-4 py-3.5 font-semibold whitespace-nowrap ${t === tier ? "bg-accent-soft" : ""}`}>
                      {TIER_LABEL[t]}
                      {t === tier && (
                        <Badge tone="accent" className="ml-2 bg-card">
                          atual
                        </Badge>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {LIMIT_ROWS.map((r) => (
                  <tr key={r.label}>
                    <th scope="row" className="sticky left-0 bg-card px-4 py-3 font-medium text-fg-2">
                      {r.label}
                    </th>
                    {LIMIT_TIERS.map((t) => (
                      <td key={t} className={`px-4 py-3 ${t === tier ? "bg-accent-soft/60 font-semibold" : ""}`}>
                        {r.value(t)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 rounded-card border border-line bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <p className="text-[14px] text-fg">Marca própria e implementação sob medida: plano Personalizado, sob consulta.</p>
            {!custom && (
              <a href={waLink(msgUpgrade(tier ? TIER_LABEL[tier] : "sem plano", TIER_LABEL.personalizado))} target="_blank" rel="noopener noreferrer" className={`${btn.small} shrink-0 max-sm:h-11`}>
                <WhatsAppIcon size={15} /> Falar com especialista
              </a>
            )}
          </div>
          <p className="text-[12.5px] text-fg-2">{SHOW_LANDING_PAGES ? "Os limites de dashboards e de landing pages publicadas são provisórios." : "Os limites de dashboards são provisórios."}</p>
        </section>
      )}
      {toast.node}
    </div>
  );
}
