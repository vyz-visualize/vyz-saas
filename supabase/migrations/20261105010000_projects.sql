-- =============================================================================
-- VYZ · Projetos
-- Projeto = cliente ou marca. Agrupa as contas (Meta, Google Ads, GA4...) e os
-- dashboards dele. O plano passa a cobrar e limitar por projeto: a coluna
-- accounts_quantity (assinatura e checkout) agora é a quantidade de projetos.
--
-- Preço no catálogo: o plano inclui 3 projetos. Para a conta do banco
-- (first + extra × (qtd − 1) + addon) continuar valendo, o db:catalog grava
-- first_account_cents = preço do plano − 2 × projeto extra. Mínimo de 3
-- projetos garantido no checkout.
--
-- Contas por projeto: até plan_entitlements.max_accounts_per_platform contas
-- de cada plataforma (Básico 1, Padrão e Avançado 3).
-- Plataforma fora do plano: liberada pelo item platform_extra da assinatura
-- (uma plataforma por unidade).
-- =============================================================================

-- ---- quantidade: até 200 projetos -------------------------------------------------------------

alter table public.checkout_sessions drop constraint checkout_sessions_accounts_quantity_check;
alter table public.checkout_sessions add constraint checkout_sessions_accounts_quantity_check check (accounts_quantity between 0 and 200);
alter table public.subscriptions drop constraint subscriptions_accounts_quantity_check;
alter table public.subscriptions add constraint subscriptions_accounts_quantity_check check (accounts_quantity between 1 and 200);
comment on column public.subscriptions.accounts_quantity is 'Projetos contratados (clientes ou marcas). Limita os projetos ativos.';

alter table public.plan_entitlements add column max_accounts_per_platform smallint not null default 1 check (max_accounts_per_platform between 1 and 50);
comment on column public.plan_entitlements.max_accounts_per_platform is 'Contas da mesma plataforma em cada projeto (Básico 1, Padrão 3).';

-- ---- projetos ---------------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (workspace_id, id)
);
comment on table public.projects is 'Projeto = cliente ou marca: agrupa contas de anúncio e dashboards. O plano limita os ativos (sem archived_at).';
create index projects_workspace_idx on public.projects (workspace_id, created_at) where archived_at is null;
create unique index projects_name_key on public.projects (workspace_id, lower(btrim(name))) where archived_at is null;
create index projects_created_by_idx on public.projects (created_by);

alter table public.projects enable row level security;
create policy "projects: membros leem" on public.projects for select to authenticated
  using (workspace_id in (select private.workspace_ids()));
create policy "projects: member cria" on public.projects for insert to authenticated
  with check (workspace_id in (select private.workspace_ids('member')));
create policy "projects: member edita" on public.projects for update to authenticated
  using (workspace_id in (select private.workspace_ids('member')))
  with check (workspace_id in (select private.workspace_ids('member')));
create policy "projects: admin apaga" on public.projects for delete to authenticated
  using (workspace_id in (select private.workspace_ids('admin')));
grant select, insert, update, delete on public.projects to authenticated;

create trigger projects_touch before update on public.projects for each row execute function private.touch_updated_at();
create trigger audit after insert or update or delete on public.projects for each row execute function private.audit_row_change('workspace_id', 'id');

alter table public.ad_accounts add column project_id uuid;
alter table public.ad_accounts add constraint ad_accounts_project_fk
  foreign key (workspace_id, project_id) references public.projects (workspace_id, id) on delete set null (project_id);
create index ad_accounts_project_idx on public.ad_accounts (workspace_id, project_id);
comment on column public.ad_accounts.project_id is 'Projeto (cliente) da conta. Conta ligada sempre tem projeto.';

alter table public.dashboards add column project_id uuid;
alter table public.dashboards add constraint dashboards_project_fk
  foreign key (workspace_id, project_id) references public.projects (workspace_id, id) on delete set null (project_id);
create index dashboards_project_idx on public.dashboards (workspace_id, project_id);
comment on column public.dashboards.project_id is 'Projeto (cliente) do dashboard; as contas de origem são do mesmo projeto.';

-- workspaces com contas ou dashboards ganham um primeiro projeto com o nome do workspace
insert into public.projects (workspace_id, name, created_by)
select w.id, left(btrim(w.name), 80), w.created_by
from public.workspaces w
where exists (select 1 from public.ad_accounts a where a.workspace_id = w.id)
   or exists (select 1 from public.dashboards d where d.workspace_id = w.id);
update public.ad_accounts a set project_id = p.id from public.projects p where p.workspace_id = a.workspace_id and a.project_id is null;
update public.dashboards d set project_id = p.id from public.projects p where p.workspace_id = d.workspace_id and d.project_id is null;

