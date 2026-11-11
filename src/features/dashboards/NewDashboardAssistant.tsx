"use client";

// Popup do assistente ao criar um dashboard: a pessoa conta o que quer (por
// texto ou voz) e recebe até três modelos que combinam, com o motivo. Quem
// prefere escolher sozinho fecha por "Clique aqui" e cai na galeria. A sugestão
// roda no navegador (features/templates/recommend); o pedido fica no histórico.

import { ArrowRight, Eye, Lock, Mic, Radio, Sparkles, Square } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Modal } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import type { PlatformId } from "@/features/accounts/platforms";
import { Mascot } from "@/features/agent/Mascot";
import { canListen, listen, stripWakeWord } from "@/features/agent/voice";
import { availableIn, TIER_LABEL, type Tier } from "@/features/pricing/entitlements";
import { EXAMPLE_REQUESTS, fallbackTemplates, recommendTemplates, type Recommendation } from "@/features/templates/recommend";
import { recordTemplateSearch } from "@/server/dashboards/actions";
import { TemplateThumb } from "./TemplateGallery";

type Via = "text" | "voice" | "example";
type Result = { query: string; items: Recommendation[]; exact: boolean };

type AssistantProps = {
  open: boolean;
  /** Fecha para escolher na galeria. */
  onBrowse: () => void;
  tier: Tier;
  enabledAccounts: Partial<Record<PlatformId, number>>;
  /** O plano inclui voz (Avançado e Personalizado). */
  voice: boolean;
  onUse: (templateId: string) => void;
  onPreview: (templateId: string) => void;
};

const noop = () => () => {};

