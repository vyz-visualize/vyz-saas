import { Suspense } from "react";
import { ScrollProgress } from "@/components/motion/ScrollProgress";
import { ComoFunciona } from "@/features/marketing/sections/ComoFunciona";
import { Demonstracao } from "@/features/marketing/sections/Demonstracao";
import { Diferenciais } from "@/features/marketing/sections/Diferenciais";
import { DorSolucao } from "@/features/marketing/sections/DorSolucao";
import { Footer } from "@/features/marketing/sections/Footer";
import { Inteligencia } from "@/features/marketing/sections/Inteligencia";
import { Hero } from "@/features/marketing/sections/Hero";
import { Intro } from "@/features/marketing/sections/Intro";
import { Navbar } from "@/features/marketing/sections/Navbar";
import { Planos } from "@/features/marketing/sections/Planos";
import { PlanProvider } from "@/features/marketing/state/PlanProvider";
import { UrlSync } from "@/features/marketing/state/UrlSync";

export default function Home() {
  return (
    <PlanProvider>
      {/* useSearchParams precisa de Suspense com Cache Components; o resto segue pré-renderizado */}
      <Suspense fallback={null}>
        <UrlSync />
      </Suspense>
      <a
        href="#conteudo"
        className="sr-only z-[90] rounded-control bg-accent px-4 py-2 text-on-accent focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </a>
      <Intro />
      <ScrollProgress />
      <Navbar />
      <main id="conteudo">
        <Hero />
        {/* cada dobra numa fronteira própria: a hidratação sai fatiada, sem tarefa longa */}
        <DorSolucao />
        <Suspense>
          <Demonstracao />
        </Suspense>
        <Diferenciais />
        <Suspense>
          <ComoFunciona />
        </Suspense>
        <Suspense>
          <Inteligencia />
        </Suspense>
        <Suspense>
          <Planos />
        </Suspense>
      </main>
      <Suspense>
        <Footer />
      </Suspense>
    </PlanProvider>
  );
}
