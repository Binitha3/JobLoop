create function public.create_order_with_items(
  p_workspace_id uuid,
  p_customer_id uuid,
  p_new_customer jsonb,
  p_due_date date,
  p_notes text,
  p_items jsonb
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
  item_total numeric(12, 2);
  calculated_total numeric(12, 2) := 0;
  resolved_customer_id uuid := p_customer_id;
  new_order_id uuid;
  new_order_number text;
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'You do not have access to this workspace.';
  end if;

  if (p_customer_id is null) = (p_new_customer is null) then
    raise exception 'Choose an existing customer or provide a new customer.';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one order item.';
  end if;

  if p_new_customer is not null then
    insert into public.customers (
      workspace_id, name, phone, email, source_channel
    )
    values (
      p_workspace_id,
      nullif(trim(p_new_customer ->> 'name'), ''),
      nullif(trim(p_new_customer ->> 'phone'), ''),
      nullif(trim(p_new_customer ->> 'email'), ''),
      nullif(p_new_customer ->> 'source_channel', '')::public.customer_source_channel
    )
    returning id into resolved_customer_id;
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    item_service_id := (item ->> 'service_id')::uuid;
    item_quantity := (item ->> 'quantity')::numeric;
    item_unit_price := (item ->> 'unit_price')::numeric;

    if item_quantity <= 0 or item_unit_price < 0 then
      raise exception 'Order item quantities and prices must be valid.';
    end if;

    if not exists (
      select 1
      from public.services s
      where s.id = item_service_id
        and s.workspace_id = p_workspace_id
        and s.active
    ) then
      raise exception 'An order item uses an inactive or unavailable service.';
    end if;

    calculated_total := calculated_total + item_quantity * item_unit_price;
  end loop;

  new_order_number := 'JOB-' || to_char(now(), 'YYMMDD') || '-' ||
    upper(left(replace(gen_random_uuid()::text, '-', ''), 6));

  insert into public.orders (
    workspace_id, customer_id, order_number, status, due_date,
    internal_notes, subtotal, total_amount, balance_due
  )
  values (
    p_workspace_id, resolved_customer_id, new_order_number, 'enquiry',
    p_due_date, nullif(trim(p_notes), ''), calculated_total,
    calculated_total, calculated_total
  )
  returning id into new_order_id;

  for item in select value from jsonb_array_elements(p_items)
  loop
    item_service_id := (item ->> 'service_id')::uuid;
    item_quantity := (item ->> 'quantity')::numeric;
    item_unit_price := (item ->> 'unit_price')::numeric;
    item_total := item_quantity * item_unit_price;

    insert into public.order_items (
      workspace_id, order_id, service_id, quantity, unit_price, line_total
    )
    values (
      p_workspace_id, new_order_id, item_service_id, item_quantity,
      item_unit_price, item_total
    );
  end loop;

  insert into public.order_events (
    workspace_id, order_id, actor_id, event_type, new_status, description
  )
  values (
    p_workspace_id, new_order_id, auth.uid(), 'status_changed', 'enquiry',
    'Order created.'
  );

  return new_order_id;
end;
$$;

revoke all on function public.create_order_with_items(uuid, uuid, jsonb, date, text, jsonb) from public;
grant execute on function public.create_order_with_items(uuid, uuid, jsonb, date, text, jsonb) to authenticated;

create function public.transition_order_status(
  p_order_id uuid,
  p_new_status public.order_status
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  current_order record;
  expected_status public.order_status;
begin
  select o.id, o.workspace_id, o.status
  into current_order
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  expected_status := case current_order.status
    when 'enquiry' then 'quoted'::public.order_status
    when 'quoted' then 'approved'::public.order_status
    when 'approved' then 'in_progress'::public.order_status
    when 'in_progress' then 'ready'::public.order_status
    when 'ready' then 'delivered'::public.order_status
    else null
  end;

  if expected_status is null or p_new_status <> expected_status then
    raise exception 'Invalid order status transition.';
  end if;

  update public.orders
  set status = p_new_status
  where id = current_order.id
    and workspace_id = current_order.workspace_id;

  insert into public.order_events (
    workspace_id, order_id, actor_id, event_type,
    previous_status, new_status, description
  )
  values (
    current_order.workspace_id, current_order.id, auth.uid(),
    'status_changed', current_order.status, p_new_status,
    'Status changed from ' || current_order.status::text ||
      ' to ' || p_new_status::text || '.'
  );
end;
$$;

revoke all on function public.transition_order_status(uuid, public.order_status) from public;
grant execute on function public.transition_order_status(uuid, public.order_status) to authenticated;
