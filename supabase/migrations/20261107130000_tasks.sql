-- =============================================================================
-- VYZ · A Fazer
-- Tarefas do workspace: manuais, criadas pelo VYZ a partir das análises
-- (source = 'insight', com insight_key para não duplicar) ou por um roteiro
-- pronto (source = 'playbook'). A situação (no prazo, atrasado, concluído) é
-- derivada na leitura, não fica gravada.
-- Plano: Básico e Padrão usam status, etapa, prioridade e prazo; Avançado e
-- Personalizado também responsáveis, cronograma, grupos e roteiros. A trava
-- de plano fica na aplicação (as colunas existem para todos).
-- =============================================================================

create table public.task_groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);
comment on table public.task_groups is 'Grupos de tarefas do A Fazer (ex.: uma campanha, um roteiro aplicado).';
create index task_groups_workspace_idx on public.task_groups (workspace_id, created_at);
create index task_groups_created_by_idx on public.task_groups (created_by);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid,
  group_id uuid,
  dashboard_id uuid references public.dashboards (id) on delete set null,
  platform text check (platform is null or char_length(platform) <= 40),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  detail text check (detail is null or char_length(detail) <= 4000),
  status text not null default 'planejado' check (status in ('planejado', 'em_andamento', 'concluido', 'cancelado')),
  stage text not null default 'outro' check (stage in ('midia_paga', 'cro', 'crm', 'criativos', 'relatorio', 'outro')),
  priority text not null default 'media' check (priority in ('alta', 'media', 'baixa')),
  start_date date,
  due_date date,
  assignees uuid[] not null default '{}' check (cardinality(assignees) <= 20),
  source text not null default 'manual' check (source in ('manual', 'insight', 'playbook')),
  insight_key text check (insight_key is null or char_length(insight_key) <= 200),
  auto_note text check (auto_note is null or char_length(auto_note) <= 400),
  seen_at timestamptz,
  edited_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check (start_date is null or due_date is null or start_date <= due_date),
  check (source <> 'insight' or insight_key is not null)
);
comment on table public.tasks is 'A Fazer: tarefas do workspace (manuais, automáticas a partir das análises ou de roteiros).';
comment on column public.tasks.insight_key is 'Análise de origem (dashboard:id). Única entre as abertas do workspace: a mesma análise não cria tarefa repetida.';
comment on column public.tasks.seen_at is 'Quando alguém abriu a tarefa automática (some o selo "Novo").';
comment on column public.tasks.edited_at is 'Última edição feita por uma pessoa. Tarefa automática editada não é fechada sozinha.';
comment on column public.tasks.auto_note is 'Nota do VYZ (ex.: fechada porque a métrica voltou ao normal).';

alter table public.tasks add constraint tasks_project_fk
  foreign key (workspace_id, project_id) references public.projects (workspace_id, id) on delete set null (project_id);
alter table public.tasks add constraint tasks_group_fk
  foreign key (workspace_id, group_id) references public.task_groups (workspace_id, id) on delete set null (group_id);

create index tasks_workspace_idx on public.tasks (workspace_id, created_at desc);
create index tasks_open_idx on public.tasks (workspace_id, priority, due_date) where status in ('planejado', 'em_andamento');
create index tasks_project_idx on public.tasks (workspace_id, project_id);
create index tasks_group_idx on public.tasks (workspace_id, group_id);
create index tasks_dashboard_idx on public.tasks (dashboard_id);
create index tasks_created_by_idx on public.tasks (created_by);
create unique index tasks_open_insight_key on public.tasks (workspace_id, insight_key)
  where insight_key is not null and status in ('planejado', 'em_andamento');

-- quando a geração automática rodou pela última vez em cada workspace
create table public.task_automation_runs (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  generated_at timestamptz not null default now(),
  created_count integer not null default 0,
  closed_count integer not null default 0
);
comment on table public.task_automation_runs is 'Última geração de tarefas automáticas do workspace (agendador ou abertura do A Fazer).';

-- ---- RLS --------------------------------------------------------------------------------------

alter table public.task_groups enable row level security;
create policy "task_groups: membros leem" on public.task_groups for select to authenticated
  using (workspace_id in (select private.workspace_ids()));
create policy "task_groups: member cria" on public.task_groups for insert to authenticated
  with check (workspace_id in (select private.workspace_ids('member')));
create policy "task_groups: member edita" on public.task_groups for update to authenticated
  using (workspace_id in (select private.workspace_ids('member')))
  with check (workspace_id in (select private.workspace_ids('member')));
create policy "task_groups: member apaga" on public.task_groups for delete to authenticated
  using (workspace_id in (select private.workspace_ids('member')));
grant select, insert, update, delete on public.task_groups to authenticated;

alter table public.tasks enable row level security;
create policy "tasks: membros leem" on public.tasks for select to authenticated
  using (workspace_id in (select private.workspace_ids()));
create policy "tasks: member cria" on public.tasks for insert to authenticated
  with check (workspace_id in (select private.workspace_ids('member')));
create policy "tasks: member edita" on public.tasks for update to authenticated
  using (workspace_id in (select private.workspace_ids('member')))
  with check (workspace_id in (select private.workspace_ids('member')));
create policy "tasks: member apaga" on public.tasks for delete to authenticated
  using (workspace_id in (select private.workspace_ids('member')));
grant select, insert, update, delete on public.tasks to authenticated;

-- só leitura para membros; quem grava é o servidor (service role)
alter table public.task_automation_runs enable row level security;
create policy "task_automation_runs: membros leem" on public.task_automation_runs for select to authenticated
  using (workspace_id in (select private.workspace_ids()));
grant select on public.task_automation_runs to authenticated;

create trigger task_groups_touch before update on public.task_groups for each row execute function private.touch_updated_at();
create trigger tasks_touch before update on public.tasks for each row execute function private.touch_updated_at();
create trigger audit after insert or update or delete on public.task_groups for each row execute function private.audit_row_change('workspace_id', 'id');
