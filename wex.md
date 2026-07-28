# BackBone CRM — Affiliate Integration (MRC)

## 1. Send a lead — `POST /api/capture`

**Headers:** `X-API-Key`, `Content-Type: application/json`
**Required:** `firstName`, `email` (valid email). Always include `"ref": "MRC"`.
**Optional:** `lastName`, `phone`, `country`, `company`, `message`, `deposit`, `depositCurrency` (`EUR` | `USD` | `GBP` | `RSD`). Any extra field is stored automatically (e.g. `aff_sub`, `clickid`).

### Example

```bash
curl -X POST https://andromeda.host/api/capture \
  -H "X-API-Key: bb_live_821ea746d8a4f495ab273c169477a509" \
  -H "Content-Type: application/json" \
  -d '{
    "ref": "MRC",
    "firstName": "Max",
    "lastName": "Mustermann",
    "email": "max@example.com",
    "phone": "+491701234567",
    "country": "DE"
  }'
```

### Responses

| Status | Meaning                                                                             |
| ------ | ----------------------------------------------------------------------------------- |
| `201`  | Created — `{ "success": true, "leadId": "...", "clientId": 1234, "status": "new" }` |
| `409`  | Duplicate email — `{ "code": "DUPLICATE_EMAIL" }` -> do **not** retry               |
| `429`  | Rate limited -> honor the `Retry-After` header                                      |

---

## 2. Pull lead statuses — `GET /api/affiliate/leads`

**Headers:** `X-API-Key`
**Params:** `ref=MRC` (required), `page`, `limit` (max 100), `from`, `to` (`YYYY-MM-DD`).

### Example

```bash
curl "https://andromeda.host/api/affiliate/leads?ref=MRC" \
  -H "X-API-Key: bb_live_821ea746d8a4f495ab273c169477a509"
```

### Response

```json
{
  "success": true,
  "leads": [
    {
      "clientId": 1234,
      "firstName": "Max",
      "lastName": "Mustermann",
      "email": "max@example.com",
      "phone": "+491701234567",
      "status": "new",
      "country": "DE",
      "createdAt": "2026-07-28T10:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 1, "pages": 1 }
}
```

You only see leads tied to ref `MRC`.

---

## 3. Go-live

1. Send one test lead -> expect `201`.
2. We confirm it in the CRM under ref `MRC`.
3. We set it to **FTD** with a test deposit -> you see the status via the pull endpoint.
4. Go live.

# BackBone CRM — Response & Error Handling (MRC)

Your system must read the **HTTP status code** and JSON body of each `POST /api/capture` response. There is no separate email/webhook notification — the response IS the notification.

## Handle these responses

| HTTP  | Body                                                                                                       | What it means                                         | What you should do                                              |
| ----- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------- |
| `201` | `{"success":true,"leadId":"...","clientId":1234,"status":"new"}`                                           | Lead accepted                                         | Store `leadId` / `clientId`. Done.                              |
| `409` | `{"success":false,"rejected":true,"code":"DUPLICATE_EMAIL","error":"Lead with this email already exists"}` | **Duplicate** — this email already exists on our side | Mark as **rejected/duplicate**. **Do NOT retry.** Not billable. |
| `400` | `{"success":false,"error":"Validation failed","details":{...}}`                                            | Bad/missing field (e.g. invalid email)                | Fix the payload. Do not retry as-is.                            |
| `401` | `{"success":false,"error":"Invalid API key"}`                                                              | Wrong/missing API key                                 | Check the `X-API-Key` header.                                   |
| `429` | `{"success":false,"error":"Too many requests...","retryAfter":N}`                                          | Rate limited                                          | Wait for the `Retry-After` header, then retry.                  |
| `5xx` | `{"success":false,"error":"Internal server error"}`                                                        | Temporary server error                                | Safe to retry after a short delay.                              |

## Important

- **Map the `code` field in your panel.** For a duplicate, we return `code:"DUPLICATE_EMAIL"`. If you do not map it, a rejected lead may appear as "Unknown" in your dashboard even though we returned a clear rejection.
- A duplicate is decided by **email** (across our whole system). A `409` means we already have that person — it is not a new billable lead.
- Only `201` counts as an accepted lead.
