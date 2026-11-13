"use client";

// Passo 2 com a Stripe: o cartão é digitado na página segura da Stripe. Aqui
// só o resumo do valor e o botão que leva até lá (payWithStripe).

import { LoaderCircle, Lock, ShieldCheck } from "lucide-react";
import { useActionState } from "react";
import { btn } from "@/components/ui/styles";
import { brl } from "@/lib/format";
import { payWithStripe } from "@/server/billing/actions";

const NOTICE: Record<string, string> = {
  cancelado: "Você voltou sem pagar. O pedido continua aberto: é só tentar de novo.",
  pendente: "A Stripe ainda não confirmou o pagamento. Se você já pagou, aguarde um instante e recarregue.",
  confirmacao: "Não conseguimos confirmar o pagamento agora. Se você já pagou, ele será confirmado em instantes; senão, tente de novo.",
};

export function StripePay({ checkoutId, amountCents, notice }: { checkoutId: string; amountCents: number; notice?: string | null }) {
  const [state, action, pending] = useActionState(() => payWithStripe(checkoutId), null);
  const error = state && !state.ok ? state.error.message : null;
  const info = notice ? NOTICE[notice] : null;
  return (
    <form action={action} className="space-y-4">
      {info && !error && <p className="rounded-control border border-line bg-card px-4 py-3 text-[14px] text-fg-2">{info}</p>}
      <button type="submit" disabled={pending} className={`${btn.primary} h-13 w-full rounded-[10px] text-[15.5px]`}>
        {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Lock className="size-4" aria-hidden />}
        {pending ? "Abrindo o pagamento seguro…" : `Pagar ${brl(amountCents)} com cartão`}
      </button>
      {error && (
        <p role="alert" className="text-[13.5px] text-error-fg">
          {error}
        </p>
      )}
      <p className="flex items-start gap-2 text-[13px] text-fg-2">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
        <span>O pagamento é feito na página segura da Stripe. O VYZ nunca vê o número do seu cartão. Depois de pagar, você volta para cá e a organização já está pronta.</span>
      </p>
    </form>
  );
}
