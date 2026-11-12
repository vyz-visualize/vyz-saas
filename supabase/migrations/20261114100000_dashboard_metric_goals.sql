-- =============================================================================
-- VYZ · Metas por métrica em cada dashboard
-- Lista de metas, uma por métrica, no valor da própria métrica (centavos para
-- dinheiro, fração para taxa):
-- [{"metric":"cpm","value":650,"direction":"max","period":{"kind":"firstWeek"},"text":"CPM de 6,50 na primeira semana"}]
-- A meta de CPA antiga (goal_cents) continua como está.
-- =============================================================================

alter table public.dashboards
  add column metric_goals jsonb not null default '[]'::jsonb
  check (jsonb_typeof(metric_goals) = 'array' and pg_column_size(metric_goals) <= 16384);

comment on column public.dashboards.metric_goals is
  'Metas por métrica (valor, sentido no máximo/no mínimo e período). [] = sem metas.';

-- quem já edita o dashboard (member+, pela política existente) também define metas
grant update (metric_goals) on public.dashboards to authenticated;
