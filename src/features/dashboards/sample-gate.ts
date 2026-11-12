// Dados de exemplo nunca aparecem sem aviso. Um dashboard que não é "live" e não
// tem conta ativa ligada mostra a amostra: no painel, com o aviso fixo no topo;
// link compartilhado, PDF e relatório agendado ficam bloqueados até ligar uma conta.

export const SAMPLE_NOTICE = "Dados de exemplo — conecte o Meta Ads ou o Google Ads para ver os números reais";
export const SAMPLE_SHARE_BLOCKED =
  "Este dashboard ainda mostra dados de exemplo. Ligue uma conta do Meta Ads ou do Google Ads a ele antes de compartilhar: o cliente veria números que não são dele.";

/** O dashboard mostraria a amostra: não é "live" e nenhuma conta ativa está ligada. */
export function showsSampleData(d: { live: boolean; sources: readonly { isEnabled: boolean }[] }): boolean {
  return !d.live && !d.sources.some((s) => s.isEnabled);
}
