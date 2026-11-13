import { brl } from "@/lib/format";
import { DASH_CUSTOM, LP_CARE_MONTHLY, NICHO_LABEL, PERIOD_LABEL, PLAN_LABEL, PLAN_PROJECTS, type PlanState, type Quote } from "./pricing";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function describeProjects(s: PlanState): string {
  return s.plano === "sem" ? "" : `até ${plural(PLAN_PROJECTS[s.plano], "workspace", "workspaces")}`;
}

export function describeExtras(s: PlanState): string[] {
  const items: string[] = [];
  if (s.lp) {
    const care = s.lpcare ? ` (com hospedagem e ajustes, ${brl(LP_CARE_MONTHLY)}/mês cada)` : "";
    items.push(`${s.lp}× Landing page feita pelo time${care}`);
  }
  if (s.sob) {
    const billing =
      s.sobm === "recorrente"
        ? ` (${brl(DASH_CUSTOM.recorrente.setup, { decimals: false })} + ${brl(DASH_CUSTOM.recorrente.mensal)}/mês cada)`
        : " (pagamento único)";
    items.push(`${s.sob}× Dashboard sob medida${billing}`);
  }
  if (s.dash && s.plano !== "sem") items.push(`${s.dash}× Dashboard adicional`);
  return items;
}

export function buildPlanMessage(s: PlanState, q: Quote, url: string): string {
  const extras = describeExtras(s);

  if (s.plano === "sem") {
    const lines = ["Olá, VYZ! Quero só os extras:"];
    for (const l of q.lines) {
      if (l.kind === "once") lines.push(`• ${l.qty}× ${l.label}: ${brl(l.amount)}`);
      if (l.kind === "monthly") lines.push(`• ${l.qty}× ${l.label}: ${brl(l.amount)}/mês`);
    }
    if (q.oneTime === 0 && q.extrasMonthly === 0) lines.push("• Ainda não escolhi os extras");
    if (s.nicho) lines.push(`• Tipo de negócio: ${NICHO_LABEL[s.nicho]}`);
    if (q.extrasMonthly > 0) lines.push(`• Todo mês: ${brl(q.extrasMonthly)}`);
    if (q.oneTime > 0) lines.push(`• Uma vez: ${brl(q.oneTime)}`);
    lines.push(`Simulação: ${url}`, "Podemos seguir?");
    return lines.join("\n");
  }

  const lines = [
    "Olá, VYZ! Montei meu plano no site:",
    `• Plano ${PLAN_LABEL[s.plano]}, ${PERIOD_LABEL[s.periodo]}`,
  ];
  lines.push(`• ${describeProjects(s)}`);
  if (s.nicho) lines.push(`• Tipo de negócio: ${NICHO_LABEL[s.nicho]}`);
  if (extras.length) lines.push(`• Extras: ${extras.join(", ")}`);
  const year = s.periodo === "anual" ? ` (${brl(q.yearly)} no ano)` : "";
  lines.push(`• Todo mês: ${brl(q.monthly)}${year}`);
  if (q.oneTime > 0) lines.push(`• Uma vez: ${brl(q.oneTime)}`);
  lines.push(`Simulação: ${url}`, "Podemos seguir?");
  return lines.join("\n");
}

/** Resumo em texto puro para o botão "Copiar resumo". */
export function buildSummary(s: PlanState, q: Quote, url: string, date: string): string {
  const head =
    s.plano === "sem"
      ? "VYZ · Sem plano (só extras)"
      : `VYZ · Plano ${PLAN_LABEL[s.plano]}, ${PERIOD_LABEL[s.periodo]}`;
  const lines = [head];
  for (const l of q.lines) {
    const value = l.kind === "included" ? "R$ 0,00 (incluso)" : brl(l.amount);
    lines.push(`${l.label}${l.detail && l.kind !== "included" ? ` (${l.detail})` : ""}: ${value}`);
  }
  if (q.monthly > 0) lines.push(`Todo mês: ${brl(q.monthly)}`);
  if (q.oneTime > 0) lines.push(`Uma vez: ${brl(q.oneTime)}`);
  lines.push(`Em 12 meses: ${brl(q.twelveMonths)}`);
  lines.push(`Simulação · não é cobrança · ${date}`, url);
  return lines.join("\n");
}
