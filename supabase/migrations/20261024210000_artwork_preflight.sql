alter table public.order_items
  add column print_width numeric(8, 2),
  add column print_height numeric(8, 2),
  add column print_unit text,
  add column bleed_mm numeric(8, 2) not null default 3,
  add constraint order_items_print_dimensions_positive
    check (
      (print_width is null and print_height is null and print_unit is null)
      or (
        print_width is not null
        and print_height is not null
        and print_width > 0
        and print_height > 0
        and print_unit is not null
        and print_unit in ('mm', 'cm', 'in', 'ft')
      )
    ),
  add constraint order_items_bleed_nonnegative check (bleed_mm >= 0);

alter table public.order_items
  add constraint order_items_workspace_id_id_key unique (workspace_id, id);

create table public.artwork_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  order_item_id uuid not null,
  storage_path text not null,
  original_name text not null check (length(trim(original_name)) between 1 and 255),
  mime text not null check (mime in ('image/png', 'image/jpeg', 'image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  width_px integer not null check (width_px > 0),
  height_px integer not null check (height_px > 0),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, order_item_id)
    references public.order_items(workspace_id, id) on delete cascade,
  unique (workspace_id, storage_path)
);
create index artwork_files_workspace_item_created_idx
  on public.artwork_files(workspace_id, order_item_id, created_at desc);

create table public.preflight_reports (
  id uuid primary key default gen_random_uuid(),
  artwork_file_id uuid not null references public.artwork_files(id) on delete cascade,
  results jsonb not null check (jsonb_typeof(results) = 'array'),
  overall text not null check (overall in ('pass', 'warn', 'fail')),
  ai_notes jsonb not null default '[]'::jsonb check (jsonb_typeof(ai_notes) = 'array'),
  created_at timestamptz not null default now()
);
create index preflight_reports_artwork_created_idx
  on public.preflight_reports(artwork_file_id, created_at desc);

alter table public.artwork_files enable row level security;
alter table public.preflight_reports enable row level security;

create policy "members can manage artwork files" on public.artwork_files
for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "members can read preflight reports" on public.preflight_reports
for select to authenticated
using (
  exists (
    select 1
    from public.artwork_files af
    where af.id = artwork_file_id
      and public.is_workspace_member(af.workspace_id)
  )
);
create policy "members can append preflight reports" on public.preflight_reports
for insert to authenticated
with check (
  exists (
    select 1
    from public.artwork_files af
    where af.id = artwork_file_id
      and public.is_workspace_member(af.workspace_id)
  )
);

create function public.save_artwork_upload(
  p_workspace_id uuid,
  p_order_item_id uuid,
  p_storage_path text,
  p_original_name text,
  p_mime text,
  p_size_bytes bigint,
  p_width_px integer,
  p_height_px integer,
  p_results jsonb,
  p_overall text,
  p_ai_notes jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  new_artwork_file_id uuid;
  item_order_id uuid;
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'You do not have access to this workspace.';
  end if;

  select oi.order_id
  into item_order_id
  from public.order_items oi
  where oi.id = p_order_item_id
    and oi.workspace_id = p_workspace_id;

  if not found then
    raise exception 'Order item not found in this workspace.';
  end if;

  insert into public.artwork_files (
    workspace_id, order_item_id, storage_path, original_name, mime,
    size_bytes, width_px, height_px, uploaded_by
  )
  values (
    p_workspace_id, p_order_item_id, p_storage_path, p_original_name, p_mime,
    p_size_bytes, p_width_px, p_height_px, auth.uid()
  )
  returning id into new_artwork_file_id;

  insert into public.preflight_reports (
    artwork_file_id, results, overall, ai_notes
  )
  values (
    new_artwork_file_id, p_results, p_overall, p_ai_notes
  );

  insert into public.order_events (
    workspace_id, order_id, actor_id, event_type, description, metadata
  )
  values (
    p_workspace_id,
    item_order_id,
    auth.uid(),
    'artwork_uploaded',
    'Artwork uploaded: ' || p_original_name,
    jsonb_build_object(
      'order_item_id', p_order_item_id,
      'artwork_file_id', new_artwork_file_id,
      'overall', p_overall
    )
  );

  return new_artwork_file_id;
end;
$$;

revoke all on function public.save_artwork_upload(
  uuid, uuid, text, text, text, bigint, integer, integer, jsonb, text, jsonb
) from public;
grant execute on function public.save_artwork_upload(
  uuid, uuid, text, text, text, bigint, integer, integer, jsonb, text, jsonb
) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'artwork',
  'artwork',
  false,
  26214400,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "workspace members can read artwork" on storage.objects
for select to authenticated
using (
  bucket_id = 'artwork'
  and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  and exists (
    select 1
    from public.order_items oi
    where oi.workspace_id = (storage.foldername(name))[1]::uuid
      and oi.id = (storage.foldername(name))[2]::uuid
  )
);

create policy "workspace members can upload artwork" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'artwork'
  and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  and exists (
    select 1
    from public.order_items oi
    where oi.workspace_id = (storage.foldername(name))[1]::uuid
      and oi.id = (storage.foldername(name))[2]::uuid
  )
);

