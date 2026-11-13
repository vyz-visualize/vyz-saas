// Projeto = cliente ou marca: agrupa as contas (Meta, Google Ads, GA4...) e os
// dashboards dele. O plano cobra e limita por projeto (accounts_quantity no banco).

export type ProjectDTO = {
  id: string;
  name: string;
  createdAt: string;
  /** Contas ligadas no projeto. */
  enabledAccounts: number;
  dashboards: number;
};

export type ProjectsState = {
  projects: ProjectDTO[];
  /** Projetos contratados no plano. */
  quantity: number;
  /** Contas da mesma plataforma em cada projeto. */
  maxAccountsPerPlatform: number;
  /** Member cria e renomeia; admin arquiva. */
  canEdit: boolean;
  canArchive: boolean;
};

/** Pessoa da organização vista de dentro de um workspace. */
export type ProjectPerson = {
  userId: string;
  name: string;
  email: string;
  role: "viewer" | "member" | "admin" | "owner";
  /** Dono e admin acessam todos os workspaces (não dá para tirar daqui). */
  allAccess: boolean;
  /** Member/viewer que está neste workspace. */
  inProject: boolean;
  isYou: boolean;
};

/** Página de um workspace: o que tem nele e quem acessa. */
export type ProjectDetail = {
  id: string;
  name: string;
  createdAt: string;
  accounts: { id: string; name: string; platformId: string; isEnabled: boolean; lastSyncedAt: string | null }[];
  dashboards: { id: string; name: string; templateId: string; updatedAt: string }[];
  /** Todos da organização: quem acessa este workspace e quem dá para pôr nele. */
  people: ProjectPerson[];
  /** Convites pendentes que já incluem este workspace (só admin vê). */
  invitations: { id: string; email: string; role: "viewer" | "member" | "admin"; expiresAt: string }[];
  /** Vagas de usuário do plano (membros + convites pendentes contam). */
  seats: { used: number; limit: number };
  maxAccountsPerPlatform: number;
  canEdit: boolean;
  /** Admin: põe e tira gente, convida, arquiva. */
  canManage: boolean;
};
