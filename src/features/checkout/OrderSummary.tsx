// Resumo do pedido no checkout, no visual da comanda da LP (cupom com
// picote e linhas pontilhadas): o que está sendo assinado, linha por linha, o
// que sai hoje e o que se repete. Sem motion: só marcação.

import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { PendingChip } from "@/components/ui/kit";
import { brl } from "@/lib/format";
import { describeAccounts } from "@/features/pricing/messages";
import { LP_PLAN_PAGES, PERIOD_LABEL, PLAN_LABEL, PRO_TRACKING_VALUE, type PlanId, type PlanState, type Quote } from "@/features/pricing/pricing";

type OrderSummaryProps = {
  state: PlanState;
  quote: Quote;
  amountDueNowCents: number;
  recurringCents: number;
  /** "Alterar pedido": volta ao Monte seu plano com a mesma seleção. */
  editHref?: string;
  simulated?: boolean;
  className?: string;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-[14px] text-fg-2">{label}</dt>
      <dd className="text-right font-semibold text-fg tnum">{value}</dd>
    </div>
  );
}

export function OrderSummary({ state, quote: q, amountDueNowCents, recurringCents, editHref, simulated = false, className = "" }: OrderSummaryProps) {
  const noPlan = state.plano === "sem";
  const annual = state.periodo === "anual";
  const lp = state.produto === "lp";
  const headline = noPlan
    ? "Sem plano · só extras"
    : `${lp ? "Landing pages · " : ""}Plano ${PLAN_LABEL[state.plano]} · ${PERIOD_LABEL[state.periodo]}`;
  const accounts = noPlan || lp ? "" : describeAccounts(state);
  const pages = noPlan || !lp ? 0 : LP_PLAN_PAGES[state.plano as PlanId];

  return (
    <div className={className}>
      <section aria-labelledby="pedido-titulo" className="receipt relative bg-card px-5 pt-7 pb-8 text-fg sm:px-7">
        <div className="flex items-center justify-between">
          <h2 id="pedido-titulo" className="label-caps text-fg-2">
            Seu pedido
          </h2>
          <Wordmark className="w-10 text-fg-2" decorative />
        </div>
        <p className="mt-2 text-[17px] font-semibold">{headline}</p>
        {!noPlan && (
          <p className="mt-0.5 text-[13px] text-fg-2">
            {lp ? `${pages} ${pages === 1 ? "landing page feita" : "landing pages feitas"} pelo time` : q.accountsBilled === 1 ? "1 conta" : `${q.accountsBilled} contas`}
            {accounts && ` · ${accounts}`}
          </p>
        )}

        <ul className="dotted mt-4 pt-2" aria-label="Linhas do pedido">
          {q.lines.map((l) => (
            <li key={l.id} className="flex items-baseline justify-between gap-3 py-1.5 text-[13.5px]">
              <span className="min-w-0">
                <span className="text-fg">{l.label}</span>
                {l.detail && <span className="block text-[12px] text-fg-2">{l.detail}</span>}
              </span>
              <span className="shrink-0 text-right font-medium tnum">
                {l.kind === "included" ? (
                  <>
                    <s className="mr-1.5 text-fg-2">{brl(PRO_TRACKING_VALUE, { decimals: false })}</s>
                    R$ 0,00
                  </>
                ) : (
                  brl(l.amount)
                )}
                {l.kind === "monthly" && <span className="text-fg-2">/mês</span>}
                {l.kind === "once" && <span className="block text-[11.5px] font-normal text-fg-2">uma vez</span>}
              </span>
            </li>
          ))}
        </ul>

        {q.accountsOutside > 0 && (
          <p className="mt-2 rounded-control border border-dashed border-line px-3 py-2 text-[12.5px] text-fg-2">
            {q.accountsOutside === 1 ? "1 conta de outra plataforma fica" : `${q.accountsOutside} contas de outras plataformas ficam`} fora do Base: TikTok,
            LinkedIn e CRMs entram no Pro.
          </p>
        )}

        <dl className="dotted mt-3 pt-2">
          {q.monthly > 0 && <Row label="Todo mês" value={brl(q.monthly)} />}
          {annual && q.monthly > 0 && <Row label="No ano (12 meses)" value={brl(recurringCents)} />}
          {q.oneTime > 0 && <Row label="Uma vez" value={brl(q.oneTime)} />}
        </dl>

        <div className="dotted mt-3 pt-4">
          <p className="text-[13px] text-fg-2">Total hoje</p>
          <p className="mt-1 text-[2.4rem] leading-none font-extrabold tracking-[-0.03em] tnum sm:text-[2.7rem]">{brl(amountDueNowCents)}</p>
          <p className="mt-2 text-[13px] text-fg-2">
            {recurringCents > 0
              ? annual
                ? `Renova a cada 12 meses por ${brl(recurringCents)}.`
                : `Depois, ${brl(recurringCents)} todo mês.`
              : "Pagamento único, sem mensalidade."}
            {annual && q.annualSaving > 0 && (
              <>
                {" "}
                No anual você economiza <strong className="font-semibold text-accent">{brl(q.annualSaving)}</strong> por ano.
              </>
            )}
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
