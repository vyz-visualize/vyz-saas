// Produtos de crédito vendidos nas lojas (compra dentro do app, RevenueCat).
// O id é o mesmo cadastrado no App Store Connect, no Google Play e no RevenueCat.
// O webhook credita exatamente o que está aqui; o app só mostra.
// vyz_creditos_100/500 foram abandonados: não creditam mais nada.

export const CREDIT_PRODUCTS = {
  vyz_creditos_1: 1,
  vyz_creditos_5: 5,
} as const;

export type CreditProductId = keyof typeof CREDIT_PRODUCTS;

export function creditsFor(productId: string): number | null {
  return (CREDIT_PRODUCTS as Record<string, number>)[productId] ?? null;
}
