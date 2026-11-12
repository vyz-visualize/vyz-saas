// Medição do site e do painel: uma camada só, no dataLayer. Sem GTM instalado, os
// eventos ficam na fila e nada sai do navegador; com o GTM, ele lê a mesma fila.
// O painel não carrega GTM nem script de terceiro: lá a fila só acumula.

export type SiteEvent =
  | "hero_cta"
  | "demo_interacao"
  | "plano_assinar"
  | "whatsapp_click"
  | "faq_abrir"
  | "cta_final"
  | "video_inicio"
  | "video_som"
  | "video_fim"
  // primeiro acesso, tour e lembretes (painel)
  | "onboarding_step_view"
  | "onboarding_step_complete"
  | "onboarding_skip"
  | "tour_complete"
  | "nudge_view"
  | "nudge_click";

type Params = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export function track(event: SiteEvent, params: Params = {}) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event, ...params });
}
