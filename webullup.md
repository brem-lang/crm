# We Bull Up — Lead Provider API

API reference for lead providers to push leads into the CRM and pull lead
data / status updates back out.

Base URL: https://trading.we-bull-up.com/api/external
Format: JSON (Content-Type: application/json)
Auth: API key in the x-api-key request header

## GETTING AN API KEY

API keys are issued by a CRM administrator:

1. Log in to https://trading.we-bull-up.com as an admin (Superadmin or
   Office Admin).
2. Go to Providers and create a provider account (or open an existing one).
3. Copy the API key shown on the provider record.

Each key is at least 16 characters and tied to one provider account. You can
only submit and retrieve leads for your own provider.

To rotate a key, an admin can use Regenerate API Key on the provider page
in the CRM.

## AUTHENTICATION

Every request must include your provider API key:

x-api-key: YOUR_API_KEY

Situation HTTP Message

---

Missing header 401 API key is required
Key too short (< 16 chars) 401 Invalid API key format
Unknown key 401 Invalid API key
Provider deactivated 403 Provider account is temporarily
blocked. Please contact support.

Keep the key secret. It identifies your account and scopes every response to
only the leads you submitted.

## RESPONSE ENVELOPE

All responses use this shape:

Success:
{ "success": true, "data": { ... } }

Error:
{ "success": false, "error": { "message": "..." } }

Validation errors may include a details array:

{
"success": false,
"error": {
"message": "Validation failed",
"details": [{ "msg": "Phone number is required", "path": "phone" }]
}
}

## ENDPOINTS

Method Path Description

---

GET /health Verify API key and connectivity
POST /leads Push (create) a new lead
GET /leads Pull (list) your leads with filters
GET /leads/{leadId}/status Get one lead's status and assignment

1. HEALTH CHECK

---

Verify your API key works before integrating.

GET /api/external/health

Example:

curl https://trading.we-bull-up.com/api/external/health \
 -H "x-api-key: YOUR_API_KEY"

Success — 200 OK:

{
"success": true,
"message": "API is working correctly",
"provider": {
"id": "clxyz123...",
"name": "Your Provider Name",
"email": "you@example.com"
},
"timestamp": "2026-06-16T08:00:00.000Z"
}

2. PUSH A LEAD

---

Create a new lead attributed to your provider account. New leads are created
with status NEW.

POST /api/external/leads

Request body fields:

Field Type Required Rules

---

phone string YES Digits with optional + - ( ) and spaces.
Used for duplicate detection.
firstName string No 1–50 characters
lastName string No 1–50 characters
email string No Valid email (stored lowercase). Used for
duplicate detection.
country string No 2–50 characters
city string No 2–50 characters
source string No Max 100 chars. Defaults to
API - <ProviderName>
campaign string No Max 100 characters
priority integer No 1–5, default 3 (1 = highest)
agentComment string No Max 500 characters

Example:

curl -X POST https://trading.we-bull-up.com/api/external/leads \
 -H "x-api-key: YOUR_API_KEY" \
 -H "Content-Type: application/json" \
 -d '{
"firstName": "Mario",
"lastName": "Rossi",
"email": "mario.rossi@example.com",
"phone": "+393201234567",
"country": "Italy",
"city": "Milan",
"source": "Facebook Campaign",
"campaign": "IT-Q2",
"priority": 2,
"agentComment": "Requested a callback in the morning"
}'

Success — 201 Created:

{
"success": true,
"data": {
"lead": {
"id": "clxyz123...",
"firstName": "Mario",
"lastName": "Rossi",
"email": "mario.rossi@example.com",
"phone": "+393201234567",
"country": "Italy",
"city": "Milan",
"source": "Facebook Campaign",
"campaign": "IT-Q2",
"status": "NEW",
"priority": 2,
"createdAt": "2026-06-16T08:00:00.000Z"
}
}
}

Duplicate — 409 Conflict:

Leads are de-duplicated globally by phone and email. If a match exists, no
new lead is created.

{
"success": false,
"error": { "message": "Lead with this phone number already exists" },
"data": { "leadId": "existing-lead-id" }
}

Same shape for email duplicates: "Lead with this email already exists".

Validation error — 400 Bad Request:

{
"success": false,
"error": {
"message": "Validation failed",
"details": [
{ "msg": "Phone number is required", "path": "phone" }
]
}
}

3. PULL LEADS (LIST + FILTERS)

---

Returns leads submitted by your provider only, newest first. When filtering
by status-change time, results are ordered by statusChangedAt descending.

GET /api/external/leads

Query parameters:

Param Type Default Description

---

page integer 1 Page number
limit integer 50 Page size (max 200)
status string — Exact lead status (see Lead Statuses)
search string — Partial match on first name, last
name, phone, or email
dateFrom date — Created on or after (createdAt)
dateTo date — Created on or before (end-of-day)
updatedFrom date/datetime — Status changed on or after
updatedTo date/datetime — Status changed on or before

Date formats: YYYY-MM-DD or full ISO 8601 YYYY-MM-DDTHH:mm:ssZ.

Polling tip: To sync status changes since your last run, call:
GET /leads?updatedFrom=<last_sync_timestamp>&limit=200

Example — poll for everything updated since yesterday:

curl "https://trading.we-bull-up.com/api/external/leads?updatedFrom=2026-06-15&limit=200" \
 -H "x-api-key: YOUR_API_KEY"

