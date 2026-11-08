-- =============================================================================
-- VYZ · Otimizações aplicadas pela API
-- tasks.action: a mudança que a tarefa propõe (pausar campanha ou mudar o
-- orçamento diário), calculada pelo VYZ a partir da análise.
-- optimization_runs: registro de cada mudança aplicada (com aprovação ou pelo
-- automático), com o "de → para", para mostrar e para desfazer.
-- optimization_autopilot: o automático por projeto (Avançado), com os limites.
-- Quem aplica e grava o registro é o servidor (service role), depois de
-- conferir o acesso; membros só leem. As regras do automático são editadas
-- por admins.
-- =============================================================================

alter table public.tasks add column action jsonb check (action is null or jsonb_typeof(action) = 'object');
comment on column public.tasks.action is 'Mudança proposta pelo VYZ (features/optimize/actions.ts): pausar campanha ou mudar orçamento diário.';

create table public.optimization_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  project_id uuid,
  campaign_id uuid references public.ad_campaigns (id) on delete set null,
  platform text not null check (platform in ('meta', 'google', 'tiktok')),
  kind text not null check (kind in ('pause', 'budget')),
  action jsonb not null check (jsonb_typeof(action) = 'object'),
  mode text not null check (mode in ('manual', 'auto')),
  status text not null check (status in ('applied', 'failed', 'undone', 'undo_failed')),
  error text check (error is null or char_length(error) <= 400),
  is_mock boolean not null default false,
  applied_by uuid references auth.users (id) on delete set null,
  applied_at timestamptz not null default now(),
  undone_by uuid references auth.users (id) on delete set null,
  undone_at timestamptz
);
comment on table public.optimization_runs is 'Mudanças aplicadas nas plataformas pelo VYZ (com aprovação ou automáticas), com o de → para para desfazer.';
create index optimization_runs_workspace_idx on public.optimization_runs (workspace_id, applied_at desc);
create index optimization_runs_task_idx on public.optimization_runs (task_id);
create index optimization_runs_campaign_idx on public.optimization_runs (campaign_id, applied_at desc);
create index optimization_runs_applied_by_idx on public.optimization_runs (applied_by);
create index optimization_runs_undone_by_idx on public.optimization_runs (undone_by);

create table public.optimization_autopilot (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null,
  enabled boolean not null default false,
  max_budget_change_pct integer not null default 20 check (max_budget_change_pct between 5 and 50),
  allow_increase boolean not null default false,
  allow_pause boolean not null default true,
  min_campaign_age_days integer not null default 7 check (min_campaign_age_days between 3 and 30),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, project_id),
  foreign key (workspace_id, project_id) references public.projects (workspace_id, id) on delete cascade
);
comment on table public.optimization_autopilot is 'Automático de otimizações por projeto (Avançado): ligado ou não e os limites.';
create index optimization_autopilot_updated_by_idx on public.optimization_autopilot (updated_by);

alter table public.optimization_runs enable row level security;
create policy "optimization_runs: membros leem" on public.optimization_runs for select to authenticated
  using (workspace_id in (select private.workspace_ids()));
grant select on public.optimization_runs to authenticated;

alter table public.optimization_autopilot enable row level security;
create policy "optimization_autopilot: membros leem" on public.optimization_autopilot for select to authenticated
  using (workspace_id in (select private.workspace_ids()));
create policy "optimization_autopilot: admin cria" on public.optimization_autopilot for insert to authenticated
  with check (workspace_id in (select private.workspace_ids('admin')));
create policy "optimization_autopilot: admin edita" on public.optimization_autopilot for update to authenticated
  using (workspace_id in (select private.workspace_ids('admin')))
  with check (workspace_id in (select private.workspace_ids('admin')));
grant select, insert, update on public.optimization_autopilot to authenticated;

create trigger optimization_autopilot_touch before update on public.optimization_autopilot for each row execute function private.touch_updated_at();
create trigger audit after insert or update or delete on public.optimization_autopilot for each row execute function private.audit_row_change('workspace_id', 'workspace_id,project_id');
