// Aviso honesto quando o objetivo do dashboard (lead, conversa) não tem resultado no período: o
// número fica 0 com o nome certo e o aviso diz o que a conta registrou no lugar. Nunca a compra
// com o nome do objetivo.

import { int } from "@/lib/format";
import type { Dataset } from "./source";

// o artigo e a concordância de cada resultado ("Os leads ... importados", "As conversas ... importadas")
const WHAT = {
  leads: { none: "leads", the: "Os", imported: "importados" },
  messages: { none: "conversas iniciadas", the: "As", imported: "importadas" },
} as const;

export function resultNotice(ds: Pick<Dataset, "result" | "current">): string | null {
  const r = ds.result;
  if (!r) return null;
  const total = ds.current.reduce((a, d) => a + d.conversions, 0);
  if (total > 0) return null;
  const what = WHAT[r.field];
  if (!r.informed)
    return `${what.the} ${what.none} da Meta passam a ser ${what.imported} na próxima sincronização; os dias de antes ficam sem esse dado.${r.purchases > 0 ? ` No período, a conta registrou ${int(r.purchases)} ${r.purchases === 1 ? "compra" : "compras"}.` : ""}`;
  return `A Meta não registrou ${what.none} no período.${r.purchases > 0 ? ` A conta registrou ${int(r.purchases)} ${r.purchases === 1 ? "compra" : "compras"}: se o resultado desta conta é a venda, escolha o objetivo de venda.` : ""}`;
}
