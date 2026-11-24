// Aviso honesto quando o objetivo do dashboard (lead, conversa) não tem resultado no período: o
// número fica 0 com o nome certo e o aviso diz o que a conta registrou no lugar. Nunca a compra
// com o nome do objetivo.

import { int } from "@/lib/format";
import type { Dataset } from "./source";

const WHAT = { leads: { none: "leads", one: "lead" }, messages: { none: "conversas iniciadas", one: "conversa iniciada" } } as const;

export function resultNotice(ds: Pick<Dataset, "result" | "current">): string | null {
  const r = ds.result;
  if (!r) return null;
  const total = ds.current.reduce((a, d) => a + d.conversions, 0);
  if (total > 0) return null;
  const what = WHAT[r.field];
  if (!r.informed)
    return `Os ${what.none} da Meta passam a ser importados na próxima sincronização; os dias de antes ficam sem esse dado.${r.purchases > 0 ? ` No período, a conta registrou ${int(r.purchases)} ${r.purchases === 1 ? "compra" : "compras"}.` : ""}`;
  return `A Meta não registrou ${what.none} no período.${r.purchases > 0 ? ` A conta registrou ${int(r.purchases)} ${r.purchases === 1 ? "compra" : "compras"}: se o resultado desta conta é a venda, escolha o objetivo de venda.` : ""}`;
}
