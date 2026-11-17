// Plano do workspace no app: assinar ou trocar pela loja (mesma regra do site:
// 3 planos fixos, Básico até 3 workspaces, Padrão até 5, Avançado ilimitados, mensal
// ou anual). O preço vem da loja.
//
// A vitrine aparece sempre, para qualquer plano atual (inclusive contratado no
// site) e para quem não é dono: os 3 planos com o preço da loja no mensal e no
// anual, renovação automática, Termos, Privacidade e Restaurar compras (a Apple
// precisa achar e comprar as assinaturas, diretriz 2.1(b)). Se a loja não
// devolver os produtos, aparece um erro claro com "Tentar de novo".

import { STORE_PLAN_HIGHLIGHTS, STORE_PLAN_PERIODS, STORE_PLAN_TIERS, storePlan, storePlanProductId, type MeResponse, type StorePlan, type StorePlanPeriod, type StorePlanTier } from "@vyz/shared";
import { useCallback, useEffect, useState } from "react";
import { Linking, Platform, Pressable, Text, View } from "react-native";
import { api, ApiFailure } from "@/lib/api";
import { ENV } from "@/lib/env";
import { buyPlan, manageSubscription, planCatalog, restorePurchases, type PlanCatalog } from "@/lib/purchases";
import { IconCheck } from "./icons";
import { Button, Card, Chip, Divider, Notice, Segmented, tap } from "./kit";
import { radius, type as typo, useTheme } from "./theme";

const TIER_LABEL: Record<StorePlanTier, string> = { base: "Básico", pro: "Padrão", avancado: "Avançado" };
const PERIOD_LABEL: Record<StorePlanPeriod, string> = { mensal: "Mensal", anual: "Anual" };
const UNIT: Record<StorePlanPeriod, string> = { mensal: "mês", anual: "ano" };
const WORKSPACES: Record<StorePlanTier, string> = { base: "Até 3 workspaces", pro: "Até 5 workspaces", avancado: "Workspaces ilimitados" };

type Workspace = MeResponse["workspaces"][number];

