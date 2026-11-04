"use client";

// Amostras do que o plano seguinte libera. Dados fixos de exemplo, escritos aqui:
// este arquivo não importa a galeria nem o comparativo, e nenhum dado do cliente
// passa por ele. Só aparece no painel, nunca no link compartilhado.

import { Trophy } from "lucide-react";
import { Paywall } from "@/components/ui/Paywall";
import type { Tier } from "@/features/pricing/entitlements";
import { Thumb } from "../ui";

const EXAMPLES = [
  { id: "exemplo-a", name: "Vídeo de depoimento", campaign: "Campanha de exemplo", ctr: "1,8%", result: "42" },
  { id: "exemplo-b", name: "Carrossel de produtos", campaign: "Campanha de exemplo", ctr: "1,3%", result: "31" },
  { id: "exemplo-c", name: "Imagem de oferta", campaign: "Campanha de exemplo", ctr: "0,9%", result: "18" },
];

function ExampleCard({ e }: { e: (typeof EXAMPLES)[number] }) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-card">
      <Thumb seed={e.id} label={e.name} className="aspect-[16/10]" />
      <div className="p-3">
        <p className="truncate text-[13px] font-semibold text-fg">{e.name}</p>
        <p className="truncate text-[11.5px] text-fg-2">{e.campaign}</p>
        <div className="mt-2 flex justify-between text-[11px] text-fg-2 tnum">
          <span>CTR {e.ctr}</span>
          <span>{e.result} resultados</span>
        </div>
      </div>
    </div>
  );
}

/** Básico: a galeria do Padrão. */
export function LockedGallery({ tier }: { tier: Tier }) {
  return (
    <Paywall current={tier} required="pro" feature="Veja seus criativos em galeria, com preview e ranking">
      <div className="grid grid-cols-1 gap-3 @[560px]:grid-cols-3">
        {EXAMPLES.map((e) => (
          <ExampleCard key={e.id} e={e} />
        ))}
      </div>
    </Paywall>
  );
}

const ROWS = [
  ["CTR do link", "1,8%", "1,3%"],
  ["Custo por resultado", "R$ 12,40", "R$ 18,90"],
  ["Frequência", "1,4", "1,7"],
];

/** Padrão: o comparativo do Avançado. */
export function LockedCompare({ tier }: { tier: Tier }) {
  return (
    <Paywall current={tier} required="avancado" feature="Compare criativos lado a lado" text="Dois ou três anúncios, métrica por métrica, com a evolução por dia de veiculação.">
      <div className="space-y-3 rounded-card border border-line bg-card p-3">
        <div className="grid grid-cols-2 gap-3">
          {EXAMPLES.slice(0, 2).map((e) => (
            <ExampleCard key={e.id} e={e} />
          ))}
        </div>
        <table className="w-full text-[12.5px] tnum">
          <tbody>
            {ROWS.map(([label, a, b]) => (
              <tr key={label} className="border-t border-line">
                <td className="py-1.5 text-fg-2">{label}</td>
                <td className="py-1.5 text-right font-semibold">
                  <Trophy size={12} aria-hidden className="mr-1 inline text-accent" />
                  {a}
                </td>
                <td className="py-1.5 text-right">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Paywall>
  );
}
