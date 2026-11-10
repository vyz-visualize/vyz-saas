import type { Metadata } from "next";
import { MotionRoot } from "@/components/motion/MotionRoot";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { SiteTracking } from "@/features/marketing/SiteTracking";
import { siteTagIds } from "@/features/marketing/track";
import { SHOW_LANDING_PAGES, SITE_INDEXABLE } from "@/lib/flags";

const title = SHOW_LANDING_PAGES ? "VYZ · Vyzualize · Dashboards e landing pages para gestores de tráfego" : "VYZ · Vyzualize · Dashboards para gestores de tráfego";
const description =
  `Meta Ads, Google Ads, TikTok Ads e outras plataformas de mídia digital num painel só: o dashboard do seu cliente pronto, com CPA, ROAS e funil no topo.${SHOW_LANDING_PAGES ? " Landing pages com GTM configurado." : ""}`;

const SHARE_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: title };

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  // a imagem precisa vir aqui: o openGraph deste layout substitui o da raiz, inclusive a imagem
  openGraph: { title, description, siteName: "VYZ · Vyzualize", locale: "pt_BR", type: "website", images: [SHARE_IMAGE] },
  twitter: { card: "summary_large_image", title, description, images: [SHARE_IMAGE] },
  // endereço canônico (resolvido pelo metadataBase da raiz)
  alternates: { canonical: "/" },
  // a raiz é noindex; no lançamento (SITE_INDEXABLE), só o site público abre
  ...(SITE_INDEXABLE ? { robots: { index: true, follow: true } } : {}),
};

/** Área de marketing: a única com Lenis, intro e motion. */
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <MotionRoot>
      <SmoothScroll />
      {/* display: contents: só carrega o tom do texto do site, sem caixa no layout */}
      <div className="site-tone contents">{children}</div>
      {/* GTM e Pixel só com o ID na variável de ambiente (lidos no build) */}
      <SiteTracking ids={siteTagIds({ gtm: process.env.NEXT_PUBLIC_GTM_ID, pixel: process.env.NEXT_PUBLIC_META_PIXEL_ID })} />
    </MotionRoot>
  );
}
