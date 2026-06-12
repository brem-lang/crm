# CLAUDE.md — Backend CRM

## Project Overview

A lead management CRM built with React + TypeScript + Vite, backed by Supabase (PostgreSQL, RLS, Edge Functions). The system handles lead intake from affiliates, distribution to advertisers, injection jobs, reporting, and user/role management.

## Build & Dev Commands

```bash
npm run build        # Production build — ALWAYS use this to verify changes
npm run dev          # Dev server (for local testing only, not for applying changes)
npm run lint         # ESLint
npm run test         # Vitest (unit tests)
```

> **Important:** Always run `npm run build` after code changes to confirm no TypeScript errors. The build script also copies compiled assets into the `assets/` directory and updates `index.html`.

The build script (`package.json`):

```
cp index.source.html index.html && vite build && rm -f assets/index-*.js assets/index-*.css && cp dist/assets/* assets/ && cp dist/index.html index.html
```

## Tech Stack

| Layer          | Technology                                |
| -------------- | ----------------------------------------- |
| Frontend       | React 18, TypeScript, Vite                |
| UI             | shadcn/ui (Radix UI), Tailwind CSS        |
| State / Data   | TanStack Query v5 (useQuery, useMutation) |
| Routing        | React Router DOM v6                       |
| Forms          | React Hook Form + Zod                     |
| Backend        | Supabase (PostgreSQL + PostgREST + Auth)  |
| Edge Functions | Deno (Supabase Functions)                 |
| Notifications  | Sonner (toast)                            |
| Charts         | Recharts                                  |
| Drag/Drop      | dnd-kit                                   |

## Project Structure

```
src/
  App.tsx                    # Routes + global providers
  main.tsx
  pages/                     # One file per route
  components/
    layout/                  # DashboardLayout, Sidebar
    ui/                      # shadcn/ui components (do not edit)
    advertisers/
    affiliates/
    distribution/
    filters/
    injection/
    leads/
    monitoring/
    pools/
    users/
  hooks/                     # All data-fetching and mutation logic lives here
  integrations/
    supabase/
      client.ts              # Supabase client (reads from env vars)
      types.ts               # Auto-generated DB types (+ manual additions)
supabase/
  migrations/                # SQL migrations (deployed to Supabase)
  functions/                 # Edge Functions (Deno runtime)
```

## Environment Variables

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Set in `.env` (local) or hosting platform environment settings.

## Authentication & RBAC

### System Roles (`app_role` PostgreSQL enum — cannot be extended)

- `super_admin` — full access
- `manager` — most access
- `agent` — leads + reports
- `affiliate` — submit leads only

Stored in `user_roles` table (`user_id`, `role: app_role`).

### Custom Roles

Stored in `roles` table with a TEXT slug (not enum). Assigned via `user_custom_roles` table (`user_id → role_id`). Each custom role has permissions defined in `role_permission_mappings` (`role_slug → permission_key`).

**Do not try to add values to the `app_role` enum.** It is locked. Use custom roles instead.

### Permission System

Permissions are merged at runtime in `src/hooks/useUserPermissions.ts`:

```
effectivePermissions =
  role_permission_mappings (system role)
  ∪ role_permission_mappings (each custom role)
  ∪ user_permissions (direct per-user grants)
```

Super admins bypass all permission checks. 38 named permissions cover all CRUD operations across every module.

### Auth Context

`useAuth()` (from `src/hooks/useAuth.tsx`) exposes:

- `user`, `session`, `roles`, `customRoleNames`, `username`
- `isSuperAdmin`, `isManager`, `isAgent`, `isAffiliate`
- `signIn`, `signInWithUsername`, `signOut`

The sidebar footer shows the user's role(s) using both `roles` (system) and `customRoleNames`.

## Key Hooks

| Hook                      | Purpose                                                                      |
| ------------------------- | ---------------------------------------------------------------------------- |
| `useLeads`                | Leads CRUD + filtering                                                       |
| `useAdvertisers`          | Advertisers CRUD                                                             |
| `useAffiliates`           | Affiliates CRUD                                                              |
| `useDistributionRules`    | Distribution rule CRUD                                                       |
| `useDistributionSettings` | Advertiser config/schedule                                                   |
| `useUsers`                | User list + role display (fetches both `user_roles` and `user_custom_roles`) |
| `useRoles`                | Roles table CRUD                                                             |
| `useRolePermissions`      | Role→permission mappings                                                     |
| `useUserPermissions`      | Current user's merged permissions                                            |
| `useCRMSettings`          | CRM name, date format, timezone from `crm_settings` table                    |

