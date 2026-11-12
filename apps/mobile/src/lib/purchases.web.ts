// Versão web das compras: só para os prints das lojas (o app web não vende).
// Mostra os planos e créditos com os preços do catálogo; comprar não faz nada.
// Fica fora dos pacotes de iOS e Android (o Metro só usa .web.ts na web).

import { CREDIT_PRODUCTS, STORE_PLAN_PRICE, storePlanProductId, type StorePlan } from "@vyz/shared";
import type { PurchasesPackage, PurchasesStoreProduct } from "react-native-purchases";

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const product = (identifier: string, title: string, cents: number) =>
  ({ identifier, title, priceString: brl(cents), price: cents / 100, currencyCode: "BRL" }) as unknown as PurchasesStoreProduct;

const CREDIT_PRICE: Record<string, number> = { vyz_creditos_1: 1000, vyz_creditos_5: 4000 };

export async function identifyPurchases(_userId: string) {}
export async function resetPurchases() {}

export async function creditPackages(): Promise<PurchasesPackage[]> {
  return Object.entries(CREDIT_PRODUCTS).map(([id, n]) => ({
    identifier: id.replace("vyz_", ""),
    product: product(id, n === 1 ? "1 crédito" : `${n} créditos`, CREDIT_PRICE[id] ?? 0),
  })) as unknown as PurchasesPackage[];
}

export async function buy(_pkg: PurchasesPackage): Promise<boolean> {
  return false;
}

export async function planProduct(plan: StorePlan): Promise<PurchasesStoreProduct | null> {
  return product(storePlanProductId(plan), "", STORE_PLAN_PRICE[plan.tier][plan.period]);
}

export async function buyPlan(_product: PurchasesStoreProduct): Promise<boolean> {
  return false;
}

export async function manageSubscription() {}
export async function restorePurchases(): Promise<boolean> {
  return false;
}
