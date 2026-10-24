insert into public.workspaces (id, name, slug, phone, email, instagram_handle, address)
values (
  '00000000-0000-0000-0000-000000000001',
  'Demo Print Studio',
  'demo-print-studio',
  '+91 98765 43210',
  'hello@demoprint.example',
  '@demoprintstudio',
  '12 Market Road, Bengaluru'
)
on conflict (id) do nothing;

create temporary table if not exists jobloop_seed_context (
  workspace_id uuid primary key
);
truncate table pg_temp.jobloop_seed_context;

insert into pg_temp.jobloop_seed_context (workspace_id)
select o.workspace_id
from public.orders o
where o.id = '00000000-0000-0000-0000-000000001001'
limit 1
on conflict do nothing;

insert into pg_temp.jobloop_seed_context (workspace_id)
select wm.workspace_id
from public.workspace_members wm
join auth.users u on u.id = wm.user_id
where lower(u.email) = 'demo@jobloop.local'
  and wm.role = 'owner'
order by wm.created_at
limit 1
on conflict do nothing;

insert into pg_temp.jobloop_seed_context (workspace_id)
values ('00000000-0000-0000-0000-000000000001')
on conflict do nothing;

insert into public.workspace_members (workspace_id, user_id, role)
select ctx.workspace_id, u.id, 'owner'
from pg_temp.jobloop_seed_context ctx
cross join auth.users u
where lower(u.email) = 'demo@jobloop.local'
on conflict (workspace_id, user_id) do nothing;

insert into public.services (id, workspace_id, name, unit, base_price, cost_price, active)
select
  ('00000000-0000-0000-0000-' || lpad(seed.service_id::text, 12, '0'))::uuid,
  ctx.workspace_id,
  seed.name,
  seed.unit::public.service_unit,
  seed.base_price,
  seed.cost_price,
  true
from pg_temp.jobloop_seed_context ctx
cross join (
  values
    (101, 'Flyers', 'piece', 4.00, 1.60),
    (102, 'Business Cards', 'set', 300.00, 125.00),
    (103, 'Vinyl Banners', 'sq_ft', 45.00, 22.00),
    (104, 'T-shirt Printing', 'piece', 399.00, 220.00),
    (105, 'Custom Mugs', 'piece', 249.00, 130.00)
) as seed(service_id, name, unit, base_price, cost_price)
on conflict (workspace_id, name) do update
set unit = excluded.unit,
    base_price = excluded.base_price,
    cost_price = excluded.cost_price,
    active = true;

insert into public.service_options (
  id, workspace_id, service_id, group_key, group_label, option_value,
  modifier_type, modifier_value, sort_order
)
select
  ('00000000-0000-0000-0000-' || lpad(seed.option_id::text, 12, '0'))::uuid,
  ctx.workspace_id,
  ('00000000-0000-0000-0000-' || lpad(seed.service_id::text, 12, '0'))::uuid,
  seed.group_key,
  seed.group_label,
  seed.option_value,
  seed.modifier_type::public.price_modifier_type,
  seed.modifier_value,
  seed.sort_order
from pg_temp.jobloop_seed_context ctx
cross join (
  values
    (201, 101, 'size', 'Size', 'A5', 'fixed', 0.00, 1),
    (202, 101, 'size', 'Size', 'A4', 'fixed', 1.50, 2),
    (203, 101, 'material', 'Paper', '170 GSM', 'fixed', 1.00, 1),
    (204, 101, 'finish', 'Finish', 'Matte', 'percentage', 0.00, 1),
    (205, 102, 'finish', 'Finish', 'Glossy', 'fixed', 100.00, 1),
    (206, 102, 'material', 'Paper', '350 GSM', 'fixed', 80.00, 1),
    (207, 103, 'material', 'Material', 'Frontlit', 'fixed', 0.00, 1),
    (208, 103, 'finish', 'Finish', 'Eyelets', 'fixed', 300.00, 1),
    (209, 104, 'material', 'Fabric', 'Cotton', 'fixed', 0.00, 1),
    (210, 104, 'rush', 'Turnaround', 'Rush order', 'percentage', 25.00, 1),
    (211, 105, 'finish', 'Print', 'Full colour', 'fixed', 40.00, 1)
) as seed(option_id, service_id, group_key, group_label, option_value, modifier_type, modifier_value, sort_order)
on conflict (service_id, group_key, option_value) do update
set group_label = excluded.group_label,
    modifier_type = excluded.modifier_type,
    modifier_value = excluded.modifier_value,
    sort_order = excluded.sort_order;