## Edge Functions

Located in `supabase/functions/`. All run on Deno.

| Function                         | Purpose                                                   |
| -------------------------------- | --------------------------------------------------------- |
| `create-user`                    | Admin creates a user via service role key                 |
| `impersonate-user`               | Super admin generates a magic link token for another user |
| `distribute-lead`                | Core lead routing logic                                   |
| `submit-lead` / `submit-lead-v2` | Public lead intake endpoints                              |
| `route-lead`                     | Routes a lead to an advertiser                            |
| `send-injection`                 | Processes injection job batches                           |
| `advertiser-callback`            | Handles advertiser webhook callbacks                      |

`create-user` validates the caller is `super_admin` before creating. It accepts `roles: []` (empty array is valid for custom-role users — validation only requires `email` and `password`).

## Database Conventions

- All tables use `UUID` primary keys (`gen_random_uuid()`)
- Timestamps: `created_at TIMESTAMPTZ DEFAULT now()`, `updated_at` via trigger
- RLS is enabled on all tables
- Helper functions: `is_super_admin(uid)`, `is_manager(uid)`, `is_agent(uid)`, `is_affiliate(uid)`
- Migrations in `supabase/migrations/` — run `supabase db push` to apply

### Key Tables

| Table                              | Notes                                                     |
| ---------------------------------- | --------------------------------------------------------- |
| `leads`                            | Core leads data                                           |
| `advertisers`                      | Advertisers                                               |
| `affiliates`                       | Affiliates                                                |
| `profiles`                         | User profile (username, full_name) — mirrors `auth.users` |
| `user_roles`                       | System role assignments (`app_role` enum)                 |
| `roles`                            | Custom roles (id, name, slug, color, is_system)           |
| `user_custom_roles`                | user_id → role_id for custom roles                        |
| `role_permission_mappings`         | role_slug → permission_key                                |
| `user_permissions`                 | Direct per-user permission overrides                      |
| `distribution_rules`               | Lead routing rules                                        |
| `distribution_rule_targets`        | Advertisers per rule (separate table, not a column)       |
| `advertiser_distribution_settings` | Per-advertiser routing config                             |
| `crm_settings`                     | Global CRM config (name, timezone, etc.)                  |

## Common Pitfalls

### PostgREST schema cache errors

If you see "could not find X in the schema cache", it usually means:

1. A new migration was applied but the Supabase API schema cache hasn't refreshed — go to Supabase Dashboard → Settings → API → Reload Schema
2. A Supabase `.update()` call is passing extra fields (non-column keys) in the payload — always explicitly pick DB columns, never spread full objects that may contain relationship data

### `distribution_rule_targets` is a table, not a column

When updating `distribution_rules`, never include `targets` in the `.update()` payload. The `targets` field exists only on the TypeScript interface as a joined relationship.

### Custom roles vs system roles in mutations

When creating/editing a user:

- System role → insert into `user_roles`, clear `user_custom_roles`
- Custom role → clear `user_roles`, insert into `user_custom_roles`
  The `create-user` edge function handles system roles only; sync custom roles afterward via `useSyncUserCustomRoles`.

### Supabase client path

Always import from `@/integrations/supabase/client`, not from `@supabase/supabase-js` directly.

## Adding a New Page

1. Create `src/pages/MyPage.tsx` using `<DashboardLayout>` as wrapper
2. Add route in `src/App.tsx`
3. Add nav item in `src/components/layout/Sidebar.tsx` (set `roles` to restrict access)
4. If the page needs data, create `src/hooks/useMyFeature.ts` — put all Supabase queries there, not in the component

## Adding a New Permission

1. Add the key to `AVAILABLE_PERMISSIONS` array in `src/hooks/useUserPermissions.ts` (include `id`, `label`, `description`, `group`)
2. Add the corresponding `can*` boolean derived from `permissions` array
3. Seed it into the migration for the roles that should have it by default
4. Use `canDoThing` from `useCurrentUserPermissions()` in the component
