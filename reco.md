Affiliate API Documentation
JSON REST API for partner integrations. Send the API key on every request. Use POST /api/affiliate/clients to register end users; the initial login password is returned once in the response.

Authentication
Header: X-API-Key: <your_plain_key>
Also send Accept: application/json and Content-Type: application/json for POST bodies.
Base URL: replace with your CRM host, e.g. https://your-crm.example.com/api
Optional per-affiliate IP allow-list may be configured; if empty, all IPs are allowed.
Rate limiting applies per API key (default around 60 requests per minute unless configured otherwise).
Endpoints overview
Method Path Description
GET /api/affiliate/stats Affiliate statistics (leads, conversions, tracking code).
GET /api/affiliate/clients List clients for this key. Optional ?email=, ?from=YYYY-MM-DD, ?to=YYYY-MM-DD, ?status=.
POST /api/affiliate/clients Create a client account; returns initial_password once.
GET /api/affiliate/leads List leads for this key. Optional ?email=, ?from=YYYY-MM-DD, ?to=YYYY-MM-DD, ?status=.
POST /api/affiliate/leads Submit a single lead.
POST /api/affiliate/leads/bulk Submit up to 50 leads in one request.
GET /api/affiliate/stats
No request body. Example response:

{
"success": true,
"message": "Affiliate statistics.",
"data": {
"affiliate_id": 1,
"name": "Partner Name",
"tracking_code": "ABC123",
"total_leads": 10,
"total_conversions": 3,
"conversion_rate": 30.0,
"leads_count": 10,
"clients_count": 3,
"is_active": true
}
}
GET /api/affiliate/clients
All query parameters are optional and can be combined:

email — exact match on the linked user email.
from — inclusive lower bound on created_at (YYYY-MM-DD or any parseable datetime; start-of-day used for date-only).
to — inclusive upper bound; end-of-day used for date-only. Requires from ≤ to when both sent.
status — one or more comma-separated values: new, ftd, potential, active, inactive, suspended, contacted, qualified, converted, duplicate, junk, appointment_set. Invalid values return HTTP 422.
Example: GET /api/affiliate/clients?from=2026-04-01&to=2026-04-30&status=active

Example response:

{
"success": true,
"message": "Clients retrieved.",
"data": [
{
"client_id": 42,
"email": "user@example.com",
"status": "new",
"created_at": "2026-04-20T12:00:00+00:00"
}
]
}
POST /api/affiliate/clients
Required: first_name, last_name, email (unique), phone. Optional: country (max 3 chars), city, tracking, domain, notes.

Example request:

{
"first_name": "Jane",
"last_name": "Doe",
"email": "jane.doe@example.com",
"phone": "+15551234567",
"country": "US",
"city": "NYC"
}
Example response (HTTP 201):

{
"success": true,
"message": "Client registered successfully.",
"data": {
"client_id": 42,
"email": "jane.doe@example.com",
"status": "new",
"initial_password": "oO4999@CRM"
}
}
Initial password rule
When a client is created via this API, the system sets the login password to:

2nd character of first name (lower)

- 2nd character of last name (upper)
- last 4 digits of phone
- @CRM
  Example: John Doe, phone ending in 34999 → oO4999@CRM

GET /api/affiliate/leads
All query parameters are optional and can be combined:

email — exact match on the lead email.
from — inclusive lower bound on created_at.
to — inclusive upper bound. Requires from ≤ to when both sent.
status — one or more comma-separated values: new, contacted, qualified, converted, duplicate, junk. Invalid values return HTTP 422.
Example: GET /api/affiliate/leads?from=2026-04-10&to=2026-04-20&status=qualified

Example response:

{
"success": true,
"message": "Leads retrieved.",
"data": [
{
"lead_id": 12,
"email": "lead@example.com",
"status": "qualified",
"is_duplicate": false,
"tracking": "campaign-a",
"created_at": "2026-04-15T10:00:00+00:00"
}
]
}
POST /api/affiliate/leads
Required: first_name, last_name. Optional: email, phone, country, source, tracking, domain, notes.

Example request:

{
"first_name": "Lead",
"last_name": "Contact",
"email": "lead@example.com",
"phone": "+15550001111"
}
Example response (HTTP 201):

{
"success": true,
"message": "Lead submitted successfully.",
"data": {
"lead_id": 100,
"is_duplicate": false,
"tracking": "campaign-a"
}
}
POST /api/affiliate/leads/bulk
Body must include leads: an array of 1–50 objects. Each object follows the same field rules as a single lead.

Example request:

{
"leads": [
{ "first_name": "A", "last_name": "One", "email": "a1@example.com" },
{ "first_name": "B", "last_name": "Two", "email": "b2@example.com" }
]
}
Example response: HTTP 201 if at least one lead was created; HTTP 422 if none were created.

{
"success": true,
"message": "1 of 2 leads submitted.",
"data": {
"created": [
{ "index": 0, "lead_id": 101, "is_duplicate": false }
],
"failed": [
{ "index": 1, "errors": { "email": ["The email has already been taken."] } }
]
},
"total_created": 1,
"total_failed": 1
}
Failed items include validation errors per index.

Errors
Validation errors typically return HTTP 422 with a Laravel-style errors object. General failures may return:

{
"success": false,
"message": "Description of the error."
}
Unauthorized (invalid key): HTTP 401. Inactive affiliate or forbidden: HTTP 403.

This document is a static reference. Replace the base URL and use the API key issued by your CRM administrator.

URL: https://external.recoverychain1.com
api_key: aff_88T1RhFSzpTe0z21yZi0YHeAVeBrgEZR6VFQ0Lfz
