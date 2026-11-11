// Fecha o conjunto antes de gravar: toda linha de métrica precisa da sua campanha, anúncio
// ou produto. As plataformas listam só os que existem hoje, mas as métricas do período
// trazem também os apagados depois (Google: REMOVED; Meta: DELETED). Sem isto, a gravação
// não acha a entidade e a importação inteira da conta falha.

import type { AccountDataset, CampaignEntity, ProductEntity } from "./dataset";

const removedCampaign = (externalId: string): CampaignEntity => ({ externalId, name: `Campanha ${externalId} (removida)`, status: "removed", objective: null, channel: null, funnelStage: null, dailyBudget: null, startedOn: null });
const unknownProduct = (externalId: string): ProductEntity => ({ externalId, title: `Produto ${externalId}`, brand: null, category: null, imageUrl: null, price: null });

export function closeDataset(ds: AccountDataset): AccountDataset {
  const campaigns = new Map(ds.campaigns.map((c) => [c.externalId, c]));
  const referenced = [...ds.campaignDaily.map((d) => d.campaignExternalId), ...ds.searchTermDaily.map((d) => d.campaignExternalId), ...ds.ads.map((a) => a.campaignExternalId)];
  for (const id of referenced) if (!campaigns.has(id)) campaigns.set(id, removedCampaign(id));

  // anúncio desconhecido: a linha diária não diz a campanha, então fica de fora (conta e campanha já contam o gasto)
  const adIds = new Set(ds.ads.map((a) => a.externalId));
  const products = new Map(ds.products.map((p) => [p.externalId, p]));
  for (const d of ds.productDaily) if (!products.has(d.productExternalId)) products.set(d.productExternalId, unknownProduct(d.productExternalId));

  return { ...ds, campaigns: [...campaigns.values()], adDaily: ds.adDaily.filter((d) => adIds.has(d.adExternalId)), products: [...products.values()] };
}
