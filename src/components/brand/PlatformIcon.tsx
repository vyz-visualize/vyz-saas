// Ícone de cada ferramenta (Meta, Google Ads, GA4, Instagram...). Marcas do pacote
// simple-icons (CC0) num quadrado com a cor da marca; as que o pacote não tem viram
// um selo com a sigla na cor delas.

import { Database, FileSpreadsheet, Hash } from "lucide-react";
import {
  siFacebook,
  siGoogleads,
  siGoogleanalytics,
  siGooglesheets,
  siHubspot,
  siInstagram,
  siMercadopago,
  siMeta,
  siShopee,
  siSpotify,
  siTiktok,
  siX,
  siYoutube,
  type SimpleIcon,
} from "simple-icons";

export type IconId = string;

const ICONS: Record<string, SimpleIcon> = {
  meta: siMeta,
  google: siGoogleads,
  ga4: siGoogleanalytics,
  instagram: siInstagram,
  facebook: siFacebook,
  tiktok: siTiktok,
  hubspot: siHubspot,
  youtube: siYoutube,
  shopee: siShopee,
  x: siX,
  spotify: siSpotify,
  mercado: siMercadopago,
  planilha: siGooglesheets,
};

/** Marcas fora do pacote: cor e sigla. */
const BADGES: Record<string, { bg: string; fg?: string; text: string }> = {
  linkedin: { bg: "#0A66C2", text: "in" },
  rdstation: { bg: "#1A2F5A", text: "RD" },
  pipedrive: { bg: "#017737", text: "P" },
  kommo: { bg: "#339DC7", text: "K" },
  globo: { bg: "#E30613", text: "g" },
  chatgpt: { bg: "#10A37F", text: "AI" },
};

export function PlatformIcon({ id, size = 36, className = "" }: { id: IconId; size?: number; className?: string }) {
  const box = { width: size, height: size, borderRadius: Math.round(size * 0.26) };
  const icon = ICONS[id];
  if (icon) {
    const dark = icon.hex === "000000";
    return (
      <span aria-hidden className={`inline-flex shrink-0 items-center justify-center ${className}`} style={{ ...box, background: dark ? "#111" : `#${icon.hex}` }}>
        <svg viewBox="0 0 24 24" width={size * 0.56} height={size * 0.56} fill="#fff">
          <path d={icon.path} />
        </svg>
      </span>
    );
  }
  const badge = BADGES[id];
  if (badge) {
    return (
      <span aria-hidden className={`inline-flex shrink-0 items-center justify-center font-bold ${className}`} style={{ ...box, background: badge.bg, color: badge.fg ?? "#fff", fontSize: size * 0.38 }}>
        {badge.text}
      </span>
    );
  }
  const Fallback = id === "manual" ? Hash : id === "import" ? FileSpreadsheet : Database;
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center bg-field text-fg-2 ${className}`} style={box}>
      <Fallback size={size * 0.5} />
    </span>
  );
}
