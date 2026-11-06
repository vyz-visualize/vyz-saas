// Cliente do Supabase no app: mesmo projeto e mesmo login do site. A sessão
// fica no chaveiro e renova sozinha enquanto o app está aberto.

import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";
import { ENV } from "./env";
import { secureStorage } from "./secure-storage";

export const supabase = createClient(ENV.supabaseUrl, ENV.supabaseKey, {
  auth: { storage: secureStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, flowType: "pkce" },
});

AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
