alter table public.quotes
  add column tax_percent numeric(5, 2) not null default 18
    check (tax_percent between 0 and 100),
  add column total numeric(12, 2) not null default 0
    check (total >= 0);

update public.quotes
set tax_percent = tax_rate,
    total = total_amount;

alter table public.tracking_tokens
  add column token text;

update public.tracking_tokens
set revoked_at = coalesce(revoked_at, now());

alter table public.tracking_tokens
  drop constraint tracking_tokens_workspace_id_order_id_key;

do $$
declare
  existing_order record;
  new_token text;
begin
  for existing_order in
    select o.workspace_id, o.id
    from public.orders o
  loop
    new_token := encode(extensions.gen_random_bytes(32), 'hex');

    insert into public.tracking_tokens (
      workspace_id, order_id, token_hash, token, created_at
    )
    values (
      existing_order.workspace_id,
      existing_order.id,
      encode(extensions.digest(new_token, 'sha256'), 'hex'),
      new_token,
      now()
    );
  end loop;
end;
$$;

alter table public.tracking_tokens
  alter column token set not null;

alter table public.tracking_tokens
  add constraint tracking_tokens_token_key unique (token);

revoke all on public.tracking_tokens from anon;
revoke all on public.quotes from anon;

create index tracking_tokens_token_idx on public.tracking_tokens(token);

create function public.create_order_tracking_token()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_token text;
begin
  new_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.tracking_tokens (
    workspace_id, order_id, token_hash, token
  )
  values (
    new.workspace_id,
    new.id,
    encode(extensions.digest(new_token, 'sha256'), 'hex'),
    new_token
  );

  return new;
end;
$$;

create trigger orders_create_tracking_token
after insert on public.orders
for each row execute function public.create_order_tracking_token();