insert into public.customers (
  id, workspace_id, name, phone, email, instagram_handle, notes, source_channel
)
select
  ('00000000-0000-0000-0000-' || lpad(seed.customer_id::text, 12, '0'))::uuid,
  ctx.workspace_id,
  seed.name,
  '+91 90000 000' || lpad(seed.customer_id::text, 2, '0'),
  'customer' || lpad(seed.customer_id::text, 2, '0') || '@example.com',
  case when seed.customer_id % 3 = 0 then '@' || lower(replace(split_part(seed.name, ' ', 1), '''', '')) else null end,
  case when seed.customer_id % 6 = 0 then 'Prefers WhatsApp updates.' else null end,
  seed.source_channel::public.customer_source_channel
from pg_temp.jobloop_seed_context ctx
cross join (
  values
    (1, 'Aarav Mehta', 'whatsapp'),
    (2, 'Ananya Rao', 'instagram'),
    (3, 'Kabir Shah', 'call'),
    (4, 'Diya Nair', 'walk_in'),
    (5, 'Ishaan Patel', 'whatsapp'),
    (6, 'Meera Iyer', 'instagram'),
    (7, 'Arjun Das', 'call'),
    (8, 'Sara Khan', 'walk_in'),
    (9, 'Vivaan Joshi', 'whatsapp'),
    (10, 'Aisha Reddy', 'instagram'),
    (11, 'Reyansh Gupta', 'call'),
    (12, 'Tara Menon', 'walk_in'),
    (13, 'Aditya Kulkarni', 'whatsapp'),
    (14, 'Myra Fernandes', 'instagram'),
    (15, 'Rohan Bhat', 'call'),
    (16, 'Kiara Sood', 'walk_in'),
    (17, 'Neil Thomas', 'whatsapp'),
    (18, 'Sana Sheikh', 'instagram'),
    (19, 'Dev Malhotra', 'call'),
    (20, 'Ira Chatterjee', 'walk_in'),
    (21, 'Yash Verma', 'whatsapp'),
    (22, 'Nisha Pillai', 'instagram'),
    (23, 'Atharv Jain', 'call'),
    (24, 'Zoya Kapoor', 'walk_in'),
    (25, 'Manav Krishnan', 'whatsapp')
) as seed(customer_id, name, source_channel)
on conflict (id) do update
set name = excluded.name,
    phone = excluded.phone,
    email = excluded.email,
    instagram_handle = excluded.instagram_handle,
    notes = excluded.notes,
    source_channel = excluded.source_channel;

create temporary table if not exists jobloop_demo_orders (
  order_id uuid primary key,
  customer_id uuid not null,
  service_id uuid not null,
  order_number text not null,
  status public.order_status not null,
  priority public.order_priority not null,
  due_date date not null,
  quantity numeric(12, 2) not null,
  unit_price numeric(12, 2) not null,
  subtotal numeric(12, 2) not null,
  discount_amount numeric(12, 2) not null,
  tax_rate numeric(5, 2) not null,
  tax_amount numeric(12, 2) not null,
  delivery_charge numeric(12, 2) not null,
  total_amount numeric(12, 2) not null,
  advance_paid numeric(12, 2) not null,
  balance_due numeric(12, 2) not null,
  payment_status public.payment_status not null,
  created_at timestamptz not null
);
truncate table pg_temp.jobloop_demo_orders;

with raw_orders as (
  select
    n,
    ('00000000-0000-0000-0000-' || lpad((1000 + n)::text, 12, '0'))::uuid as order_id,
    ('00000000-0000-0000-0000-' || lpad((((n - 1) % 25) + 1)::text, 12, '0'))::uuid as customer_id,
    ('00000000-0000-0000-0000-' || lpad((100 + ((n - 1) % 5) + 1)::text, 12, '0'))::uuid as service_id,
    'JP-' || to_char(current_date, 'YYMM') || '-' || lpad(n::text, 4, '0') as order_number,
    (array['enquiry', 'quoted', 'approved', 'in_progress', 'ready', 'delivered', 'cancelled']::public.order_status[])[((n - 1) % 7) + 1] as status,
    case when n % 13 = 0 then 'urgent'::public.order_priority
         when n % 6 = 0 then 'high'::public.order_priority
         else 'normal'::public.order_priority end as priority,
    current_date + case when n % 8 = 0 then -4 else (n % 10) - 2 end as due_date,
    (10 + (n % 9) * 5)::numeric(12, 2) as quantity,
    s.base_price as unit_price,
    now() - (n % 21 || ' days')::interval as created_at
  from generate_series(1, 40) as series(n)
  join public.services s
    on s.workspace_id = (select workspace_id from pg_temp.jobloop_seed_context)
    and s.id = ('00000000-0000-0000-0000-' || lpad((100 + ((n - 1) % 5) + 1)::text, 12, '0'))::uuid
),
totals as (
  select
    *,
    round(quantity * unit_price, 2) as subtotal,
    case when n % 5 = 0 then round(quantity * unit_price * 0.05, 2) else 0::numeric end as discount_amount,
    18.00::numeric(5, 2) as tax_rate,
    case when n % 4 = 0 then 150.00::numeric else 0::numeric end as delivery_charge
  from raw_orders
),
taxed as (
  select *, round((subtotal - discount_amount + delivery_charge) * tax_rate / 100, 2) as tax_amount
  from totals
),
with_total as (
  select *, round(subtotal - discount_amount + delivery_charge + tax_amount, 2) as total_amount
  from taxed
),
with_payment as (
  select *,
    case when n % 4 = 0 then 0::numeric
         when n % 4 = 1 then total_amount
         else round(total_amount * 0.4, 2) end as advance_paid
  from with_total
)
insert into pg_temp.jobloop_demo_orders (
  order_id, customer_id, service_id, order_number, status, priority, due_date,
  quantity, unit_price, subtotal, discount_amount, tax_rate, tax_amount,
  delivery_charge, total_amount, advance_paid, balance_due, payment_status, created_at
)
select
  order_id,
  customer_id,
  service_id,
  order_number,
  status,
  priority,
  due_date,
  quantity,
  unit_price,
  subtotal,
  discount_amount,
  tax_rate,
  tax_amount,
  delivery_charge,
  total_amount,
  advance_paid,
  total_amount - advance_paid,
  case when total_amount - advance_paid = 0 then 'paid'::public.payment_status
       when advance_paid > 0 then 'partially_paid'::public.payment_status
       else 'unpaid'::public.payment_status end,
  created_at
from with_payment;

insert into public.orders (
  id, workspace_id, customer_id, order_number, status, priority, due_date,
  delivery_address, internal_notes, currency, subtotal, discount_amount,
  tax_rate, tax_amount, delivery_charge, total_amount, advance_paid, balance_due,
  payment_status, created_at
)
select
  d.order_id,
  ctx.workspace_id,
  d.customer_id,
  d.order_number,
  d.status,
  d.priority,
  d.due_date,
  'Delivery address to be confirmed',
  case when d.order_id = '00000000-0000-0000-0000-000000001001' then 'Confirm final artwork before production.' else null end,
  'INR',
  d.subtotal,
  d.discount_amount,
  d.tax_rate,
  d.tax_amount,
  d.delivery_charge,
  d.total_amount,
  d.advance_paid,
  d.balance_due,
  d.payment_status,
  d.created_at
from pg_temp.jobloop_seed_context ctx
cross join pg_temp.jobloop_demo_orders d
on conflict (id) do update
set customer_id = excluded.customer_id,
    order_number = excluded.order_number,
    status = excluded.status,
    priority = excluded.priority,
    due_date = excluded.due_date,
    delivery_address = excluded.delivery_address,
    internal_notes = excluded.internal_notes,
    subtotal = excluded.subtotal,
    discount_amount = excluded.discount_amount,
    tax_rate = excluded.tax_rate,
    tax_amount = excluded.tax_amount,
    delivery_charge = excluded.delivery_charge,
    total_amount = excluded.total_amount,
    advance_paid = excluded.advance_paid,
    balance_due = excluded.balance_due,
    payment_status = excluded.payment_status,
    created_at = excluded.created_at;

insert into public.order_items (
  id, workspace_id, order_id, service_id, description, quantity, unit_price,
  line_total, selected_options
)
select
  ('00000000-0000-0000-0000-' || lpad((6000 + row_number() over (order by d.order_number))::text, 12, '0'))::uuid,
  ctx.workspace_id,
  d.order_id,
  d.service_id,
  s.name,
  d.quantity,
  d.unit_price,
  d.subtotal,
  case when d.order_id = '00000000-0000-0000-0000-000000001001'
    then '[{"group":"size","value":"A4"},{"group":"material","value":"170 GSM"}]'::jsonb
    else '[]'::jsonb end
from pg_temp.jobloop_seed_context ctx
cross join pg_temp.jobloop_demo_orders d
join public.services s
  on s.workspace_id = ctx.workspace_id
  and s.id = d.service_id
on conflict (id) do update
set service_id = excluded.service_id,
    description = excluded.description,
    quantity = excluded.quantity,
    unit_price = excluded.unit_price,
    line_total = excluded.line_total,
    selected_options = excluded.selected_options;

insert into public.quotes (
  id, workspace_id, order_id, quote_number, version, status, valid_until,
  subtotal, discount_amount, tax_rate, tax_amount, delivery_charge, total_amount,
  terms
)
select
  ('00000000-0000-0000-0000-' || lpad((7000 + row_number() over (order by d.order_number))::text, 12, '0'))::uuid,
  ctx.workspace_id,
  d.order_id,
  'QT-' || substring(d.order_number from 4),
  1,
  case when d.status = 'quoted' then 'sent'::public.quote_status
       else 'accepted'::public.quote_status end,
  current_date + 7,
  d.subtotal,
  d.discount_amount,
  d.tax_rate,
  d.tax_amount,
  d.delivery_charge,
  d.total_amount,
  'Quote valid for 7 days. Production starts after approval and advance payment.'
from pg_temp.jobloop_seed_context ctx
cross join pg_temp.jobloop_demo_orders d
where d.status not in ('enquiry', 'cancelled')
on conflict (id) do update
set quote_number = excluded.quote_number,
    status = excluded.status,
    valid_until = excluded.valid_until,
    subtotal = excluded.subtotal,
    discount_amount = excluded.discount_amount,
    tax_rate = excluded.tax_rate,
    tax_amount = excluded.tax_amount,
    delivery_charge = excluded.delivery_charge,
    total_amount = excluded.total_amount,
    terms = excluded.terms;

insert into public.payments (
  id, workspace_id, order_id, amount, method, status, reference, paid_at
)
select
  ('00000000-0000-0000-0000-' || lpad((8000 + row_number() over (order by d.order_number))::text, 12, '0'))::uuid,
  ctx.workspace_id,
  d.order_id,
  d.advance_paid,
  'upi',
  'completed',
  'DEMO-UPI-' || substring(d.order_number from 4),
  d.created_at
from pg_temp.jobloop_seed_context ctx
cross join pg_temp.jobloop_demo_orders d
where d.advance_paid > 0
on conflict (id) do update
set amount = excluded.amount,
    status = excluded.status,
    reference = excluded.reference,
    paid_at = excluded.paid_at;

insert into public.order_events (
  id, workspace_id, order_id, event_type, new_status, description, created_at
)
select
  ('00000000-0000-0000-0000-' || lpad((9000 + row_number() over (order by d.order_number))::text, 12, '0'))::uuid,
  ctx.workspace_id,
  d.order_id,
  'order_created',
  d.status,
  'Demo order added to the workspace.',
  d.created_at
from pg_temp.jobloop_seed_context ctx
cross join pg_temp.jobloop_demo_orders d
on conflict (id) do update
set new_status = excluded.new_status,
    description = excluded.description,
    created_at = excluded.created_at;
