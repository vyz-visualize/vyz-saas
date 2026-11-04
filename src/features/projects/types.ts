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
