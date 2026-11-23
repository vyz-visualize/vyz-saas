-- Carga do histórico do MMM: ritmo novo (docs/MMM.md).
--
-- mmm_claim_backfill passa a:
--   * pegar os meses MAIS ANTIGOS primeiro (a Meta só guarda 37 meses: o mais velho sai primeiro);
--   * entregar no máximo um trabalho por conta em cada chamada, e nenhum de conta que já tem
--     trabalho rodando (os paralelos são sempre de contas diferentes);
--   * ter a fase 'pedir': só trabalhos da Meta ainda sem relatório pedido, com no máximo 3
--     relatórios esperando por conta (a rodada pede vários relatórios assíncronos de uma vez e
--     baixa nas rodadas seguintes);
--   * esperar 20 s antes de devolver um relatório da Meta que ainda estava processando (não
--     consulta o mesmo relatório sem parar dentro da rodada).
--
-- A assinatura ganha p_fase (padrão 'tudo'): a chamada antiga, só com p_limit, continua valendo.
-- Nada muda nos dados: a fila, os status e as tentativas ficam como estão.

drop function public.mmm_claim_backfill(integer);

create function public.mmm_claim_backfill(p_limit integer default 3, p_fase text default 'tudo')
returns table (id bigint, workspace_id uuid, ad_account_id uuid, platform_id text, mes date, status text, tentativas smallint, report_run_id text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_fase not in ('tudo', 'pedir') then
    raise exception using errcode = 'P0001', message = 'mmm:fase_invalida';
  end if;
  if not (select ativo from mmm.backfill_control where backfill_control.id) then
    return;
  end if;
  return query
  with elegiveis as (
    select j.id, j.ad_account_id, j.status, j.mes
    from mmm.backfill_jobs j
    where (
        j.status = 'pendente'
        or (j.status = 'aguardando' and j.updated_at < now() - interval '20 seconds')
        or (j.status = 'erro' and j.tentativas < 5)
        or (j.status = 'rodando' and j.updated_at < now() - interval '30 minutes')
      )
      -- conta com trabalho rodando agora fica de fora: paralelo só entre contas diferentes
      and not exists (
        select 1 from mmm.backfill_jobs r
        where r.ad_account_id = j.ad_account_id and r.status = 'rodando' and r.updated_at >= now() - interval '30 minutes'
      )
      and (
        p_fase = 'tudo'
        or (
          j.platform_id = 'meta' and j.status = 'pendente' and j.report_run_id is null
          and (select count(*) from mmm.backfill_jobs k where k.ad_account_id = j.ad_account_id and k.status = 'aguardando') < 3
        )
      )
  ),
  um_por_conta as (
    -- relatório esperando primeiro (termina mais rápido); depois o mês mais antigo
    select distinct on (e.ad_account_id) e.id, e.status, e.mes
    from elegiveis e
    order by e.ad_account_id, (e.status = 'aguardando') desc, e.mes asc, e.id
  ),
  ordem as (
    select u.id from um_por_conta u
    order by (u.status = 'aguardando') desc, u.mes asc, u.id
    limit least(greatest(p_limit, 1), 20)
  ),
  travados as (
    select j.id from mmm.backfill_jobs j
    where j.id in (select o.id from ordem o)
    for update skip locked
  )
  update mmm.backfill_jobs j
     set status = 'rodando', tentativas = j.tentativas + 1, iniciado_em = coalesce(j.iniciado_em, now()), updated_at = now()
    from travados t
   where j.id = t.id
  returning j.id, j.workspace_id, j.ad_account_id, j.platform_id, j.mes, j.status, j.tentativas, j.report_run_id;
end;
$$;

revoke all on function public.mmm_claim_backfill(integer, text) from public, anon, authenticated;
grant execute on function public.mmm_claim_backfill(integer, text) to service_role;
