create or replace function public.get_public_order_tracking(p_token text)
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
      order by q.version desc, q.created_at desc
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

notify pgrst, 'reload schema';
