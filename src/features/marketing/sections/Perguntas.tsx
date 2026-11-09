// Dobra "Perguntas": as objeções de quem está decidindo e as dúvidas sobre projetos.
// <details> nativo: abre sem JS; o clique na pergunta vai para o dataLayer (faq_abrir).
// Embaixo do título, o bloco "Ainda com dúvida?" (WhatsApp): no desktop fica fixo enquanto a
// lista rola; no celular vem depois da lista.

import { CutReveal } from "@/components/motion/CutReveal";
import { btn } from "@/components/ui/styles";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { VyzFace } from "@/features/marketing/demo/VyzFace";
import { ENTITLEMENTS } from "@/features/pricing/entitlements";
import { MAX_PROJECTS_IN_PLAN, PLAN_PROJECTS } from "@/features/pricing/pricing";
import { MSG_SPECIALIST, waLink } from "@/lib/whatsapp";

type Faq = { q: string; a: string };

const GROUPS: { title: string; items: Faq[] }[] = [
  {
    title: "Antes de assinar",
    items: [
      {
        q: "Preciso passar a senha das contas de anúncio?",
        a: "A conexão é pelo login oficial da Meta e do Google, sem passar senha, e autoriza leitura e alterações. Nada muda sem você clicar em Aplicar (pausar campanha ou ajustar orçamento diário). O automático é opcional, do plano Avançado, e vem desligado. Cada mudança fica registrada e pode ser desfeita em até 30 dias, se o valor não tiver mudado na plataforma. Você desconecta quando quiser.",
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

/** Ainda com dúvida? O mesmo WhatsApp (e o mesmo evento) do botão do topo. */
function FaqHelp() {
  return (
    <aside aria-labelledby="perguntas-ajuda" className="rounded-card border border-line bg-card p-5 sm:p-6">
      <div className="flex items-center gap-3.5">
        {/* o VYZ pisca de vez em quando; parado com "reduzir movimento" e fora da tela */}
        <VyzFace size={48} />
        <h3 id="perguntas-ajuda" className="text-[19px] leading-snug font-semibold text-fg">
          Ainda com dúvida?
        </h3>
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-fg-2">Fale com um especialista no WhatsApp. A gente responde rápido.</p>
      <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-3">
        <a href={waLink(MSG_SPECIALIST)} target="_blank" rel="noopener noreferrer" className={btn.primary} data-track="whatsapp_click" data-track-origem="perguntas">
          <WhatsAppIcon /> Falar com especialista
        </a>
        <a href="#planos" className={btn.ghost}>
          Ver planos
        </a>
      </div>
    </aside>
  );
}

export function Perguntas() {
  return (
    <section id="perguntas" aria-labelledby="perguntas-title" className="relative border-t border-line">
      {/* no desktop: título e bloco na coluna da esquerda, lista na da direita (as duas linhas).
          No celular, a ordem do HTML: título, lista, bloco. */}
      <div className="mx-auto grid max-w-[1360px] gap-y-8 px-4 pt-14 pb-16 sm:px-6 sm:pt-20 sm:pb-24 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:grid-rows-[auto_1fr] lg:gap-x-14 lg:gap-y-0 lg:px-10">
        <div className="lg:col-start-1 lg:row-start-1">
          <p className="label-caps text-fg-2">Perguntas</p>
          <CutReveal as="h2" id="perguntas-title" className="display mt-5 text-[clamp(2rem,4.6vw,3.6rem)] text-fg" lines={["O que perguntam", <span key="a" className="text-accent">antes de assinar.</span>]} />
        </div>
        <div className="space-y-8 lg:col-start-2 lg:row-span-2 lg:row-start-1">
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
        {/* a célula ocupa a altura que a lista deixa; o bloco gruda embaixo do menu enquanto ela rola */}
        <div className="lg:col-start-1 lg:row-start-2 lg:pt-10">
          <div className="lg:sticky lg:top-24">
            <FaqHelp />
          </div>
        </div>
      </div>
    </section>
  );
}
