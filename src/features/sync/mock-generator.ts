// Gerador de dados simulados, puro e determinístico: é o que a sincronização
// grava quando a conexão é simulada e o que as prévias de dashboard mostram.
//
// O mesmo id externo gera sempre a mesma conta, e cada número do dia sai de
// uma semente própria (conta + entidade + data): pedir 90 ou 7 dias dá os
// mesmos números nos dias em comum. Só os 3 últimos dias dependem do fim do
// período, porque as compras recentes ainda estão sendo atribuídas (como nas
// plataformas, que revisam esses dias nas sincronizações seguintes).
//
// As histórias (criativo cansando, campanha nova) ficam presas a uma data de
// referência, `anchorDate`. Sem ela, a referência é o fim do período (bom para
// prévias). A sincronização passa sempre a mesma data por conta, para que
// reprocessar um período nunca mude o que já foi gravado.

import { slugify } from "@/lib/ids";
import type { SyncPlatform } from "./dataset";
import { dateRange, isIsoDate } from "./dates";
import { generateGoogle } from "./mock/google";
import { generateMeta } from "./mock/meta";
import type { MockAccountDataset, MockContext } from "./mock/shared";

export type { MockAccountDataset, MockStories } from "./mock/shared";

export type GenerateAccountInput = {
  platform: SyncPlatform;
  accountExternalId: string;
  /** Nome da conta: dá o nome da loja nos termos de pesquisa e nos anúncios. */
  accountName: string;
  currency?: string;
  /** Último dia gerado (YYYY-MM-DD), inclusive. */
  endDate: string;
  /** Quantos dias, terminando em endDate. */
  days: number;
  /** Data de referência das histórias (padrão: endDate). */
  anchorDate?: string;
};

export const MAX_GENERATED_DAYS = 730;

// Câmbio aproximado a partir do real: os números são pensados em BRL.
const FX: Record<string, number> = { BRL: 1, USD: 0.18, EUR: 0.17, GBP: 0.14, MXN: 3.4, ARS: 180, CLP: 170, COP: 720, PEN: 0.68, UYU: 7.2 };

/** "Loja Exemplo · Brasil" → "Loja Exemplo". */
function brandOf(accountName: string): string {
  const first = accountName.split(/\s+[·|•–—-]\s+/)[0]?.trim();
  return first || "Loja";
}

export function generateAccountData(input: GenerateAccountInput): MockAccountDataset {
  if (!["meta", "google", "tiktok", "linkedin"].includes(input.platform)) throw new RangeError(`Plataforma sem gerador: ${String(input.platform)}`);
  if (!input.accountExternalId?.trim()) throw new RangeError("accountExternalId é obrigatório.");
  if (!isIsoDate(input.endDate)) throw new RangeError(`endDate inválida: ${input.endDate}`);
  if (!Number.isInteger(input.days) || input.days < 1 || input.days > MAX_GENERATED_DAYS) throw new RangeError(`days deve ser um inteiro de 1 a ${MAX_GENERATED_DAYS}.`);
  if (input.anchorDate !== undefined && !isIsoDate(input.anchorDate)) throw new RangeError(`anchorDate inválida: ${input.anchorDate}`);

  const currency = (input.currency ?? "BRL").toUpperCase();
  const brand = brandOf(input.accountName);
  const ctx: MockContext = {
    platform: input.platform,
    accountExternalId: input.accountExternalId.trim(),
    brand,
    brandTerm: brand.toLocaleLowerCase("pt-BR"),
    site: `https://${slugify(brand, "-")}.example`,
    currency,
    fx: FX[currency] ?? 1,
    endDate: input.endDate,
    dates: dateRange(input.endDate, input.days),
    anchor: input.anchorDate ?? input.endDate,
  };
  if (ctx.platform === "google") return generateGoogle(ctx);
  // TikTok e LinkedIn: a mesma história de mídia social do Meta (campanhas, anúncios e números por dia)
  const data = generateMeta(ctx);
  return ctx.platform === "meta" ? data : { ...data, platform: ctx.platform };
}
