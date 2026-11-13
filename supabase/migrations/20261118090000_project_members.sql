-- =============================================================================
-- VYZ · Equipe por workspace (na interface, "projeto" passou a se chamar workspace
-- e o workspace de cima, organização)
--
-- Quem é dono ou admin da organização vê tudo. Quem é member ou viewer só vê os
-- projetos onde está em project_members: as contas, os dashboards (e tudo que é
-- deles: páginas, fontes, links, relatórios, exportações), as tarefas, as
-- otimizações e as métricas das contas desses projetos.
--
-- Como: políticas RESTRITIVAS, que se somam (AND) às permissivas que já existem.
-- Nenhuma política antiga muda; o service_role continua ignorando RLS (o servidor
-- filtra por conta própria onde usa o cliente admin).
--
-- Vagas: a pessoa continua sendo membro da organização (o limite de usuários do
-- plano vale como antes). Pôr alguém da organização num projeto não gasta vaga.
-- Convite pode já levar os projetos (workspace_invitations.project_ids).
--
-- Nada muda no dia: todo member/viewer atual entra em todos os projetos ativos.
-- =============================================================================

-- ---- tabela -----------------------------------------------------------------------------------

create table public.project_members (
  workspace_id uuid not null,
  project_id uuid not null,
  user_id uuid not null,
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id),
  foreign key (workspace_id, project_id) references public.projects (workspace_id, id) on delete cascade,
  -- saiu da organização, sai dos projetos
  foreign key (workspace_id, user_id) references public.workspace_members (workspace_id, user_id) on delete cascade
);
comment on table public.project_members is 'Quem (member/viewer da organização) acessa cada projeto. Dono e admin acessam todos sem linha aqui.';
create index project_members_user_idx on public.project_members (user_id, workspace_id);
create index project_members_added_by_idx on public.project_members (added_by);

-- ---- funções de acesso ------------------------------------------------------------------------

-- Projetos que o usuário logado acessa com pelo menos min_role na organização.
create function private.project_ids(min_role public.member_role default 'viewer')
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.projects p
  join public.workspace_members m on m.workspace_id = p.workspace_id and m.user_id = (select auth.uid()) and m.role >= min_role
  where m.role >= 'admin'
     or exists (select 1 from public.project_members pm where pm.project_id = p.id and pm.user_id = m.user_id);
$$;
revoke all on function private.project_ids(public.member_role) from public;
grant execute on function private.project_ids(public.member_role) to authenticated, service_role;

-- Contas de anúncio visíveis: as dos projetos acessíveis; sem projeto, só admin.
create function private.ad_account_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.id from public.ad_accounts a
  where a.project_id in (select private.project_ids())
     or (a.project_id is null and a.workspace_id in (select private.workspace_ids('admin')));
$$;
revoke all on function private.ad_account_ids() from public;
grant execute on function private.ad_account_ids() to authenticated, service_role;

-- Dashboards visíveis (para as tabelas filhas).
create function private.dashboard_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select d.id from public.dashboards d
  where d.project_id in (select private.project_ids())
     or (d.project_id is null and d.workspace_id in (select private.workspace_ids('admin')));
$$;
revoke all on function private.dashboard_ids() from public;
grant execute on function private.dashboard_ids() to authenticated, service_role;

