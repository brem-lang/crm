-- Merges direct user_permissions with role-derived permissions (system roles
-- via user_roles + custom roles via user_custom_roles/roles) in a single
-- server-side query, replacing what was previously 2 sequential client
-- round-trips plus a redundant user_custom_roles fetch duplicated elsewhere.
--
-- No SECURITY DEFINER: relies on the existing RLS policies on the underlying
-- tables (self/super_admin/manager on user_permissions and user_roles,
-- self/super_admin on user_custom_roles, open-select on
-- role_permission_mappings), matching the access the client already had when
-- querying these tables directly.
create or replace function public.get_current_user_permissions(p_user_id uuid)
returns text[]
language sql
stable
as $$
  select coalesce(array_agg(distinct perm), '{}')
  from (
    select permission::text as perm
    from user_permissions
    where user_id = p_user_id

    union

    select rpm.permission_key as perm
    from role_permission_mappings rpm
    where rpm.role_slug in (
      select role::text from user_roles where user_id = p_user_id
      union
      select r.slug
      from user_custom_roles ucr
      join roles r on r.id = ucr.role_id
      where ucr.user_id = p_user_id
    )
  ) merged;
$$;

grant execute on function public.get_current_user_permissions(uuid) to authenticated;
