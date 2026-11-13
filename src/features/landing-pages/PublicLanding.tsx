// A LP no endereço público (/p/<endereço>): a versão publicada para visitantes
// ou a prévia do rascunho para quem é do workspace. Server Component: só o
// formulário roda no navegador.

import Script from "next/script";
import { PendingChip } from "@/components/ui/kit";
import { landingTemplate } from "@/features/templates/landing-pages";
import type { Tracking } from "@/features/workspace/types";
import type { RenderableLanding } from "@/server/landing-pages/queries";
import { LandingRenderer } from "./LandingRenderer";
import { LeadForm } from "./LeadForm";
import { whatsappHref } from "./model";
import { validateTracking } from "./tracking";

/** Tags do cliente (GTM, GA4, Pixel, Google Ads). Os IDs passaram pela validação e pelos checks do banco. */
function TrackingTags({ tracking }: { tracking: Tracking }) {
  const ok = (k: keyof Tracking) => !!tracking[k] && validateTracking(k, tracking[k]) === null;
  const gtag = [ok("ga4") && tracking.ga4, ok("adsConversion") && tracking.adsConversion.split("/")[0]].filter((v): v is string => !!v);
  return (
    <>
      {ok("gtm") && (
        <Script id="lp-gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(tracking.gtm)});`}
        </Script>
      )}
      {gtag.length > 0 && (
        <>
          <Script id="lp-gtag-src" src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gtag[0])}`} strategy="afterInteractive" />
          <Script id="lp-gtag" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());${gtag.map((id) => `gtag('config',${JSON.stringify(id)});`).join("")}`}
          </Script>
        </>
      )}
      {ok("pixel") && (
        <Script id="lp-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(tracking.pixel)});fbq('track','PageView');`}
        </Script>
      )}
    </>
  );
}

export function PublicLanding({ lp, preview = false }: { lp: RenderableLanding; preview?: boolean }) {
  const t = landingTemplate(lp.templateId);
  if (!t) return <LandingUnavailable />;
  const wa = lp.content.sections.whatsapp ? whatsappHref(lp.content.whatsapp) : null;
  const ctaHref = t.hero === "form" ? "#formulario" : (wa ?? undefined);
  return (
    <main className="min-h-dvh bg-[#f7f8f3]">
      {preview && (
        <div className="bg-[#1e1e1e] px-4 py-2 text-center text-[12.5px] text-[#e8ece1]">
          <p>
            Prévia {lp.status === "published" ? "do rascunho" : "· rascunho"} · só quem é da organização vê. As tags de rastreamento não rodam aqui.
          </p>
        </div>
      )}
      <div className="mx-auto max-w-[1100px]">
        <LandingRenderer
          template={t}
          content={lp.content}
          hideBadge={lp.hideBadge}
          ctaHref={ctaHref}
          whatsappHref={wa}
          form={t.hero === "form" ? <LeadForm slug={lp.slug} fields={lp.content.fields} cta={lp.content.cta} preview={preview} /> : undefined}
        />
      </div>
      {!preview && <TrackingTags tracking={lp.tracking} />}
    </main>
  );
}

export function LandingUnavailable({ preview = false }: { preview?: boolean }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg p-6">
      <div className="max-w-md rounded-card border border-dashed border-line p-8 text-center">
        <h1 className="title text-2xl">Página indisponível</h1>
        <p className="mt-2 text-fg-2">
          {preview ? "Não encontramos esta landing page na sua organização. Confira o endereço ou se você entrou com a conta certa." : "Esta página não existe ou saiu do ar."}
        </p>
        {preview && <PendingChip className="mt-4" label="Endereço próprio em breve" detail="A publicação em subdomínio (sua-marca.vyz.app) ainda depende da hospedagem." />}
      </div>
    </main>
  );
}
