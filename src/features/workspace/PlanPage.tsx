"use client";

// Página Plano: o plano da sessão, o uso, a troca de plano/período/contas
// (prévia do ajuste com quotePlanChange e o mesmo bloqueio do servidor), o
// cancelamento e o histórico da cobrança (faturas, pagamentos, linha do
// tempo e pedidos de serviço). Só o dono troca e cancela; admin vê a
// cobrança; os demais veem o plano e o uso.

import { CalendarClock, CreditCard, Receipt } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { Modal, PageHeader, PendingChip } from "@/components/ui/kit";
import { Segmented } from "@/components/ui/Segmented";
import { Stepper } from "@/components/ui/Stepper";
import { btn } from "@/components/ui/styles";
import { useToast } from "@/components/ui/Toast";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { UsageBar } from "@/features/accounts/AccountsPage";
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
import { planChangeBlocker, quotePlanChange, samePlan, type PlanSelection, type PlanUsage } from "@/features/checkout/plan-change";
import { ENTITLEMENTS, LIMIT_ROWS, LIMIT_TIERS, TIER_LABEL, type Tier } from "@/features/pricing/entitlements";
import { INCLUDED_PROJECTS, LP_PLAN_PAGES, MAX_PROJECTS_IN_PLAN, lpMonthly, lpSetup, type Period, type PlanId } from "@/features/pricing/pricing";
import { brl } from "@/lib/format";
import { msgUpgrade, waLink } from "@/lib/whatsapp";
import { cancelSubscription, changePlan, resumeSubscription } from "@/server/billing/actions";
import type { BillingOverview } from "@/server/billing/queries";
import { SHOW_LANDING_PAGES } from "@/lib/flags";
import { useWorkspaceSession } from "./WorkspaceProvider";

const PLAN_IDS: PlanId[] = ["base", "pro", "avancado"];
const toPeriod = (interval: "month" | "year"): Period => (interval === "year" ? "anual" : "mensal");

type Subscription = NonNullable<BillingOverview["subscription"]>;

