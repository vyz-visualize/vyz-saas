"use client";

// Bancada da dobra Diferenciais (ver page.dev.tsx), dentro da área (marketing) para ter o
// mesmo layout do site (motion, rolagem suave, tom do texto): a dobra entre dois espaços,
// para ver a rolagem e o lado VYZ fixo. A direção escolhida ("Prompt × Pronto") já está no site.

import { Diferenciais } from "@/features/marketing/sections/Diferenciais";

export function Bench() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <div className="flex h-[40vh] items-end border-b border-line px-6 pb-6 text-fg-2">↓ Dobra anterior (Por dentro)</div>
      <Diferenciais />
      <div className="flex h-[50vh] items-start border-t border-line px-6 pt-6 text-fg-2">↓ Próxima dobra (Como funciona)</div>
    </div>
  );
}
