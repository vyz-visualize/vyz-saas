// Formato que o servidor entrega às telas do painel (Início e Configurações).
// Só tipos: pode ser importado no navegador.

import type { GuidesState } from "@/features/onboarding/guides";
import type { ProviderId } from "@/features/integrations/providers";
import type { HistoryTone } from "./history";
import type { MemberRole } from "./session";

export type HomeConnection = {
  provider: ProviderId;
  name: string;
  connected: boolean;
  /** Contas ativas desta plataforma / contas vistas pela conexão. */
  enabledCount: number;
  accountsCount: number;
  /** Sincronização mais recente entre as contas ativas. */
  lastSyncedAt: string | null;
  /** Alguma conta ativa com a última sincronização falhada. */
  syncFailed: boolean;
  syncing: boolean;
};

export type HomeData = {
  /** Hora da renderização (servidor e navegador escrevem o mesmo "há 5 min"). */
  now: string;
  recent: { kind: "dashboard" | "landing"; id: string; title: string; sub: string; href: string; updatedAt: string }[];
  connections: HomeConnection[];
  /** Links de compartilhamento ativos (para o passo "Compartilhar"). */
  activeShareLinks: number;
  /** Dashboards com pelo menos uma conta ativa ligada (os de exemplo não contam no checklist). */
  realDashboards: number;
  /** Primeiro dashboard com conta ligada (o passo "Compartilhar" abre nele). */
  firstRealDashboardHref: string | null;
  /** Tour e lembretes da pessoa (user_guides). */
  guides: GuidesState;
  /** Ferramentas de teste no rodapé: recomeçar a conta de teste e refazer o primeiro acesso. */
  tools: { reset: boolean; replay: boolean };
};

export type TeamMember = { userId: string; name: string; email: string; role: MemberRole; joinedAt: string; isYou: boolean };

export type AccessEvent = { id: number; at: string; label: string; tone: HistoryTone; device: string; ip: string | null };

export type ActivityItem = { id: string; at: string; label: string; tone: HistoryTone; actorName: string | null };

export type SettingsData = {
  now: string;
  profile: { fullName: string; email: string; phone: string | null };
  team: TeamMember[];
  /** Convites pendentes (admin). */
  invitations: { id: string; email: string; role: MemberRole; expiresAt: string }[];
  /** Acessos da própria conta (auth_events). */
  access: AccessEvent[];
  /** Atividade do workspace (admin): activity_events + audit_events. null = sem permissão. */
  activity: ActivityItem[] | null;
};
