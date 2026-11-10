import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseWs = supabase.replace(/^https:/, "wss:");

// CSP sem nonce: nonce obriga render dinâmico e quebra as páginas
// pré-renderizadas (Cache Components). Ver docs do Next, "Without Nonces".
const csp = (extra: { script?: string; connect?: string; frame?: string } = {}) =>
  [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${extra.script ? ` ${extra.script}` : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabase} ${supabaseWs}${extra.connect ? ` ${extra.connect}` : ""}`,
    "media-src 'self' blob:",
    `frame-src 'self'${extra.frame ? ` ${extra.frame}` : ""}`,
    "frame-ancestors 'none'",
    `form-action 'self' ${supabase} https://accounts.google.com https://www.facebook.com https://checkout.stripe.com`,
    "base-uri 'self'",
    "object-src 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

const common = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // microfone: assistente VYZ por voz (só no próprio site)
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=(), usb=(), interest-cohort=(), microphone=(self)" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

// LPs publicadas rodam GTM, Pixel e GA4 do cliente.
const landingTags = {
  script: "https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://www.googleadservices.com https://googleads.g.doubleclick.net",
  connect: "https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://www.facebook.com https://connect.facebook.net https://googleads.g.doubleclick.net",
  frame: "https://www.googletagmanager.com https://td.doubleclick.net https://www.facebook.com",
};

// Site: GTM e Pixel da própria VYZ, só quando houver um ID configurado.
const siteTags = process.env.NEXT_PUBLIC_GTM_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID ? landingTags : {};

// Vídeo do site: os arquivos de public/video que existem no build (src/features/marketing/video.ts
// decide a partir deles se a dobra, o link do hero e o item do menu aparecem).
const videoDir = join(process.cwd(), "public", "video");
const videoFiles = existsSync(videoDir) ? readdirSync(videoDir).filter((f) => /^vyz-por-dentro(-celular)?\.(mp4|webm|webp|jpg)$/.test(f)) : [];

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_DEMO_VIDEO_FILES: videoFiles.join(","),
  },
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // logo da marca até 2 MB (o padrão das Server Actions é 1 MB)
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path((?!p/).*)", headers: [...common, { key: "Content-Security-Policy", value: csp(siteTags) }] },
      { source: "/p/:path*", headers: [...common, { key: "Content-Security-Policy", value: csp(landingTags) }] },
    ];
  },
};

export default nextConfig;
