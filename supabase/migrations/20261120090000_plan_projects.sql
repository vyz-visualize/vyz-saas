-- Limite de workspaces (no banco, "projects") por plano no catálogo: Básico 3,
-- Padrão 5 e Avançado com teto interno de 30 (no site, "+5 workspaces").
--
-- Antes, o limite vinha só de subscriptions.accounts_quantity (5, 15 e 30, gravado
-- na compra). Agora o plano também tem o seu teto (plan_entitlements.max_projects)
-- e o gatilho usa o menor dos dois. Personalizado e landing pages ficam com 200:
-- para eles quem manda continua sendo accounts_quantity (o que foi contratado).
--
-- Assinaturas ativas dos planos de dashboard passam para o número novo (ninguém
-- hoje tem mais workspaces ativos do que o novo limite; quem tiver no futuro
-- continua com os que já tem, só não cria nem desarquiva acima do limite).
-- No Avançado, a mensagem do limite não traz o número.

alter table public.plan_entitlements
  add column max_projects smallint not null default 200 check (max_projects between 1 and 200);

comment on column public.plan_entitlements.max_projects is
  'Teto de workspaces (projects ativos) do plano. O limite efetivo é least(subscriptions.accounts_quantity, max_projects).';

update public.plan_entitlements set max_projects = case plan_id
  when 'base' then 3
  when 'pro' then 5
  when 'avancado' then 30
  else 200
end;

-- assinaturas vigentes dos planos de dashboard: a quantidade passa a ser a do plano
update public.subscriptions s
set accounts_quantity = case s.plan_id when 'base' then 3 when 'pro' then 5 else 30 end
where s.plan_id in ('base', 'pro', 'avancado')
  and s.status in ('active', 'trialing', 'past_due')
  and s.accounts_quantity is distinct from (case s.plan_id when 'base' then 3 when 'pro' then 5 else 30 end);

create or replace function private.enforce_project_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.plan_entitlements%rowtype;
  v_quantity integer;
  v_limit integer;
  v_active integer;
begin
  if new.archived_at is not null or (tg_op = 'UPDATE' and old.archived_at is null) then
    return new;
  end if;
  e := private.require_active_plan(new.workspace_id, 'projects');
  select wp.accounts_quantity into v_quantity from private.workspace_plan(new.workspace_id) wp;
  v_limit := least(coalesce(v_quantity, 0), coalesce(e.max_projects, 200));
  select count(*) into v_active from public.projects p
  where p.workspace_id = new.workspace_id and p.archived_at is null and p.id <> new.id;
  if v_active + 1 > v_limit then
    -- o Avançado não mostra o teto interno (no site, "+5 workspaces")
    if e.plan_id = 'avancado' then
      raise exception using errcode = 'P0001', message = 'limit:projects',
        hint = 'Você chegou ao limite do seu plano. Fale com a gente para ampliar.';
    end if;
    raise exception using errcode = 'P0001', message = 'limit:projects',
      hint = format('Seu plano tem até %s %s.', v_limit, case when v_limit = 1 then 'workspace' else 'workspaces' end);
  end if;
  return new;
end;
$$;
