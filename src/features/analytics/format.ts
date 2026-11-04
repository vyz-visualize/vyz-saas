// Formatação dos dashboards com dados reais. O armazém guarda dinheiro em
// reais (2 casas); src/lib/format trabalha em centavos.

import { brl, brlCompact, decimal, int, pct } from "@/lib/format";
import type { ValueFormat } from "./types";

export const HIDDEN = "•••";

export type Money = { currency: string };

/** R$ 1.234,56 (ou "USD 1.234,56" fora do real). */
export function money(v: number | null | undefined, cur = "BRL", { decimals = true }: { decimals?: boolean } = {}): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (cur === "BRL") return brl(v * 100, { decimals });
  return `${cur} ${decimal(v, decimals ? 2 : 0)}`;
}

/** R$ 80,1 mil. */
export function moneyCompact(v: number | null | undefined, cur = "BRL"): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (cur === "BRL") return brlCompact(v * 100);
  if (Math.abs(v) >= 10_000) return `${cur} ${decimal(v / 1000, 1)} mil`;
  return `${cur} ${int(v)}`;
}

export function formatValue(v: number | null | undefined, format: ValueFormat, cur = "BRL", compact = false): string {
  if (v == null || !Number.isFinite(v)) return "—";
  switch (format) {
    case "money":
      return compact || Math.abs(v) >= 10_000 ? moneyCompact(v, cur) : money(v, cur, { decimals: Math.abs(v) < 1000 });
    case "int":
      return int(v);
    case "decimal":
      return decimal(v, Number.isInteger(v) ? 0 : 1);
    case "ratio":
      return decimal(v, 2);
    case "pct":
      return pct(v, v !== 0 && Math.abs(v) < 0.1 ? 2 : 1);
    case "seconds":
      return `${decimal(v, 1)} s`;
  }
}

/** Variação: "+8,2%" / "−3,1%". */
export function deltaText(d: number): string {
  const sign = d > 0 ? "+" : d < 0 ? "−" : "";
  return `${sign}${pct(Math.abs(d), Math.abs(d) < 0.1 ? 1 : 0)}`;
}

/** Variação boa, ruim ou neutra, conforme o sentido da métrica. */
export function deltaTone(d: number | null, better: "up" | "down" | "neutral"): "good" | "bad" | "neutral" {
  if (d == null || better === "neutral" || Math.abs(d) < 0.005) return "neutral";
  return (better === "up" ? d > 0 : d < 0) ? "good" : "bad";
}

export const STATUS_LABEL: Record<string, string> = { active: "Ativa", paused: "Pausada", archived: "Arquivada", removed: "Removida" };

export const FORMAT_LABEL: Record<string, string> = {
  image: "Imagem",
  video: "Vídeo",
  carousel: "Carrossel",
  collection: "Coleção",
  text: "Texto",
  shopping: "Shopping",
  responsive: "Responsivo",
};

export const MATCH_LABEL: Record<string, string> = {
  exact: "Exata",
  phrase: "Frase",
  broad: "Ampla",
  near_exact: "Exata (variação)",
  near_phrase: "Frase (variação)",
  unknown: "—",
};