export function NewDashboardAssistant({ open, onBrowse, tier, enabledAccounts, voice, onUse, onPreview }: AssistantProps) {
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const stopMic = useRef<() => void>(() => {});
  const latest = useRef("");
  // só no navegador: no servidor e na hidratação o microfone nasce desligado
  const micSupported = useSyncExternalStore(noop, canListen, () => false);

  const run = useCallback(
    (raw: string, via: Via) => {
      const query = raw.trim().slice(0, 300);
      if (!query) return;
      const o = { tier, enabledAccounts };
      const found = recommendTemplates(query, o);
      const items = found.length ? found : fallbackTemplates(o);
      setResult({ query, items, exact: found.length > 0 });
      // histórico: o que a pessoa procurou e o que foi sugerido (falha de registro não atrapalha)
      void recordTemplateSearch({ query, via, suggested: items.map((r) => r.template.id) }).catch(() => {});
    },
    [enabledAccounts, tier],
  );

  const stop = useCallback(() => {
    stopMic.current();
    setListening(false);
    setInterim("");
  }, []);

  // sair do popup (fechar, usar ou ver a prévia) desliga o microfone; ao desmontar também
  useEffect(() => () => stopMic.current(), []);
  const leave = (then: () => void) => {
    stop();
    then();
  };

  function toggleMic() {
    if (!voice) return setNote(`Falar com o assistente faz parte do plano ${TIER_LABEL.avancado}. Por enquanto, digite o que precisa.`);
    if (!micSupported) return setNote("Este navegador não reconhece voz. Digite o que precisa.");
    if (listening) return stop();
    setNote(null);
    setListening(true);
    stopMic.current = listen({
      onInterim: setInterim,
      onFinal: (heard) => {
        setInterim("");
        const { rest } = stripWakeWord(heard);
        if (!rest) return;
        const next = `${latest.current} ${rest}`.trim();
        latest.current = next;
        setText(next);
        run(next, "voice");
      },
      onError: setNote,
      onEnd: () => {
        setListening(false);
        setInterim("");
      },
    });
  }

  const change = (v: string) => {
    latest.current = v;
    setText(v);
  };

  return (
    <Modal open={open} onClose={() => leave(onBrowse)} title="Novo dashboard" wide>
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <span className="shrink-0">
            <Mascot state={listening ? "listening" : "idle"} size={56} />
          </span>
          <div className="min-w-0">
            <p className="title text-xl">Que dashboard você quer montar?</p>
            <p className="mt-0.5 text-[14px] text-fg-2">Conte em uma frase o tipo de negócio, as plataformas e o que quer acompanhar. Eu indico o modelo.</p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(text, "text");
          }}
        >
          <div className="flex items-end gap-2 rounded-card border border-line bg-field p-2 focus-within:border-accent">
            <label className="min-w-0 flex-1">
              <span className="sr-only">O que você quer acompanhar</span>
              <textarea
                value={listening && interim ? `${text} ${interim}`.trim() : text}
                onChange={(e) => change(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || e.shiftKey) return;
                  e.preventDefault();
                  run(text, "text");
                }}
                readOnly={listening}
                rows={2}
                maxLength={300}
                placeholder={listening ? "Ouvindo… pode falar" : "Ex.: loja virtual com Meta e Google, quero ver receita e ROAS"}
                className="block w-full resize-none bg-transparent px-2 py-1.5 text-[15px] outline-none placeholder:text-fg-2"
              />
            </label>
            <button
              type="button"
              onClick={toggleMic}
              aria-pressed={listening}
              aria-label={listening ? "Parar de ouvir" : voice ? "Falar em vez de digitar" : `Falar em vez de digitar (${availableIn("avancado")})`}
              className={`relative inline-flex size-10 shrink-0 items-center justify-center rounded-control border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${listening ? "border-accent bg-accent text-on-accent" : "border-line text-fg hover:border-accent hover:text-accent"} ${voice && micSupported ? "" : "opacity-60"}`}
            >
              {listening ? <Square size={15} aria-hidden /> : <Mic size={18} aria-hidden />}
              {!voice && (
                <span aria-hidden className="absolute -top-1.5 -right-1.5 inline-flex size-4 items-center justify-center rounded-full bg-card text-fg-2 ring-1 ring-line">
                  <Lock size={9} />
                </span>
              )}
            </button>
            <button type="submit" disabled={!text.trim()} className={`${btn.small} h-10 shrink-0`}>
              <Sparkles size={15} aria-hidden /> Sugerir
            </button>
          </div>
          <p aria-live="polite" className={`mt-1.5 min-h-[18px] text-[12.5px] ${note ? "text-warning" : "text-fg-2"}`}>
            {note ?? (listening ? "Ouvindo. Toque no quadrado para parar." : "")}
          </p>
        </form>

        {!result && (
          <div>
            <p className="mb-2 text-[12.5px] font-medium text-fg-2">Ou comece por um destes:</p>
            <ul className="flex flex-wrap gap-1.5">
              {EXAMPLE_REQUESTS.map((e) => (
                <li key={e}>
                  <button
                    type="button"
                    onClick={() => {
                      change(e);
                      run(e, "example");
                    }}
                    className="rounded-chip border border-line px-3 py-1.5 text-[13px] text-fg-2 transition-colors hover:border-accent hover:text-fg"
                  >
                    {e}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {result && (
          <section aria-live="polite" aria-label="Modelos sugeridos" className="space-y-3">
            <p className="text-[14px]">
              {result.exact ? (
                <>
                  Para <strong>“{result.query}”</strong>, {result.items.length === 1 ? "este modelo é o que mais combina" : "estes modelos são os que mais combinam"}:
                </>
              ) : result.items.length ? (
                <>Não achei um modelo exato para esse pedido. Estes funcionam com o seu plano agora; se preferir, descreva de outro jeito ou veja todos.</>
              ) : (
                <>Não achei um modelo para esse pedido. Descreva de outro jeito ou veja todos os modelos.</>
              )}
            </p>
            <ul className={`grid gap-3 ${result.items.length > 1 ? "sm:grid-cols-2" : ""} ${result.items.length > 2 ? "lg:grid-cols-3" : ""}`}>
              {result.items.map((r, i) => (
                <Suggestion key={r.template.id} r={r} best={result.exact && i === 0} onUse={(id) => leave(() => onUse(id))} onPreview={(id) => leave(() => onPreview(id))} />
              ))}
            </ul>
          </section>
        )}

        <p className="border-t border-line pt-4 text-[13.5px] text-fg-2">
          Prefere procurar você mesmo?{" "}
          <button type="button" onClick={() => leave(onBrowse)} className="font-semibold text-accent underline underline-offset-4 outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-accent">
            Clique aqui para ver todos os modelos
          </button>
          .
        </p>
      </div>
    </Modal>
  );
}

function Suggestion({ r, best, onUse, onPreview }: { r: Recommendation; best: boolean; onUse: (id: string) => void; onPreview: (id: string) => void }) {
  const t = r.template;
  return (
    <li className={`flex flex-col overflow-hidden rounded-card border bg-card ${best ? "border-accent" : "border-line"}`}>
      <div className="relative border-b border-line">
        <TemplateThumb t={t} height={120} />
        {best && <span className="absolute top-2 left-2 rounded-chip bg-accent px-2 py-0.5 text-[11px] font-semibold text-on-accent">Combina mais</span>}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <p className="leading-snug font-semibold">{t.name}</p>
          <span className={`shrink-0 rounded-chip px-2 py-0.5 text-[11px] font-semibold ${t.tier === "base" ? "border border-line text-fg-2" : "bg-accent-soft text-fg"}`}>{TIER_LABEL[t.tier]}</span>
        </div>
        <p className="line-clamp-3 text-[13px] text-fg-2">{t.description}</p>
        {(r.reasons.length > 0 || t.dataMode === "live") && (
          <p className="flex flex-wrap gap-1">
            {t.dataMode === "live" && (
              <span className="inline-flex items-center gap-1 rounded-chip bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-fg">
                <Radio size={11} aria-hidden /> Dados reais
              </span>
            )}
            {r.reasons.slice(0, 4).map((reason) => (
              <span key={reason} className="rounded-chip border border-line px-2 py-0.5 text-[11px] text-fg-2 first-letter:uppercase">
                {reason}
              </span>
            ))}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1.5">
          {r.locked ? (
            <Link href="/painel/plano" className={btn.small}>
              <Lock size={14} aria-hidden /> {availableIn(t.tier)}
            </Link>
          ) : r.needsAccount ? (
            <Link href="/painel/contas" className={btn.small}>
              Ativar uma conta <ArrowRight size={15} aria-hidden />
            </Link>
          ) : (
            <button type="button" onClick={() => onUse(t.id)} className={btn.small}>
              Usar este <ArrowRight size={15} aria-hidden />
            </button>
          )}
          <button type="button" onClick={() => onPreview(t.id)} className="inline-flex h-9 items-center gap-1.5 rounded-control px-2.5 text-[13px] font-semibold text-accent outline-none hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent">
            <Eye size={15} aria-hidden /> Ver prévia
          </button>
        </div>
      </div>
    </li>
  );
}
