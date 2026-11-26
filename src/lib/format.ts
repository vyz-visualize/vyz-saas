// Formatação pt-BR feita à mão para sair idêntica no servidor e no navegador.

function groupThousands(n: number): string {
  return Math.trunc(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Centavos → "R$ 1.234,56". */
export function brl(cents: number, { decimals = true }: { decimals?: boolean } = {}): string {
  // divisão por zero que escapou de quem chamou: "—", nunca "R$ Infinity,NaN"
  if (!Number.isFinite(cents)) return "—";
  const rounded = Math.round(cents);
  const abs = Math.abs(rounded);
  const reais = Math.floor(abs / 100);
  const rest = abs % 100;
  const sign = rounded < 0 ? "−" : "";
  const tail = decimals ? `,${String(rest).padStart(2, "0")}` : "";
  return `${sign}R$ ${groupThousands(reais)}${tail}`;
}

/** Centavos → "R$ 80,1 mil" para valores grandes. */
export function brlCompact(cents: number): string {
  if (!Number.isFinite(cents)) return "—";
  const reais = cents / 100;
  if (reais >= 1_000_000) return `R$ ${decimal(reais / 1_000_000, 1)} mi`;
  if (reais >= 100_000) return `R$ ${int(reais / 1000)} mil`;
  if (reais >= 10_000) return `R$ ${decimal(reais / 1000, 1)} mil`;
  return brl(cents, { decimals: false });
}

/** 1234 → "1.234". */
export function int(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "−" : "";
  return sign + groupThousands(Math.abs(Math.round(n)));
}

/** 3.14159, 1 → "3,1". */
export function decimal(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  const fixed = Math.abs(n).toFixed(digits);
  const [i, d] = fixed.split(".");
  const sign = n < 0 ? "−" : "";
  return `${sign}${groupThousands(Number(i))}${d ? `,${d}` : ""}`;
}

/** 0.082 → "8,2%". */
export function pct(ratio: number, digits = 1): string {
  if (!Number.isFinite(ratio)) return "—";
  return `${decimal(ratio * 100, digits)}%`;
}

/** Junta com vírgulas e "e" no fim: ["a","b","c"] → "a, b e c". */
export function joinPt(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

/** Date → "22/10/2026". */
export function ddmmyyyy(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** "1 conta", "0 contas", "3 contas". */
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Nomes dos meses, de janeiro (índice 0) a dezembro. */
export const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"] as const;
