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

  ga4: {
    provider: "ga4",
    title: "Conectar o GA4 com uma conta de serviço",
    intro:
      "Sem login do Google: você cria uma conta de serviço no Google Cloud, dá a ela acesso de Leitor no GA4 e cola aqui a chave dela. A chave não expira. Leva uns 10 minutos.",
    steps: [
      {
        title: "Crie um projeto e ligue as APIs",
        text: "No Google Cloud, crie um projeto (ou use um que já tenha) e ative a Google Analytics Data API e a Google Analytics Admin API.",
        link: { href: "https://console.cloud.google.com/apis/library", label: "Abrir a biblioteca de APIs" },
      },
      {
        title: "Crie a conta de serviço",
        text: "Em IAM e administrador > Contas de serviço, clique em Criar conta de serviço, dê um nome (por exemplo, vyz) e conclua sem escolher papéis.",
        link: { href: "https://console.cloud.google.com/iam-admin/serviceaccounts", label: "Abrir contas de serviço" },
      },
      {
        title: "Baixe a chave JSON",
        text: "Abra a conta de serviço, vá em Chaves > Adicionar chave > Criar nova chave e escolha JSON. O arquivo baixa no computador.",
      },
      {
        title: "Dê acesso de Leitor no GA4",
        text: "No GA4, vá em Administrador > Gerenciamento de acesso à propriedade (ou à conta, para liberar todas as propriedades dela), clique em + e adicione o e-mail da conta de serviço (termina em iam.gserviceaccount.com) com a função Leitor.",
        link: { href: "https://analytics.google.com/analytics/web/", label: "Abrir o GA4" },
      },
      {
        title: "Cole a chave aqui",
        text: "Abra o arquivo JSON num editor de texto, copie tudo e cole no campo abaixo. O VYZ confere na hora e mostra as propriedades que a conta de serviço enxerga.",
      },
    ],
    fields: [{ name: "json", label: "Chave JSON da conta de serviço", placeholder: '{ "type": "service_account", … }', hint: "Fica guardada criptografada e não aparece de novo." }],
    notes: [
      "Se o Google Cloud não deixar criar a chave, a sua empresa bloqueou chaves de conta de serviço: peça ao administrador do Google Workspace ou use um projeto de uma conta pessoal.",
      "Para cortar o acesso, desconecte aqui ou tire a conta de serviço do GA4.",
    ],
  },

  tiktok: {
    provider: "tiktok",
    title: "Conectar o TikTok Ads com o seu app",
    intro:
      "Para quem já tem um app aprovado no TikTok for Business Developers. Você autoriza a sua conta de anúncios no seu app e cola aqui o App ID, o Secret e o código de autorização; o VYZ troca pelo token de longo prazo.",
    steps: [
      {
        title: "Abra o seu app",
        text: "No portal de desenvolvedores do TikTok for Business, vá em Meus apps e abra o app aprovado (com as permissões de gestão e de relatórios de anúncios). Copie o App ID e o Secret.",
        link: { href: "https://business-api.tiktok.com/portal/apps", label: "Abrir meus apps" },
      },
      {
        title: "Autorize a conta de anúncios",
        text: "Abra o link de autorização do anunciante (Advertiser authorization URL) do app, entre com a conta que gerencia os anúncios e confirme. O TikTok abre o endereço de retorno do app com auth_code= no endereço.",
      },
      {
        title: "Cole aqui",
        text: "Cole o App ID, o Secret e o endereço inteiro do retorno (ou só o auth_code). O código vale por 1 hora e só uma vez: se passar disso, autorize de novo.",
      },
    ],
    fields: [
      { name: "app_id", label: "App ID" },
      { name: "secret", label: "Secret", hint: "Usado só nesta troca; não fica guardado." },
      { name: "auth_code", label: "Endereço do retorno ou auth_code" },
    ],
    notes: ["O token de longo prazo não expira. Para cortar o acesso, desconecte aqui ou revogue a autorização do app no TikTok."],
  },

  linkedin: {
    provider: "linkedin",
    title: "Conectar o LinkedIn Ads com o seu app",
    intro: "Para quem já tem um app no LinkedIn com o produto Advertising API aprovado. Você gera um token no seu app e cola aqui. O token vale 60 dias.",
    steps: [
      {
        title: "Abra o seu app",
        text: "No portal de desenvolvedores do LinkedIn, abra o app que tem o Advertising API aprovado.",
        link: { href: "https://www.linkedin.com/developers/apps", label: "Abrir meus apps" },
      },
      {
        title: "Gere o token",
        text: "Na aba Auth, abra as ferramentas de token OAuth 2.0 e clique em Create token. Marque as permissões abaixo e autorize com a conta que acessa as contas de anúncio:",
        items: ["r_ads", "r_ads_reporting"],
      },
      { title: "Cole aqui", text: "Copie o token de acesso e cole no campo abaixo. Perto dos 60 dias, o VYZ avisa para trocar." },
    ],
    fields: [{ name: "token", label: "Token de acesso", hint: "Fica guardado criptografado e não aparece de novo." }],
    notes: ["Para cortar o acesso, desconecte aqui ou remova a autorização do app no LinkedIn."],
  },

  hubspot: {
    provider: "hubspot",
    title: "Conectar o HubSpot com token",
    intro: "Use enquanto o login do HubSpot não está liberado. Você cria um app privado na sua conta, só com leitura, e cola o token aqui. O token não expira.",
    steps: [
      {
        title: "Crie um app privado",
        text: "No HubSpot, clique na engrenagem (Configurações) > Integrações > Apps privados > Criar app privado. Em contas mais novas, o caminho é Desenvolvimento > Apps legados > Criar app legado > Privado. Dê um nome (por exemplo, VYZ).",
      },
      { title: "Marque os escopos de leitura", text: "Na aba Escopos, marque estes três:", items: ["crm.objects.contacts.read", "crm.objects.deals.read", "crm.schemas.deals.read"] },
      { title: "Copie o token", text: "Crie o app, confirme e, na aba Autenticação, mostre e copie o token de acesso (começa com pat-). Cole no campo abaixo." },
    ],
    fields: [{ name: "token", label: "Token do app privado", placeholder: "pat-…", hint: "Fica guardado criptografado e não aparece de novo." }],
    notes: ["Para cortar o acesso, desconecte aqui ou exclua o app privado no HubSpot."],
  },

  pipedrive: {
    provider: "pipedrive",
    title: "Conectar o Pipedrive com token",
    intro: "Use enquanto o login do Pipedrive não está liberado. O token pessoal da API lê o que o seu usuário vê no Pipedrive.",
    steps: [
      {
        title: "Abra a página da API",
        text: "No Pipedrive, clique na sua foto no canto superior direito > Configurações pessoais > API.",
        link: { href: "https://app.pipedrive.com/settings/api", label: "Abrir a página da API" },
      },
      { title: "Copie o token", text: "Copie o seu token de API pessoal e cole no campo abaixo." },
    ],
    fields: [{ name: "token", label: "Token de API pessoal", hint: "Fica guardado criptografado e não aparece de novo." }],
    notes: ["Se você gerar um token novo no Pipedrive, o antigo para de funcionar: use Trocar token aqui."],
  },

  kommo: {
    provider: "kommo",
    title: "Conectar o Kommo com token",
    intro: "Use enquanto o login do Kommo não está liberado. Você cria uma integração privada na sua conta, gera um token de longa duração e cola aqui com o endereço da conta.",
    steps: [
      {
        title: "Crie uma integração privada",
        text: "No Kommo, vá em Configurações > Integrações > Criar integração e escolha integração privada. Dê um nome (por exemplo, VYZ), libere o acesso aos leads e aos contatos e salve.",
      },
      { title: "Gere o token de longa duração", text: "Abra a integração, vá na aba Chaves e escopos e clique em Gerar token de longa duração. Escolha a validade mais longa e copie o token." },
      { title: "Cole aqui com o endereço da conta", text: "O endereço é o que aparece no navegador quando você usa o Kommo, como suaempresa.kommo.com." },
    ],
    fields: [
      { name: "domain", label: "Endereço da conta", placeholder: "suaempresa.kommo.com" },
      { name: "token", label: "Token de longa duração", hint: "Fica guardado criptografado e não aparece de novo." },
    ],
    notes: ["Quando o token vencer, o VYZ avisa: gere outro na mesma integração e use Trocar token."],
  },
};

/** Campos que não são segredo (aparecem enquanto a pessoa digita). */
export const PLAIN_FIELDS = new Set(["app_id", "domain"]);

/** O auth_code do TikTok, colado sozinho ou dentro do endereço do retorno. */
export function tiktokAuthCode(raw: string): string {
  const text = raw.trim();
  const fromUrl = /[?&]auth_code=([^&#\s]+)/.exec(text)?.[1];
  return decodeURIComponent(fromUrl ?? text).replace(/\s+/g, "");
}

/** Validade de um JWT (o token de longa duração do Kommo é um), sem conferir assinatura: só para avisar antes de vencer. */
export function jwtExpiry(token: string): string | undefined {
  const payload = token.split(".")[1];
  if (!payload) return undefined;
  try {
    const exp = (JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: unknown }).exp;
    return typeof exp === "number" && exp > 0 ? new Date(exp * 1000).toISOString() : undefined;
  } catch {
    return undefined;
  }
}

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
