create function public.seed_default_workspace_services()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.services (
    workspace_id, name, unit, base_price, cost_price, active
  )
  values
    (new.id, 'Flyers', 'piece', 4.00, null, true),
    (new.id, 'Business Cards', 'set', 300.00, null, true),
    (new.id, 'Vinyl Banners', 'sq_ft', 45.00, null, true),
    (new.id, 'T-shirt Printing', 'piece', 399.00, null, true),
    (new.id, 'Custom Mugs', 'piece', 249.00, null, true)
  on conflict (workspace_id, name) do nothing;

  return new;
end;
$$;

create trigger workspaces_seed_default_services
after insert on public.workspaces
for each row execute function public.seed_default_workspace_services();

insert into public.services (
  workspace_id, name, unit, base_price, cost_price, active
)
select
  w.id,
  seed.name,
  seed.unit::public.service_unit,
  seed.base_price,
  null,
  true
from public.workspaces w
cross join (
  values
    ('Flyers', 'piece', 4.00::numeric),
    ('Business Cards', 'set', 300.00::numeric),
    ('Vinyl Banners', 'sq_ft', 45.00::numeric),
    ('T-shirt Printing', 'piece', 399.00::numeric),
    ('Custom Mugs', 'piece', 249.00::numeric)
) as seed(name, unit, base_price)
where not exists (
  select 1
  from public.services s
  where s.workspace_id = w.id
    and s.active
)
on conflict (workspace_id, name) do nothing;

notify pgrst, 'reload schema';
