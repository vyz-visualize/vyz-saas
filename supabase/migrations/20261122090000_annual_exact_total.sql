-- =============================================================================
-- Anual com total exato (R$ 499,90, R$ 1.499,90 e R$ 2.999,90, iguais aos das lojas)
--
-- O preço anual passou a ser o total do ano, que não divide por 12. O catálogo e os itens
-- continuam guardando o valor por mês (plan_prices.first_account_cents e checkout_items),
-- agora arredondado (R$ 41,66), e a cobrança do anual (recurring_cents) é o total exato.
-- fulfill_checkout muda só em dois pontos:
--   - a conferência do pedido aceita no anual a diferença desse arredondamento (menos de 12
--     centavos no ano); no mensal continua exata;
--   - na fatura, a linha do plano anual leva o total exato do ano.
-- O resto da função é o de 20261030010000_hardening.sql, sem mudança.
-- =============================================================================

create or replace function public.fulfill_checkout(
  p_checkout_id uuid,
  p_provider_customer_id text,
  p_provider_subscription_id text default null,
  p_provider_invoice_id text default null,
  p_payment jsonb default '{}'::jsonb,
  p_period_start timestamptz default now(),
  p_period_end timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.checkout_sessions%rowtype;
  v_ws uuid;
  v_sub uuid;
  v_invoice uuid;
  v_end timestamptz;
  v_months integer;
  v_recurring bigint;
  v_once bigint;
  v_plan_lines integer;
  v_bad integer;
begin
  select * into c from public.checkout_sessions where id = p_checkout_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'checkout:not_found';
  end if;
  if c.status = 'completed' then
    return c.workspace_id;
  end if;
  if c.status <> 'open' then
    raise exception using errcode = 'P0001', message = 'checkout:not_open';
  end if;
  if c.user_id is null then
    raise exception using errcode = 'P0001', message = 'checkout:no_user';
  end if;

  v_months := case c.interval when 'year' then 12 else 1 end;
  select
    coalesce(sum(i.amount_cents) filter (where i.kind = 'recurring'), 0),
    coalesce(sum(i.amount_cents) filter (where i.kind = 'one_time'), 0),
    count(*) filter (where i.plan_price_id is not null),
    count(*) filter (where
         (i.kind = 'recurring' and c.plan_id is null)
      or (i.plan_price_id is not null and (
            pp.plan_id is distinct from c.plan_id or pp.interval is distinct from c.interval
            or i.quantity <> c.accounts_quantity
            or i.amount_cents <> pp.first_account_cents + pp.extra_account_cents * (i.quantity - 1) + pp.addon_cents))
      or (i.billing_item_id is not null and (bi.kind is distinct from i.kind or i.amount_cents <> bi.unit_cents * i.quantity)))
  into v_recurring, v_once, v_plan_lines, v_bad
  from public.checkout_items i
  left join public.plan_prices pp on pp.id = i.plan_price_id
  left join public.billing_items bi on bi.id = i.billing_item_id
  where i.checkout_session_id = c.id;
  if v_bad > 0
     or v_plan_lines <> (case when c.plan_id is null then 0 else 1 end)
     or (c.plan_id is null and v_once = 0)
     -- no anual, o item do plano guarda o preço por mês arredondado (R$ 41,66) e a cobrança é o
     -- total exato do ano (R$ 499,90): aceita só a diferença desse arredondamento (menos de 1
     -- centavo por mês); no mensal, tem de bater exato
     or abs(c.recurring_cents - v_recurring * v_months) >= v_months
     or c.amount_due_now_cents <> c.recurring_cents + v_once then
    raise exception using errcode = 'P0001', message = 'checkout:invalid_order', hint = 'O pedido não fecha com os itens. Monte o pedido de novo.';
  end if;

  if c.workspace_id is not null then
    if not exists (
      select 1 from public.workspace_members m
      where m.workspace_id = c.workspace_id and m.user_id = c.user_id and m.role = 'owner'
    ) then
      raise exception using errcode = 'P0001', message = 'checkout:not_owner';
    end if;
    v_ws := c.workspace_id;
    -- dois checkouts do mesmo workspace não concluem ao mesmo tempo
    perform pg_advisory_xact_lock(hashtextextended('vyz:checkout:' || v_ws::text, 0));
    if c.plan_id is not null and exists (
      select 1 from public.subscriptions s
      where s.workspace_id = v_ws and s.status in ('active', 'trialing', 'past_due')
    ) then
      raise exception using errcode = 'P0001', message = 'checkout:already_subscribed',
        hint = 'Este workspace já tem uma assinatura ativa. Troque o plano em Plano.';
    end if;
  else
    insert into public.workspaces (name, slug, business_type_id, created_by)
    values (btrim(c.company_name), private.unique_workspace_slug(c.company_name), c.business_type_id, c.user_id)
    returning id into v_ws;
    insert into public.workspace_members (workspace_id, user_id, role) values (v_ws, c.user_id, 'owner');
    update public.profiles set default_workspace_id = v_ws where id = c.user_id and default_workspace_id is null;
  end if;

  if exists (
    select 1 from public.billing_customers b
    where b.provider = c.provider and b.provider_customer_id = p_provider_customer_id and b.workspace_id <> v_ws
  ) then
    raise exception using errcode = 'P0001', message = 'billing:customer_in_use', hint = 'Este cliente do provedor já é de outro workspace.';
  end if;
  insert into public.billing_customers (workspace_id, provider, provider_customer_id, email, legal_name, tax_id, phone)
  values (v_ws, c.provider, p_provider_customer_id, c.email, btrim(c.company_name), c.tax_id, c.phone)
  on conflict (workspace_id) do update set
    provider = excluded.provider,
    provider_customer_id = excluded.provider_customer_id,
    email = excluded.email,
    legal_name = coalesce(excluded.legal_name, public.billing_customers.legal_name),
    tax_id = coalesce(excluded.tax_id, public.billing_customers.tax_id),
    phone = coalesce(excluded.phone, public.billing_customers.phone);

  if c.plan_id is not null then
    -- assinatura sem acesso (unpaid, paused, incomplete) é substituída
    update public.subscriptions
      set status = 'canceled', canceled_at = now(), ended_at = now()
      where workspace_id = v_ws and status not in ('canceled', 'incomplete_expired');

    v_end := coalesce(p_period_end, p_period_start + case c.interval when 'year' then interval '1 year' else interval '1 month' end);
    insert into public.subscriptions (
      workspace_id, plan_id, status, interval, accounts_quantity, provider,
      provider_subscription_id, checkout_session_id, current_period_start, current_period_end
    ) values (
      v_ws, c.plan_id, 'active', c.interval, c.accounts_quantity, c.provider,
      p_provider_subscription_id, c.id, p_period_start, v_end
    )
    returning id into v_sub;

    insert into public.subscription_items (workspace_id, subscription_id, plan_price_id, billing_item_id, quantity, amount_cents)
    select v_ws, v_sub, i.plan_price_id, i.billing_item_id, i.quantity, i.amount_cents
    from public.checkout_items i
    where i.checkout_session_id = c.id and i.kind = 'recurring'
    order by i.position;
  end if;

  insert into public.service_orders (workspace_id, checkout_session_id, billing_item_id, quantity)
  select v_ws, c.id, i.billing_item_id, i.quantity
  from public.checkout_items i
  where i.checkout_session_id = c.id and i.kind = 'one_time'
  order by i.position;

  insert into public.invoices (
    workspace_id, subscription_id, checkout_session_id, provider, provider_invoice_id, status,
    currency, subtotal_cents, total_cents, amount_paid_cents, description, lines,
    period_start, period_end, paid_at
  ) values (
    v_ws, v_sub, c.id, c.provider, p_provider_invoice_id, 'paid',
    c.currency, c.amount_due_now_cents, c.amount_due_now_cents, c.amount_due_now_cents,
    case when c.plan_id is null then 'Pedido avulso' else 'Assinatura ' || c.plan_id end,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'label', i.label, 'kind', i.kind, 'quantity', i.quantity,
        'plan_price_id', i.plan_price_id, 'billing_item_id', i.billing_item_id,
        'months', case when i.kind = 'recurring' then v_months else 1 end,
        'monthly_amount_cents', case when i.kind = 'recurring' then i.amount_cents end,
        -- a linha do plano no anual leva o total exato do ano (o que sobra do recorrente sem os extras)
        'amount_cents', case
          when i.plan_price_id is not null and v_months > 1 then c.recurring_cents - (v_recurring - i.amount_cents) * v_months
          when i.kind = 'recurring' then i.amount_cents * v_months
          else i.amount_cents
        end
      ) order by i.position)
      from public.checkout_items i where i.checkout_session_id = c.id
    ), '[]'::jsonb),
    case when c.plan_id is not null then p_period_start end,
    case when c.plan_id is not null then v_end end,
    now()
  )
  returning id into v_invoice;

  insert into public.payment_transactions (
    workspace_id, invoice_id, checkout_session_id, provider, provider_payment_id, kind, status,
    amount_cents, currency, method, card_brand, card_last4, installments, processed_at
  ) values (
    v_ws, v_invoice, c.id, c.provider, nullif(p_payment ->> 'provider_payment_id', ''), 'charge', 'succeeded',
    c.amount_due_now_cents, c.currency,
    nullif(p_payment ->> 'method', ''), nullif(p_payment ->> 'card_brand', ''), nullif(p_payment ->> 'card_last4', ''),
    nullif(p_payment ->> 'installments', '')::smallint, now()
  );

  -- plataformas contratadas viram as sugeridas no onboarding (só com plano)
  if c.plan_id is not null then
    insert into public.workspace_platforms (workspace_id, platform_id)
    select v_ws, p.id
    from public.platforms p
    where (p.id = 'meta' and coalesce((c.selection ->> 'meta')::integer, 0) > 0)
       or (p.id = 'google' and coalesce((c.selection ->> 'google')::integer, 0) > 0)
       or (p.id = 'ga4' and coalesce((c.selection ->> 'ga4')::integer, 0) > 0)
    on conflict do nothing;
  end if;

  update public.checkout_sessions
    set status = 'completed', completed_at = now(), workspace_id = v_ws
    where id = c.id;

  return v_ws;
end;
$$;
revoke all on function public.fulfill_checkout(uuid, text, text, text, jsonb, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.fulfill_checkout(uuid, text, text, text, jsonb, timestamptz, timestamptz) to service_role;
