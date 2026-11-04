// Contas por projeto: no Meta, cada Business Manager conta uma vez (com todas
// as contas de anúncio dentro); nas outras plataformas, cada conta. Mesma regra
// de private.billable_unit no banco, que é quem garante o limite: aqui é para a
// tela avisar antes.

export type BillableRef = { platformId: string; externalId: string; businessExternalId: string | null };

export function billableUnit(a: BillableRef): string {
  return a.platformId === "meta" ? `meta:${a.businessExternalId ?? a.externalId}` : `${a.platformId}:${a.externalId}`;
}

/** Quantas contas contratadas um conjunto de contas ativas ocupa. */
export function countUnits(accounts: BillableRef[]): number {
  return new Set(accounts.map(billableUnit)).size;
}

/**
 * Se ligar `candidate` no projeto cabe no plano: cada projeto aceita até
 * `maxPerPlatform` contas da mesma plataforma (BM do Meta conta uma vez).
 * `enabled` são as contas desta plataforma já ligadas neste projeto.
 */
export function fitsProject(candidate: BillableRef, enabled: BillableRef[], maxPerPlatform: number): boolean {
  const units = new Set(enabled.map(billableUnit));
  units.add(billableUnit(candidate));
  return units.size <= maxPerPlatform;
}

/** "2 de 3 projetos do plano" (com singular). */
export function planUsageLabel(used: number, quantity: number): string {
  return `${used} de ${quantity} ${quantity === 1 ? "projeto" : "projetos"} do plano`;
}
