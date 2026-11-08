import type { Metadata } from "next";

// Painel interno da Vyzualize: fora do menu, do sitemap e dos buscadores.
export const metadata: Metadata = { title: "Interno", robots: { index: false, follow: false, nocache: true } };

export default function InternoLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-bg px-4 py-8 text-fg sm:px-8">{children}</div>;
}
