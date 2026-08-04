# `leads` Table Schema

Source of truth: [`src/integrations/supabase/types.ts`](../src/integrations/supabase/types.ts) (`public.leads`, auto-generated from the Supabase schema).

| Column | Type | Nullable |
| --- | --- | --- |
| `id` | `string` (uuid, PK) | — |
| `request_id` | `string` | ✓ |
| `firstname` | `string` | — |
| `lastname` | `string` | — |
| `email` | `string` | — |
| `mobile` | `string` | — |
| `country_code` | `string` | — |
| `country` | `string` | ✓ |
| `city` | `string` | ✓ |
| `locale` | `string` | ✓ |
| `ip_address` | `string` | ✓ |
| `user_agent` | `string` | ✓ |
| `platform` | `string` | ✓ |
| `browser` | `string` | ✓ |
| `aff_sub` | `string` | ✓ |
| `affiliate_id` | `string` | ✓ |
| `advertiser_id` | `string` | ✓ |
| `assigned_to` | `string` | ✓ |
| `offer_name` | `string` | ✓ |
| `click_id` | `string` | ✓ |
| `autologin` | `string` | ✓ |
| `comment` | `string` | ✓ |
| `custom1` | `string` | ✓ |
| `custom2` | `string` | ✓ |
| `custom3` | `string` | ✓ |
| `custom4` | `string` | ✓ |
| `custom5` | `string` | ✓ |
| `status` | enum `lead_status` | — |
| `sale_status` | `string` | ✓ |
| `is_ftd` | `boolean` | — |
| `ftd_date` | `string` | ✓ |
| `ftd_id` | `string` | ✓ |
| `ftd_released` | `boolean` | — |
| `ftd_released_at` | `string` | ✓ |
| `ftd_released_by` | `string` | ✓ |
| `is_live` | `boolean` | — |
| `needs_review` | `boolean` | ✓ |
| `fraud_score` | `number` | ✓ |
| `fraud_flags` | `Json` | ✓ |
| `is_proxy` | `boolean` | ✓ |
| `time_to_click` | `number` | ✓ |
| `ip_address` (submission) | `string` | ✓ |
| `submission_country` | `string` | ✓ |
| `submission_asn` | `string` | ✓ |
| `submission_ua` | `string` | ✓ |
| `click_ip` | `string` | ✓ |
| `click_country` | `string` | ✓ |
| `click_asn` | `string` | ✓ |
| `click_ua` | `string` | ✓ |
| `live_lead_score` | `number` | ✓ |
| `live_lead_status` | `string` | ✓ |
| `distributed_at` | `string` | ✓ |
| `created_at` | `string` (timestamptz) | — |
| `updated_at` | `string` (timestamptz) | — |

**52 columns total.**

## Grouped by purpose

- **Identity / contact:** `id`, `request_id`, `firstname`, `lastname`, `email`, `mobile`
- **Location & device:** `country_code`, `country`, `city`, `locale`, `ip_address`, `user_agent`, `platform`, `browser`
- **Attribution:** `aff_sub`, `affiliate_id`, `advertiser_id`, `assigned_to`, `offer_name`, `click_id`, `autologin`
- **Free-form / custom:** `comment`, `custom1`–`custom5`
- **Status & sales:** `status` (enum), `sale_status`, `is_ftd`, `ftd_date`, `ftd_id`, `ftd_released`, `ftd_released_at`, `ftd_released_by`
- **Quality / fraud:** `is_live`, `needs_review`, `fraud_score`, `fraud_flags`, `is_proxy`
- **Live lead scoring** (see [`live-lead-scoring.md`](./live-lead-scoring.md)): `time_to_click`, `submission_country`, `submission_asn`, `submission_ua`, `click_ip`, `click_country`, `click_asn`, `click_ua`, `live_lead_score`, `live_lead_status`
- **Timestamps:** `distributed_at`, `created_at`, `updated_at`

## Note

`submission_ua` exists as a column but `src/lib/liveLeadScoring.ts` reads `user_agent` for the submission-side UA instead of `submission_ua`. Worth confirming whether `submission_ua` is a leftover/unused column or should be wired in.
