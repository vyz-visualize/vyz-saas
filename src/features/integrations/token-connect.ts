// Conexão por token: a opção secundária ao login (OAuth). O cliente gera um token no app
// dele (no Meta, um app do próprio Business Manager com um usuário do sistema), cola no VYZ
// e o VYZ confere na hora, lista as contas e guarda o token no Vault como o do login.
// Serve enquanto o login da plataforma depende de aprovação (Análise do App do Meta).
// Só dados e regras puras: o tutorial aparece na tela e o servidor usa as mesmas regras.

import type { ProviderId } from "./providers";

/** Marca gravada nos escopos da conexão: o token veio colado pelo cliente, do app dele. */
export const TOKEN_SCOPE = "vyz:token";

export const isTokenConnection = (scopes: readonly string[] | null | undefined) => !!scopes?.includes(TOKEN_SCOPE);

export type TokenField = {
  name: string;
  label: string;
  placeholder?: string;
  hint?: string;
};

export type TokenStep = {
  title: string;
  text: string;
  link?: { href: string; label: string };
  /** Lista que acompanha o passo (permissões a marcar, por exemplo). */
  items?: string[];
};

export type TokenGuide = {
  provider: ProviderId;
  /** Título do modal. */
  title: string;
  intro: string;
  steps: TokenStep[];
  fields: TokenField[];
  notes: string[];
};

/** Permissões do token do Meta. A de editar é opcional: só para o botão Aplicar das otimizações. */
export const META_TOKEN_PERMISSIONS = {
  required: ["ads_read", "business_management", "pages_show_list", "pages_read_engagement", "read_insights", "instagram_basic", "instagram_manage_insights"],
  optional: ["ads_management"],
} as const;

export const TOKEN_GUIDES: Partial<Record<ProviderId, TokenGuide>> = {
  meta: {
    provider: "meta",
    title: "Conectar o Meta com token",
    intro:
      "Use enquanto o login do Meta não está liberado. Você cria um app seu no Meta, gera um token que não expira e cola aqui. Leva uns 10 minutos e é uma vez só por Business Manager. Traz as contas de anúncio, as Páginas e o Instagram ligado a elas.",
    steps: [
      {
        title: "Crie um app no Meta",
        text: "Clique em Criar app. Se pedir o caso de uso, escolha o de anúncios (API de Marketing) ou Outro; se pedir o tipo, escolha Empresa. Vincule o app ao portfólio empresarial (Business Manager) que tem as contas. O app pode ficar em modo de desenvolvimento.",
        link: { href: "https://developers.facebook.com/apps", label: "Abrir Meta for Developers" },
      },
      {
        title: "Deixe o segredo do app desligado",
        text: "No app, em Configurações do app > Avançado, confira que \"Exigir segredo do app\" está desligado. Ligado, o Meta recusa as leituras do VYZ.",
      },
      {
        title: "Crie um usuário do sistema",
        text: "Nas configurações do negócio, vá em Usuários > Usuários do sistema e clique em Adicionar. Dê um nome (por exemplo, VYZ) e escolha a função Administrador ou Funcionário.",
        link: { href: "https://business.facebook.com/settings/system-users", label: "Abrir usuários do sistema" },
      },
      {
        title: "Dê acesso às contas",
        text: "No usuário do sistema, clique em Atribuir ativos e marque: o app do passo 1, as contas de anúncio e as Páginas do Facebook (o Instagram vem junto com a Página). Nas contas de anúncio, ver o desempenho basta; para o VYZ aplicar otimizações, dê também gerenciar campanhas.",
      },
      {
        title: "Gere o token",
        text: "Ainda no usuário do sistema, clique em Gerar novo token. Escolha o app do passo 1, em expiração escolha Nunca e marque estas permissões (ads_management só se quiser que o VYZ aplique otimizações):",
        items: [...META_TOKEN_PERMISSIONS.required, `${META_TOKEN_PERMISSIONS.optional[0]} (opcional)`],
      },
      {
        title: "Copie e cole aqui",
        text: "Copie o token inteiro (começa com EAA) e cole no campo abaixo. O VYZ confere na hora e mostra as contas que ele enxerga.",
      },
    ],
    fields: [{ name: "token", label: "Token de acesso", placeholder: "EAA…", hint: "Fica guardado criptografado e não aparece de novo." }],
    notes: [
      "Agência: contas de clientes que chegam ao seu Business Manager como parceiro podem não aparecer enquanto o app do VYZ não tiver a aprovação do Meta. Se faltar alguma, gere o token no Business Manager do próprio cliente.",
      "Para cortar o acesso, desconecte aqui ou remova o usuário do sistema no Business Manager.",
    ],
  },
};

export const tokenGuide = (provider: ProviderId): TokenGuide | null => TOKEN_GUIDES[provider] ?? null;

/** Tira espaços, quebras de linha, aspas e um "Bearer " colados junto com o token. */
export function cleanToken(raw: string): string {
  return raw
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim()
    .replace(/^bearer\s+/i, "")
    .replace(/\s+/g, "");
}

/** Token do Meta: começa com EAA e só tem letras e números. */
export function metaTokenProblem(token: string): string | null {
  if (!token) return "Cole o token gerado no Business Manager.";
  if (!/^EAA[A-Za-z0-9]+$/.test(token)) return "Esse não parece um token do Meta: ele começa com EAA e só tem letras e números.";
  if (token.length < 60 || token.length > 2048) return "O token parece incompleto. Copie de novo, inteiro.";
  return null;
}
