// A fileira de cards de KPI sem buraco: os cards se dividem em fileiras de até 4, o mais
// parelhas possível (5 → 3 + 2, 6 → 3 + 3, 7 → 4 + 3, 9 → 3 + 3 + 3), e cada card ocupa
// 12 ÷ (cards na fileira) colunas de uma grade de 12. No celular (2 colunas), o último
// card de uma quantidade ímpar ocupa a linha toda. Puro: o PageView usa e o teste confere.

const WIDE: Record<number, string> = {
  1: "@[440px]:col-span-12",
  2: "@[440px]:col-span-6",
  3: "@[440px]:col-span-4",
  4: "@[440px]:col-span-3",
};

/** Cards por fileira, do topo para baixo (as fileiras maiores primeiro). */
export function kpiRows(count: number): number[] {
  if (count <= 0) return [];
  const rows = Math.ceil(count / 4);
  const base = Math.floor(count / rows);
  const extra = count % rows;
  return Array.from({ length: rows }, (_, i) => base + (i < extra ? 1 : 0));
}

/** A classe de cada card, na ordem. */
export function kpiSpans(count: number): string[] {
  const out: string[] = [];
  for (const perRow of kpiRows(count)) for (let i = 0; i < perRow; i++) out.push(WIDE[perRow]);
  // celular: 2 por linha; com quantidade ímpar, o último ocupa a linha toda
  if (count % 2 === 1) out[count - 1] = `col-span-2 ${out[count - 1]}`;
  return out;
}

/** A grade em volta dos cards. */
export const KPI_GRID = "grid grid-cols-2 gap-2 relative @[440px]:grid-cols-12";