create policy "workspace members can delete artwork" on storage.objects
for delete to authenticated
using (
  bucket_id = 'artwork'
  and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  and exists (
    select 1
    from public.order_items oi
    where oi.workspace_id = (storage.foldername(name))[1]::uuid
      and oi.id = (storage.foldername(name))[2]::uuid
  )
);

create or replace function public.create_order_with_items(
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
  item_print_width numeric(8, 2);
  item_print_height numeric(8, 2);
  item_print_unit text;
  item_bleed_mm numeric(8, 2);
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
    item_print_width := nullif(item ->> 'print_width', '')::numeric;
    item_print_height := nullif(item ->> 'print_height', '')::numeric;
    item_print_unit := nullif(item ->> 'print_unit', '');
    item_bleed_mm := coalesce(nullif(item ->> 'bleed_mm', '')::numeric, 3);

    if item_quantity <= 0 or item_unit_price < 0 then
      raise exception 'Order item quantities and prices must be valid.';
    end if;
    if (item_print_width is null) <> (item_print_height is null)
       or (
         item_print_width is not null
         and (
           item_print_width <= 0
           or item_print_height <= 0
           or item_print_unit is null
           or item_print_unit not in ('mm', 'cm', 'in', 'ft')
         )
       )
       or item_bleed_mm < 0 then
      raise exception 'Order item print dimensions and bleed must be valid.';
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
      workspace_id, order_id, service_id, quantity, unit_price, line_total,
      print_width, print_height, print_unit, bleed_mm
    )
    values (
      p_workspace_id, new_order_id, item_service_id, item_quantity,
      item_unit_price, item_total,
      nullif(item ->> 'print_width', '')::numeric,
      nullif(item ->> 'print_height', '')::numeric,
      nullif(item ->> 'print_unit', ''),
      coalesce(nullif(item ->> 'bleed_mm', '')::numeric, 3)
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

create or replace function public.create_order_from_message(
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
  item_print_width numeric(8, 2);
  item_print_height numeric(8, 2);
  item_print_unit text;
  item_bleed_mm numeric(8, 2);
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
    item_print_width := nullif(item ->> 'print_width', '')::numeric;
    item_print_height := nullif(item ->> 'print_height', '')::numeric;
    item_print_unit := nullif(item ->> 'print_unit', '');
    item_bleed_mm := coalesce(nullif(item ->> 'bleed_mm', '')::numeric, 3);

    if item_quantity is null or item_quantity <= 0 then
      raise exception 'Enter a valid quantity for every item.';
    end if;
    if (item_print_width is null) <> (item_print_height is null)
       or (
         item_print_width is not null
         and (
           item_print_width <= 0
           or item_print_height <= 0
           or item_print_unit is null
           or item_print_unit not in ('mm', 'cm', 'in', 'ft')
         )
       )
       or item_bleed_mm < 0 then
      raise exception 'Order item print dimensions and bleed must be valid.';
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
    item_print_width := nullif(item ->> 'print_width', '')::numeric;
    item_print_height := nullif(item ->> 'print_height', '')::numeric;
    item_print_unit := nullif(item ->> 'print_unit', '');
    item_bleed_mm := coalesce(nullif(item ->> 'bleed_mm', '')::numeric, 3);
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
      workspace_id, order_id, service_id, description, quantity, unit_price,
      line_total, print_width, print_height, print_unit, bleed_mm
    )
    values (
      p_workspace_id, new_order_id, item_service_id, item_description,
      item_quantity, item_unit_price, item_total, item_print_width,
      item_print_height, item_print_unit, item_bleed_mm
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

create or replace function public.enforce_order_status_transition()
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

  if new.status = 'in_progress'
     and exists (
       select 1
       from public.order_items oi
       join public.artwork_files af
         on af.workspace_id = oi.workspace_id
        and af.order_item_id = oi.id
       join public.preflight_reports pr on pr.artwork_file_id = af.id
       where oi.workspace_id = old.workspace_id
         and oi.order_id = old.id
         and pr.overall = 'fail'
     )
     and nullif(trim(current_setting('jobloop.order_status_reason', true)), '') is null then
    raise exception 'Artwork preflight failed. Provide a reason to override.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop function public.transition_order_status(uuid, public.order_status, text);

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
  has_failed_artwork boolean;
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

  select exists (
    select 1
    from public.order_items oi
    join public.artwork_files af
      on af.workspace_id = oi.workspace_id
     and af.order_item_id = oi.id
    join public.preflight_reports pr on pr.artwork_file_id = af.id
    where oi.workspace_id = current_order.workspace_id
      and oi.order_id = current_order.id
      and pr.overall = 'fail'
  )
  into has_failed_artwork;

  if p_new_status = 'in_progress'
     and has_failed_artwork
     and nullif(trim(p_reason), '') is null then
    raise exception 'Artwork preflight failed. Provide a reason to override.'
      using errcode = 'check_violation';
  end if;

  perform set_config(
    'jobloop.order_status_reason',
    coalesce(nullif(trim(p_reason), ''), ''),
    true
  );

  if p_new_status = 'in_progress'
     and has_failed_artwork then
    insert into public.order_events (
      workspace_id, order_id, actor_id, event_type, reason, description
    )
    values (
      current_order.workspace_id,
      current_order.id,
      auth.uid(),
      'preflight_override',
      trim(p_reason),
      'Production started despite a failed artwork preflight.'
    );
  end if;

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