Success — 200 OK:

{
"success": true,
"data": {
"leads": [
{
"id": "clxyz123...",
"firstName": "Mario",
"lastName": "Rossi",
"email": "mario.rossi@example.com",
"phone": "+393201234567",
"country": "Italy",
"city": "Milan",
"source": "Facebook Campaign",
"campaign": "IT-Q2",
"status": "CALLBACK",
"previousStatus": "NEW",
"statusChangedAt": "2026-06-16T09:30:00.000Z",
"priority": 2,
"createdAt": "2026-06-15T08:00:00.000Z",
"updatedAt": "2026-06-16T09:30:00.000Z"
}
],
"pagination": {
"currentPage": 1,
"totalPages": 4,
"totalCount": 173,
"hasNext": true,
"hasPrev": false
}
}
}

4. GET A SINGLE LEAD'S STATUS

---

GET /api/external/leads/{leadId}/status

Returns status, assignment, and follow-up timestamps for one of your leads.

Example:

curl https://trading.we-bull-up.com/api/external/leads/clxyz123.../status \
 -H "x-api-key: YOUR_API_KEY"

Success — 200 OK:

{
"success": true,
"data": {
"lead": {
"id": "clxyz123...",
"firstName": "Mario",
"lastName": "Rossi",
"email": "mario.rossi@example.com",
"phone": "+393201234567",
"status": "CALLBACK",
"previousStatus": "NEW",
"statusChangedAt": "2026-06-16T09:30:00.000Z",
"priority": 2,
"lastContactAt": "2026-06-16T09:25:00.000Z",
"nextFollowUpAt": "2026-06-17T08:00:00.000Z",
"createdAt": "2026-06-15T08:00:00.000Z",
"updatedAt": "2026-06-16T09:30:00.000Z",
"assignedAgent": {
"firstName": "Anna",
"lastName": "Bianchi",
"email": "anna@example.com"
}
}
}
}

assignedAgent is null if the lead has not been assigned yet.

Not found — 404:

{
"success": false,
"error": { "message": "Lead not found or not accessible" }
}

You cannot read leads belonging to other providers.

## REFERENCE

Lead statuses (use these exact strings when filtering by status):

Status Meaning

---

NEW Just received, not yet worked
FRESH Newly assigned, ready to call
CALLING Currently being called
NO_ANSWER No answer
NO_ANSWER_1 No answer, attempt 1
NO_ANSWER_2 No answer, attempt 2
NO_ANSWER_3 No answer, attempt 3
NO_ANSWER_4 No answer, attempt 4
VOICE_MAIL Reached voicemail
NOT_INTERESTED Declined
CALLBACK Callback scheduled (see nextFollowUpAt)
CALL_AGAIN To be called again
QUALIFIED Qualified prospect
DEMO_ACCOUNT Demo account opened
FTD First-time deposit (converted)
CONVERTED Converted client
LOW_POTENTIAL Low potential
NO_INVEST Will not invest
NO_MONEY No funds
DEPOSIT_ELSEWHERE Deposited elsewhere
WRONG_NUMBER Invalid phone
WRONG_COUNTRY Wrong country
WRONG_LANGUAGE Language mismatch
CALLED_BY_OTHERS Already contacted by another source
DENY_REGISTRATION Refused registration

Priority:
Integer 1–5 (default 3). Lower number = higher priority.

HTTP status codes:

Code Meaning

---

200 OK (health, pull, status)
201 Lead created
400 Validation failed (check error.details)
401 Missing or invalid API key
403 Provider blocked or inactive
404 Lead not found or not accessible
409 Duplicate lead (phone or email)
500 Server error — retry later

## RECOMMENDED INTEGRATION PATTERN

1. Submit each lead with POST /leads. Store the returned lead.id on your
   side.
2. On 409, treat the lead as already known (the existing leadId is returned)
   — do not resubmit.
3. Poll for updates on a schedule (e.g. every 15–30 min) using
   GET /leads?updatedFrom=<last_poll_time>&limit=200, paging through results
   while pagination.hasNext is true.
4. Use statusChangedAt to detect what changed since your last poll.
5. For a one-off check of a specific lead, use GET /leads/{leadId}/status.

## INTEGRATION NOTES

- HTTPS only — all requests must use https://trading.we-bull-up.com.
- Idempotency — duplicate phone/email returns 409 with the existing leadId;
  handle this in your integration to avoid double-counting.
- Office linking — if your provider is linked to an office in the CRM, leads
  may inherit that office's routing. Unlinked providers still accept leads
  normally.
- Support — contact your CRM administrator to create providers, link
  offices, or rotate API keys.

## MINIMAL TEST (COPY-PASTE)

Replace YOUR_API_KEY with your key:

# 1. Health

curl -s https://trading.we-bull-up.com/api/external/health \
 -H "x-api-key: YOUR_API_KEY"

# 2. Push

curl -s -X POST https://trading.we-bull-up.com/api/external/leads \
 -H "x-api-key: YOUR_API_KEY" \
 -H "Content-Type: application/json" \
 -d '{"firstName":"Test","lastName":"Lead","phone":"+14165559999","country":"Canada"}'

# 3. Pull

curl -s "https://trading.we-bull-up.com/api/external/leads?limit=5" \
 -H "x-api-key: YOUR_API_KEY"
