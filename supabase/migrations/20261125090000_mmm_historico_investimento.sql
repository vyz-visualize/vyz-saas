-- Histórico de investimento do MMM por conta e mês (tela "MMM em construção").
--
-- O schema mmm não fica na API: o servidor lê por funções public.mmm_*. Esta só lê: por conta e
-- mês, o investimento (em reais quando a conta é de outra moeda), os dias com gasto e a soma dos
-- quadrados do gasto diário (para medir se a verba varia, sem mandar cada dia). Execução só para o
-- service_role; quem chama já conferiu que a pessoa pode ver o dashboard dessas contas.

create function public.mmm_historico_investimento(p_ad_account_ids uuid[])
returns table (ad_account_id uuid, platform_id text, mes date, investimento numeric, dias_com_gasto integer, soma_quadrados numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with por_dia as (
    select m.ad_account_id, m.platform_id, m.date, sum(coalesce(m.spend_brl, m.spend)) as gasto
    from mmm.media_daily m
    where m.ad_account_id = any (p_ad_account_ids)
    group by m.ad_account_id, m.platform_id, m.date
  )
  select d.ad_account_id, d.platform_id, date_trunc('month', d.date)::date as mes,
         sum(d.gasto) as investimento,
         count(*) filter (where d.gasto > 0)::integer as dias_com_gasto,
         sum(d.gasto * d.gasto) as soma_quadrados
  from por_dia d
  group by d.ad_account_id, d.platform_id, date_trunc('month', d.date)
  order by 1, 3;
$$;

revoke all on function public.mmm_historico_investimento(uuid[]) from public, anon, authenticated;
grant execute on function public.mmm_historico_investimento(uuid[]) to service_role;
