"use client";

// Página "Landing pages · em breve": o que vem (templates reais, editor e leads,
// com dados de exemplo e sem ação) e a lista de espera.

import { Check } from "lucide-react";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { PageHeader } from "@/components/ui/kit";
import { ScaledPreview } from "@/components/ui/ScaledPreview";
import { btn } from "@/components/ui/styles";
import { landingDefaults, landingTemplate, type LandingTemplate } from "@/features/templates/landing-pages";
import { joinLandingWaitlist, recordLandingWaitlistVisit } from "@/server/landing-pages/waitlist";
import { ContentFields } from "./editor";
import { LandingRenderer } from "./LandingRenderer";
import { WAITLIST_USE_CASE_MAX } from "./waitlist";

const SAMPLE_TEMPLATES: { id: string; brand: string }[] = [
  { id: "produto-oferta", brand: "Loja Verde" },
  { id: "empreendimento", brand: "Incorporadora Sul" },
  { id: "captura-leads", brand: "Escola Aurora" },
];

const SAMPLE_LEADS = [
  { name: "Ana Souza", contact: "ana@exemplo.com", page: "Coleção de verão", origin: "Meta Ads · remarketing", when: "Hoje, 10:42" },
  { name: "Bruno Lima", contact: "bruno@exemplo.com", page: "Lançamento Aurora", origin: "Google Ads · pesquisa", when: "Hoje, 09:15" },
  { name: "Carla Dias", contact: "carla@exemplo.com", page: "Coleção de verão", origin: "Meta Ads · interesses", when: "Ontem, 18:03" },
];

const SampleBadge = () => <span className="shrink-0 rounded-chip border border-line px-2.5 py-0.5 text-[11px] font-medium text-fg-2">Amostra · dados fictícios</span>;

function Waitlist({ initialJoined }: { initialJoined: boolean }) {
  const [joined, setJoined] = useState(initialJoined);
  const [useCase, setUseCase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (joined) {
    return (
      <section role="status" className="flex items-start gap-3 rounded-card border border-accent bg-accent-soft/40 p-5">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
          <Check size={18} aria-hidden />
        </span>
        <div>
          <h2 className="title text-lg text-fg">Você está na lista</h2>
          <p className="mt-0.5 text-[14px] text-fg-2">Avisamos você assim que as landing pages abrirem.</p>
        </div>
      </section>
    );
  }

  return (
    <form
      className="space-y-3 rounded-card border border-line bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await joinLandingWaitlist(useCase);
          if (res.ok) setJoined(true);
          else setError(res.error.message);
        });
      }}
    >
      <label htmlFor="lp-uso" className="block text-[14px] font-medium text-fg">
        Para que você usaria? <span className="font-normal text-fg-2">(opcional)</span>
      </label>
      <textarea
        id="lp-uso"
        rows={2}
        value={useCase}
        maxLength={WAITLIST_USE_CASE_MAX}
        onChange={(e) => setUseCase(e.target.value)}
        placeholder="Ex.: páginas de captação para os meus clientes"
        className="block w-full resize-y rounded-control border border-line bg-field px-3 py-2 text-[14px] text-fg outline-none placeholder:text-fg-2/70 focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent"
      />
      {error && (
        <p role="alert" className="text-[13px] text-error-fg">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className={btn.primary}>
        {pending ? "Inscrevendo…" : "Quero acessar antes"}
      </button>
    </form>
  );
}

function PreviewBlock({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="title text-lg text-fg">{title}</h2>
          <p className="text-[14px] text-fg-2">{text}</p>
        </div>
        <SampleBadge />
      </div>
      {/* só para ver: nada aqui recebe clique nem foco */}
      <div inert>{children}</div>
    </section>
  );
}

const noop = () => {};

export function LandingComingSoon({ joined }: { joined: boolean }) {
  const templates = SAMPLE_TEMPLATES.flatMap(({ id, brand }) => {
    const t = landingTemplate(id);
    return t ? [{ t, brand }] : [];
  });
  const editing: LandingTemplate | undefined = templates[0]?.t;

  // conta a visita no navegador: o pré-carregamento de links do Next não entra na medida
  const counted = useRef(false);
  useEffect(() => {
    if (counted.current) return;
    counted.current = true;
    void recordLandingWaitlistVisit();
  }, []);

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Em breve" title="Landing pages · em breve" text="Páginas prontas para anúncio, com GTM e pixel configurados e os leads no painel. Entre na lista para acessar antes." />
      <Waitlist initialJoined={joined} />

      <PreviewBlock title="Templates" text="Escolha um modelo pronto para o seu segmento.">
        <ul className="grid gap-4 md:grid-cols-3">
          {templates.map(({ t, brand }) => (
            <li key={t.id} className="overflow-hidden rounded-card border border-line bg-card">
              <ScaledPreview height={200} width={900}>
                <LandingRenderer template={t} content={landingDefaults(t, brand)} />
              </ScaledPreview>
              <p className="border-t border-line px-4 py-3 text-[14px] font-semibold text-fg">{t.name}</p>
            </li>
          ))}
        </ul>
      </PreviewBlock>

      {editing && (
        <PreviewBlock title="Editor" text="Marca, textos e seções, com a prévia ao lado.">
          <div className="grid gap-4 rounded-card border border-line bg-card p-5 lg:grid-cols-2">
            <div className="max-h-[420px] min-w-0 overflow-hidden">
              <ContentFields t={editing} value={landingDefaults(editing, "Loja Verde")} onChange={noop} />
            </div>
            <div className="min-w-0 overflow-hidden rounded-control border border-line">
              <ScaledPreview height={420} width={900}>
                <LandingRenderer template={editing} content={landingDefaults(editing, "Loja Verde")} />
              </ScaledPreview>
            </div>
          </div>
        </PreviewBlock>
      )}

      <PreviewBlock title="Captura de leads" text="Cada formulário cai aqui, com a página e a origem do clique.">
        <div className="overflow-x-auto rounded-card border border-line bg-card">
          <table className="w-full min-w-[640px] text-left text-[13.5px]">
            <thead>
              <tr className="border-b border-line text-[12.5px] text-fg-2">
                {["Nome", "Contato", "Página", "Origem", "Quando"].map((h) => (
                  <th key={h} scope="col" className="px-4 py-2.5 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {SAMPLE_LEADS.map((l) => (
                <tr key={l.contact}>
                  <td className="px-4 py-2.5 font-medium">{l.name}</td>
                  <td className="px-4 py-2.5 text-fg-2">{l.contact}</td>
                  <td className="px-4 py-2.5">{l.page}</td>
                  <td className="px-4 py-2.5 text-fg-2">{l.origin}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-fg-2">{l.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PreviewBlock>
    </div>
  );
}
