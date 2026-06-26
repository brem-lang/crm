Live Lead Scoring — Development Plan

Phase 1 — Database
Add new columns to leads table:

click_ip — IP address when lead clicked the ad
click_country — country from click IP
click_asn — ISP/provider from click IP
submission_ip — IP address when lead submitted the form
submission_country — country from submission IP
submission_asn — ISP/provider from submission IP
submission_ua — user agent (browser/device) on submission
click_ua — user agent on click
time_to_click — seconds between page load and form submit
is_proxy — boolean, true if VPN/proxy detected
live_lead_score — computed integer 0-100
live_lead_status — green / orange / light-red / red

Phase 2 — IP Intelligence
Integrate a free or cheap IP lookup API to detect:

Country from IP
ISP / ASN from IP
VPN / Proxy flag

Recommended free options:

ip-api.com — free, no key needed, returns country + ISP + proxy flag
IPQualityScore — more accurate proxy detection, free tier available

Phase 3 — Data Collection
Update submit-lead edge function to:

Capture submission IP from request headers
Call IP intelligence API to get country + ASN + proxy flag
Save all fields to leads table on submission

Update lead form (frontend) to:

Capture time between page load and form submit
Capture user agent
Send click IP via hidden field or header

Phase 4 — Scoring Engine
Create a new edge function score-lead:
SignalPointsIP exact match25Country match20ISP/ASN match15No VPN/Proxy20Time to click > 5s10User agent match10
Calculate total score → assign status:

80-100 → green (live)
60-79 → orange (likely live)
40-59 → light red (suspicious)
0-39 → red (not live)

Phase 5 — Auto Score on Lead Arrival
Trigger score-lead automatically when a new lead is inserted:

Database trigger OR call from submit-lead function
Score saved to live_lead_score and live_lead_status columns immediately

Phase 6 — UI

Color coded score badge on leads table
Score breakdown tooltip (shows each signal result)
Filter leads by live lead status
Dashboard widget showing live vs non-live lead ratio
