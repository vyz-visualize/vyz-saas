// Compras dentro do app pela loja via RevenueCat: créditos e o plano (mesma
// regra do site: plano + período + contas). O app só compra e mostra; quem
// credita e grava a assinatura é o backend (webhook /api/webhooks/revenuecat).

import { parseStorePlan, storePlanProductId, type StorePlan } from "@vyz/shared";
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

export async function creditPackages(): Promise<PurchasesPackage[]> {
  if (!configure()) return [];
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
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

/** Produto da loja para o plano escolhido (null = não cadastrado na loja). */
export async function planProduct(plan: StorePlan): Promise<PurchasesStoreProduct | null> {
  if (!configure()) return null;
  const [product] = await Purchases.getProducts([storePlanProductId(plan)], PRODUCT_CATEGORY.SUBSCRIPTION);
  return product ?? null;
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
