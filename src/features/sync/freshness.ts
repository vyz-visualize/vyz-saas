// Quando os números de um dashboard pedem uma atualização ao abrir. Puro e pequeno: roda
// também no navegador (o selo de sincronização).

/** Dados mais velhos que isto disparam a sincronização ao abrir o dashboard. */
export const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000;

/** A mesma conta não é tentada de novo, ao abrir, antes disto (deu erro ou acabou de rodar). */
export const REFRESH_COOLDOWN_MS = 15 * 60 * 1000;

/** A sincronização mais antiga entre as contas (a que define "atualizado em"). Sem nenhuma, null. */
export function oldestSync(lastSyncedAt: readonly (string | null | undefined)[]): string | null {
  return (
    lastSyncedAt
      .filter((v): v is string => !!v)
      .sort()
      .at(0) ?? null
  );
}

/** Os dados têm mais de 6 h. Conta que nunca sincronizou está na importação inicial: não conta. */
export function needsRefresh(lastSyncedAt: string | null | undefined, now: number): boolean {
  if (!lastSyncedAt) return false;
  const at = Date.parse(lastSyncedAt);
  return Number.isFinite(at) && now - at > REFRESH_AFTER_MS;
}

/** "2026-10-30T13:05:00Z" → "30/10 às 10:05" no fuso dado (mesmo texto no servidor e no navegador). */
export function syncedAtLabel(iso: string, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("day")}/${get("month")} às ${get("hour")}:${get("minute")}`;
  } catch {
    return "";
  }
}
