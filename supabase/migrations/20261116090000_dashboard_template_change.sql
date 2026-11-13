-- Trocar o modelo de um dashboard que já existe (página Dashboards e o aviso do primeiro
-- acesso). Até aqui o template_id só era gravado na criação: quem edita não tinha permissão
-- na coluna. Agora pode trocar, com a mesma regra da criação: o modelo precisa estar ativo e
-- caber no plano do workspace. Contas, metas, métricas e o resto do dashboard ficam.

create or replace function private.enforce_dashboard_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.plan_entitlements%rowtype;
  v_count integer;
  v_template_rank smallint;
  v_template_changed boolean := tg_op = 'UPDATE' and new.template_id is distinct from old.template_id;
begin
  if tg_op = 'UPDATE' and not v_template_changed and not (
       (new.hide_vyz_brand and not old.hide_vyz_brand)
    or (new.brand_color is not null and new.brand_color is distinct from old.brand_color)
    or (new.brand_logo_path is not null and new.brand_logo_path is distinct from old.brand_logo_path)
  ) then
    return new;
  end if;

  e := private.require_active_plan(new.workspace_id, 'dashboards');

  if tg_op = 'INSERT' then
    select count(*) into v_count from public.dashboards d where d.workspace_id = new.workspace_id;
    if v_count >= e.max_dashboards then
      raise exception using errcode = 'P0001', message = 'limit:dashboards',
        hint = format('Seu plano permite até %s dashboards.', e.max_dashboards);
    end if;
  end if;

  -- modelo novo (na criação ou na troca): ativo e dentro do plano
  if tg_op = 'INSERT' or v_template_changed then
    select p.rank into v_template_rank
    from public.dashboard_templates t join public.plans p on p.id = t.min_plan_id
    where t.id = new.template_id and t.is_active;
    if v_template_rank is null then
      raise exception using errcode = 'P0001', message = 'dashboard:template_unavailable';
    end if;
    if v_template_rank > private.plan_rank(e.plan_id) then
      raise exception using errcode = 'P0001', message = 'plan:template', hint = 'Este template é de um plano acima do seu.';
    end if;
  end if;

  if (new.hide_vyz_brand or new.brand_color is not null or new.brand_logo_path is not null) and not e.white_label then
    raise exception using errcode = 'P0001', message = 'plan:white_label', hint = 'Marca própria é do plano Personalizado.';
  end if;
  return new;
end;
$$;

-- o gatilho passa a olhar também a troca de modelo
drop trigger if exists dashboards_enforce_rules on public.dashboards;
create trigger dashboards_enforce_rules
  before insert or update of hide_vyz_brand, brand_color, brand_logo_path, template_id on public.dashboards
  for each row execute function private.enforce_dashboard_rules();

-- quem edita o dashboard (RLS de update já exige member+) pode trocar o modelo
grant update (template_id) on public.dashboards to authenticated;
