add new columns
locale - it is the language of the leads

click_id:
A unique ID generated when the user clicks an ad before they even fill out the form.
Purpose: Track where the lead came from — which ad, which campaign, which affiliate link was clicked.
Example flow:
User clicks ad → URL contains click_id=abc123
→ User fills form → click_id is passed along with the lead
→ CRM stores click_id → can trace back to exact ad click
Used for:

Tracking ad performance
Matching conversions back to the original click
Affiliate attribution
Detecting fraud (same click_id used multiple times = bot)

lead_request_id:
A unique ID generated when the lead submission request hits your API.
Purpose: Identify each individual API request — useful for debugging, deduplication, and audit logs.
Example flow:
Affiliate sends lead → API generates lead_request_id=xyz789
→ Stored in logs → if same request is sent twice, you can detect it
→ Used to trace exactly what happened to that specific request
Used for:

Deduplication — reject if same lead_request_id submitted twice
Debugging — trace a specific request in logs
Audit trail — know exactly when and how a lead came in
Support — affiliate says "my lead wasn't accepted" → find by lead_request_id

i think the lead_id generate by the api and sending test leads is the same
