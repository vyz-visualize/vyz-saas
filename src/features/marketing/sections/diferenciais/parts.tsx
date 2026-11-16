"use client";

// Peças comuns às duas direções da dobra Diferenciais: o "pousar" de cada item ao rolar,
// o lado VYZ (um login, o dashboard se montando, a sincronização e o link), a faixa de quem
// fez o produto e a frase de fechamento. Com "reduzir movimento", tudo já aparece parado.

import { useInView } from "motion/react";
import { Link2, RefreshCw } from "lucide-react";
import { useRef, useSyncExternalStore, type ReactNode } from "react";
import { PlatformIcon } from "@/components/brand/PlatformIcon";
import { BuildPreview } from "@/features/onboarding/stage/BuildPreview";
import { PlayWhenVisible } from "../PlayWhenVisible";
import { ROLES } from "./copy";

const REDUCE = "(prefers-reduced-motion: reduce)";
const subscribeReduce = (cb: () => void) => {
  const m = matchMedia(REDUCE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

/** "Reduzir movimento", sem descompasso na hidratação (no servidor e no 1º render: false). */
export function useReduceMotion() {
  return useSyncExternalStore(subscribeReduce, () => matchMedia(REDUCE).matches, () => false);
}

/** true quando o elemento já passou do terço de baixo da tela (uma vez só). */
export function useLanded<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -28% 0px" });
  const reduce = useReduceMotion();
  return [ref, Boolean(seen || reduce)] as const;
}

/** Um item que pousa ao rolar: sobe e acende. */
export function Land({
  children,
  className = "",
  as: Tag = "li",
}: {
  children: ReactNode;
  className?: string;
  as?: "li" | "div" | "p";
}) {
  const [ref, on] = useLanded<HTMLElement>();
  return (
    <Tag
      ref={ref as never}
      data-landed={on || undefined}
      className={`transition-[opacity,transform] duration-500 ease-brand motion-reduce:transition-none ${on ? "translate-y-0 opacity-100" : "translate-y-3 opacity-25 motion-reduce:translate-y-0 motion-reduce:opacity-100"} ${className}`}
    >
      {children}
    </Tag>
  );
}

/** O lado VYZ: um login, o dashboard se montando, a sincronização e o link do cliente. */
export function VyzSide({ client = "Loja Verde" }: { client?: string }) {
  return (
    <div data-dif-vyz>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-control border border-line bg-card px-3 py-2 text-[14px] font-medium text-fg">
          <PlatformIcon id="meta" size={20} />
          Entrar com a Meta
        </span>
        <span className="text-[13px] text-fg-2">ou</span>
        <span className="inline-flex items-center gap-2 rounded-control border border-line bg-card px-3 py-2 text-[14px] font-medium text-fg">
          <PlatformIcon id="google" size={20} />
          Entrar com o Google
        </span>
      </div>
      <PlayWhenVisible className="mt-4">
        <BuildPreview client={client} />
      </PlayWhenVisible>
      <ul className="mt-4 space-y-2.5 text-[15px] text-fg">
        <li className="flex items-start gap-2.5">
          <RefreshCw
            size={17}
            className="mt-0.5 shrink-0 text-accent"
            aria-hidden
          />
          <span>
            <strong className="font-semibold">
              Sincroniza sozinho 3x por dia.
            </strong>{" "}
            <span className="text-fg-2">
              Sem crédito, sem limite de mensagens.
            </span>
          </span>
        </li>
        <li className="flex items-start gap-2.5">
          <Link2
            size={17}
            className="mt-0.5 shrink-0 text-accent"
            aria-hidden
          />
          <span>
            <strong className="font-semibold">O cliente recebe um link.</strong>{" "}
            <span className="text-fg-2">
              Um dashboard que ele entende, não um print de conversa.
            </span>
          </span>
        </li>
      </ul>
    </div>
  );
}

/** "Feito por quem vive isso": os papéis em colunas com fio, sem caixas. */
export function MadeBy({ tone = "default" }: { tone?: "default" | "inverse" }) {
  const muted = tone === "inverse" ? "text-bg/70" : "text-fg-2";
  const rule = tone === "inverse" ? "border-bg/20" : "border-line";
  return (
    <div data-dif-made-by>
      <p className={`label-caps ${muted}`}>Feito por quem vive isso</p>
      <ol className="mt-5 grid gap-6 sm:grid-cols-3 sm:gap-0">
        {ROLES.map((r, i) => (
          <Land
            key={r.role}
            className={`border-t pt-4 sm:border-t-0 sm:pt-0 ${rule} ${i === 0 ? "" : "sm:border-l sm:pl-6"}`}
          >
            <h3 className="title text-[1.25rem]">{r.role}</h3>
            {r.since && (
              // marcador de texto pendente: some quando o texto for confirmado
              <p
                className="mt-1 text-[13px] font-medium text-warning"
                data-pendente
              >
                {r.since}
              </p>
            )}
            <ul
              className={`mt-3 space-y-1.5 text-[14.5px] leading-snug ${muted}`}
            >
              {r.items.map((it) => (
                <li key={it} className="flex gap-2">
                  <span
                    aria-hidden
                    className="mt-[0.55em] size-1 shrink-0 rounded-full bg-accent"
                  />
                  {it}
                </li>
              ))}
            </ul>
          </Land>
        ))}
      </ol>
    </div>
  );
}

/** A frase de fechamento, grande, com o marca-texto ao pousar. */
export function Closing({ text }: { text: string }) {
  const [ref, on] = useLanded<HTMLParagraphElement>();
  return (
    <p
      ref={ref}
      className="display text-[clamp(2rem,5.6vw,4.6rem)] leading-[1.02] text-fg"
      data-dif-closing
    >
      <span
        className="bg-no-repeat transition-[background-size] duration-700 ease-brand motion-reduce:transition-none"
        style={{
          backgroundImage:
            "linear-gradient(color-mix(in srgb, var(--accent) 38%, transparent), color-mix(in srgb, var(--accent) 38%, transparent))",
          backgroundPosition: "0 88%",
          backgroundSize: on ? "100% 0.3em" : "0% 0.3em",
          boxDecorationBreak: "clone",
          WebkitBoxDecorationBreak: "clone",
        }}
      >
        {text}
      </span>
    </p>
  );
}
