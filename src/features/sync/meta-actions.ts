// Eventos da Meta sem contagem em dobro. A API devolve o mesmo evento em vários
// tipos de ação (compra aparece como omni_purchase, offsite_conversion.fb_pixel_purchase,
// onsite_conversion.purchase…): somar dá o dobro. Regra: um campo por evento, sempre
// o agrupado, que já reúne os outros. A importação real usa esta função.
// Fonte: referência Ads Action Stats, "Grouped Action Types".

export const META_ACTION_FIELDS = {
  conversions: "omni_purchase",
  leads: "lead",
  registrations: "omni_complete_registration",
  addToCart: "omni_add_to_cart",
  initiateCheckout: "omni_initiated_checkout",
  landingPageViews: "landing_page_view",
  linkClicks: "link_click",
  postEngagement: "post_engagement",
  postReactions: "post_reaction",
  postComments: "comment",
  postShares: "post",
  postSaves: "onsite_conversion.post_save",
  videoViews: "video_view",
} as const;

export type MetaActionMetric = keyof typeof META_ACTION_FIELDS;
export type MetaAction = { action_type?: string; value?: string | number };

/** Lê cada evento do seu único campo. Sem o campo na resposta: null, nunca 0. */
export function readMetaActions(actions: readonly MetaAction[] | null | undefined): Record<MetaActionMetric, number | null> {
  const byType = new Map<string, number>();
  for (const a of actions ?? []) {
    const value = Number(a.value);
    if (a.action_type && Number.isFinite(value)) byType.set(a.action_type, value);
  }
  const out = {} as Record<MetaActionMetric, number | null>;
  for (const metric of Object.keys(META_ACTION_FIELDS) as MetaActionMetric[]) out[metric] = byType.get(META_ACTION_FIELDS[metric]) ?? null;
  return out;
}
