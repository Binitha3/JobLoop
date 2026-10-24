do $$
declare
  existing_user record;
  workspace_name text;
  workspace_slug text;
  new_workspace_id uuid;
begin
  for existing_user in
    select u.id, u.email, u.raw_user_meta_data
    from auth.users u
    where not exists (
      select 1
      from public.workspace_members wm
      where wm.user_id = u.id
    )
  loop
    workspace_name := left(
      coalesce(
        nullif(trim(existing_user.raw_user_meta_data ->> 'workspace_name'), ''),
        split_part(coalesce(existing_user.email, 'New business'), '@', 1) || ' Print Shop'
      ),
      120
    );
    workspace_slug := regexp_replace(lower(workspace_name), '[^a-z0-9]+', '-', 'g');

    insert into public.workspaces (name, slug, email)
    values (
      workspace_name,
      trim(both '-' from workspace_slug) || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8),
      existing_user.email
    )
    returning id into new_workspace_id;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (new_workspace_id, existing_user.id, 'owner');
  end loop;
end;
$$;
