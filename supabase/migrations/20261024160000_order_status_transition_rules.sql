alter table public.order_events
  add column from_status public.order_status,
  add column to_status public.order_status,
  add column reason text;

update public.order_events
set from_status = previous_status,
    to_status = new_status
where from_status is null
  and to_status is null;

create function public.enforce_order_status_transition()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if not (
    (old.status = 'enquiry' and new.status in ('quoted', 'cancelled'))
    or (old.status = 'quoted' and new.status in ('approved', 'enquiry', 'cancelled'))
    or (old.status = 'approved' and new.status in ('in_progress', 'quoted', 'cancelled'))
    or (old.status = 'in_progress' and new.status in ('ready', 'approved', 'cancelled'))
    or (old.status = 'ready' and new.status in ('delivered', 'in_progress'))
    or (old.status = 'cancelled' and new.status = 'enquiry')
  ) then
    raise exception 'Invalid order status transition from % to %.', old.status, new.status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger orders_enforce_status_transition
before update of status on public.orders
for each row
execute function public.enforce_order_status_transition();

create function public.log_order_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  transition_reason text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  transition_reason := nullif(
    trim(current_setting('jobloop.order_status_reason', true)),
    ''
  );

  insert into public.order_events (
    workspace_id,
    order_id,
    actor_id,
    event_type,
    previous_status,
    new_status,
    from_status,
    to_status,
    reason,
    description
  )
  values (
    new.workspace_id,
    new.id,
    auth.uid(),
    'status_changed',
    old.status,
    new.status,
    old.status,
    new.status,
    transition_reason,
    'Status changed from ' || old.status::text || ' to ' || new.status::text || '.'
  );

  return new;
end;
$$;

create trigger orders_log_status_transition
after update of status on public.orders
for each row
execute function public.log_order_status_transition();

drop function public.transition_order_status(uuid, public.order_status);

create function public.transition_order_status(
  p_order_id uuid,
  p_new_status public.order_status,
  p_reason text default null
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  current_order record;
begin
  if p_reason is not null and length(trim(p_reason)) > 500 then
    raise exception 'The reason must be 500 characters or fewer.';
  end if;

  select o.id, o.workspace_id, o.status
  into current_order
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  perform set_config(
    'jobloop.order_status_reason',
    coalesce(nullif(trim(p_reason), ''), ''),
    true
  );

  update public.orders
  set status = p_new_status
  where id = current_order.id
    and workspace_id = current_order.workspace_id;
end;
$$;

revoke all on function public.transition_order_status(uuid, public.order_status, text)
  from public;
grant execute on function public.transition_order_status(uuid, public.order_status, text)
  to authenticated;

notify pgrst, 'reload schema';
