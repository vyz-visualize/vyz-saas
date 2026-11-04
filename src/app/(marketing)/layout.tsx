import type { Metadata } from "next";
import { MotionRoot } from "@/components/motion/MotionRoot";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { SHOW_LANDING_PAGES } from "@/features/marketing/config";

const title = SHOW_LANDING_PAGES ? "VYZ · Dashboards e landing pages para gestores de tráfego" : "VYZ · Dashboards para gestores de tráfego";
const description =
  `Conecte Meta Ads, Google Ads e GA4 e tenha o dashboard do seu cliente pronto, com CPA, ROAS e funil no topo.${SHOW_LANDING_PAGES ? " Landing pages com GTM configurado." : ""}`;

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  openGraph: { title, description, siteName: "VYZ", locale: "pt_BR", type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

/** Área de marketing: a única com Lenis, intro e motion. */
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <MotionRoot>
      <SmoothScroll />
      {children}
    </MotionRoot>
  );
}
