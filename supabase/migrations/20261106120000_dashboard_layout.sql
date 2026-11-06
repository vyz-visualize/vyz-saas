-- =============================================================================
-- VYZ · Disposição de cada aba do dashboard (Editar disposição)
-- Só as abas que a pessoa mexeu, numa grade de 12 colunas:
-- {"visao-geral":[{"id":"kpis","x":0,"y":0,"w":12,"h":8},{"id":"m:meta:ctr","x":0,"y":8,"w":3,"h":4}]}
-- =============================================================================

alter table public.dashboards
  add column layout jsonb not null default '{}'::jsonb
  check (jsonb_typeof(layout) = 'object' and pg_column_size(layout) <= 32768);

comment on column public.dashboards.layout is
  'Disposição dos blocos por aba (grade de 12 colunas). {} = a do template.';

-- quem já edita o dashboard (member+, pela política existente) também arruma a disposição
grant update (layout) on public.dashboards to authenticated;