create function public.save_order_quote(
  p_order_id uuid,
  p_discount_amount numeric,
  p_tax_percent numeric,
  p_delivery_charge numeric,
  p_valid_until date,
  p_terms text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  target_order record;
  calculated_subtotal numeric(12, 2);
  calculated_taxable numeric(12, 2);
  calculated_tax numeric(12, 2);
  calculated_total numeric(12, 2);
  next_quote_number text;
  next_version integer;
  new_quote_id uuid;
begin
  select o.id, o.workspace_id, o.currency
  into target_order
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  if not public.is_workspace_member(target_order.workspace_id) then
    raise exception 'You do not have access to this order.';
  end if;

  if p_discount_amount is null
     or p_tax_percent is null
     or p_delivery_charge is null
     or p_discount_amount < 0
     or p_tax_percent < 0 or p_tax_percent > 100
     or p_delivery_charge < 0 then
    raise exception 'Quote amounts and tax percentage must be valid.';
  end if;

  select coalesce(round(sum(oi.line_total), 2), 0)
  into calculated_subtotal
  from public.order_items oi
  where oi.order_id = target_order.id
    and oi.workspace_id = target_order.workspace_id;

  if p_discount_amount > calculated_subtotal then
    raise exception 'Discount cannot exceed the subtotal.';
  end if;

  calculated_taxable := round(calculated_subtotal - p_discount_amount, 2);
  calculated_tax := round(calculated_taxable * p_tax_percent / 100, 2);
  calculated_total := round(calculated_taxable + calculated_tax + p_delivery_charge, 2);

  if calculated_total < 0 then
    raise exception 'Quote total cannot be negative.';
  end if;

  perform pg_advisory_xact_lock(hashtext(target_order.workspace_id::text));

  select coalesce(max(q.version), 0) + 1
  into next_version
  from public.quotes q
  where q.workspace_id = target_order.workspace_id
    and q.order_id = target_order.id;

  next_quote_number := 'JL-Q-' || lpad(
    (
      select (coalesce(max(substring(q.quote_number from '[0-9]+$')::integer), 0) + 1)::text
      from public.quotes q
      where q.workspace_id = target_order.workspace_id
        and q.quote_number ~ '^JL-Q-[0-9]+$'
    ),
    4,
    '0'
  );

  insert into public.quotes (
    workspace_id, order_id, quote_number, version, status,
    valid_until, subtotal, discount_amount, tax_rate, tax_percent,
    tax_amount, delivery_charge, total_amount, total, terms
  )
  values (
    target_order.workspace_id, target_order.id, next_quote_number,
    next_version, 'draft', p_valid_until, calculated_subtotal,
    p_discount_amount, p_tax_percent, p_tax_percent, calculated_tax,
    p_delivery_charge, calculated_total, calculated_total, p_terms
  )
  returning id into new_quote_id;

  insert into public.order_events (
    workspace_id, order_id, actor_id, event_type, description, metadata
  )
  values (
    target_order.workspace_id,
    target_order.id,
    auth.uid(),
    'quote_created',
    'Quote ' || next_quote_number || ' created, total ₹' ||
      to_char(calculated_total, 'FM999999999999990.00'),
    jsonb_build_object(
      'quote_number', next_quote_number,
      'total', calculated_total
    )
  );

  return jsonb_build_object(
    'id', new_quote_id,
    'quote_number', next_quote_number,
    'total', calculated_total
  );
end;
$$;

revoke all on function public.save_order_quote(uuid, numeric, numeric, numeric, date, text)
  from public;
grant execute on function public.save_order_quote(uuid, numeric, numeric, numeric, date, text)
  to authenticated;

create function public.regenerate_order_tracking_token(p_order_id uuid)
returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  target_order record;
  new_token text;
begin
  select o.id, o.workspace_id
  into target_order
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found or not public.is_workspace_member(target_order.workspace_id) then
    raise exception 'Order not found in this workspace.';
  end if;

  update public.tracking_tokens
  set revoked_at = now()
  where order_id = target_order.id
    and workspace_id = target_order.workspace_id
    and revoked_at is null;

  new_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.tracking_tokens (
    workspace_id, order_id, token_hash, token
  )
  values (
    target_order.workspace_id,
    target_order.id,
    encode(extensions.digest(new_token, 'sha256'), 'hex'),
    new_token
  );

  insert into public.order_events (
    workspace_id, order_id, actor_id, event_type, description
  )
  values (
    target_order.workspace_id,
    target_order.id,
    auth.uid(),
    'tracking_link_regenerated',
    'Public tracking link regenerated.'
  );

  return new_token;
end;
$$;

revoke all on function public.regenerate_order_tracking_token(uuid) from public;
grant execute on function public.regenerate_order_tracking_token(uuid) to authenticated;

create function public.get_public_order_tracking(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'business_name', w.name,
    'business_phone', w.phone,
    'job_number', o.order_number,
    'customer_first_name', split_part(trim(c.name), ' ', 1),
    'status', o.status::text,
    'timeline', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'status', coalesce(oe.to_status, oe.new_status)::text,
            'date', oe.created_at::date
          )
          order by oe.created_at
        )
        from public.order_events oe
        where oe.workspace_id = o.workspace_id
          and oe.order_id = o.id
          and coalesce(oe.to_status, oe.new_status) is not null
      ),
      '[]'::jsonb
    ),
    'due_date', o.due_date,
    'line_items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'service', coalesce(oi.description, s.name),
            'quantity', oi.quantity
          )
          order by oi.created_at
        )
        from public.order_items oi
        join public.services s
          on s.id = oi.service_id
          and s.workspace_id = oi.workspace_id
        where oi.workspace_id = o.workspace_id
          and oi.order_id = o.id
      ),
      '[]'::jsonb
    ),
    'latest_quote_total', (
      select q.total
      from public.quotes q
      where q.workspace_id = o.workspace_id
        and q.order_id = o.id
      order by q.created_at desc
      limit 1
    ),
    'amount_paid', coalesce(
      (
        select sum(p.amount)
        from public.payments p
        where p.workspace_id = o.workspace_id
          and p.order_id = o.id
          and p.status = 'completed'
      ),
      0
    ),
    'balance_due', o.balance_due
  )
  from public.tracking_tokens tt
  join public.orders o
    on o.id = tt.order_id
    and o.workspace_id = tt.workspace_id
  join public.workspaces w on w.id = o.workspace_id
  join public.customers c
    on c.id = o.customer_id
    and c.workspace_id = o.workspace_id
  where tt.token = p_token
    and tt.revoked_at is null
  limit 1;
$$;

revoke all on function public.get_public_order_tracking(text) from public;
grant execute on function public.get_public_order_tracking(text) to anon, authenticated;
revoke all on function public.get_public_order_status(text) from public, anon, authenticated;

notify pgrst, 'reload schema';
