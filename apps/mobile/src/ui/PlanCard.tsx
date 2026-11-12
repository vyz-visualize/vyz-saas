// Plano do workspace no app: assinar ou trocar pela loja (mesma regra do site:
// 3 planos fixos, Básico até 5 projetos, Padrão até 15, Avançado até 30, mensal
// ou anual). Plano contratado no site muda no site (sem link: regra das lojas).
// O preço vem da loja.

import { STORE_PLAN_HIGHLIGHTS, STORE_PLAN_PERIODS, STORE_PLAN_TIERS, storePlan, type MeResponse, type StorePlan, type StorePlanPeriod, type StorePlanTier } from "@vyz/shared";
import { useEffect, useState } from "react";
import { Linking, Platform, Pressable, Text, View } from "react-native";
import type { PurchasesStoreProduct } from "react-native-purchases";
import { api, ApiFailure } from "@/lib/api";
import { buyPlan, manageSubscription, planProduct, restorePurchases } from "@/lib/purchases";
import { ENV } from "@/lib/env";
import { Button, Card, Notice } from "./kit";
import { useTheme } from "./theme";

const TIER_LABEL: Record<StorePlanTier, string> = { base: "Básico", pro: "Padrão", avancado: "Avançado" };
const PERIOD_LABEL: Record<StorePlanPeriod, string> = { mensal: "Mensal", anual: "Anual" };

type Workspace = MeResponse["workspaces"][number];

function Choice<T extends string>({ options, value, label, onChange }: { options: readonly T[]; value: T; label: (v: T) => string; onChange: (v: T) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {options.map((o) => (
        <Pressable
          key={o}
          accessibilityRole="button"
          accessibilityState={{ selected: o === value }}
          onPress={() => onChange(o)}
          style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: "center", borderColor: o === value ? t.accent : t.line, backgroundColor: o === value ? t.accent : "transparent" }}
        >
          <Text style={{ color: o === value ? t.accentFg : t.fg, fontWeight: "600" }}>{label(o)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

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

  const header = (
    <>
      <Text style={{ color: t.fg2, fontSize: 13 }}>Plano</Text>
      <Text style={{ color: t.fg, fontSize: 20, fontWeight: "700" }}>
        {current ? `${TIER_LABEL[current.tier]} · ${PERIOD_LABEL[current.period]} · até ${current.accounts} projetos` : "Sem plano"}
      </Text>
      {current && workspace.cancelAtPeriodEnd && workspace.periodEnd ? (
        <Text style={{ color: t.fg2 }}>Termina em {new Date(workspace.periodEnd).toLocaleDateString("pt-BR")}</Text>
      ) : null}
    </>
  );

  if (workspace.planSource === "site") {
    return (
      <Card>
        {header}
        <Text style={{ color: t.fg2 }}>Este plano não é gerenciado pelo app.</Text>
      </Card>
    );
  }
  if (workspace.role !== "owner") {
    return (
      <Card>
        {header}
        <Text style={{ color: t.fg2 }}>Só o dono do workspace muda o plano.</Text>
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
    <Card>
      {header}
      <Choice options={STORE_PLAN_TIERS} value={plan.tier} label={(v) => TIER_LABEL[v]} onChange={(tier) => setPlan((p) => storePlan(tier, p.period))} />
      <View style={{ gap: 6 }}>
        {STORE_PLAN_HIGHLIGHTS[plan.tier].map((h) => (
          <Text key={h} style={{ color: t.fg2 }}>
            ✓ {h}
          </Text>
        ))}
      </View>
      <Choice options={STORE_PLAN_PERIODS} value={plan.period} label={(v) => PERIOD_LABEL[v]} onChange={(period) => setPlan((p) => storePlan(p.tier, period))} />
      <Text style={{ color: t.fg, fontSize: 17, fontWeight: "600" }}>{product ? `${product.priceString} por ${plan.period === "anual" ? "ano" : "mês"}` : "Carregando preço…"}</Text>
      {same ? null : <Button label={current ? "Trocar plano" : "Assinar"} busy={busy} onPress={purchase} />}
      {current ? <Button tone="secondary" label="Gerenciar assinatura" onPress={() => void manageSubscription()} /> : null}
      <Button tone="secondary" label="Restaurar compras" busy={busy} onPress={() => void restore()} />
      {/* o que a Apple e o Google pedem junto da compra: renovação automática, cancelamento e os documentos */}
      <Text style={{ color: t.fg3, fontSize: 12, lineHeight: 17 }}>
        Assinatura com renovação automática. A cobrança é feita na sua conta {Platform.OS === "ios" ? "Apple" : "Google Play"} ao confirmar a compra e se repete a cada{" "}
        {plan.period === "anual" ? "ano" : "mês"} pelo mesmo valor, a menos que a renovação seja desligada até 24 horas antes do fim do período. Gerencie ou cancele nos ajustes da
        sua conta da loja.
      </Text>
      <View style={{ flexDirection: "row", gap: 16 }}>
        <Text accessibilityRole="link" style={{ color: t.accent, fontSize: 12.5, fontWeight: "600" }} onPress={() => void Linking.openURL(`${ENV.apiUrl}/termos`)}>
          Termos de Uso
        </Text>
        <Text accessibilityRole="link" style={{ color: t.accent, fontSize: 12.5, fontWeight: "600" }} onPress={() => void Linking.openURL(`${ENV.apiUrl}/privacidade`)}>
          Política de Privacidade
        </Text>
      </View>
      <Notice text={message} tone="info" />
    </Card>
  );
}