-- ---- limite de projetos -----------------------------------------------------------------------

create function private.enforce_project_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quantity integer;
  v_active integer;
begin
  if new.archived_at is not null or (tg_op = 'UPDATE' and old.archived_at is null) then
    return new;
  end if;
  perform private.require_active_plan(new.workspace_id, 'projects');
  select wp.accounts_quantity into v_quantity from private.workspace_plan(new.workspace_id) wp;
  select count(*) into v_active from public.projects p
  where p.workspace_id = new.workspace_id and p.archived_at is null and p.id <> new.id;
  if v_active + 1 > coalesce(v_quantity, 0) then
    raise exception using errcode = 'P0001', message = 'limit:projects',
      hint = format('Seu plano tem %s %s.', v_quantity, case when v_quantity = 1 then 'projeto' else 'projetos' end);
  end if;
  return new;
end;
$$;
create trigger projects_enforce_limit before insert or update of archived_at on public.projects
  for each row execute function private.enforce_project_limit();

-- projeto padrão do workspace: o mais antigo ativo; sem nenhum, cria um com o nome do workspace
create function private.default_project(p_workspace_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.projects
  where workspace_id = p_workspace_id and archived_at is null
  order by created_at limit 1;
  if v_id is null then
    insert into public.projects (workspace_id, name, created_by)
    select w.id, left(btrim(w.name), 80), (select auth.uid()) from public.workspaces w where w.id = p_workspace_id
    returning id into v_id;
  end if;
  return v_id;
end;
$$;
revoke all on function private.default_project(uuid) from public, anon, authenticated;

-- ---- contas: projeto, plataformas do plano e contas por plataforma no projeto ----------------

create or replace function private.enforce_ad_account_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.plan_entitlements%rowtype;
  v_unit text := private.billable_unit(new.platform_id, new.external_id, new.business_external_id);
  v_units integer;
  v_same boolean;
  v_platform_rank smallint;
  v_extra_platforms integer;
  v_above integer;
  v_moved boolean := tg_op = 'UPDATE' and old.is_enabled and new.business_external_id is distinct from old.business_external_id;
  v_reprojected boolean := tg_op = 'UPDATE' and old.is_enabled and new.project_id is distinct from old.project_id;
begin
  if not new.is_enabled or (tg_op = 'UPDATE' and old.is_enabled and not v_moved and not v_reprojected) then
    return new;
  end if;
  if new.status <> 'active' or new.connection_id is null then
    raise exception using errcode = 'P0001', message = 'account:not_connected', hint = 'Só contas conectadas e ativas podem ser ligadas.';
  end if;
  if v_moved and not coalesce((select wp.has_access from private.workspace_plan(new.workspace_id) wp), false) then
    new.is_enabled := false;
    new.enabled_at := null;
    return new;
  end if;

  e := private.require_active_plan(new.workspace_id, 'ad_accounts');

  if new.project_id is null then
    new.project_id := private.default_project(new.workspace_id);
  end if;

  -- plataforma acima do plano: só com plataforma extra contratada (uma por unidade)
  select p.rank into v_platform_rank
  from public.platforms pl join public.plans p on p.id = pl.min_plan_id
  where pl.id = new.platform_id;
  if v_platform_rank > private.plan_rank(e.plan_id) then
    select coalesce(sum(si.quantity), 0) into v_extra_platforms
    from public.subscriptions s
    join public.subscription_items si on si.subscription_id = s.id
    where s.workspace_id = new.workspace_id and s.status in ('active', 'trialing', 'past_due') and si.billing_item_id = 'platform_extra';
    select count(distinct a.platform_id) into v_above
    from public.ad_accounts a
    join public.platforms pl on pl.id = a.platform_id
    join public.plans p on p.id = pl.min_plan_id
    where a.workspace_id = new.workspace_id and a.is_enabled and a.id <> new.id and a.platform_id <> new.platform_id
      and p.rank > private.plan_rank(e.plan_id);
    if v_above + 1 > v_extra_platforms then
      raise exception using errcode = 'P0001', message = 'plan:platform', hint = 'Esta plataforma é de um plano acima do seu. No Básico, contrate a plataforma extra.';
    end if;
  end if;

  -- contas da mesma plataforma neste projeto
  select count(distinct u.unit), coalesce(bool_or(u.unit = v_unit), false)
    into v_units, v_same
  from (
    select private.billable_unit(a.platform_id, a.external_id, a.business_external_id) as unit
    from public.ad_accounts a
    where a.workspace_id = new.workspace_id and a.project_id = new.project_id and a.platform_id = new.platform_id
      and a.is_enabled and a.id <> new.id
  ) u;
  if not v_same then
    v_units := v_units + 1;
  end if;
  if v_units > e.max_accounts_per_platform then
    if v_moved then
      new.is_enabled := false;
      new.enabled_at := null;
      return new;
    end if;
    raise exception using errcode = 'P0001', message = 'limit:accounts',
      hint = format('Seu plano permite %s %s de cada plataforma por projeto.', e.max_accounts_per_platform,
        case when e.max_accounts_per_platform = 1 then 'conta' else 'contas' end);
  end if;
  return new;
end;
$$;

drop trigger if exists ad_accounts_enforce_rules on public.ad_accounts;
create trigger ad_accounts_enforce_rules before insert or update of is_enabled, business_external_id, project_id on public.ad_accounts
  for each row execute function private.enforce_ad_account_rules();

-- ---- dashboards: projeto e contas do mesmo projeto -------------------------------------------

create function private.dashboard_default_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.project_id is null then
    new.project_id := private.default_project(new.workspace_id);
  end if;
  return new;
end;
$$;
create trigger dashboards_default_project before insert on public.dashboards
  for each row execute function private.dashboard_default_project();

create function private.check_dashboard_source_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_project uuid;
begin
  select a.project_id into v_account_project from public.ad_accounts a where a.id = new.ad_account_id;
  -- primeira conta do dashboard: ele passa a ser do projeto dela
  if not exists (
    select 1 from public.dashboard_sources s where s.dashboard_id = new.dashboard_id and s.ad_account_id <> new.ad_account_id
  ) then
    update public.dashboards set project_id = v_account_project
    where id = new.dashboard_id and project_id is distinct from v_account_project and v_account_project is not null;
    return new;
  end if;
  if exists (
    select 1 from public.dashboards d
    where d.id = new.dashboard_id and d.project_id is not null and v_account_project is distinct from d.project_id
  ) then
    raise exception using errcode = 'P0001', message = 'dashboard:source_project', hint = 'A conta é de outro projeto.';
  end if;
  return new;
end;
$$;
create trigger dashboard_sources_same_project before insert or update on public.dashboard_sources
  for each row execute function private.check_dashboard_source_project();

-- ---- uso: projetos ativos ---------------------------------------------------------------------

create or replace view public.workspace_usage
with (security_invoker = true)
as
select
  w.id as workspace_id,
  (select count(*) from public.dashboards d where d.workspace_id = w.id)::integer as dashboards,
  (select count(*) from public.landing_pages l where l.workspace_id = w.id)::integer as landing_pages,
  (select count(*) from public.landing_pages l where l.workspace_id = w.id and l.status = 'published')::integer as published_landing_pages,
  (select count(*) from public.ad_accounts a where a.workspace_id = w.id and a.is_enabled)::integer as enabled_ad_accounts,
  (
    select count(distinct private.billable_unit(a.platform_id, a.external_id, a.business_external_id))
    from public.ad_accounts a
    where a.workspace_id = w.id and a.is_enabled
  )::integer as billable_accounts,
  (select count(*) from public.connections c where c.workspace_id = w.id and c.status = 'active')::integer as active_connections,
  (select count(*) from public.projects p where p.workspace_id = w.id and p.archived_at is null)::integer as projects
from public.workspaces w;
comment on view public.workspace_usage is 'Quanto do plano está em uso: dashboards, LPs publicadas, contas ligadas e projetos ativos (projects).';

-- ---- troca de plano: o uso que precisa caber agora é de projetos -----------------------------

create or replace function public.change_subscription(
  p_subscription_id uuid,
  p_plan_id text,
  p_interval public.billing_interval,
  p_accounts integer,
  p_plan_amount_cents bigint,
  p_period_start timestamptz default null,
  p_period_end timestamptz default null,
  p_invoice jsonb default null,
  p_payment jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.subscriptions%rowtype;
  pp public.plan_prices%rowtype;
  e public.plan_entitlements%rowtype;
  v_price_id text := p_plan_id || '_' || p_interval;
  v_invoice uuid;
  v_amount bigint;
  v_projects integer;
  v_rank smallint;
begin
  select * into s from public.subscriptions where id = p_subscription_id for update;
  if not found or s.status not in ('active', 'trialing', 'past_due') then
    raise exception using errcode = 'P0001', message = 'plan:inactive';
  end if;
  if p_accounts is null or p_accounts < 1 or p_accounts > 200 then
    raise exception using errcode = 'P0001', message = 'checkout:invalid_order', hint = 'De 3 a 200 projetos.';
  end if;

  select * into pp from public.plan_prices where id = v_price_id and is_active;
  if not found or pp.plan_id <> p_plan_id
     or p_plan_amount_cents <> pp.first_account_cents + pp.extra_account_cents * (p_accounts - 1) + pp.addon_cents then
    raise exception using errcode = 'P0001', message = 'checkout:invalid_order', hint = 'O valor do plano não confere com o catálogo.';
  end if;

  -- o uso precisa caber no plano novo (projetos, dashboards, LPs e plataformas)
  perform pg_advisory_xact_lock(hashtextextended('vyz:ad_accounts:' || s.workspace_id::text, 0));
  select * into e from public.plan_entitlements where plan_id = p_plan_id;
  select p.rank into v_rank from public.plans p where p.id = p_plan_id;
  select count(*) into v_projects from public.projects p where p.workspace_id = s.workspace_id and p.archived_at is null;
  if v_projects > p_accounts then
    raise exception using errcode = 'P0001', message = 'limit:projects_in_use',
      hint = format('Há %s projetos ativos; o novo plano tem %s.', v_projects, p_accounts);
  end if;
  if (select count(*) from public.dashboards d where d.workspace_id = s.workspace_id) > e.max_dashboards then
    raise exception using errcode = 'P0001', message = 'limit:dashboards_in_use',
      hint = format('O novo plano permite até %s dashboards.', e.max_dashboards);
  end if;
  if (select count(*) from public.landing_pages l where l.workspace_id = s.workspace_id and l.status = 'published') > e.max_landing_pages then
    raise exception using errcode = 'P0001', message = 'limit:landing_pages_in_use',
      hint = format('O novo plano permite até %s landing pages publicadas.', e.max_landing_pages);
  end if;
  if exists (
    select 1 from public.ad_accounts a
    join public.platforms pl on pl.id = a.platform_id
    join public.plans mp on mp.id = pl.min_plan_id
    where a.workspace_id = s.workspace_id and a.is_enabled and mp.rank > v_rank
  ) and not exists (
    select 1 from public.subscription_items si where si.subscription_id = s.id and si.billing_item_id = 'platform_extra'
  ) then
    raise exception using errcode = 'P0001', message = 'plan:platform_in_use';
  end if;

  update public.subscriptions
     set plan_id = p_plan_id,
         interval = p_interval,
         accounts_quantity = p_accounts,
         current_period_start = coalesce(p_period_start, current_period_start),
         current_period_end = coalesce(p_period_end, current_period_end)
   where id = s.id;

  update public.subscription_items
     set plan_price_id = v_price_id, quantity = p_accounts, amount_cents = p_plan_amount_cents
   where subscription_id = s.id and plan_price_id is not null;
  if not found then
    insert into public.subscription_items (workspace_id, subscription_id, plan_price_id, quantity, amount_cents)
    values (s.workspace_id, s.id, v_price_id, p_accounts, p_plan_amount_cents);
  end if;

  if p_invoice is not null then
    v_amount := (p_invoice ->> 'amount_cents')::bigint;
    if v_amount is null or v_amount <= 0 then
      raise exception using errcode = 'P0001', message = 'checkout:invalid_order', hint = 'Valor da cobrança inválido.';
    end if;
    insert into public.invoices (
      workspace_id, subscription_id, provider, provider_invoice_id, status, currency,
      subtotal_cents, total_cents, amount_paid_cents, description, lines, period_start, period_end, paid_at
    ) values (
      s.workspace_id, s.id, s.provider, nullif(p_invoice ->> 'provider_invoice_id', ''), 'paid', 'BRL',
      v_amount, v_amount, v_amount, coalesce(nullif(p_invoice ->> 'description', ''), 'Troca de plano'),
      jsonb_build_array(jsonb_build_object('label', coalesce(p_invoice ->> 'label', 'Ajuste proporcional'), 'kind', 'proration', 'quantity', 1, 'amount_cents', v_amount)),
      now(), coalesce(p_period_end, s.current_period_end), now()
    )
    returning id into v_invoice;

    insert into public.payment_transactions (
      workspace_id, invoice_id, provider, provider_payment_id, kind, status, amount_cents, currency,
      method, card_brand, card_last4, processed_at
    ) values (
      s.workspace_id, v_invoice, s.provider, nullif(p_payment ->> 'provider_payment_id', ''), 'charge', 'succeeded', v_amount, 'BRL',
      nullif(p_payment ->> 'method', ''), nullif(p_payment ->> 'card_brand', ''), nullif(p_payment ->> 'card_last4', ''), now()
    );
  end if;

  return v_invoice;
end;
$$;

-- ---- quem pode mover conta e dashboard de projeto --------------------------------------------

grant update (project_id) on public.ad_accounts to authenticated;
grant insert (project_id), update (project_id) on public.dashboards to authenticated;
