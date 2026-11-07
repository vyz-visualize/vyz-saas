// Dobra "Perguntas": as objeções de quem está decidindo e as dúvidas sobre projetos.
// <details> nativo: abre sem JS; o clique na pergunta vai para o dataLayer (faq_abrir).

import { CutReveal } from "@/components/motion/CutReveal";
import { ENTITLEMENTS } from "@/features/pricing/entitlements";
import { MAX_PROJECTS_IN_PLAN, PLAN_PROJECTS } from "@/features/pricing/pricing";

type Faq = { q: string; a: string };

const GROUPS: { title: string; items: Faq[] }[] = [
  {
    title: "Antes de assinar",
    items: [
      {
        q: "Preciso passar a senha das contas de anúncio?",
        a: "Não. Você entra pela própria Meta e pelo Google e autoriza a leitura dos relatórios. O VYZ só lê: não cria, não pausa e não altera campanhas.",
      },
      {
        q: "O meu cliente precisa criar conta?",
        a: "Não. Ele recebe um link e abre no navegador, sem login, e filtra o painel sozinho. Se preferir, mande o PDF. Você decide se ele vê o investimento.",
      },
      {
        q: "Por que Meta e Google não aparecem somados?",
        a: "Porque as duas plataformas costumam contar a mesma venda. Somar dobraria o resultado. O VYZ mostra cada uma com a sua venda, lado a lado.",
      },
      {
        q: "Posso cancelar?",
        a: "Cancele quando quiser, no painel, na página Plano.",
      },
    ],
  },
  {
    title: "Sobre projetos",
    items: [
      {
        q: "O que é um projeto?",
        a: "É o cliente, a empresa ou a marca para quem você gera os dashboards. Dentro dele você conecta as contas (Meta Ads, Google Ads e as outras plataformas do plano) e cria os dashboards daquele cliente.",
      },
      {
        q: "Quantos projetos cabem em cada plano?",
        a: `O Básico vai até ${PLAN_PROJECTS.base} projetos, o Padrão até ${PLAN_PROJECTS.pro} e o Avançado até ${PLAN_PROJECTS.avancado}. Tem mais de ${MAX_PROJECTS_IN_PLAN} clientes? O plano Personalizado é sob consulta, com um especialista.`,
      },
      {
        q: "E se eu passar do limite de projetos?",
        a: "Suba de plano quando quiser, na página Plano do painel. A diferença entra na cobrança, proporcional aos dias que faltam no ciclo.",
      },
      {
        q: "Quantas contas cabem em cada projeto?",
        a: `No Básico, 1 conta de cada plataforma por projeto. No Padrão e no Avançado, até ${ENTITLEMENTS.pro.maxAccountsPerPlatform}. No Meta, as contas da mesma Business Manager contam como uma.`,
      },
    ],
  },
];

export function Perguntas() {
  return (
    <section id="perguntas" aria-labelledby="perguntas-title" className="relative border-t border-line">
      <div className="mx-auto grid max-w-[1360px] gap-8 px-4 pt-14 pb-16 sm:px-6 sm:pt-20 sm:pb-24 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14 lg:px-10">
        <div>
          <p className="label-caps text-fg-2">Perguntas</p>
          <CutReveal as="h2" id="perguntas-title" className="display mt-5 text-[clamp(2rem,4.6vw,3.6rem)] text-fg" lines={["O que perguntam", <span key="a" className="text-accent">antes de assinar.</span>]} />
        </div>
        <div className="space-y-8">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <h3 className="label-caps text-fg-2">{g.title}</h3>
              <div className="mt-3 divide-y divide-line rounded-card border border-line bg-card">
                {g.items.map((f) => (
                  <details key={f.q} className="group px-5 py-1">
                    <summary data-track="faq_abrir" data-track-pergunta={f.q} className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-2.5 text-[16px] font-semibold text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
                      {f.q}
                      <span aria-hidden className="text-xl leading-none text-fg-2 transition-transform group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <p className="pb-4 max-w-3xl text-[15px] leading-relaxed text-fg-2">{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
