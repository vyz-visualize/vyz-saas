// Medição do site: uma camada só, no dataLayer. Sem GTM instalado, os eventos ficam
// na fila e nada sai do navegador; com o GTM, ele lê a mesma fila.

export type SiteEvent = "hero_cta" | "demo_interacao" | "plano_assinar" | "whatsapp_click" | "faq_abrir" | "cta_final";

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