function Section({ id, title, aside, children, className = "" }: { id: string; title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 space-y-4 rounded-card border border-line bg-card p-5 ${className}`} aria-labelledby={id}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="title text-lg">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12.5px] text-fg-2">{label}</dt>
      <dd className="mt-0.5 font-semibold tnum">{children}</dd>
    </div>
  );
}

const statusTone = (s: string) =>
  s === "active" || s === "trialing" || s === "paid" || s === "succeeded" || s === "delivered"
    ? "bg-accent-soft text-fg"
    : s === "failed" || s === "past_due" || s === "unpaid"
      ? "bg-error-soft text-error-fg"
      : "border border-line text-fg-2";

function StatusChip({ status, label }: { status: string; label: string }) {
  return <span className={`inline-flex rounded-chip px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap ${statusTone(status)}`}>{label}</span>;
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
  const [next, setNext] = useState<PlanSelection>(unlock && PLAN_IDS.indexOf(unlock) > PLAN_IDS.indexOf(sub.tier) ? { ...current, tier: unlock } : current);
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
  const set = (patch: Partial<PlanSelection>) => {
    setError(null);
    setNext((n) => ({ ...n, ...patch }));
  };
  const submit = () =>
    start(async () => {
      const res = await changePlan(next);
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
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-[13px] font-medium">Plano</p>
          <Segmented<PlanId>
            label="Plano"
            block
            value={next.tier}
            onChange={(tier) => set({ tier })}
            options={PLAN_IDS.map((t) => ({ value: t, label: TIER_LABEL[t] }))}
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-[13px] font-medium">Período</p>
          <Segmented<Period>
            label="Período"
            block
            value={next.period}
            onChange={(period) => set({ period })}
            options={[
              { value: "mensal", label: "Mensal" },
              { value: "anual", label: "Anual" },
            ]}
          />
        </div>
      </div>
      <Stepper
        label="Projetos contratados"
        hint={`Cada cliente ou marca é um projeto. Pelo menos os ${usage.projects} em uso e no mínimo ${INCLUDED_PROJECTS}; até ${MAX_PROJECTS_IN_PLAN}.`}
        unit="projeto contratado"
        value={next.accounts}
        min={Math.max(INCLUDED_PROJECTS, usage.projects)}
        max={MAX_PROJECTS_IN_PLAN}
        onChange={(accounts) => set({ accounts })}
      />

      {!unchanged && (
        <dl className="grid gap-3 rounded-control border border-line bg-bg p-4 text-[13.5px] sm:grid-cols-3" aria-live="polite">
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
      <button type="button" className={btn.small} disabled={unchanged || !!blocker || pending} onClick={submit}>
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
            className={`rounded-control border p-3 text-left transition-colors ${pick === t ? "border-accent bg-accent-soft" : "border-line hover:border-accent"}`}
          >
            <span className="title block text-[15px]">
              {TIER_LABEL[t]}
              {t === current && <span className="ml-1.5 text-[11px] font-medium text-fg-2">atual</span>}
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
        className={`${btn.small} ${pick === current ? "pointer-events-none opacity-50" : ""}`}
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
        <button type="button" className={`${btn.ghost} h-9 border border-line text-fg-2`} onClick={() => setConfirm(true)}>
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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`${btn.small} bg-error`}
              disabled={pending}
              onClick={() => run(cancelSubscription, (end) => `Cancelamento agendado para ${end}.`)}
            >
              {pending ? "Cancelando…" : "Cancelar no fim do período"}
            </button>
            <button type="button" className={`${btn.ghost} h-9`} onClick={() => setConfirm(false)}>
              Manter assinatura
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ---- histórico ----------------------------------------------------------------------

function Table({ caption, head, children, empty }: { caption: string; head: string[]; children: ReactNode[]; empty: string }) {
  if (children.length === 0) return <p className="text-[13.5px] text-fg-2">{empty}</p>;
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-[560px] text-left text-[13.5px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-[12.5px] text-fg-2">
            {head.map((h, i) => (
              <th key={h} scope="col" className={`py-2 pr-4 font-medium ${i === head.length - 1 ? "pr-0 text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

function History({ overview }: { overview: BillingOverview }) {
  const { invoices, transactions, timeline, serviceOrders } = overview;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Section id="h-faturas" title="Faturas" aside={<Receipt size={18} aria-hidden className="text-fg-2" />}>
        <Table caption="Faturas" head={["Data", "Descrição", "Status", "Total"]} empty="Nenhuma fatura ainda.">
          {invoices.map((i) => (
            <tr key={i.id}>
              <td className="py-2.5 pr-4 whitespace-nowrap tnum">{formatDate(i.paidAt ?? i.createdAt)}</td>
              <td className="py-2.5 pr-4">
                <span className="block">{invoiceDescription(i.description) ?? i.lines[0]?.label ?? "Fatura"}</span>
                {i.periodStart && i.periodEnd && (
                  <span className="text-[12px] text-fg-2">
                    {formatDate(i.periodStart)} a {formatDate(i.periodEnd)}
                  </span>
                )}
              </td>
              <td className="py-2.5 pr-4">
                <StatusChip status={i.status} label={INVOICE_STATUS_LABEL[i.status]} />
              </td>
              <td className="py-2.5 text-right font-semibold whitespace-nowrap tnum">{brl(i.totalCents)}</td>
            </tr>
          ))}
        </Table>
      </Section>
      <Section id="h-pagamentos" title="Pagamentos" aside={<CreditCard size={18} aria-hidden className="text-fg-2" />}>
        <Table caption="Pagamentos" head={["Data", "Forma", "Status", "Valor"]} empty="Nenhum pagamento ainda.">
          {transactions.map((t) => (
            <tr key={t.id}>
              <td className="py-2.5 pr-4 whitespace-nowrap tnum">{formatDate(t.processedAt ?? t.createdAt)}</td>
              <td className="py-2.5 pr-4">
                <span className="block">
                  {t.cardBrand ? `${CARD_BRAND_LABEL[t.cardBrand]} •••• ${t.cardLast4 ?? ""}` : t.method ? PAYMENT_METHOD_LABEL[t.method] : "—"}
                </span>
                <span className="text-[12px] text-fg-2">{t.failureMessage ?? TRANSACTION_KIND_LABEL[t.kind]}</span>
              </td>
              <td className="py-2.5 pr-4">
                <StatusChip status={t.status} label={TRANSACTION_STATUS_LABEL[t.status]} />
              </td>
              <td className="py-2.5 text-right font-semibold whitespace-nowrap tnum">{brl(t.kind === "charge" ? t.amountCents : -t.amountCents)}</td>
            </tr>
          ))}
        </Table>
      </Section>
      <Section id="h-linha" title="Linha do tempo da assinatura" aside={<CalendarClock size={18} aria-hidden className="text-fg-2" />}>
        {timeline.length === 0 ? (
          <p className="text-[13.5px] text-fg-2">Nada registrado ainda.</p>
        ) : (
          <ol className="space-y-3 border-l border-line pl-4">
            {timeline.map((t) => (
              <li key={t.id} className="relative text-[13.5px]">
                <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-accent" aria-hidden />
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

  const subtitle = sub
    ? `${SUBSCRIPTION_STATUS_LABEL[sub.status]} · ${INTERVAL_LABEL[sub.interval]} · ${brl(sub.recurringCents)} por ${sub.interval === "year" ? "ano" : "mês"}`
    : tier
      ? lp
        ? `${ent.maxLandingPages} landing pages no plano`
        : `${access.accountsQuantity} ${access.accountsQuantity === 1 ? "projeto contratado" : "projetos contratados"}`
      : lp
        ? "Escolha um plano para publicar as landing pages."
        : "Escolha um plano para usar os dashboards.";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Plano"
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

      {!tier && (
        <Section id="h-assinar" title="Assinar">
          <p className="text-[14px] text-fg-2">
            {role === "owner" ? "Assine um dos planos. O pagamento libera o painel na hora." : "Peça ao dono do workspace para assinar um plano."}
          </p>
          {role === "owner" && (
            <div className="flex flex-wrap gap-2">
              <Link href={lp ? "/assinar?produto=lp&plano=pro&periodo=mensal" : "/assinar?plano=pro&periodo=anual&meta=1&google=0"} className={btn.small}>
                Assinar o {TIER_LABEL.pro}
              </Link>
              <Link
                href={`/?produto=${lp ? "lp" : "dash"}&plano=pro&periodo=${lp ? "mensal" : "anual"}#planos`}
                className={`${btn.ghost} h-9 border border-line`}
              >
                Ver os planos
              </Link>
            </div>
          )}
        </Section>
      )}

      {tier && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section id="h-assinatura" title="Assinatura">
            {sub ? (
              <>
                <dl className="grid grid-cols-2 gap-4 text-[14px]">
                  <Fact label="Status">
                    <StatusChip status={sub.status} label={SUBSCRIPTION_STATUS_LABEL[sub.status]} />
                  </Fact>
                  <Fact label={sub.cancelAtPeriodEnd ? "Termina em" : "Renova em"}>{formatDate(sub.currentPeriodEnd)}</Fact>
                  <Fact label="Período">{INTERVAL_LABEL[sub.interval]}</Fact>
                  <Fact label={`Valor por ${sub.interval === "year" ? "ano" : "mês"}`}>{brl(sub.recurringCents)}</Fact>
                </dl>
                <ul className="divide-y divide-line border-t border-line text-[13.5px]">
                  {sub.items.map((i) => (
                    <li key={i.id} className="flex justify-between gap-3 py-2">
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
          <Section id="h-uso" title="Uso atual">
            {lp ? (
              <UsageBar used={usage.publishedLandingPages} limit={ent.maxLandingPages} label="Landing pages publicadas" />
            ) : (
              <>
                <UsageBar used={usage.projects} limit={access.accountsQuantity} label="Projetos" />
                <UsageBar used={usage.dashboards} limit={ent.maxDashboards} label="Dashboards" />
                <p className="text-[12.5px] text-fg-2">
                  Cada cliente ou marca é um projeto, com até {ent.maxAccountsPerPlatform} {ent.maxAccountsPerPlatform === 1 ? "conta" : "contas"} de cada plataforma.
                </p>
              </>
            )}
          </Section>
        </div>
      )}

      {sub && canManage && !custom && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          {lp ? (
            <Section id="h-trocar" title="Trocar de plano">
              <LpChangePlan current={sub.tier} unlock={unlock} />
            </Section>
          ) : (
            <Section id="h-trocar" title="Trocar plano, período ou contas">
              <ChangePlan key={`${sub.tier}:${sub.interval}:${sub.accountsQuantity}`} sub={sub} usage={usage} now={now} onDone={toast.show} unlock={unlock} />
            </Section>
          )}
          <Section id="h-cancelar" title="Cancelamento">
            <CancelControls sub={sub} onDone={toast.show} />
          </Section>
        </div>
      )}
      {sub && !canManage && overview && <p className="text-[13.5px] text-fg-2">Só o dono do workspace troca o plano ou cancela a assinatura.</p>}

      {overview && <History overview={overview} />}

      {!lp && (
        <section aria-labelledby="h-limites" className="space-y-3">
          <h2 id="h-limites" className="title text-lg">
            Limites por plano
          </h2>
          <div className="overflow-x-auto rounded-card border border-line bg-card">
            <table className="w-full min-w-[560px] text-left text-[13.5px]">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="px-4 py-3 font-medium text-fg-2">
                    &nbsp;
                  </th>
                  {LIMIT_TIERS.map((t) => (
                    <th key={t} scope="col" className={`px-4 py-3 font-semibold ${t === tier ? "bg-accent-soft" : ""}`}>
                      {TIER_LABEL[t]}
                      {t === tier && <span className="ml-1.5 text-[11px] font-medium text-fg-2">atual</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {LIMIT_ROWS.map((r) => (
                  <tr key={r.label}>
                    <th scope="row" className="px-4 py-2.5 font-medium text-fg-2">
                      {r.label}
                    </th>
                    {LIMIT_TIERS.map((t) => (
                      <td key={t} className={`px-4 py-2.5 ${t === tier ? "bg-accent-soft/60 font-semibold" : ""}`}>
                        {r.value(t)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 rounded-card border border-line bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[14px] text-fg">Marca própria e implementação sob medida: plano Personalizado, sob consulta.</p>
            {!custom && (
              <a
                href={waLink(msgUpgrade(tier ? TIER_LABEL[tier] : "sem plano", TIER_LABEL.personalizado))}
                target="_blank"
                rel="noopener noreferrer"
                className={`${btn.small} h-8 shrink-0 px-3 text-[12.5px]`}
              >
                <WhatsAppIcon size={14} /> Falar com especialista
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
