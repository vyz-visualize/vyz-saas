// Fora do index de propósito: a lista em si não pode entrar no bundle do app.
// Termos que nunca podem aparecer no app iOS (revisão da Apple: outras lojas,
// meios de pagamento externos, preço fora da loja). O auditor do build
// (apps/mobile/scripts/audit-bundle.mjs) procura estes termos no bundle.

export const IOS_FORBIDDEN_TERMS = ["Android", "Google Play", "Play Store", "Pix", "cartão", "cartao", "boleto", "assinar no site", "/assinar", "R$"] as const;
