-- Importação por planilha (CSV ou Google Sheets) para as plataformas sem API
-- (Shopee, Spotify, Globo, ChatGPT Ads). A conta de planilha não tem conexão
-- (OAuth): fica ativa com metadata.source = 'import' e conta no limite do plano
-- como qualquer outra (o gatilho do plano continua valendo para ela).
--
-- Segurança: quem está logado só cadastra conta com status 'pending' e não
-- consegue mudar o status (sem grant de update nessa coluna). Só o servidor
-- (chave de serviço, depois de conferir o papel de admin) cria a conta de
-- planilha já ativa. Marcar metadata.source = 'import' numa conta pendente
-- não ativa nada.

-- 1. A regra da tabela: conta ativa precisa de conexão OU ser de planilha.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.ad_accounts'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%connection_id is not null%'
  loop
    execute format('alter table public.ad_accounts drop constraint %I', c.conname);
  end loop;
end;
$$;

alter table public.ad_accounts
  add constraint ad_accounts_enabled_needs_source
  -- coalesce: sem a chave, a comparação daria NULL e a regra passaria
  check (not is_enabled or (status = 'active' and (connection_id is not null or coalesce(metadata ->> 'source', '') = 'import')));

comment on table public.ad_accounts is 'Contas de anúncio/propriedades vistas pelas conexões, cadastradas à mão (status pending) ou alimentadas por planilha (metadata.source = import, sem conexão). is_enabled = conta ativa no VYZ (entra no limite do plano).';

-- 2. O gatilho do plano: mesma função de 20261105010000_projects.sql, aceitando a conta de planilha sem conexão.
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
  -- conta de planilha (metadata.source = 'import') não tem conexão: os dados entram por arquivo ou link
  if new.status <> 'active' or (new.connection_id is null and coalesce(new.metadata ->> 'source', '') <> 'import') then
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
