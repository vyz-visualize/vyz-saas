// Dobra "Diferenciais": o que já está no produto e um gerador de relatório comum não faz.
// Sem citar ninguém. O app aparece como disponível; os selos das lojas, só com a URL.

import { BarChart3, EyeOff, GitCompareArrows, MessageCircle, MousePointerClick, Smartphone } from "lucide-react";
import type { ReactNode } from "react";
import { CutReveal } from "@/components/motion/CutReveal";
import { Reveal } from "@/components/motion/Reveal";
import { storeLinks } from "@/lib/store-links";

const ITEMS: { icon: ReactNode; title: string; short: string; text: string; tag?: string }[] = [
  { icon: <MousePointerClick size={20} />, title: "Dashboard interativo", short: "Clique numa campanha e tudo filtra.", text: "Clique numa campanha e o painel inteiro filtra. O seu cliente também consegue, no link." },
  { icon: <MessageCircle size={20} />, title: "Análise, não só gráfico", short: "Pergunte ao VYZ. Voz no Avançado.", text: "Pergunte ao VYZ sobre os números e ele responde na hora.", tag: "Voz no Avançado" },
  { icon: <GitCompareArrows size={20} />, title: "Comparativo de criativos", short: "Anúncios lado a lado, no Avançado.", text: "Anúncios lado a lado, com o melhor de cada métrica e uma leitura do resultado.", tag: "No Avançado" },
  { icon: <BarChart3 size={20} />, title: "Métricas por cliente", short: "Escolha os cards de cada cliente.", text: "Escolha os cards de cada cliente: cada um vê o que importa para ele." },
  { icon: <EyeOff size={20} />, title: "Investimento oculto no link", short: "O valor nem chega ao cliente.", text: "Mande o resultado sem mostrar quanto foi investido: o valor nem chega ao navegador do cliente." },
  { icon: <Smartphone size={20} />, title: "App para iOS e Android", short: "Os dashboards no seu celular.", text: "Os dashboards dos seus clientes no celular, com o VYZ junto." },
];

export function Diferenciais() {
  const stores = storeLinks();
  return (
    <section id="diferenciais" aria-labelledby="dif-title" className="relative">
      <div className="mx-auto max-w-[1360px] px-4 pt-14 pb-14 sm:px-6 sm:pt-20 sm:pb-24 lg:px-10 lg:pt-28">
        <p className="label-caps text-fg-2">Diferenciais</p>
        <CutReveal as="h2" id="dif-title" className="display mt-5 text-[clamp(2.2rem,5.4vw,4.4rem)] text-fg" lines={["O que um gerador de", <span key="a" className="text-accent">relatório comum não faz.</span>]} />
        <ul className="mt-7 grid gap-2.5 sm:mt-12 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {ITEMS.map((it, i) => (
            <li key={it.title}>
              <Reveal delay={(i % 3) * 80} className="h-full">
                <article className="group flex h-full flex-col rounded-card border border-line bg-card p-4 transition-colors duration-200 hover:border-accent sm:p-6">
                  {/* no celular: ícone ao lado, título e uma linha curta */}
                  <div className="flex items-center gap-3.5 sm:block">
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent transition-transform duration-300 ease-brand group-hover:-translate-y-0.5 sm:size-11" aria-hidden>
                      {it.icon}
                    </span>
                    <div className="min-w-0">
                      <h3 className="title text-[1.05rem] text-fg sm:mt-5 sm:text-[1.25rem]">{it.title}</h3>
                      <p className="mt-0.5 text-[14px] leading-snug text-fg-2 sm:hidden">{it.short}</p>
                    </div>
                  </div>
                  <p className="mt-2 hidden text-[15.5px] leading-relaxed text-fg-2 sm:block">{it.text}</p>
                  {it.tag && <span className="mt-4 hidden w-fit sm:inline-block rounded-chip border border-line px-2.5 py-0.5 text-[12px] font-medium text-fg-2">{it.tag}</span>}
                  {it.icon && it.title.startsWith("App") && (stores.appStore || stores.playStore) && (
                    <span className="mt-4 flex flex-wrap gap-2">
                      {stores.appStore && (
                        <a href={stores.appStore} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-control border border-line px-3 text-[13px] font-medium text-fg hover:border-accent">
                          App Store
                        </a>
                      )}
                      {stores.playStore && (
                        <a href={stores.playStore} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-control border border-line px-3 text-[13px] font-medium text-fg hover:border-accent">
                          Google Play
                        </a>
                      )}
                    </span>
                  )}
                </article>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
