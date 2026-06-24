Affiliate Lead API Security Flow

1. Each affiliate has a setting:
   IP Whitelist Required: Yes / No

2. If affiliate wants IP whitelist:

- Admin enables “IP Whitelist Required”.
- Admin adds his allowed IPs.
- CRM accepts leads only from those IPs.

3. If affiliate does NOT want IP whitelist:

- Admin keeps “IP Whitelist Required” disabled.
- CRM does not block by IP.
- CRM accepts leads based on API key/token only.

4. When lead API request comes in:

- Check affiliate API key/token first.
- If invalid, reject request.
- If valid, check affiliate setting.

5. If “IP Whitelist Required = Yes”:

- Get request IP.
- Check if IP is in that affiliate’s whitelist.
- If IP not found, reject lead.
- If IP found, continue.

6. If “IP Whitelist Required = No”:

- Skip IP whitelist check.
- Continue directly to lead validation.

7. Then continue:

- Validate lead data.
- Check duplicate lead.
- Save lead.
- Return success response.

8. Always save API logs:

- Affiliate ID
- Request IP
- Payload
- Status: accepted / rejected
- Reason
- Date/time
