-- Fix: lead_distributions SELECT policy only covered system roles.
-- Custom roles (admin, affiliate_manager, advertiser_manager) got empty
-- lead_distributions arrays from PostgREST joins, making the Request/Response
-- modals always show "No distribution record found".
--
-- New policy: anyone who can read leads can also read their distributions.
-- This mirrors the leads SELECT policy logic extended with custom-role checks.

DROP POLICY IF EXISTS "Staff can view distributions" ON public.lead_distributions;

-- super_admin / manager / agent (system roles)
CREATE POLICY "lead_distributions_select_system_roles"
ON public.lead_distributions FOR SELECT
USING (
  public.is_super_admin(auth.uid())
  OR public.is_manager(auth.uid())
  OR public.is_agent(auth.uid())
);

-- Any user whose custom role has the view_leads permission
CREATE POLICY "lead_distributions_select_custom_roles"
ON public.lead_distributions FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_custom_roles ucr
    JOIN public.roles r ON r.id = ucr.role_id
    JOIN public.role_permission_mappings rpm ON rpm.role_slug = r.slug
    WHERE ucr.user_id = auth.uid()
      AND rpm.permission_key = 'view_leads'
  )
);

-- Direct per-user view_leads permission grant
CREATE POLICY "lead_distributions_select_direct_permission"
ON public.lead_distributions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = auth.uid()
      AND permission_key = 'view_leads'
  )
);

-- Affiliate managers: can see distributions for leads from their assigned affiliates
CREATE POLICY "lead_distributions_select_affiliate_manager"
ON public.lead_distributions FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_affiliate_assignments uaa
    JOIN public.leads l ON l.id = lead_distributions.lead_id
    WHERE uaa.user_id = auth.uid()
      AND uaa.affiliate_id = l.affiliate_id
  )
);

-- Advertiser managers: can see distributions for their assigned advertisers
CREATE POLICY "lead_distributions_select_advertiser_manager"
ON public.lead_distributions FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_advertiser_assignments uaa
    WHERE uaa.user_id = auth.uid()
      AND uaa.advertiser_id = lead_distributions.advertiser_id
  )
);
