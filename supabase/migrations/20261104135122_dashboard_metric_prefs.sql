-- =============================================================================
-- VYZ · 18 · Métricas escolhidas em cada dashboard
-- Guarda só o que difere do padrão do template, por plataforma:
-- {"meta":{"kpis":{"hidden":["cpm"],"shown":["reach"]},"columns":{"hidden":[],"shown":[]}}}
-- =============================================================================

alter table public.dashboards
  add column metric_prefs jsonb not null default '{}'::jsonb
  check (jsonb_typeof(metric_prefs) = 'object' and pg_column_size(metric_prefs) <= 16384);

comment on column public.dashboards.metric_prefs is
  'Métricas ocultas e ligadas em relação ao padrão do template, por plataforma. {} = padrão.';

-- quem já edita o dashboard (member+, pela política existente) também personaliza
grant update (metric_prefs) on public.dashboards to authenticated;
