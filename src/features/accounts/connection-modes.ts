// Como cada plataforma entra no VYZ. Puro: serve à tela de contas, ao A Fazer
// e à documentação (docs/PLATAFORMAS.md, que segue esta mesma tabela).
//
//   oauth_write  login (OAuth) com leitura e escrita: o VYZ lê os dados e
//                aplica otimizações (pausar, orçamento) pelo botão Aplicar;
//   oauth_read   login (OAuth) só leitura: dados entram, mudanças são manuais;
//   import       sem API aberta: os dados entram por planilha (CSV ou Google
//                Sheets) ou relatório agendado; mudanças são manuais.
//
// status = em que pé está no VYZ:
//   live        login pronto no código (falta só a aprovação da plataforma);
//   planned     login a construir assim que a plataforma aprovar o app;
//   restricted  API existe, mas o acesso depende de aprovação difícil;
//   no_api      sem API para anunciantes hoje.

import type { PlatformId } from "./platforms";

export type ConnectMode = "oauth_write" | "oauth_read" | "import";
export type ConnectStatus = "live" | "planned" | "restricted" | "no_api";

export type PlatformConnection = {
  mode: ConnectMode;
  status: ConnectStatus;
  /** O que o VYZ consegue mudar pela API (vazio = nada). */
  writes: string[];
  /** Frase curta para a tela de contas. */
  note: string;
};

export const CONNECTIONS: Record<PlatformId, PlatformConnection> = {
  meta: {
    mode: "oauth_write",
    status: "live",
    writes: ["pausar e reativar campanha", "orçamento diário"],
    note: "Login do Meta: dados e otimizações aplicadas pelo VYZ.",
  },
  google: {
    mode: "oauth_write",
    status: "live",
    writes: ["pausar e reativar campanha", "orçamento diário"],
    note: "Login do Google: dados e otimizações aplicadas pelo VYZ.",
  },
  youtube: {
    mode: "oauth_write",
    status: "live",
    writes: ["pausar e reativar campanha", "orçamento diário"],
    note: "Entra pelo login do Google Ads (as campanhas de vídeo estão lá).",
  },
  ga4: {
    mode: "oauth_read",
    status: "planned",
    writes: [],
    note: "Login do Google, só leitura. Por enquanto, cadastre o ID da propriedade.",
  },
  tiktok: {
    mode: "oauth_write",
    status: "planned",
    writes: ["pausar e reativar campanha", "orçamento diário"],
    note: "Login do TikTok em breve. Por enquanto, cadastre o Advertiser ID.",
  },
  linkedin: {
    mode: "oauth_read",
    status: "planned",
    writes: [],
    note: "Login do LinkedIn em breve (leitura). Por enquanto, cadastre o ID da conta.",
  },
  rdstation: {
    mode: "oauth_read",
    status: "planned",
    writes: [],
    note: "Login do RD Station em breve (leitura do CRM). Por enquanto, use o token.",
  },
  hubspot: {
    mode: "oauth_read",
    status: "planned",
    writes: [],
    note: "Login do HubSpot em breve (leitura do CRM). Por enquanto, cadastre o Hub ID.",
  },
  crm: {
    mode: "import",
    status: "no_api",
    writes: [],
    note: "Outros CRMs: os dados entram por planilha.",
  },
  mercado: {
    mode: "oauth_read",
    status: "planned",
    writes: [],
    note: "Login do Mercado Livre em breve (relatórios do Product Ads).",
  },
  x: {
    mode: "oauth_read",
    status: "restricted",
    writes: [],
    note: "A API de anúncios do X depende de aprovação do X. Até lá, os dados entram por planilha.",
  },
  shopee: {
    mode: "import",
    status: "restricted",
    writes: [],
    note: "A API da Shopee é só para parceiros aprovados. Os dados entram por planilha.",
  },
  spotify: {
    mode: "import",
    status: "no_api",
    writes: [],
    note: "O Spotify não abre API de anúncios. Os dados entram por planilha.",
  },
  globo: {
    mode: "import",
    status: "no_api",
    writes: [],
    note: "A Globo não tem API pública. Os dados entram por planilha ou relatório.",
  },
  chatgpt: {
    mode: "import",
    status: "no_api",
    writes: [],
    note: "O ChatGPT Ads ainda não tem API para anunciantes. Os dados entram por planilha.",
  },
};

export const MODE_LABEL: Record<ConnectMode, string> = {
  oauth_write: "Login com otimização",
  oauth_read: "Login, só leitura",
  import: "Importação por planilha",
};

/** O VYZ aplica mudanças nesta plataforma pela API. */
export const canWrite = (id: PlatformId) => CONNECTIONS[id].mode === "oauth_write" && CONNECTIONS[id].status === "live";
