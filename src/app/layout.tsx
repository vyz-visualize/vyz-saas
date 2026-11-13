import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { HtmlFlags } from "@/components/ui/HtmlFlags";
import { INTRO_KEY, shouldPlayIntro } from "@/lib/intro-rule";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Raiz mínima: fonte, tokens e tema. Cada área ((marketing), (painel), (publico))
// define os próprios metadados.
export const metadata: Metadata = {
  // domínio oficial (NEXT_PUBLIC_SITE_URL): URLs absolutas de Open Graph e links
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.vyzualize.com.br"),
  title: { default: "VYZ · Vyzualize", template: "%s · VYZ" },
  applicationName: "VYZ · Vyzualize",
  // TODO: remover no lançamento
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#1E1E1E",
  colorScheme: "dark light",
};

// Roda antes da primeira pintura: tema salvo (o padrão é o escuro), marca que
// há JS, menu do painel aberto (ele recolhe sozinho em 2 s, se não estiver fixado)
// e decide se a intro roda (primeira visita à home, sem campanha).
const bootScript = `(function(){var d=document.documentElement;d.setAttribute("data-js","");try{var t=localStorage.getItem("vyz-theme");if(t==="light"||t==="dark")d.setAttribute("data-theme",t)}catch(e){}try{if(location.pathname.indexOf("/painel")===0)d.setAttribute("data-sidebar","open")}catch(e){}try{if((${shouldPlayIntro.toString()})({pathname:location.pathname,search:location.search,hash:location.hash,seen:!!localStorage.getItem("${INTRO_KEY}"),reducedMotion:matchMedia("(prefers-reduced-motion: reduce)").matches}))d.setAttribute("data-intro","")}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" data-theme="dark" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="min-h-dvh overflow-x-clip">
        <HtmlFlags />
        {children}
      </body>
    </html>
  );
}