-- Projetos que um usuário acessa (para o servidor filtrar o que manda por WhatsApp e push).
-- null = todos (dono ou admin).
create function public.user_project_ids(p_workspace_id uuid, p_user_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when m.role >= 'admin' then null
    else coalesce((select array_agg(pm.project_id) from public.project_members pm where pm.workspace_id = p_workspace_id and pm.user_id = p_user_id), '{}')
  end
  from public.workspace_members m
  where m.workspace_id = p_workspace_id and m.user_id = p_user_id;
$$;
revoke all on function public.user_project_ids(uuid, uuid) from public, anon, authenticated;
grant execute on function public.user_project_ids(uuid, uuid) to service_role;

-- ---- RLS da tabela nova -----------------------------------------------------------------------

alter table public.project_members enable row level security;
create policy "project_members: quem acessa o projeto le" on public.project_members for select to authenticated
  using (project_id in (select private.project_ids()));
create policy "project_members: admin adiciona" on public.project_members for insert to authenticated
  with check (workspace_id in (select private.workspace_ids('admin')) and added_by = (select auth.uid()));
create policy "project_members: admin remove" on public.project_members for delete to authenticated
  using (workspace_id in (select private.workspace_ids('admin')));
grant select, insert, delete on public.project_members to authenticated;

create trigger audit after insert or delete on public.project_members for each row execute function private.audit_row_change('workspace_id', 'project_id');

-- ---- políticas restritivas --------------------------------------------------------------------

-- projetos (insert fica de fora: quem cria ainda não está no projeto; o trigger abaixo o põe lá)
-- quem criou também lê (o insert ... returning confere a leitura antes do trigger que o põe no projeto)
create policy "projects: so os do usuario (le)" on public.projects as restrictive for select to authenticated
  using (id in (select private.project_ids()) or created_by = (select auth.uid()));
create policy "projects: so os do usuario (edita)" on public.projects as restrictive for update to authenticated
  using (id in (select private.project_ids()));
create policy "projects: so os do usuario (apaga)" on public.projects as restrictive for delete to authenticated
  using (id in (select private.project_ids()));

create policy "ad_accounts: so as dos projetos do usuario" on public.ad_accounts as restrictive for all to authenticated
  using (
    project_id in (select private.project_ids())
    or (project_id is null and workspace_id in (select private.workspace_ids('admin')))
  )
  with check (
    project_id in (select private.project_ids())
    or (project_id is null and workspace_id in (select private.workspace_ids('admin')))
  );

create policy "dashboards: so os dos projetos do usuario" on public.dashboards as restrictive for all to authenticated
  using (
    project_id in (select private.project_ids())
    or (project_id is null and workspace_id in (select private.workspace_ids('admin')))
  )
  with check (
    project_id in (select private.project_ids())
    or (project_id is null and workspace_id in (select private.workspace_ids('admin')))
  );

create policy "dashboard_pages: so dos dashboards do usuario" on public.dashboard_pages as restrictive for all to authenticated
  using (dashboard_id in (select private.dashboard_ids())) with check (dashboard_id in (select private.dashboard_ids()));
create policy "dashboard_sources: so dos dashboards e contas do usuario" on public.dashboard_sources as restrictive for all to authenticated
  using (dashboard_id in (select private.dashboard_ids()))
  with check (dashboard_id in (select private.dashboard_ids()) and ad_account_id in (select private.ad_account_ids()));
create policy "share_links: so dos dashboards do usuario" on public.share_links as restrictive for all to authenticated
  using (dashboard_id in (select private.dashboard_ids())) with check (dashboard_id in (select private.dashboard_ids()));
create policy "scheduled_reports: so dos dashboards do usuario" on public.scheduled_reports as restrictive for all to authenticated
  using (dashboard_id in (select private.dashboard_ids())) with check (dashboard_id in (select private.dashboard_ids()));
create policy "scheduled_report_recipients: so dos relatorios do usuario" on public.scheduled_report_recipients as restrictive for all to authenticated
  using (report_id in (select r.id from public.scheduled_reports r)) with check (report_id in (select r.id from public.scheduled_reports r));
create policy "report_deliveries: so dos dashboards do usuario" on public.report_deliveries as restrictive for all to authenticated
  using (dashboard_id is null or dashboard_id in (select private.dashboard_ids()));
create policy "dashboard_exports: so dos dashboards do usuario" on public.dashboard_exports as restrictive for all to authenticated
  using (dashboard_id is null or dashboard_id in (select private.dashboard_ids()))
  with check (dashboard_id is null or dashboard_id in (select private.dashboard_ids()));

-- tarefas sem projeto continuam da organização inteira
create policy "tasks: so dos projetos do usuario" on public.tasks as restrictive for all to authenticated
  using (project_id is null or project_id in (select private.project_ids()))
  with check (project_id is null or project_id in (select private.project_ids()));
create policy "optimization_runs: so dos projetos do usuario" on public.optimization_runs as restrictive for all to authenticated
  using (project_id is null or project_id in (select private.project_ids()));
create policy "optimization_autopilot: so dos projetos do usuario" on public.optimization_autopilot as restrictive for all to authenticated
  using (project_id in (select private.project_ids())) with check (project_id in (select private.project_ids()));
create policy "sync_runs: so das contas do usuario" on public.sync_runs as restrictive for all to authenticated
  using (ad_account_id is null or ad_account_id in (select private.ad_account_ids()));

-- armazém de métricas: toda tabela com ad_account_id e RLS ligada (public e mmm), só leitura
do $$
declare
  t record;
begin
  for t in
    select c.table_schema, c.table_name
    from information_schema.columns c
    join pg_class k on k.relname = c.table_name
    join pg_namespace n on n.oid = k.relnamespace and n.nspname = c.table_schema
    where c.column_name = 'ad_account_id'
      and c.table_schema in ('public', 'mmm')
      and k.relkind in ('r', 'p')
      and k.relrowsecurity
      and not k.relispartition
      and c.table_name not in ('dashboard_sources', 'sync_runs', 'ad_accounts')
  loop
    execute format(
      'create policy %I on %I.%I as restrictive for select to authenticated using (ad_account_id is null or ad_account_id in (select private.ad_account_ids()))',
      t.table_name || ': so das contas do usuario', t.table_schema, t.table_name
    );
  end loop;
end;
$$;

-- ---- quem cria um projeto entra nele; dashboard novo cai num projeto que a pessoa acessa ------

create function private.project_creator_joins()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null and exists (
    select 1 from public.workspace_members m
    where m.workspace_id = new.workspace_id and m.user_id = new.created_by and m.role < 'admin'
  ) then
    insert into public.project_members (workspace_id, project_id, user_id, added_by)
    values (new.workspace_id, new.id, new.created_by, new.created_by)
    on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger projects_creator_joins after insert on public.projects
  for each row execute function private.project_creator_joins();

create or replace function private.dashboard_default_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if new.project_id is null then
    -- member/viewer: o projeto ativo mais antigo entre os dele
    if uid is not null and exists (
      select 1 from public.workspace_members m where m.workspace_id = new.workspace_id and m.user_id = uid and m.role < 'admin'
    ) then
      select p.id into new.project_id
      from public.projects p
      join public.project_members pm on pm.project_id = p.id and pm.user_id = uid
      where p.workspace_id = new.workspace_id and p.archived_at is null
      order by p.created_at limit 1;
    end if;
    if new.project_id is null then
      new.project_id := private.default_project(new.workspace_id);
    end if;
  end if;
  return new;
end;
$$;

-- ---- convite com projetos -----------------------------------------------------------------

alter table public.workspace_invitations add column project_ids uuid[] not null default '{}';
comment on column public.workspace_invitations.project_ids is 'Projetos que a pessoa acessa ao aceitar (member/viewer). Vazio = nenhum (admin vê todos).';
grant insert (project_ids) on public.workspace_invitations to authenticated;

create or replace function public.accept_workspace_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.workspace_invitations%rowtype;
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception using errcode = 'P0001', message = 'auth:required';
  end if;

  select * into inv
  from public.workspace_invitations i
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;

  if not found or inv.revoked_at is not null or inv.accepted_at is not null or inv.expires_at < now() then
    raise exception using errcode = 'P0001', message = 'invitation:invalid';
  end if;
  if lower(inv.email) <> lower(coalesce((select u.email from auth.users u where u.id = uid), '')) then
    raise exception using errcode = 'P0001', message = 'invitation:email_mismatch';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, invited_by)
  values (inv.workspace_id, uid, inv.role, inv.invited_by)
  on conflict (workspace_id, user_id) do nothing;

  -- os projetos do convite (só os que ainda existem nesta organização)
  insert into public.project_members (workspace_id, project_id, user_id, added_by)
  select inv.workspace_id, p.id, uid, inv.invited_by
  from public.projects p
  where p.workspace_id = inv.workspace_id and p.id = any (inv.project_ids)
  on conflict do nothing;

  update public.workspace_invitations set accepted_at = now(), accepted_by = uid where id = inv.id;
  update public.profiles set default_workspace_id = coalesce(default_workspace_id, inv.workspace_id) where id = uid;
  return inv.workspace_id;
end;
$$;
revoke all on function public.accept_workspace_invitation(text) from public, anon;
grant execute on function public.accept_workspace_invitation(text) to authenticated;

-- ---- quem já era membro continua vendo tudo ---------------------------------------------------

insert into public.project_members (workspace_id, project_id, user_id, added_by)
select p.workspace_id, p.id, m.user_id, null
from public.projects p
join public.workspace_members m on m.workspace_id = p.workspace_id and m.role < 'admin'
where p.archived_at is null
on conflict do nothing;
