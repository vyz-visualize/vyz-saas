// Números do jeito que se lê no celular: "R$ 110 mil", "3,4×", "+8,2%".

import type { ApiKpi } from "@vyz/shared";

const nf = (o: Intl.NumberFormatOptions, v: number) => new Intl.NumberFormat("pt-BR", o).format(v);

export function money(v: number | null, currency = "BRL", compact = true): string {
  if (v === null) return "—";
  if (compact && Math.abs(v) >= 10_000) return nf({ style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }, v);
  return nf({ style: "currency", currency, maximumFractionDigits: Math.abs(v) < 100 ? 2 : 0 }, v);
}

export function int(v: number | null, compact = true): string {
  if (v === null) return "—";
  return compact && Math.abs(v) >= 10_000 ? nf({ notation: "compact", maximumFractionDigits: 1 }, v) : nf({ maximumFractionDigits: 0 }, v);
}

export function formatKpi(k: Pick<ApiKpi, "value" | "format">, currency: string, compact = true): string {
  const v = k.value;
  if (v === null) return "—";
  switch (k.format) {
    case "money":
      return money(v, currency, compact);
    case "pct":
      return nf({ style: "percent", maximumFractionDigits: 2 }, v);
    case "ratio":
      return `${nf({ maximumFractionDigits: 2 }, v)}×`;
    case "decimal":
      return nf({ maximumFractionDigits: 2 }, v);
    default:
      return int(v, compact);
  }
}

export function pct(v: number, digits = 1): string {
  return nf({ style: "percent", maximumFractionDigits: digits }, v);
}

/** Bom, ruim ou neutro, pelo sentido do indicador. */
export function deltaTone(k: Pick<ApiKpi, "delta" | "better">): "good" | "bad" | "neutral" {
  if (k.delta === null || k.better === "neutral" || k.delta === 0) return "neutral";
  return k.delta > 0 === (k.better === "up") ? "good" : "bad";
}

export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}
