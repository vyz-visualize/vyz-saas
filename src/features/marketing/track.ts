// Medição do site: uma camada só, no dataLayer. Sem GTM instalado, os eventos ficam
// na fila e nada sai do navegador; com o GTM, ele lê a mesma fila.

export type SiteEvent = "hero_cta" | "demo_interacao" | "plano_assinar" | "whatsapp_click" | "faq_abrir" | "cta_final" | "video_inicio" | "video_som" | "video_fim";

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

/** Os parâmetros de um elemento marcado: data-track="evento" e data-track-<nome>="valor". */
export function trackedParams(el: HTMLElement): { event: SiteEvent; params: Params } | null {
  const event = el.dataset.track as SiteEvent | undefined;
  if (!event) return null;
  const params: Params = {};
  for (const [key, value] of Object.entries(el.dataset)) {
    if (key === "track" || !key.startsWith("track") || value == null) continue;
    const name = key.slice(5);
    params[name[0].toLowerCase() + name.slice(1)] = value;
  }
  return { event, params };
}

/**
 * Um ouvinte só para a página: qualquer elemento com data-track vira evento ao ser clicado.
 * Pergunta fechada só conta ao abrir.
 */
export function onTrackedClick(e: MouseEvent) {
  const el = (e.target as Element | null)?.closest?.("[data-track]") as HTMLElement | null;
  if (!el) return;
  if (el.tagName === "SUMMARY" && (el.parentElement as HTMLDetailsElement | null)?.open) return;
  const hit = trackedParams(el);
  if (hit) track(hit.event, hit.params);
}

// ---- GTM e Pixel: só com o ID (variável de ambiente); sem ID, nada carrega ----------------

const GTM_ID = /^GTM-[A-Z0-9]{4,12}$/;
const PIXEL_ID = /^\d{8,20}$/;

export type SiteTagIds = { gtm: string | null; pixel: string | null };

/** IDs válidos das variáveis de ambiente. Qualquer outra coisa é ignorada (nada entra no HTML). */
export function siteTagIds(env: { gtm?: string; pixel?: string }): SiteTagIds {
  const gtm = env.gtm?.trim() ?? "";
  const pixel = env.pixel?.trim() ?? "";
  return { gtm: GTM_ID.test(gtm) ? gtm : null, pixel: PIXEL_ID.test(pixel) ? pixel : null };
}

export const gtmSnippet = (id: string) =>
  `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');`;

export const pixelSnippet = (id: string) =>
  `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');`;
