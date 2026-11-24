import "server-only";

// Cliente do Supabase com a sessão do usuário (cookies httpOnly). Tudo o que
// passa por ele respeita o RLS. Use em Server Components, Server Actions e
// Route Handlers.

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/database.types";
import { serverEnv } from "@/server/env";
import { requestContext, sessionCookieOptions } from "@/server/http/request";

export type DB = SupabaseClient<Database>;

export async function createServerSupabase(): Promise<DB> {
  const env = serverEnv();
  const store = await cookies();
  const ctx = await requestContext();
  const cookieOptions = await sessionCookieOptions();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, { ...options, ...cookieOptions });
        } catch {
          // Server Component não grava cookie: o proxy renova a sessão na próxima requisição.
        }
      },
    },
    cookieOptions,
    global: { headers: ctx.forwardHeaders },
  });
}
