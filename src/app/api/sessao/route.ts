// Quem está logado, para o site público (que é estático) trocar "Entrar" por
// "Olá, Fulano". Só o primeiro nome; sem sessão, { name: null }.

import { getSessionUser } from "@/server/auth/session";
import { createServerSupabase } from "@/server/supabase/server";

const firstName = (full: string | null | undefined, email: string | null) => (full?.trim().split(/\s+/)[0] || email?.split("@")[0] || "").slice(0, 40);

export async function GET() {
  const headers = { "cache-control": "private, no-store" };
  const user = await getSessionUser();
  if (!user) return Response.json({ name: null }, { headers });
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  return Response.json({ name: firstName(data?.full_name, user.email) }, { headers });
}
