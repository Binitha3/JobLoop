create type public.workspace_role as enum ('owner', 'staff');
create type public.customer_source_channel as enum ('whatsapp', 'instagram', 'call', 'walk_in');
create type public.service_unit as enum ('piece', 'sq_ft', 'set');
create type public.price_modifier_type as enum ('fixed', 'percentage');
create type public.order_status as enum ('enquiry', 'quoted', 'approved', 'in_progress', 'ready', 'delivered', 'cancelled');
create type public.order_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.quote_status as enum ('draft', 'sent', 'accepted', 'rejected', 'expired');
create type public.payment_method as enum ('cash', 'upi', 'bank_transfer', 'card', 'other');
create type public.payment_status as enum ('unpaid', 'partially_paid', 'paid', 'refunded');
create type public.payment_record_status as enum ('pending', 'completed', 'failed', 'refunded');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  slug text not null unique,
  phone text,
  email text,
  instagram_handle text,
  logo_url text,
  address text,
  currency char(3) not null default 'INR',
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_id_idx on public.workspace_members(user_id);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  phone text,
  email text,
  instagram_handle text,
  notes text,
  source_channel public.customer_source_channel,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);
create index customers_workspace_name_idx on public.customers(workspace_id, name);
create index customers_workspace_phone_idx on public.customers(workspace_id, phone);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  unit public.service_unit not null,
  base_price numeric(12, 2) not null check (base_price >= 0),
  cost_price numeric(12, 2) check (cost_price is null or cost_price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, name)
);
create index services_workspace_active_idx on public.services(workspace_id, active);

create table public.service_options (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  service_id uuid not null,
  group_key text not null check (length(trim(group_key)) between 1 and 80),
  group_label text not null check (length(trim(group_label)) between 1 and 120),
  option_value text not null check (length(trim(option_value)) between 1 and 120),
  modifier_type public.price_modifier_type not null,
  modifier_value numeric(12, 2) not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, service_id) references public.services(workspace_id, id) on delete cascade,
  unique (service_id, group_key, option_value)
);
create index service_options_workspace_service_idx on public.service_options(workspace_id, service_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  customer_id uuid not null,
  order_number text not null,
  status public.order_status not null default 'enquiry',
  priority public.order_priority not null default 'normal',
  due_date date,
  delivery_address text,
  internal_notes text,
  currency char(3) not null default 'INR',
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  discount_amount numeric(12, 2) not null default 0 check (discount_amount >= 0),
  tax_rate numeric(5, 2) not null default 0 check (tax_rate between 0 and 100),
  tax_amount numeric(12, 2) not null default 0 check (tax_amount >= 0),
  delivery_charge numeric(12, 2) not null default 0 check (delivery_charge >= 0),
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  advance_paid numeric(12, 2) not null default 0 check (advance_paid >= 0),
  balance_due numeric(12, 2) not null default 0 check (balance_due >= 0),
  payment_status public.payment_status not null default 'unpaid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, customer_id) references public.customers(workspace_id, id) on delete restrict,
  unique (workspace_id, id),
  unique (workspace_id, order_number)
);
create index orders_workspace_status_idx on public.orders(workspace_id, status);
create index orders_workspace_due_date_idx on public.orders(workspace_id, due_date);
create index orders_workspace_customer_idx on public.orders(workspace_id, customer_id);
create index orders_workspace_payment_status_idx on public.orders(workspace_id, payment_status);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  order_id uuid not null,
  service_id uuid not null,
  description text,
  quantity numeric(12, 2) not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  line_total numeric(12, 2) not null check (line_total >= 0),
  selected_options jsonb not null default '[]'::jsonb check (jsonb_typeof(selected_options) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, order_id) references public.orders(workspace_id, id) on delete cascade,
  foreign key (workspace_id, service_id) references public.services(workspace_id, id) on delete restrict
);
create index order_items_workspace_order_idx on public.order_items(workspace_id, order_id);
create index order_items_workspace_service_idx on public.order_items(workspace_id, service_id);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  order_id uuid not null,
  quote_number text not null,
  version integer not null default 1 check (version > 0),
  status public.quote_status not null default 'draft',
  valid_until date,
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  discount_amount numeric(12, 2) not null default 0 check (discount_amount >= 0),
  tax_rate numeric(5, 2) not null default 0 check (tax_rate between 0 and 100),
  tax_amount numeric(12, 2) not null default 0 check (tax_amount >= 0),
  delivery_charge numeric(12, 2) not null default 0 check (delivery_charge >= 0),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  terms text,
  pdf_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, order_id) references public.orders(workspace_id, id) on delete cascade,
  unique (workspace_id, quote_number),
  unique (workspace_id, order_id, version)
);
create index quotes_workspace_order_idx on public.quotes(workspace_id, order_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  order_id uuid not null,
  amount numeric(12, 2) not null check (amount > 0),
  method public.payment_method not null,
  status public.payment_record_status not null default 'completed',
  reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, order_id) references public.orders(workspace_id, id) on delete cascade
);
create index payments_workspace_order_idx on public.payments(workspace_id, order_id);
create index payments_workspace_status_idx on public.payments(workspace_id, status);

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  order_id uuid not null,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (length(trim(event_type)) between 1 and 80),
  previous_status public.order_status,
  new_status public.order_status,
  description text not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (workspace_id, order_id) references public.orders(workspace_id, id) on delete cascade
);
create index order_events_workspace_order_created_idx on public.order_events(workspace_id, order_id, created_at desc);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  order_id uuid not null,
  storage_path text not null,
  file_name text not null,
  content_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, order_id) references public.orders(workspace_id, id) on delete cascade,
  unique (workspace_id, storage_path)
);
create index attachments_workspace_order_idx on public.attachments(workspace_id, order_id);

