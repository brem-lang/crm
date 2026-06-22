-- Seed Admin as a system role (full access except CRM Integrations)
INSERT INTO public.roles (name, slug, description, color, is_system)
VALUES ('Admin', 'admin', 'Full access except CRM Integrations', '#6366f1', true)
ON CONFLICT (slug) DO NOTHING;

-- Grant all super_admin permissions EXCEPT the 4 CRM integration ones
INSERT INTO public.role_permission_mappings (role_slug, permission_key)
SELECT 'admin', permission_key
FROM public.role_permission_mappings
WHERE role_slug = 'super_admin'
  AND permission_key NOT IN (
    'view_crm_types',
    'create_crm_types',
    'edit_crm_types',
    'delete_crm_types'
  )
ON CONFLICT DO NOTHING;
