import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

// Páginas legais: texto corrido, sem motion. Os links ficam no rodapé, no checkout e no app.
// indexáveis desde já: a raiz é noindex (a home só abre com SITE_INDEXABLE), estas não
export const metadata: Metadata = { title: { default: "VYZ", template: "%s · VYZ" }, robots: { index: true, follow: true } };

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site-tone flex min-h-dvh flex-col bg-bg">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-10">
        <Link href="/" aria-label="VYZ, voltar ao site" className="block w-[72px]">
          <Wordmark decorative />
        </Link>
        <ThemeToggle className="size-10" />
      </header>
      <main className="flex-1 px-4 pt-6 pb-20 sm:px-6">
        <article className="legal mx-auto max-w-[720px] text-[15px] leading-relaxed text-fg-2 [&_a]:text-accent [&_a]:underline [&_h1]:mb-3 [&_h1]:text-[clamp(2.2rem,6vw,3.4rem)] [&_h1]:leading-[1.02] [&_h1]:font-extrabold [&_h1]:tracking-[-0.03em] [&_h1]:text-fg [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-fg [&_li]:mt-1.5 [&_p]:mt-3 [&_strong]:text-fg [&_code]:rounded-[4px] [&_code]:bg-card [&_code]:px-1 [&_code]:text-[13px] [&_code]:break-all [&_code]:text-fg [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </article>
      </main>
      <footer className="border-t border-line px-4 py-5 text-center text-[13px] text-fg-2">
        <Link href="/termos" className="hover:text-accent">Termos de Uso</Link>
        {" · "}
        <Link href="/privacidade" className="hover:text-accent">Política de Privacidade</Link>
        {" · "}
        <Link href="/exclusao-de-dados" className="hover:text-accent">Exclusão de dados</Link>
      </footer>
    </div>
  );
}