create table public.tracking_tokens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  order_id uuid not null,
  token_hash text not null unique check (length(token_hash) = 64),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, order_id) references public.orders(workspace_id, id) on delete cascade,
  unique (workspace_id, order_id)
);
create index tracking_tokens_workspace_order_idx on public.tracking_tokens(workspace_id, order_id);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workspaces_set_updated_at before update on public.workspaces
for each row execute function public.set_updated_at();
create trigger customers_set_updated_at before update on public.customers
for each row execute function public.set_updated_at();
create trigger services_set_updated_at before update on public.services
for each row execute function public.set_updated_at();
create trigger service_options_set_updated_at before update on public.service_options
for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();
create trigger order_items_set_updated_at before update on public.order_items
for each row execute function public.set_updated_at();
create trigger quotes_set_updated_at before update on public.quotes
for each row execute function public.set_updated_at();
create trigger payments_set_updated_at before update on public.payments
for each row execute function public.set_updated_at();

create function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = (select auth.uid())
  );
$$;

create function public.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role = 'owner'
  );
$$;

grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;

create function public.provision_workspace_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_workspace_id uuid;
  workspace_name text;
  workspace_slug text;
begin
  workspace_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'workspace_name'), ''),
    split_part(coalesce(new.email, 'New business'), '@', 1) || ' Print Shop'
  );
  workspace_slug := regexp_replace(lower(workspace_name), '[^a-z0-9]+', '-', 'g');

  insert into public.workspaces (name, slug, email)
  values (
    workspace_name,
    trim(both '-' from workspace_slug) || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8),
    new.email
  )
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created_provision_workspace
after insert on auth.users
for each row execute function public.provision_workspace_for_new_user();

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.customers enable row level security;
alter table public.services enable row level security;
alter table public.service_options enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.quotes enable row level security;
alter table public.payments enable row level security;
alter table public.order_events enable row level security;
alter table public.attachments enable row level security;
alter table public.tracking_tokens enable row level security;

create policy "members can read workspaces" on public.workspaces
for select to authenticated using (public.is_workspace_member(id));
create policy "owners can update workspaces" on public.workspaces
for update to authenticated using (public.is_workspace_owner(id))
with check (public.is_workspace_owner(id));
create policy "owners can delete workspaces" on public.workspaces
for delete to authenticated using (public.is_workspace_owner(id));

create policy "members can read workspace memberships" on public.workspace_members
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "owners can manage workspace memberships" on public.workspace_members
for all to authenticated using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

create policy "members can manage customers" on public.customers
for all to authenticated using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
create policy "members can read services" on public.services
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "owners can manage services" on public.services
for all to authenticated using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));
create policy "members can read service options" on public.service_options
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "owners can manage service options" on public.service_options
for all to authenticated using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

create policy "members can manage orders" on public.orders
for all to authenticated using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
create policy "members can manage order items" on public.order_items
for all to authenticated using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
create policy "members can manage quotes" on public.quotes
for all to authenticated using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
create policy "members can manage payments" on public.payments
for all to authenticated using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
create policy "members can read order events" on public.order_events
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members can append order events" on public.order_events
for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "members can manage attachments" on public.attachments
for all to authenticated using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
create policy "members can manage tracking tokens" on public.tracking_tokens
for all to authenticated using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

insert into storage.buckets (id, name, public, file_size_limit)
values ('order-attachments', 'order-attachments', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = 20971520;

create policy "workspace members can read order files" on storage.objects
for select to authenticated
using (
  bucket_id = 'order-attachments'
  and public.is_workspace_member((storage.foldername(name))[1]::uuid)
);
create policy "workspace members can upload order files" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'order-attachments'
  and public.is_workspace_member((storage.foldername(name))[1]::uuid)
);
create policy "workspace members can update order files" on storage.objects
for update to authenticated
using (
  bucket_id = 'order-attachments'
  and public.is_workspace_member((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'order-attachments'
  and public.is_workspace_member((storage.foldername(name))[1]::uuid)
);
create policy "workspace members can delete order files" on storage.objects
for delete to authenticated
using (
  bucket_id = 'order-attachments'
  and public.is_workspace_member((storage.foldername(name))[1]::uuid)
);

create function public.get_public_order_status(p_token_hash text)
returns table (
  business_name text,
  business_phone text,
  business_email text,
  order_number text,
  order_status public.order_status,
  due_date date,
  currency text,
  total_amount numeric,
  balance_due numeric,
  order_created_at timestamptz,
  items jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    w.name,
    w.phone,
    w.email,
    o.order_number,
    o.status,
    o.due_date,
    o.currency::text,
    o.total_amount,
    o.balance_due,
    o.created_at,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'name', coalesce(oi.description, s.name),
            'quantity', oi.quantity,
            'unit', s.unit
          )
          order by oi.created_at
        )
        from public.order_items oi
        join public.services s
          on s.workspace_id = oi.workspace_id
          and s.id = oi.service_id
        where oi.workspace_id = o.workspace_id
          and oi.order_id = o.id
      ),
      '[]'::jsonb
    )
  from public.tracking_tokens tt
  join public.orders o
    on o.workspace_id = tt.workspace_id
    and o.id = tt.order_id
  join public.workspaces w on w.id = tt.workspace_id
  where tt.token_hash = p_token_hash
    and tt.revoked_at is null
    and (tt.expires_at is null or tt.expires_at > now())
  limit 1;
$$;
revoke all on function public.get_public_order_status(text) from public;
grant execute on function public.get_public_order_status(text) to anon, authenticated;
