# Backend CRM — Architecture & Advertiser CRM Types

## Table of Contents

1. [System Overview](#system-overview)
2. [Lead Lifecycle](#lead-lifecycle)
3. [Advertiser CRM Types](#advertiser-crm-types)
4. [Distribution Engine](#distribution-engine)
5. [Injection System](#injection-system)
6. [Edge Functions](#edge-functions)
7. [Role & Permission Model](#role--permission-model)

---

> **Jump to:** [Injection System ↓](#injection-system) | [CRM Types ↓](#advertiser-crm-types)
2. [Lead Lifecycle](#lead-lifecycle)
3. [Advertiser CRM Types](#advertiser-crm-types)
4. [Distribution Engine](#distribution-engine)
5. [Edge Functions](#edge-functions)
6. [Role & Permission Model](#role--permission-model)

---

## System Overview

This CRM is a **lead management platform** built on React + TypeScript + Vite with Supabase (PostgreSQL, RLS, Edge Functions) as the backend. It handles the full lifecycle of a lead — from intake via affiliate submissions, through distribution rules, all the way to injection into external advertiser CRM platforms.

```
Affiliate / External Source
        │  POST /submit-lead
        ▼
  [Leads Table]  ──────────────────────────────────────────────────────────────────
        │                                                                          │
        │  distribute-lead / route-lead                                            │
        ▼                                                                          ▼
  Distribution Engine                                                       Lead Pool
  (rules + caps + schedule)
        │
        │  advertiser adapter
        ▼
  External CRM API  (TrackBox / Getlinked / DrMailer / EliteCRM / etc.)
        │
        ▼
  external_lead_id + autologin_url stored back on lead
```

---

## Lead Lifecycle

| Stage | Description |
|---|---|
| **Intake** | Lead arrives via `submit-lead` or `submit-lead-v2` edge function, or is created manually in the UI. |
| **Queued / New** | Stored in the `leads` table with status `NEW`. |
| **Distribution** | `distribute-lead` evaluates distribution rules, caps, geo filters, affiliate filters, and schedule windows. |
| **Injection** | `send-injection` processes batch injection jobs — loops through leads and fires the relevant adapter. |
| **Callback** | `advertiser-callback` handles asynchronous webhook responses from external CRMs. |
| **Status Updates** | Agents update lead status (QUALIFIED, FTD, CONVERTED, etc.) manually or via imported callbacks. |

---

## Advertiser CRM Types

Each advertiser record has an `advertiser_type` field. This determines which API adapter fires when a lead is distributed to that advertiser. All requests are routed through a VPS forwarder (`https://crm.alphatradecrm.com/proxy/forward.php`) for IP whitelisting.

### Complete List (11 Types)

| # | Value | Label | Auth Method | Content Type |
|---|---|---|---|---|
| 1 | `trackbox` | TrackBox | Separate POST + GET API keys, plus AI/CI/GI params | JSON |
| 2 | `enigma` | Getlinked | `Api-Key` header | `application/x-www-form-urlencoded` |
| 3 | `drmailer` | Dr Tracker | `api_key` + `pass` + `campaign_id` in body | `application/x-www-form-urlencoded` |
| 4 | `timelocal` | Timelocal | `Api-Key` header | JSON |
| 5 | `elitecrm` | EliteCRM | `Api-Key` header + `sender` param | JSON |
| 6 | `gsi` | GSI Markets | `id` + `hash` URL parameters | PHP/query string |
| 7 | `elnopy` | ELNOPY (Mpower Traffic) | `api_token` in query string | JSON, E.164 phone |
| 8 | `reacto` | Reacto Trading | `api_key` header | JSON, mTLS-secured |
| 9 | `streamline11` | Streamline11 | `affid` + `funnel` slug in body | `application/x-www-form-urlencoded` |
| 10 | `custom` | Custom | User-defined | User-defined |
| 11 | `mock` | Mock (Testing) | No auth — test/dev only | N/A |

---

### Type Details

#### `trackbox` — TrackBox

- **Auth:** Two separate API keys — `api_key_post` (for POST/create) and `api_key_get` (for GET/poll)
- **Extra params:** `ai` (account ID), `ci` (campaign ID), `gi` (group ID), `username`, `password`
- **Flow:** POST lead → poll autologin URL via GET key
- **Response:** Returns `addonData.data.loginURL` as the autologin URL

#### `enigma` — Getlinked

- **Auth:** `Api-Key: <api_key>` request header
- **Format:** `application/x-www-form-urlencoded`
- **Response:** JSON with `details.leadRequest.ID` (external lead ID) and `details.redirect.url` (autologin)

#### `drmailer` — Dr Tracker

- **Auth:** `api_key` + `pass` fields in POST body
- **Extra params:** `campaign_id`
- **Format:** `application/x-www-form-urlencoded`

#### `timelocal` — Timelocal

- **Auth:** `Api-Key: <api_key>` request header
- **Format:** JSON body

#### `elitecrm` — EliteCRM

- **Auth:** `Api-Key: <api_key>` request header
- **Extra params:** `sender` (required)
- **Format:** JSON body

#### `gsi` — GSI Markets

- **Auth:** `id` and `hash` appended as URL query parameters (PHP-style API)
- **Format:** Query string / URL parameters

#### `elnopy` — ELNOPY / Mpower Traffic

- **Auth:** `api_token` in query string + `link_id` + `source`
- **Phone format:** E.164 (e.g. `+393401234567`)
- **Format:** JSON body

#### `reacto` — Reacto Trading

- **Auth:** `api_key` header (mTLS-secured endpoint, internal trading platform)
- **Format:** JSON body

#### `streamline11` — Streamline11

- **Auth:** `affid` (affiliate ID) + `funnel` (funnel slug) in POST body, plus optional `token`
- **Base URL:** `gpapi.org`
- **Format:** `application/x-www-form-urlencoded`

#### `custom` — Custom

- Fully user-configured fields. Used for in-house or non-standard integrations.

#### `mock` — Mock / Test

- No real API call. Used only in development/testing to simulate a successful distribution without hitting an external CRM.

---

### Advertiser Config Fields by Type

| CRM Type | `url` | `api_key` | `api_key_post` | `api_key_get` | `username` | `password` | `ai` / `ci` / `gi` | `sender` | `gsi_id` / `gsi_hash` | `api_token` / `link_id` / `source` | `affid` / `funnel` / `token` | `campaign_id` / `pass` |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| trackbox | ✓ | | ✓ | ✓ | ✓ | ✓ | ✓ | | | | | |
| enigma | ✓ | ✓ | | | | | | | | | | |
| drmailer | ✓ | ✓ | | | | | | | | | | ✓ |
| timelocal | ✓ | ✓ | | | | | | | | | | |
| elitecrm | ✓ | ✓ | | | | | | ✓ | | | | |
| gsi | ✓ | | | | | | | | ✓ | | | |
| elnopy | ✓ | | | | | | | | | ✓ | | |
| reacto | ✓ | ✓ | | | | | | | | | | |
| streamline11 | ✓ | | | | | | | | | | ✓ | |
| custom | ✓ | ✓ | | | | | | | | | | |

---

## Distribution Engine

The distribution engine (`distribute-lead` edge function) decides **which advertiser receives a lead** based on:

### Distribution Rules

Each rule has a `rule_type`:

| Type | Behaviour |
|---|---|
| `priority` | Try advertisers in priority order; first one with capacity wins |
| `weighted` | Distribute leads proportionally by weight across multiple advertisers |
| `affiliate` | Route based on which affiliate submitted the lead |
| `geo` | Route based on the lead's country code |

### Conditions (Filters)

Each rule can filter by:
- `affiliate_ids` — only match leads from specific affiliates
- `country_codes` — only match leads from specific countries
- `language_codes` — only match leads with a specific language
- `device_types` — only match leads from a specific device type

### Cap Enforcement

Before distributing, the engine checks:
1. **Daily cap** — max leads distributed to an advertiser today
2. **Hourly cap** — max leads distributed in the current hour
3. **Working hours** — `start_time` / `end_time` per advertiser or `weekly_schedule` (per-day on/off + time window)
4. **Geo filter** — allowed `countries` list on `advertiser_distribution_settings`
5. **Affiliate filter** — allowed `affiliates` list on `advertiser_distribution_settings`

### Rejection Reasons

| Code | Meaning |
|---|---|
| `no_matching_rule` | No active rule matched this lead |
| `advertiser_paused` | Advertiser is inactive |
| `outside_working_hours` | Current time is outside the advertiser's schedule |
| `daily_cap_reached` | Advertiser hit its daily lead cap |
| `hourly_cap_reached` | Advertiser hit its hourly lead cap |
| `country_not_allowed` | Lead's country is not in the advertiser's allowed list |
| `affiliate_not_allowed` | Lead's affiliate is not in the advertiser's allowed list |
| `duplicate_lead` | Lead was already sent to this advertiser |
| `advertiser_rejected` | External CRM returned a rejection response |

---

## Injection System

An **injection job** is a controlled, time-paced batch send of leads from a **Lead Pool** to one or more advertisers. It mimics organic traffic by randomising delays, device types, user-agents, IPs, and browser fingerprints — rather than blasting all leads at once.

### Concept Map

```
Lead Pool  ──────────────────────────────────────────────────────►  Injection Job
(pool_leads table)                                                   (injections table)
                                                                          │
                                                              ┌───────────┴───────────┐
                                                         Settings               Lead Queue
                                                     (caps, schedule,        (injection_leads table)
                                                      noise, smart mode)          │
                                                                                   │ send-injection (cron/edge fn)
                                                                                   ▼
                                                                        Advertiser CRM API
                                                                   (trackbox / enigma / elitecrm …)
                                                                                   │
                                                                      external_lead_id + autologin_url
                                                                       stored back on injection_lead
```

---

### Step-by-Step: How to Create an Injection

#### Step 1 — Build a Lead Pool

A Lead Pool is a named bucket of lead records. Before creating an injection you must have a pool with leads in it.

- Go to **Pools** in the sidebar
- Create a new pool (give it a name)
- Import or assign leads to it — leads land in `lead_pool_leads`

#### Step 2 — Create the Injection Job

- Go to **Injections** in the sidebar → click **New Injection**
- Fill in the **New Injection Dialog** (`src/components/injection/NewInjectionDialog.tsx`):

| Field | Description |
|---|---|
| `name` | Human-readable label for this job (e.g. "IT Batch June W1") |
| `pool_id` | The Lead Pool to draw leads from |

This creates the injection record in `status = 'draft'`.

#### Step 3 — Configure Settings

After creation, open the injection and fill in **InjectionSettingsForm**:

| Field | Type | Description |
|---|---|---|
| `advertiser_ids` | UUID[] | One or more target advertisers (leads rotate across them) |
| `min_delay_seconds` | integer | Minimum gap between sends (e.g. `30`) |
| `max_delay_seconds` | integer | Maximum gap between sends (e.g. `180`) |
| `noise_level` | `low` / `medium` / `high` | How much variance to add to delays |
| `smart_mode` | boolean | Auto-calculates delay so all leads finish within the working window |
| `allow_resend_same_advertiser` | boolean | Skip the 5-day same-advertiser cooldown |
| `working_start_time` | TIME | e.g. `09:00` — don't send before this time |
| `working_end_time` | TIME | e.g. `18:00` — stop sending after this time |
| `working_days` | TEXT[] | Days to send on: `["monday","tuesday","wednesday","thursday","friday"]` |
| `geo_caps` | JSONB | Max leads per country: `{"IT": 100, "DE": 50}` |
| `offer_name` | TEXT | Override the offer name on every lead in this batch |
| `filter_countries` | TEXT[] | Only include leads with these country codes |
| `filter_affiliate_ids` | UUID[] | Only include leads from these affiliates |
| `filter_from_date` | TIMESTAMPTZ | Only include leads created after this date |
| `filter_to_date` | TIMESTAMPTZ | Only include leads created before this date |

#### Step 4 — Validate (Pre-flight Check)

Before starting, the UI calls `validate-injection` which returns:

```json
{
  "total_leads": 250,
  "will_send": 198,
  "will_skip_duplicates": 42,
  "will_skip_geo_cap": 10,
  "duplicate_emails": ["already@sent.com", "..."],
  "advertisers": [
    { "id": "uuid", "name": "TrackBox EU", "duplicates": 42 }
  ],
  "geo_breakdown": [
    { "country_code": "IT", "leads": 120, "cap": 100, "will_send": 100, "will_skip": 20 },
    { "country_code": "DE", "leads": 80,  "cap": 50,  "will_send": 50,  "will_skip": 30 }
  ]
}
```

This tells you exactly what will be sent, what will be skipped (duplicates already sent in past injections or live distributions), and what will be skipped due to geo caps.

#### Step 5 — Start the Injection

Click **Start**. This:
1. Sets `status = 'running'`
2. Copies filtered pool leads into `injection_leads` (status `pending`)
3. Calculates `scheduled_at` for the first lead
4. The `send-injection` edge function (called on a cron loop or triggered directly) picks it up

---

### How `send-injection` Processes Leads

Each invocation of the function:

1. **Recover stuck leads** — any lead stuck in `'sending'` for >5 min is reset to `'pending'`
2. **Find due injections** — all `'running'` injections where `next_scheduled_at <= now + 30s`
3. **Claim the next lead atomically** — updates status `pending → sending` in a single UPDATE with RETURNING to avoid race conditions
4. **Global send protection** — checks `global_sent_leads` table:
   - Lead cannot go to >1 advertiser within 24 hours
   - Lead cannot go to the same advertiser for 5 days (unless `allow_resend_same_advertiser = true`)
5. **GEO cap check** — counts `sent` leads for that country; skips if at cap
6. **Traffic simulation** — generates:
   - Device type: 65% mobile / 35% desktop
   - Rotating user-agent from 50+ real browser strings
   - IP address from MangoProxy (sticky session, city-clustered)
   - ISP name (rotates every 6–10 leads)
   - Browser language and timezone matched to country
7. **Fire the adapter** — calls the advertiser's CRM API (all routed through VPS forwarder at `crm.alphatradecrm.com/proxy/forward.php`)
8. **Store result** — writes `external_lead_id`, `autologin_url`, `response`, sets status `sent` or `failed`
9. **Schedule next lead** — calculates next `scheduled_at` based on delay settings and writes it back to the injection

---

### Delay Modes

#### Standard Mode
```
actual_delay = random(min_delay_seconds, max_delay_seconds)
noise expansion per noise_level:
  low    → min × 0.9  … max × 1.1
  medium → min × 0.7  … max × 1.5
  high   → min × 0.4  … max × 2.5
```

#### Smart Mode
Self-balancing — calculates how many leads can still be sent in today's remaining working window and sets a delay so the batch finishes by `working_end_time`. Uses four randomised zones:

| Zone | Share | Delay multiplier |
|---|---|---|
| BURST | 12% | 0.3× budget delay |
| NORMAL | 28% | 0.7× budget delay |
| SLOW | 35% | 1.2× budget delay |
| LULL | 25% | 2.0× budget delay |

---

### Injection Status Flow

```
draft
  │ (start clicked)
  ▼
running ──► paused ──► running  (resume)
  │
  ▼
completed  (all leads sent / skipped)
  │
cancelled  (manually stopped)
```

### Lead Status Flow (per `injection_lead`)

```
pending → scheduled → sending → sent
                              ↘ failed
                              ↘ skipped  (duplicate or geo cap)
```

---

### Sample Injection JSON (API / Supabase Insert)

This is the shape of a full injection record you would insert or PATCH via the Supabase client:

```json
{
  "name": "IT + DE Batch — June Week 1",
  "pool_id": "a1b2c3d4-0000-0000-0000-000000000001",
  "advertiser_ids": [
    "adv-uuid-0000-0000-0000-000000000001",
    "adv-uuid-0000-0000-0000-000000000002"
  ],
  "status": "draft",

  "min_delay_seconds": 45,
  "max_delay_seconds": 210,
  "noise_level": "medium",
  "smart_mode": false,
  "allow_resend_same_advertiser": false,

  "working_start_time": "09:00:00",
  "working_end_time": "18:00:00",
  "working_days": ["monday", "tuesday", "wednesday", "thursday", "friday"],

  "geo_caps": {
    "IT": 100,
    "DE": 50,
    "ES": 30
  },

  "filter_countries": ["IT", "DE", "ES"],
  "filter_affiliate_ids": null,
  "filter_from_date": "2026-05-01T00:00:00Z",
  "filter_to_date": "2026-06-01T00:00:00Z",

  "offer_name": "AlphaTrade Summer 2026"
}
```

---

### Sample `injection_lead` Record (After Send)

```json
{
  "id": "lead-uuid-0000-0000-0000-000000000001",
  "injection_id": "inj-uuid-0000-0000-0000-000000000001",
  "pool_lead_id": "pool-lead-uuid-000000000001",
  "advertiser_id": "adv-uuid-0000-0000-0000-000000000001",

  "firstname": "Marco",
  "lastname": "Rossi",
  "email": "marco.rossi@example.com",
  "mobile": "+393401234567",
  "country_code": "IT",
  "country": "Italy",
  "offer_name": "AlphaTrade Summer 2026",

  "status": "sent",
  "scheduled_at": "2026-06-10T09:02:15Z",
  "sent_at": "2026-06-10T09:02:47Z",

  "external_lead_id": "GL-00123456",
  "autologin_url": "https://trade.example.com/autologin?token=abc123",
  "response": "{\"status\":\"ok\",\"details\":{\"leadRequest\":{\"ID\":\"GL-00123456\"}}}",
  "error_message": null,

  "device_type": "mobile",
  "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
  "browser_language": "it-IT,it;q=0.9",
  "timezone": "Europe/Rome",
  "city": "Rome",
  "isp_name": "Telecom Italia",
  "ip_address": "5.90.123.45"
}
```

---

### Validate-Injection Sample Request/Response

**Request** (POST to `validate-injection` edge function):
```json
{
  "injection_id": "inj-uuid-0000-0000-0000-000000000001"
}
```

**Response:**
```json
{
  "total_leads": 180,
  "will_send": 140,
  "will_skip_duplicates": 28,
  "will_skip_geo_cap": 12,
  "duplicate_emails": [
    "already.sent@example.com",
    "duplicate2@example.com"
  ],
  "advertisers": [
    {
      "id": "adv-uuid-0000-0000-0000-000000000001",
      "name": "Getlinked EU",
      "duplicates": 20
    },
    {
      "id": "adv-uuid-0000-0000-0000-000000000002",
      "name": "TrackBox IT",
      "duplicates": 8
    }
  ],
  "geo_breakdown": [
    { "country_code": "IT", "leads": 100, "cap": 100, "will_send": 100, "will_skip": 0  },
    { "country_code": "DE", "leads": 50,  "cap": 40,  "will_send": 40,  "will_skip": 10 },
    { "country_code": "ES", "leads": 30,  "cap": 50,  "will_send": 28,  "will_skip": 2  }
  ]
}
```

---

## Edge Functions

All backend logic runs as Supabase Edge Functions (Deno runtime).

| Function | Trigger | Purpose |
|---|---|---|
| `submit-lead` | POST from affiliate | Intake a new lead (v1) |
| `submit-lead-v2` | POST from affiliate | Intake a new lead (v2, enhanced validation) |
| `distribute-lead` | Manual / queue | Route a single lead to an advertiser via the matching adapter |
| `route-lead` | Rule engine | Evaluate distribution rules and select target advertiser |
| `send-injection` | Job scheduler | Batch-inject leads from an injection job |
| `advertiser-callback` | Webhook from CRM | Handle async status callbacks from external CRMs |
| `create-user` | Admin UI | Create a new user via service role key (validates super_admin caller) |
| `delete-user` | Admin UI | Remove a user |
| `impersonate-user` | Super admin UI | Generate a magic-link token for another user |
| `get-leads` | Reports / export | Fetch leads with filters |
| `lead-status` | Status page | Get current status of a lead |
| `poll-lead-status` | Polling job | Poll external CRM for updated lead status |
| `process-lead-queue` | Queue processor | Process queued lead distribution jobs |
| `validate-injection` | Injection UI | Validate a batch before running injection |
| `filter-pool-leads` | Pool management | Filter leads in a pool |
| `parse-document` | Data import | Parse uploaded documents for lead import |
| `db-proxy` | Internal | Database proxy for restricted operations |

---

## Role & Permission Model

### System Roles (`app_role` PostgreSQL enum — fixed, cannot be extended)

| Role | Access Level |
|---|---|
| `super_admin` | Full access, bypasses all permission checks |
| `manager` | Most access |
| `agent` | Leads + reports only |
| `affiliate` | Submit leads only |
| `affiliate_manager` | Manage affiliates |

### Custom Roles

Stored in the `roles` table with a TEXT slug. Assigned via `user_custom_roles`. Permissions are defined per-role in `role_permission_mappings`.

### Effective Permissions (merged at runtime)

```
effectivePermissions =
  role_permission_mappings (system role)
  ∪ role_permission_mappings (each custom role)
  ∪ user_permissions (direct per-user overrides)
```

38 named permissions cover all CRUD operations across every module (leads, advertisers, affiliates, distribution, users, roles, settings, injection, reports).

---

## Key Database Tables

| Table | Purpose |
|---|---|
| `leads` | Core leads data |
| `advertisers` | Advertiser records + `advertiser_type` + `config` (JSON) |
| `affiliates` | Affiliate partners |
| `distribution_rules` | Routing rules |
| `distribution_rule_targets` | Advertisers assigned to each rule (separate table) |
| `advertiser_distribution_settings` | Per-advertiser caps, schedule, geo/affiliate filters |
| `profiles` | User profiles (username, full_name) |
| `user_roles` | System role assignments |
| `roles` | Custom role definitions |
| `user_custom_roles` | User → custom role mappings |
| `role_permission_mappings` | Role → permission key mappings |
| `user_permissions` | Direct per-user permission overrides |
| `crm_settings` | Global config (CRM name, timezone, date format) |
