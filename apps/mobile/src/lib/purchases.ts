// Compras dentro do app pela loja via RevenueCat: créditos e o plano (mesma
// regra do site: plano + período + contas). O app só compra e mostra; quem
// credita e grava a assinatura é o backend (webhook /api/webhooks/revenuecat).

import { creditsFor, parseStorePlan, STORE_PLAN_PERIODS, STORE_PLAN_TIERS, storePlanProductId } from "@vyz/shared";
import { Platform } from "react-native";
import Purchases, { PRODUCT_CATEGORY, type PurchasesPackage, type PurchasesStoreProduct } from "react-native-purchases";
import { ENV } from "./env";

let configured = false;

function configure() {
  if (configured) return true;
  const apiKey = Platform.OS === "ios" ? ENV.revenueCatIosKey : ENV.revenueCatAndroidKey;
  if (!apiKey) return false;
  Purchases.configure({ apiKey });
  configured = true;
  return true;
}

/** O usuário do RevenueCat é o id do Supabase: o webhook sabe quem creditar. */
export async function identifyPurchases(userId: string) {
  if (configure()) await Purchases.logIn(userId).catch(() => {});
}

export async function resetPurchases() {
  if (configured) await Purchases.logOut().catch(() => {});
}

/** Pacotes de créditos da oferta atual (se a oferta também tiver planos, eles ficam de fora). */
export async function creditPackages(): Promise<PurchasesPackage[]> {
  if (!configure()) return [];
  const offerings = await Purchases.getOfferings();
  return (offerings.current?.availablePackages ?? []).filter((p) => creditsFor(p.product.identifier) !== null);
}

/** true = comprou; false = cancelou. Lança em erro da loja. */
export async function buy(pkg: PurchasesPackage): Promise<boolean> {
  try {
    await Purchases.purchasePackage(pkg);
    return true;
  } catch (err) {
    if ((err as { userCancelled?: boolean }).userCancelled) return false;
    throw err;
  }
}

/** Os 6 produtos de plano (3 planos × mensal e anual), na ordem da tela. */
export const PLAN_PRODUCT_IDS = STORE_PLAN_TIERS.flatMap((tier) => STORE_PLAN_PERIODS.map((period) => storePlanProductId({ tier, period })));

export type PlanCatalog = {
  /** Produto da loja por id (vyz_<plano>_<período>_ate<n>). */
  products: Record<string, PurchasesStoreProduct>;
  /** Mensal ou anual sem produto na loja (o motivo vai para o console). */
  error: string | null;
};

/**
 * Busca os 6 planos na loja de uma vez, com o preço dela. Nunca esconde a
 * seção: sem produto, devolve uma mensagem clara e registra o motivo.
 */
export async function planCatalog(): Promise<PlanCatalog> {
  if (!configure()) {
    console.warn(`[compras] sem a chave pública do RevenueCat para ${Platform.OS} (EXPO_PUBLIC_REVENUECAT_${Platform.OS === "ios" ? "IOS" : "ANDROID"}_KEY)`);
    return { products: {}, error: "As assinaturas não estão disponíveis nesta versão do app." };
  }
  try {
    const list = await Purchases.getProducts(PLAN_PRODUCT_IDS, PRODUCT_CATEGORY.SUBSCRIPTION);
    // no Android o id pode vir como "produto:base-plan"
    const products = Object.fromEntries(list.map((p) => [p.identifier.split(":")[0], p]));
    const missing = PLAN_PRODUCT_IDS.filter((id) => !products[id]);
    if (missing.length === PLAN_PRODUCT_IDS.length) {
      console.warn(`[compras] a loja não devolveu nenhum plano. Pedidos: ${PLAN_PRODUCT_IDS.join(", ")}`);
      return { products, error: "Não foi possível carregar os planos da loja agora. Confira a conexão e tente de novo." };
    }
    if (missing.length) console.warn(`[compras] a loja não devolveu: ${missing.join(", ")}`);
    return { products, error: null };
  } catch (err) {
    console.warn("[compras] erro ao buscar os planos na loja", err);
    return { products: {}, error: "Não foi possível carregar os planos da loja agora. Confira a conexão e tente de novo." };
  }
}

/** Produto de plano ativo na loja para este usuário (para trocar de plano no Android). */
async function activePlanProductId(): Promise<string | null> {
  const info = await Purchases.getCustomerInfo();
  return info.activeSubscriptions.find((id) => parseStorePlan(id)) ?? null;
}

/**
 * Assina ou troca o plano. No iOS a troca é automática (mesmo grupo de
 * assinaturas); no Android informamos o produto antigo. true = comprou;
 * false = cancelou. Lança em erro da loja.
 */
export async function buyPlan(product: PurchasesStoreProduct): Promise<boolean> {
  try {
    const old = Platform.OS === "android" ? await activePlanProductId() : null;
    await Purchases.purchaseStoreProduct(product, old && old.split(":")[0] !== product.identifier.split(":")[0] ? { oldProductIdentifier: old.split(":")[0] } : null);
    return true;
  } catch (err) {
    if ((err as { userCancelled?: boolean }).userCancelled) return false;
    throw err;
  }
}

/**
 * Restaurar compras (exigido pela Apple): reaplica na conta da loja o que já foi
 * comprado. true = havia assinatura ativa; o backend sincroniza pelo webhook.
 */
export async function restorePurchases(): Promise<boolean> {
  if (!configure()) return false;
  const info = await Purchases.restorePurchases();
  return Object.keys(info.entitlements.active).length > 0 || info.activeSubscriptions.length > 0;
}

/** Cancelar ou ver a assinatura: tela da própria loja. */
export async function manageSubscription() {
  if (configure()) await Purchases.showManageSubscriptions();
}
