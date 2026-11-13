// Volta da conexão para o app: o destino guardado no state (só caminhos do
// painel e do onboarding) e o resultado na URL (?conectado=meta ou
// ?erro=<codigo>&provedor=meta), com a mensagem em português.

import { isProviderId, PROVIDERS, type ProviderId } from "./providers";

export const RETURN_DEFAULT = "/painel/contas";
const RETURN_PREFIXES = ["/painel", "/comecar"];
const RESULT_KEYS = ["conectado", "erro", "provedor"];
// Mesma regra do check de oauth_states.redirect_path.
const STORED_PATH = /^\/[A-Za-z0-9/_?=&%.-]*$/;
const BASE = "http://vyz.invalid";

export const CONNECT_ERRORS = {
  cancelado: "Você cancelou a conexão. Nada foi alterado.",
  estado_invalido: "Não conseguimos confirmar este pedido de conexão. Comece de novo pelo botão Conectar.",
  estado_expirado: "O pedido de conexão expirou (vale 10 minutos). Comece de novo pelo botão Conectar.",
  sessao: "Entre na sua conta para conectar.",
  permissao: "Só administradores da organização conectam contas.",
  plano_inativo: "A assinatura desta organização não está ativa.",
  muitas_tentativas: "Muitas tentativas de conexão em pouco tempo. Espere alguns minutos e tente de novo.",
  workspace_trocado: "Você trocou de organização no meio da conexão. Abra a organização certa e conecte de novo.",
  permissoes_negadas: "Faltou autorizar o acesso aos anúncios. Conecte de novo e mantenha todas as permissões marcadas.",
  provedor_recusou: "O login foi recusado pelo provedor. Tente de novo.",
  troca_falhou: "O provedor não confirmou o login. Tente conectar de novo.",
  provedor_indisponivel: "O provedor não respondeu agora. Tente de novo em instantes.",
  contas_invalidas: "O provedor devolveu contas que não são desta plataforma. Nada foi alterado; tente conectar de novo.",
  nao_configurado: "A conexão com este provedor ainda não foi configurada no VYZ.",
  indisponivel: "Não foi possível concluir a conexão agora. Tente de novo em instantes.",
} as const;

export type ConnectErrorCode = keyof typeof CONNECT_ERRORS;

export const isConnectErrorCode = (v: unknown): v is ConnectErrorCode => typeof v === "string" && Object.hasOwn(CONNECT_ERRORS, v);

function parse(path: string): URL | null {
  try {
    const url = new URL(path, BASE);
    return url.origin === BASE ? url : null;
  } catch {
    return null;
  }
}

/** Caminho com o resultado da conexão (troca resultados anteriores; descarta o #). */
export function withConnectResult(path: string, result: { conectado?: ProviderId; erro?: ConnectErrorCode; provedor?: ProviderId }): string {
  const url = parse(path) ?? new URL(RETURN_DEFAULT, BASE);
  for (const k of RESULT_KEYS) url.searchParams.delete(k);
  for (const [k, v] of Object.entries(result)) if (v) url.searchParams.set(k, v);
  return url.pathname + url.search;
}

/**
 * Destino para guardar no state: normaliza ("/painel/../x" vira "/x"), tira
 * resultados antigos e só aceita o painel e o onboarding. O resto vira o padrão.
 */
export function storedReturnPath(raw: string | null | undefined, fallback = RETURN_DEFAULT): string {
  const url = raw ? parse(raw) : null;
  if (!url) return fallback;
  const allowed = RETURN_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`));
  if (!allowed) return fallback;
  const path = withConnectResult(url.pathname + url.search, {});
  if (path.length > 512 || path.startsWith("//") || !STORED_PATH.test(path)) return fallback;
  return path;
}

export type ConnectResult =
  | { kind: "connected"; provider: ProviderId; message: string }
  | { kind: "error"; code: ConnectErrorCode; provider: ProviderId | null; message: string };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Lê ?conectado= / ?erro= da URL da página. Código desconhecido é ignorado. */
export function connectResult(searchParams: Record<string, string | string[] | undefined>): ConnectResult | null {
  const connected = first(searchParams.conectado);
  if (isProviderId(connected)) {
    return { kind: "connected", provider: connected, message: `${PROVIDERS[connected].name} conectado. Escolha abaixo quais contas entram no VYZ.` };
  }
  const code = first(searchParams.erro);
  if (!isConnectErrorCode(code)) return null;
  const provider = first(searchParams.provedor);
  return { kind: "error", code, provider: isProviderId(provider) ? provider : null, message: CONNECT_ERRORS[code] };
}
