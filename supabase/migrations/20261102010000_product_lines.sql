-- =============================================================================
-- VYZ · 16 · Linhas de produto: SaaS de dashboards (dash) e SaaS de landing pages (lp)
--   plans.product                 de onde tudo sai (lp_base, lp_pro, lp_avancado = lp)
--   checkout_sessions.product     caminho escolhido na página de preços
--   subscriptions.product         copiado do plano (trigger)
--   workspaces.product            o lado da plataforma do workspace (trigger)
--   profiles.product              último caminho do usuário (trigger), para rotear
--   product_events                histórico de quem entrou em qual produto, e quando
-- Troca de plano só dentro do mesmo produto.
-- =============================================================================

create type public.product_line as enum ('dash', 'lp');

alter table public.plans add column product public.product_line not null default 'dash';
comment on column public.plans.product is 'Linha de produto do plano: dash (dashboards) ou lp (landing pages).';

alter table public.checkout_sessions add column product public.product_line not null default 'dash';
alter table public.subscriptions add column product public.product_line not null default 'dash';
alter table public.workspaces add column product public.product_line not null default 'dash';
alter table public.profiles add column product public.product_line;
comment on column public.checkout_sessions.product is 'Caminho escolhido na página de preços.';
comment on column public.subscriptions.product is 'Copiado de plans.product na criação. Não muda.';
comment on column public.workspaces.product is 'Lado da plataforma (dash.vyzualize.com.br ou lps.vyzualize.com.br).';
comment on column public.profiles.product is 'Último produto em que o usuário entrou. null = ainda não escolheu.';

create index workspaces_product_idx on public.workspaces (product);
create index subscriptions_product_idx on public.subscriptions (product);

-- histórico (só cresce): cada vez que um usuário entra num produto
create table public.product_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  product public.product_line not null,
  source text not null check (source in ('checkout', 'store', 'plan_change', 'manual')),
  checkout_session_id uuid references public.checkout_sessions (id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table public.product_events is 'Histórico do caminho do usuário entre os produtos (dash / lp). Só cresce.';
create index product_events_user_idx on public.product_events (user_id, created_at desc);
create index product_events_workspace_idx on public.product_events (workspace_id);
alter table public.product_events enable row level security;
create policy product_events_select_own on public.product_events
  for select to authenticated using (user_id = (select auth.uid()));
grant select on public.product_events to authenticated;
revoke update, delete on public.product_events from service_role;

-- ---- checkout: o produto tem de bater com o plano -----------------------------------------------

create function private.checkout_product_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.plan_id is not null then
    select p.product into strict new.product from public.plans p where p.id = new.plan_id;
  end if;
  return new;
end;
$$;
revoke all on function private.checkout_product_guard() from public;
create trigger checkout_product_guard before insert or update of plan_id, product on public.checkout_sessions
  for each row execute function private.checkout_product_guard();

-- ---- assinatura: produto vem do plano; troca só dentro do produto -----------------------------

create function private.subscription_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.product_line;
begin
  select p.product into strict v_product from public.plans p where p.id = new.plan_id;
  if tg_op = 'UPDATE' and v_product <> old.product then
    raise exception using errcode = 'P0001', message = 'plan:product_mismatch',
      hint = 'Dashboards e landing pages são produtos separados. Troque para um plano do mesmo produto.';
  end if;
  new.product := v_product;
  return new;
end;
$$;
revoke all on function private.subscription_product() from public;
create trigger subscription_product before insert or update of plan_id on public.subscriptions
  for each row execute function private.subscription_product();

-- workspace herda o produto da assinatura; o dono passa a esse caminho
create function private.subscription_routes_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  update public.workspaces w set product = new.product
    where w.id = new.workspace_id and w.product is distinct from new.product;
  -- landing pages não têm o onboarding de contas: começa direto no template
  if new.product = 'lp' then
    update public.workspaces w set onboarding_step = 'done', onboarding_completed_at = coalesce(w.onboarding_completed_at, now())
      where w.id = new.workspace_id and w.onboarding_step <> 'done';
  end if;
  select m.user_id into v_owner from public.workspace_members m
    where m.workspace_id = new.workspace_id and m.role = 'owner' order by m.created_at limit 1;
  if v_owner is not null then
    update public.profiles set product = new.product where id = v_owner and product is distinct from new.product;
    insert into public.product_events (user_id, workspace_id, product, source, checkout_session_id)
    values (
      v_owner, new.workspace_id, new.product,
      case when new.provider in ('app_store', 'play_store') then 'store' when new.checkout_session_id is not null then 'checkout' else 'manual' end,
      new.checkout_session_id
    );
  end if;
  return null;
end;
$$;
revoke all on function private.subscription_routes_workspace() from public;
create trigger subscription_routes_workspace after insert on public.subscriptions
  for each row execute function private.subscription_routes_workspace();

-- checkout aberto já registra o caminho escolhido (antes do pagamento)
create function private.checkout_routes_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null then
    update public.profiles set product = new.product where id = new.user_id and product is null;
  end if;
  return null;
end;
$$;
revoke all on function private.checkout_routes_profile() from public;
create trigger checkout_routes_profile after insert on public.checkout_sessions
  for each row execute function private.checkout_routes_profile();

-- dados atuais: tudo o que existe é dashboard
update public.profiles p set product = 'dash'
  where p.product is null and exists (select 1 from public.workspace_members m where m.user_id = p.id);

-- ---- acesso: o produto aparece no workspace_access ------------------------------------------

create or replace view public.workspace_access
with (security_invoker = true)
as
select
  w.id as workspace_id,
  s.id as subscription_id,
  s.plan_id,
  s.status as subscription_status,
  s.interval,
  coalesce(s.accounts_quantity, 0)::integer as accounts_quantity,
  s.current_period_end,
  coalesce(s.cancel_at_period_end, false) as cancel_at_period_end,
  coalesce(s.status in ('active', 'trialing', 'past_due'), false) as has_access,
  e.dashboard_templates,
  e.landing_templates,
  e.platforms,
  e.pages_plan_id,
  e.white_label,
  e.audio,
  e.custom_dashboards,
  e.agent_chat,
  e.agent_voice,
  e.max_dashboards,
  e.max_landing_pages,
  (w.hide_vyz_brand and coalesce(e.white_label, false) and coalesce(s.status in ('active', 'trialing', 'past_due'), false)) as hide_vyz_brand_effective,
  coalesce(e.max_members, 1) as max_members,
  s.provider,
  w.product
from public.workspaces w
left join lateral (
  select sub.*
  from public.subscriptions sub
  where sub.workspace_id = w.id and sub.status not in ('canceled', 'incomplete_expired')
  order by sub.created_at desc
  limit 1
) s on true
left join public.plan_entitlements e on e.plan_id = s.plan_id;
grant select on public.workspace_access to authenticated;

-- colunas novas legíveis pelo próprio usuário (grants por coluna do hardening)
grant select (product) on public.workspaces to authenticated;
grant select (product) on public.profiles to authenticated;
grant select (product) on public.subscriptions to authenticated;
grant select (product) on public.checkout_sessions to authenticated;
