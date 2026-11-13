// Plano do workspace no app: assinar ou trocar pela loja (mesma regra do site:
// 3 planos fixos, Básico até 5 projetos, Padrão até 15, Avançado até 30, mensal
// ou anual). Plano contratado no site muda no site (sem link: regra das lojas).
// O preço vem da loja.

import { STORE_PLAN_HIGHLIGHTS, STORE_PLAN_PERIODS, STORE_PLAN_TIERS, storePlan, type MeResponse, type StorePlan, type StorePlanPeriod, type StorePlanTier } from "@vyz/shared";
import { useEffect, useState } from "react";
import { Linking, Platform, Text, View } from "react-native";
import type { PurchasesStoreProduct } from "react-native-purchases";
import { api, ApiFailure } from "@/lib/api";
import { buyPlan, manageSubscription, planProduct, restorePurchases } from "@/lib/purchases";
import { ENV } from "@/lib/env";
import { IconCheck } from "./icons";
import { Button, Card, Chip, Divider, Notice, Segmented } from "./kit";
import { type as typo, useTheme } from "./theme";

const TIER_LABEL: Record<StorePlanTier, string> = { base: "Básico", pro: "Padrão", avancado: "Avançado" };
const PERIOD_LABEL: Record<StorePlanPeriod, string> = { mensal: "Mensal", anual: "Anual" };

type Workspace = MeResponse["workspaces"][number];

export function PlanCard({ workspace, onChanged }: { workspace: Workspace; onChanged: () => void }) {
  const t = useTheme();
  const current: StorePlan | null =
    workspace.plan && workspace.period && (STORE_PLAN_TIERS as readonly string[]).includes(workspace.plan)
      ? { tier: workspace.plan as StorePlanTier, period: workspace.period, accounts: workspace.accounts }
      : null;
  const [plan, setPlan] = useState<StorePlan>(current ? storePlan(current.tier, current.period) : storePlan("pro", "anual"));
  const [product, setProduct] = useState<PurchasesStoreProduct | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setProduct(null);
    planProduct(plan).then((p) => alive && setProduct(p)).catch(() => alive && setProduct(null));
    return () => {
      alive = false;
    };
  }, [plan]);

  const ending = current && workspace.cancelAtPeriodEnd && workspace.periodEnd ? `Termina em ${new Date(workspace.periodEnd).toLocaleDateString("pt-BR")}` : null;
  const header = (
    <View style={{ gap: 4 }}>
      <Text style={{ color: t.fg2, ...typo.overline }}>Plano atual</Text>
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <Text style={{ color: t.fg, ...typo.title }}>{current ? TIER_LABEL[current.tier] : "Sem plano"}</Text>
        {current ? <Chip label={PERIOD_LABEL[current.period]} tone="accent" /> : null}
        {ending ? <Chip label={ending} tone="warn" /> : null}
      </View>
      {current ? <Text style={{ color: t.fg2, fontSize: 13.5, lineHeight: 19 }}>Até {current.accounts} workspaces</Text> : null}
    </View>
  );

  if (workspace.planSource === "site") {
    return (
      <Card style={{ gap: 10 }}>
        {header}
        <Text style={{ color: t.fg2, fontSize: 14, lineHeight: 20 }}>Este plano não é gerenciado pelo app.</Text>
      </Card>
    );
  }
  if (workspace.role !== "owner") {
    return (
      <Card style={{ gap: 10 }}>
        {header}
        <Text style={{ color: t.fg2, fontSize: 14, lineHeight: 20 }}>Só o dono da organização muda o plano.</Text>
      </Card>
    );
  }

  const same = !!current && current.tier === plan.tier && current.period === plan.period && current.accounts === plan.accounts && !workspace.cancelAtPeriodEnd;

  const purchase = async () => {
    if (!product) return;
    setBusy(true);
    setMessage(null);
    try {
      await api(`/workspaces/${workspace.id}/store-plan`, { method: "POST" });
      if (await buyPlan(product)) {
        await api("/store/sync", { method: "POST" }).catch(() => {});
        setMessage(current ? "Plano trocado." : "Assinatura feita. Bem-vindo ao VYZ!");
        onChanged();
      }
    } catch (err) {
      setMessage(err instanceof ApiFailure ? err.error.message : "A compra não foi concluída. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const found = await restorePurchases();
      if (found) await api("/store/sync", { method: "POST" }).catch(() => {});
      setMessage(found ? "Compras restauradas." : "Nenhuma assinatura encontrada nesta conta da loja.");
      if (found) onChanged();
    } catch {
      setMessage("Não foi possível restaurar agora. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ gap: 14 }}>
      {header}
      <Divider />
      <Segmented options={STORE_PLAN_TIERS.map((v) => ({ value: v, label: TIER_LABEL[v] }))} value={plan.tier} onChange={(tier) => setPlan((p) => storePlan(tier, p.period))} />
      <View style={{ gap: 8 }}>
        {STORE_PLAN_HIGHLIGHTS[plan.tier].map((h) => (
          <View key={h} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
            <View style={{ marginTop: 2 }}>
              <IconCheck color={t.accent} size={16} strokeWidth={2.4} />
            </View>
            <Text style={{ color: t.fg2, fontSize: 14, lineHeight: 20, flex: 1 }}>{h}</Text>
          </View>
        ))}
      </View>
      <Segmented options={STORE_PLAN_PERIODS.map((v) => ({ value: v, label: PERIOD_LABEL[v] }))} value={plan.period} onChange={(period) => setPlan((p) => storePlan(p.tier, period))} />
      <Text style={{ color: t.fg, fontSize: 19, lineHeight: 25, fontWeight: "800", letterSpacing: -0.3, fontVariant: ["tabular-nums"] }}>{product ? `${product.priceString} por ${plan.period === "anual" ? "ano" : "mês"}` : "Carregando preço…"}</Text>
      {same ? null : <Button label={current ? "Trocar plano" : "Assinar"} busy={busy} onPress={purchase} />}
      {current ? <Button size="md" tone="secondary" label="Gerenciar assinatura" onPress={() => void manageSubscription()} /> : null}
      <Button size="md" tone="ghost" label="Restaurar compras" busy={busy} onPress={() => void restore()} />
      {/* o que a Apple e o Google pedem junto da compra: renovação automática, cancelamento e os documentos */}
      <Text style={{ color: t.fg3, fontSize: 12, lineHeight: 17 }}>
        Assinatura com renovação automática. A cobrança é feita na sua conta {Platform.OS === "ios" ? "Apple" : "Google Play"} ao confirmar a compra e se repete a cada{" "}
        {plan.period === "anual" ? "ano" : "mês"} pelo mesmo valor, a menos que a renovação seja desligada até 24 horas antes do fim do período. Gerencie ou cancele nos ajustes da
        sua conta da loja.
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 16 }}>
        <Text accessibilityRole="link" style={{ color: t.accent, fontSize: 12.5, fontWeight: "600", paddingVertical: 8 }} onPress={() => void Linking.openURL(`${ENV.apiUrl}/termos`)}>
          Termos de Uso
        </Text>
        <Text accessibilityRole="link" style={{ color: t.accent, fontSize: 12.5, fontWeight: "600", paddingVertical: 8 }} onPress={() => void Linking.openURL(`${ENV.apiUrl}/privacidade`)}>
          Política de Privacidade
        </Text>
      </View>
      <Notice text={message} tone="info" />
    </Card>
  );
}
