alter table public.services
  alter column base_price drop not null;

alter table public.orders
  add column source_message text;

create table public.ai_extraction_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0)
);

alter table public.ai_extraction_rate_limits enable row level security;
revoke all on public.ai_extraction_rate_limits from anon, authenticated;

create function public.consume_ai_extraction_request()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  updated_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  insert into public.ai_extraction_rate_limits (
    user_id, window_started_at, request_count
  )
  values (current_user_id, now(), 1)
  on conflict (user_id) do update
  set
    window_started_at = case
      when public.ai_extraction_rate_limits.window_started_at <= now() - interval '1 minute'
        then now()
      else public.ai_extraction_rate_limits.window_started_at
    end,
    request_count = case
      when public.ai_extraction_rate_limits.window_started_at <= now() - interval '1 minute'
        then 1
      else public.ai_extraction_rate_limits.request_count + 1
    end
  returning request_count into updated_count;

  return updated_count <= 10;
end;
$$;

revoke all on function public.consume_ai_extraction_request() from public, anon;
grant execute on function public.consume_ai_extraction_request() to authenticated;

create function public.normalize_order_phone(p_phone text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  with digits as (
    select regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') as value
  )
  select nullif(
    case
      when length(value) = 12 and left(value, 2) = '91' then substring(value from 3)
      when length(value) = 11 and left(value, 1) = '0' then substring(value from 2)
      else value
    end,
    ''
  )
  from digits;
$$;

revoke all on function public.normalize_order_phone(text) from public, anon;
grant execute on function public.normalize_order_phone(text) to authenticated;

create function public.create_order_from_message(
  p_workspace_id uuid,
  p_customer_name text,
  p_phone text,
  p_items jsonb,
  p_due_date date,
  p_delivery_address text,
  p_source_message text
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  item jsonb;
  item_service_id uuid;
  item_quantity numeric(12, 2);
  item_unit_price numeric(12, 2);
  item_catalog_price numeric(12, 2);
  item_total numeric(12, 2);
  calculated_total numeric(12, 2) := 0;
  resolved_customer_id uuid;
  new_order_id uuid;
  new_order_number text;
  normalized_phone text;
  item_description text;
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'You do not have access to this workspace.';
  end if;

  if length(trim(coalesce(p_customer_name, ''))) not between 1 and 160 then
    raise exception 'Enter a customer name.';
  end if;
  if length(coalesce(p_phone, '')) > 80
     or length(coalesce(p_delivery_address, '')) > 1000
     or length(coalesce(p_source_message, '')) not between 1 and 10000 then
    raise exception 'Order message or customer details are too long or missing.';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 50 then
    raise exception 'Add at least one order item.';
  end if;

  normalized_phone := public.normalize_order_phone(p_phone);
  if normalized_phone is not null then
    perform pg_advisory_xact_lock(hashtext(p_workspace_id::text || normalized_phone));
    select c.id
    into resolved_customer_id
    from public.customers c
    where c.workspace_id = p_workspace_id
      and public.normalize_order_phone(c.phone) = normalized_phone
    order by c.created_at
    limit 1
    for update;
  end if;

  if resolved_customer_id is null then
    insert into public.customers (workspace_id, name, phone, source_channel)
    values (
      p_workspace_id,
      trim(p_customer_name),
      nullif(trim(coalesce(p_phone, '')), ''),
      null
    )
    returning id into resolved_customer_id;
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    item_service_id := (item ->> 'service_id')::uuid;
    item_quantity := (item ->> 'quantity')::numeric;

    if item_quantity is null or item_quantity <= 0 then
      raise exception 'Enter a valid quantity for every item.';
    end if;

    select s.base_price
    into item_catalog_price
    from public.services s
    where s.id = item_service_id
      and s.workspace_id = p_workspace_id
      and s.active;

    if not found then
      raise exception 'An order item uses an inactive or unavailable service.';
    end if;

    if item_catalog_price is null then
      item_unit_price := nullif(item ->> 'unit_price', '')::numeric;
      if item_unit_price is null or item_unit_price < 0 then
        raise exception 'Enter a price for each service without a catalogue price.';
      end if;
    else
      item_unit_price := item_catalog_price;
    end if;

    item_total := round(item_quantity * item_unit_price, 2);
    calculated_total := calculated_total + item_total;
  end loop;

  new_order_number := 'JOB-' || to_char(now(), 'YYMMDD') || '-' ||
    upper(left(replace(gen_random_uuid()::text, '-', ''), 6));

  insert into public.orders (
    workspace_id, customer_id, order_number, status, due_date,
    delivery_address, source_message, subtotal, total_amount, balance_due
  )
  values (
    p_workspace_id, resolved_customer_id, new_order_number, 'enquiry',
    p_due_date, nullif(trim(coalesce(p_delivery_address, '')), ''),
    p_source_message, calculated_total, calculated_total, calculated_total
  )
  returning id into new_order_id;

  for item in select value from jsonb_array_elements(p_items)
  loop
    item_service_id := (item ->> 'service_id')::uuid;
    item_quantity := (item ->> 'quantity')::numeric;
    select s.base_price into item_catalog_price
    from public.services s
    where s.id = item_service_id
      and s.workspace_id = p_workspace_id
      and s.active;
    item_unit_price := coalesce(
      item_catalog_price,
      nullif(item ->> 'unit_price', '')::numeric
    );
    item_total := round(item_quantity * item_unit_price, 2);
    item_description := nullif(trim(coalesce(item ->> 'raw_text', '')), '');

    if nullif(trim(coalesce(item ->> 'size', '')), '') is not null then
      item_description := concat_ws(
        E'\n', item_description, 'Size: ' || trim(item ->> 'size')
      );
    end if;
    if nullif(trim(coalesce(item ->> 'material', '')), '') is not null then
      item_description := concat_ws(
        E'\n', item_description, 'Material: ' || trim(item ->> 'material')
      );
    end if;
    if nullif(trim(coalesce(item ->> 'notes', '')), '') is not null then
      item_description := concat_ws(
        E'\n', item_description, 'Notes: ' || trim(item ->> 'notes')
      );
    end if;

    insert into public.order_items (
      workspace_id, order_id, service_id, description, quantity, unit_price, line_total
    )
    values (
      p_workspace_id, new_order_id, item_service_id, item_description,
      item_quantity, item_unit_price, item_total
    );
  end loop;

  insert into public.order_events (
    workspace_id, order_id, actor_id, event_type, new_status, description
  )
  values (
    p_workspace_id, new_order_id, auth.uid(), 'created_from_message', 'enquiry',
    'Created from pasted message'
  );

  return new_order_id;
end;
$$;

revoke all on function public.create_order_from_message(uuid, text, text, jsonb, date, text, text)
  from public, anon;
grant execute on function public.create_order_from_message(uuid, text, text, jsonb, date, text, text)
  to authenticated;

notify pgrst, 'reload schema';
