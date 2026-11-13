// "Primeiros passos" da Início: em ordem, e um passo só fica feito quando o
// anterior está feito de verdade (o dashboard só conta com conta ligada).
// Puro: a tela e os testes usam o mesmo.

import { CORE_PROVIDER_IDS, PROVIDERS, type ProviderId } from "@/features/integrations/providers";

export type HomeStepId = "connect" | "dashboard" | "share";
export type HomeStep = { id: HomeStepId; label: string; text: string; done: boolean };

export type HomeStepsInput = {
  /** Plataformas com conta ativa. */
  connected: readonly ProviderId[];
  /** Dashboards com pelo menos uma conta ativa ligada. */
  realDashboards: number;
  activeShareLinks: number;
};

export function homeSteps(i: HomeStepsInput): HomeStep[] {
  const connect = i.connected.length > 0;
  const dashboard = connect && i.realDashboards > 0;
  const share = dashboard && i.activeShareLinks > 0;
  return [
    { id: "connect", label: "Conectar as contas", text: "Conecte o Meta Ads ou o Google Ads e escolha as contas.", done: connect },
    { id: "dashboard", label: "Criar o primeiro dashboard", text: "Com as contas conectadas, o dashboard já abre com os números reais.", done: dashboard },
    { id: "share", label: "Compartilhar com o cliente", text: "Gere o link só de leitura ou exporte o PDF.", done: share },
  ];
}

export const nextStep = (steps: HomeStep[]): HomeStep | null => steps.find((s) => !s.done) ?? null;

export type HomeCta = { label: string; text: string; href: string; kind: "connect" | "dashboard" | "share" };

/**
 * O botão principal da Início: o próximo passo pendente. "Novo dashboard" só
 * volta a ser o principal com as contas conectadas.
 */
export function homeCta(steps: HomeStep[], connected: readonly ProviderId[], opts: { connectHref: (p: ProviderId) => string; shareHref: string }): HomeCta {
  const next = nextStep(steps);
  if (next?.id === "connect") {
    const provider = CORE_PROVIDER_IDS.find((p) => !connected.includes(p)) ?? CORE_PROVIDER_IDS[0];
    return { kind: "connect", label: `Conectar ${PROVIDERS[provider].name}`, text: "Um login, sem copiar ID. Depois você escolhe as contas.", href: opts.connectHref(provider) };
  }
  if (next?.id === "share") return { kind: "share", label: "Compartilhar com o cliente", text: "Link só de leitura ou PDF do dashboard", href: opts.shareHref };
  return { kind: "dashboard", label: "Novo dashboard", text: "Meta Ads e Google Ads com os dados das suas contas", href: "/painel/dashboards/novo?novo=1" };
}

/** "Avançado · 1 de 2 projetos": deixa claro que é o limite do plano. */
export function planBadge(tierLabel: string, used: number, limit: number): string {
  return `${tierLabel} · ${used} de ${limit} ${limit === 1 ? "workspace" : "workspaces"}`;
}
