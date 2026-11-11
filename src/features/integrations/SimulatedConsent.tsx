// Tela de consentimento simulada (modo de teste). Identidade do VYZ, sem imitar
// a marca ou o visual do Facebook ou do Google: deixa claro que é simulação e o
// que falta para a conexão real. Permitir e Cancelar voltam para a rota de
// retorno como um provedor de verdade faria (?code=... ou ?error=access_denied).

import { Check, CircleAlert, FlaskConical } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { PendingChip } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ConsentActions } from "./ConsentActions";
import { MOCK_NOTICE, MOCK_PROFILES, mockAccountGroups } from "./mock-data";
import { loginOf, PROVIDERS, type ProviderId } from "./providers";

export function ConsentFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-10">
        <Link href="/painel" aria-label="VYZ, voltar ao painel" className="block w-[72px]">
          <Wordmark decorative />
        </Link>
        <ThemeToggle className="size-10" />
      </header>
      <main className="flex flex-1 justify-center px-4 pt-2 pb-16 sm:items-center sm:px-6">
        <div className="w-full max-w-[560px]">{children}</div>
      </main>
    </div>
  );
}

const card = "rounded-[20px] border border-line bg-card p-6 sm:p-8";

export function ConsentSkeleton() {
  return (
    <div className={card} aria-busy="true" aria-label="Carregando">
      <div className="h-6 w-28 animate-pulse rounded-chip bg-line motion-reduce:animate-none" />
      <div className="mt-5 h-7 w-3/4 animate-pulse rounded-control bg-line motion-reduce:animate-none" />
      <div className="mt-6 h-16 animate-pulse rounded-control bg-line motion-reduce:animate-none" />
      <div className="mt-6 h-32 animate-pulse rounded-control bg-line motion-reduce:animate-none" />
    </div>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

type SimulatedConsentProps = {
  provider: ProviderId;
  state: string;
  code: string;
  workspaceName: string;
  expiresAt: string;
  timeZone: string;
};

export function SimulatedConsent({ provider, state, code, workspaceName, expiresAt, timeZone }: SimulatedConsentProps) {
  const info = PROVIDERS[provider];
  const profile = MOCK_PROFILES[provider];
  const callback = `/api/integrations/${provider}/callback`;
  const allow = `${callback}?${new URLSearchParams({ state, code })}`;
  const deny = `${callback}?${new URLSearchParams({ state, error: "access_denied", error_reason: "user_denied" })}`;
  const until = new Intl.DateTimeFormat("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(expiresAt));

  return (
    <section aria-labelledby="consent-title" className={card}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-chip bg-accent-soft px-2.5 py-0.5 text-[12px] font-semibold text-fg">
          <FlaskConical size={13} aria-hidden /> Modo de teste
        </span>
        <PendingChip label="O que falta para a conexão real" detail={MOCK_NOTICE[provider]} />
      </div>

      <h1 id="consent-title" className="mt-4 text-[22px] leading-tight font-semibold tracking-[-0.01em] text-fg">
        Conexão simulada com {info.name}
      </h1>
      <p className="mt-2 text-[14px] text-fg-2">
        Esta tela faz o papel {loginOf(info.id)}. Nada sai do VYZ: o login, as permissões e as contas abaixo são fictícios.
      </p>

      <div className="mt-6 flex items-center gap-3 rounded-control border border-line bg-bg p-3">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-[14px] font-bold text-on-accent">
          {initials(profile.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{profile.name}</p>
          <p className="truncate text-[13px] text-fg-2">{profile.email}</p>
        </div>
      </div>

      <h2 className="mt-6 text-[13px] font-medium text-fg-2">O VYZ pede para</h2>
      <ul className="mt-2 space-y-2.5 text-[14px]">
        {info.permissions.map((p) => (
          <li key={p.scope} className="flex items-start gap-2.5">
            <Check size={16} aria-hidden className="mt-0.5 shrink-0 text-accent" />
            <span>
              {p.label}
              <span className="block text-[12.5px] text-fg-2">{p.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      <h2 className="mt-6 text-[13px] font-medium text-fg-2">Contas que este login enxerga</h2>
      <ul className="mt-2 divide-y divide-line overflow-hidden rounded-control border border-line">
        {mockAccountGroups(provider).map((g) => (
          <li key={g.id} className="p-3">
            <p className="text-[13.5px] font-semibold">
              {info.groupLabel} · {g.name}
            </p>
            <p className="text-[12.5px] text-fg-2">{g.accounts.map((a) => `${a.name} (${a.externalId})`).join(" · ")}</p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12.5px] text-fg-2">Você escolhe quais contas ativar depois, no VYZ.</p>

      <p className="mt-6 text-[14px]">
        Conectar ao workspace <strong>{workspaceName}</strong>.
      </p>
      <ConsentActions allow={allow} deny={deny} />
      <p className="mt-3 text-center text-[12px] text-fg-2">Este pedido vale até {until}.</p>
    </section>
  );
}

const PROBLEM: Record<"invalid" | "expired" | "used", { title: string; text: string }> = {
  invalid: { title: "Pedido de conexão inválido", text: "Este link não é de uma conexão que você começou. Volte e use o botão Conectar." },
  expired: { title: "O pedido de conexão expirou", text: "Ele vale 10 minutos. Volte e comece de novo pelo botão Conectar." },
  used: { title: "Este pedido já foi usado", text: "Cada pedido de conexão vale uma vez. Volte e comece de novo pelo botão Conectar." },
};

export function ConsentProblem({ reason, back }: { reason: keyof typeof PROBLEM; back: string }) {
  const p = PROBLEM[reason];
  return (
    <section aria-labelledby="consent-problem" className={card}>
      <CircleAlert size={22} aria-hidden className="text-error-fg" />
      <h1 id="consent-problem" className="mt-3 text-[20px] leading-tight font-semibold text-fg">
        {p.title}
      </h1>
      <p className="mt-2 text-[14px] text-fg-2">{p.text}</p>
      <Link href={back} className={`${btn.small} mt-5`}>
        Voltar
      </Link>
    </section>
  );
}
