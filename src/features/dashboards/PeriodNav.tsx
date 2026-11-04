"use client";

// Seletor de período dos dashboards com dados reais: troca o ?periodo= da URL e
// o servidor desenha de novo com o período novo (os dados vêm do cache por conta).

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { PeriodPicker, rangeDays } from "@/components/ui/PeriodPicker";
import type { PeriodId } from "@/features/workspace/types";
import { periodQuery } from "./model";

export function PeriodNav({ period, customDays }: { period: PeriodId; customDays: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  function go(next: PeriodId, days: number) {
    const q = new URLSearchParams(params.toString());
    q.delete("periodo");
    q.delete("dias");
    q.delete("novo");
    // o trecho de dias só vale dentro do período
    q.delete("de");
    q.delete("ate");
    const rest = q.toString();
    start(() => router.push(`${pathname}?${periodQuery({ period: next, customDays: days })}${rest ? `&${rest}` : ""}`, { scroll: false }));
  }

  return (
    <div className="w-full min-w-0 @[540px]:w-60 print:hidden" aria-busy={pending}>
      <PeriodPicker period={period} range={null} customDays={customDays} maxDays={60} onChange={(p, r) => go(p, r ? rangeDays(r) : customDays)} />
      <p className="sr-only" aria-live="polite">
        {pending ? "Carregando o período" : ""}
      </p>
    </div>
  );
}