export function PlanCard({ workspace, onChanged }: { workspace: Workspace; onChanged: () => void }) {
  const t = useTheme();
  const current: StorePlan | null =
    workspace.plan && workspace.period && (STORE_PLAN_TIERS as readonly string[]).includes(workspace.plan)
      ? { tier: workspace.plan as StorePlanTier, period: workspace.period, accounts: workspace.accounts }
      : null;
  const fromStore = workspace.planSource === "app_store" || workspace.planSource === "play_store";
  const owner = workspace.role === "owner";
  const [plan, setPlan] = useState<StorePlan>(current ? storePlan(current.tier, current.period) : storePlan("pro", "anual"));
  const [catalog, setCatalog] = useState<PlanCatalog | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    setCatalog(null);
    void planCatalog().then(setCatalog);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const productOf = (tier: StorePlanTier, period: StorePlanPeriod) => catalog?.products[storePlanProductId({ tier, period })] ?? null;
  const product = productOf(plan.tier, plan.period);
  const isCurrent = (tier: StorePlanTier) => !!current && current.tier === tier && current.period === plan.period;
  // só a assinatura da própria loja é "a mesma": plano do site pode passar para a loja
  const same = fromStore && isCurrent(plan.tier) && !workspace.cancelAtPeriodEnd;
  const ending = current && workspace.cancelAtPeriodEnd && workspace.periodEnd ? `Termina em ${new Date(workspace.periodEnd).toLocaleDateString("pt-BR")}` : null;

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

  const buyLabel = same
    ? "Seu plano atual"
    : product
      ? `${current ? "Trocar para" : "Assinar"} ${TIER_LABEL[plan.tier]} · ${product.priceString}/${UNIT[plan.period]}`
      : `${current ? "Trocar para" : "Assinar"} ${TIER_LABEL[plan.tier]}`;

  return (
    <Card style={{ gap: 14 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: t.fg2, ...typo.overline }}>Plano atual</Text>
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <Text style={{ color: t.fg, ...typo.title }}>{current ? TIER_LABEL[current.tier] : "Sem plano"}</Text>
          {current ? <Chip label={PERIOD_LABEL[current.period]} tone="accent" /> : null}
          {ending ? <Chip label={ending} tone="warn" /> : null}
        </View>
        {current ? (
          <Text style={{ color: t.fg2, fontSize: 13.5, lineHeight: 19 }}>
            {WORKSPACES[current.tier]}
            {workspace.planSource === "site" ? " · contratado fora do app" : ""}
          </Text>
        ) : null}
      </View>
      <Divider />

      <Text style={{ color: t.fg, ...typo.heading, fontSize: 16 }}>{current ? "Trocar de plano" : "Escolha um plano"}</Text>
      <Segmented options={STORE_PLAN_PERIODS.map((v) => ({ value: v, label: PERIOD_LABEL[v] }))} value={plan.period} onChange={(period) => setPlan((p) => storePlan(p.tier, period))} />

      <View style={{ gap: 10 }} accessibilityRole="radiogroup">
        {STORE_PLAN_TIERS.map((tier) => {
          const selected = plan.tier === tier;
          const p = productOf(tier, plan.period);
          return (
            <Pressable
              key={tier}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${TIER_LABEL[tier]}, ${p ? `${p.priceString} por ${UNIT[plan.period]}` : "preço indisponível"}`}
              onPress={() => {
                tap();
                setPlan(storePlan(tier, plan.period));
              }}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                minHeight: 64,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: radius.md,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? t.accent : t.line,
                backgroundColor: selected ? t.accentSoft : pressed ? t.surface2 : t.surface,
              })}
            >
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: selected ? t.accent : t.fg3, alignItems: "center", justifyContent: "center" }}>
                {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.accent }} /> : null}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Text style={{ color: t.fg, fontSize: 16, lineHeight: 21, fontWeight: "800" }}>{TIER_LABEL[tier]}</Text>
                  {isCurrent(tier) ? <Chip label="Atual" tone="accent" /> : null}
                </View>
                <Text style={{ color: t.fg2, fontSize: 13, lineHeight: 18 }}>{WORKSPACES[tier]}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: t.fg, fontSize: 16, lineHeight: 21, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{p ? p.priceString : catalog ? "Indisponível" : "…"}</Text>
                <Text style={{ color: t.fg2, fontSize: 12, lineHeight: 16 }}>por {UNIT[plan.period]}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Notice text={catalog?.error ?? null} onRetry={load} />

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

      {owner ? (
        <Button label={buyLabel} busy={busy} disabled={same || !product} onPress={purchase} />
      ) : (
        <Text style={{ color: t.fg2, fontSize: 14, lineHeight: 20 }}>Só o dono da organização assina ou troca o plano.</Text>
      )}
      {fromStore && current ? <Button size="md" tone="secondary" label="Gerenciar assinatura" onPress={() => void manageSubscription()} /> : null}
      <Button size="md" tone="ghost" label="Restaurar compras" busy={busy} onPress={() => void restore()} />

      {/* o que a Apple e o Google pedem junto da compra: nome, período, preço, renovação automática, cancelamento e os documentos */}
      <Text style={{ color: t.fg3, fontSize: 12, lineHeight: 17 }}>
        Plano {TIER_LABEL[plan.tier]} {PERIOD_LABEL[plan.period].toLowerCase()}
        {product ? `: ${product.priceString} por ${UNIT[plan.period]}` : ""}. Assinatura com renovação automática. A cobrança é feita na sua conta{" "}
        {Platform.OS === "ios" ? "Apple" : "Google Play"} ao confirmar a compra e se repete a cada {UNIT[plan.period]} pelo mesmo valor, a menos que a renovação seja desligada até 24
        horas antes do fim do período. Gerencie ou cancele nos ajustes da sua conta da loja.
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
