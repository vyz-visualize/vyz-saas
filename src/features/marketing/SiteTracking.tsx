"use client";

// A medição do site na página: o ouvinte de cliques (sempre) e o GTM e o Pixel, só com ID.

import Script from "next/script";
import { useEffect } from "react";
import { gtmSnippet, onTrackedClick, pixelSnippet, type SiteTagIds } from "./track";

export function SiteTracking({ ids }: { ids: SiteTagIds }) {
  useEffect(() => {
    document.addEventListener("click", onTrackedClick, true);
    return () => document.removeEventListener("click", onTrackedClick, true);
  }, []);
  return (
    <>
      {ids.gtm && (
        <Script id="vyz-gtm" strategy="afterInteractive">
          {gtmSnippet(ids.gtm)}
        </Script>
      )}
      {ids.pixel && (
        <Script id="vyz-pixel" strategy="afterInteractive">
          {pixelSnippet(ids.pixel)}
        </Script>
      )}
    </>
  );
}
