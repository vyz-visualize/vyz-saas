// Verba do mês, alvo de custo e margem: são do dashboard e podem não estar definidos (os
// dados reais não inventam nada). Sem eles, o card mostra um convite, nunca NaN nem um zero
// que pareça dado. Sem margem, o equilíbrio é ROAS 1 (receita = investimento), a regra do produto.

import type { Dataset } from "./source";

export const BUDGET_INVITE = "Defina a verba do mês";
export const GOAL_INVITE = "Defina o alvo";
export const MARGIN_INVITE = "defina a margem";

/** Verba do mês definida (e utilizável numa conta). */
export const hasBudget = (ds: Pick<Dataset, "budget">) => Number.isFinite(ds.budget.monthly) && ds.budget.monthly > 0;
/** Alvo de custo por conversão definido. */
export const hasGoal = (ds: Pick<Dataset, "goal">) => Number.isFinite(ds.goal) && ds.goal > 0;
/** Margem definida (sem ela, o equilíbrio é o padrão ROAS 1). */
export const hasMargin = (ds: Pick<Dataset, "marginSet">) => ds.marginSet !== false;

/** ROAS de equilíbrio a mostrar: o do dashboard ou o padrão 1. */
export const breakEvenOf = (ds: Pick<Dataset, "breakEven">) => (Number.isFinite(ds.breakEven) && ds.breakEven > 0 ? ds.breakEven : 1);
