import { Suspense } from "react";
import { ScrollProgress } from "@/components/motion/ScrollProgress";
import { ComoFunciona } from "@/features/marketing/sections/ComoFunciona";
import { CtaFinal } from "@/features/marketing/sections/CtaFinal";
import { Diferenciais } from "@/features/marketing/sections/Diferenciais";
import { DorSolucao } from "@/features/marketing/sections/DorSolucao";
import { PorQueFecha } from "@/features/marketing/sections/PorQueFecha";
import { Footer } from "@/features/marketing/sections/Footer";
import { Hero } from "@/features/marketing/sections/Hero";
import { Intro } from "@/features/marketing/sections/Intro";
import { Navbar } from "@/features/marketing/sections/Navbar";
import { Perguntas } from "@/features/marketing/sections/Perguntas";
import { PorDentro } from "@/features/marketing/sections/PorDentro";
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
          <PorDentro />
        </Suspense>
        <Diferenciais />
        <Suspense>
          <ComoFunciona />
        </Suspense>
        <Suspense>
          <PorQueFecha />
        </Suspense>
        <Suspense>
          <Planos />
        </Suspense>
        <Perguntas />
        <CtaFinal />
      </main>
      <Suspense>
        <Footer />
      </Suspense>
    </PlanProvider>
  );
}
