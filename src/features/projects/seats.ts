// Vagas de usuário do plano (aba Pessoas do workspace). Puro, para testar.
// limit null = usuários ilimitados (Padrão, Avançado e Personalizado): a tela mostra só o
// uso, sem total, sem barra de limite e sem bloquear o convite (igual aos workspaces
// ilimitados). O número que o banco grava para o ilimitado (UNLIMITED_MEMBERS) nunca aparece.

import { isUnlimitedMemberLimit } from "@/features/pricing/entitlements";

export type Seats = { used: number; limit: number | null };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Limite do plano (max_members) → limite das vagas; null = ilimitado. */
export const seatsLimit = (maxMembers: number | null | undefined): number | null => (isUnlimitedMemberLimit(maxMembers) ? null : (maxMembers as number));

export type SeatsView = {
  unlimited: boolean;
  /** Todas as vagas em uso: o convite fica bloqueado. Nunca no ilimitado. */
  full: boolean;
  /** Vagas livres (null no ilimitado). */
  free: number | null;
  /** 0 a 1, para a barra (null no ilimitado: sem barra). */
  ratio: number | null;
  /** Ao lado do número grande: "de 1 usuário" / "usuários em uso". */
  countLabel: string;
  /** Linha embaixo do medidor. */
  note: string;
  /** Aviso no formulário de convite. */
  inviteNote: string;
};

export function seatsView({ used, limit }: Seats): SeatsView {
  if (limit == null) {
    return {
      unlimited: true,
      full: false,
      free: null,
      ratio: null,
      countLabel: used === 1 ? "usuário em uso" : "usuários em uso",
      note: "Usuários ilimitados no seu plano.",
      inviteNote: `Usuários ilimitados no seu plano: ${plural(used, "pessoa", "pessoas")} com acesso, contando convites pendentes.`,
    };
  }
  const free = Math.max(0, limit - used);
  const full = used >= limit;
  return {
    unlimited: false,
    full,
    free,
    ratio: Math.min(1, used / Math.max(1, limit)),
    countLabel: `de ${plural(limit, "usuário", "usuários")}`,
    note: free > 0 ? `Ainda ${free === 1 ? "cabe 1 pessoa" : `cabem ${free} pessoas`}.` : "Todas as vagas em uso. Pôr aqui quem já está na organização não gasta vaga.",
    inviteNote: full
      ? `${limit === 1 ? "A vaga de usuário do plano está em uso" : `As ${limit} vagas de usuário do plano estão em uso`} (convites pendentes contam). Suba de plano para convidar mais gente.`
      : `Gasta 1 vaga do plano: ${used} de ${limit} em uso.`,
  };
}
