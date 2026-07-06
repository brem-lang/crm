-- Make the "Admin" custom role's data access identical to super_admin.
--
-- The "Admin" custom role (20260624000000_add_admin_role.sql, "Full access
-- except CRM Integrations") is assigned via user_custom_roles, a completely
-- separate table from user_roles (the locked app_role enum). Every RLS
-- policy across the schema checks is_super_admin()/is_manager()/is_agent(),
-- which only read user_roles — so a user with only the "Admin" custom role
-- fails all of them and gets silently empty results everywhere (Leads,
-- Affiliates, Advertisers, Dashboard, etc.), not an error.
--
-- Rather than patching every table's RLS policies individually, extend the
-- one function nearly all of them call. This cascades to every policy that
-- calls is_super_admin() with no other changes needed.
--
-- Verified safe: the "Admin" role's one deliberate exclusion (CRM
-- Integration settings) is enforced via role_permission_mappings-driven UI
-- checks only — the crm_types table has no RLS policy referencing
-- is_super_admin() at all, so this cannot leak that access back.
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.has_role(_user_id, 'super_admin')
        OR EXISTS (
            SELECT 1
            FROM public.user_custom_roles ucr
            JOIN public.roles r ON r.id = ucr.role_id
            WHERE ucr.user_id = _user_id AND r.slug = 'admin'
        );
$$;
