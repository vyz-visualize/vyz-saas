import "server-only";

import type { ProviderId } from "@/features/integrations/providers";
import { serverEnv } from "@/server/env";

/** URL de retorno cadastrada (usada fora de uma requisição, ex.: renovação do Kommo). */
export async function redirectUriFor(provider: ProviderId): Promise<string> {
  return `${new URL(serverEnv().NEXT_PUBLIC_SITE_URL).origin}/api/integrations/${provider}/callback`;
}
