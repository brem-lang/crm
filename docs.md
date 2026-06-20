================================================================================
SAXO LTD — Lead API Documentation
================================================================================

Base URL: https://platform.saxoltd.com/api/external

================================================================================
AUTHENTICATION
================================================================================

All requests require an API key passed via the "x-api-key" header.

    x-api-key: YOUR_API_KEY_HERE

Your API key will be provided by SAXO LTD when your provider account is
created. Keep it confidential — do not share it publicly.

================================================================================

1. # HEALTH CHECK

Verify your API key is working.

GET /health

Example (cURL):

curl -X GET https://platform.saxoltd.com/api/external/health \
 -H "x-api-key: YOUR_API_KEY"

Success Response (200):

{
"success": true,
"message": "API is working correctly",
"provider": {
"id": "your-provider-id",
"name": "Your Company",
"email": "you@company.com"
},
"timestamp": "2026-04-10T09:00:00.000Z"
}

# ================================================================================ 2. CREATE LEAD

Submit a new lead into the system.

POST /leads

Headers:
Content-Type: application/json
x-api-key: YOUR_API_KEY

Body Parameters:

FIELD TYPE REQUIRED DESCRIPTION

---

phone string YES Phone number with country code
(e.g. "+393401234567"). Must be unique.
firstName string No First name (1-50 characters)
lastName string No Last name (1-50 characters)
email string No Valid email address. Must be unique
if provided.
country string No Country name (2-50 characters)
city string No City name (2-50 characters)
source string No Lead source/origin (max 100 chars).
Defaults to "API - YourProviderName"
campaign string No Campaign identifier (max 100 chars)
priority integer No 1 (lowest) to 5 (highest). Default: 3
agentComment string No Additional notes (max 500 chars)

Example (cURL):

curl -X POST https://platform.saxoltd.com/api/external/leads \
 -H "Content-Type: application/json" \
 -H "x-api-key: YOUR_API_KEY" \
 -d '{
"firstName": "Marco",
"lastName": "Rossi",
"email": "marco.rossi@example.com",
"phone": "+393401234567",
"country": "Italy",
"city": "Milan",
"source": "Facebook Ads",
"campaign": "IT-Spring-2026",
"priority": 4,
"agentComment": "Interested in forex trading"
}'

Example (Python):

import requests

url = "https://platform.saxoltd.com/api/external/leads"
headers = {
"Content-Type": "application/json",
"x-api-key": "YOUR_API_KEY"
}
payload = {
"firstName": "Marco",
"lastName": "Rossi",
"email": "marco.rossi@example.com",
"phone": "+393401234567",
"country": "Italy",
"city": "Milan",
"source": "Facebook Ads",
"campaign": "IT-Spring-2026",
"priority": 4
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())

Example (PHP):

  <?php
  $url = "https://platform.saxoltd.com/api/external/leads";
  $apiKey = "YOUR_API_KEY";

  $data = [
      "firstName" => "Marco",
      "lastName"  => "Rossi",
      "email"     => "marco.rossi@example.com",
      "phone"     => "+393401234567",
      "country"   => "Italy",
      "city"      => "Milan",
      "source"    => "Facebook Ads",
      "campaign"  => "IT-Spring-2026",
      "priority"  => 4
  ];

  $ch = curl_init($url);
  curl_setopt($ch, CURLOPT_POST, true);
  curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
  curl_setopt($ch, CURLOPT_HTTPHEADER, [
      "Content-Type: application/json",
      "x-api-key: " . $apiKey
  ]);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

  $response = curl_exec($ch);
  curl_close($ch);

  echo $response;
  ?>

Example (JavaScript / Node.js):

const response = await fetch("https://platform.saxoltd.com/api/external/leads", {
method: "POST",
headers: {
"Content-Type": "application/json",
"x-api-key": "YOUR_API_KEY"
},
body: JSON.stringify({
firstName: "Marco",
lastName: "Rossi",
email: "marco.rossi@example.com",
phone: "+393401234567",
country: "Italy",
city: "Milan",
source: "Facebook Ads",
campaign: "IT-Spring-2026",
priority: 4
})
});

const data = await response.json();
console.log(data);

RESPONSES:

Success (201 Created):

    {
      "success": true,
      "data": {
        "lead": {
          "id": "abc123def456",
          "firstName": "Marco",
          "lastName": "Rossi",
          "email": "marco.rossi@example.com",
          "phone": "+393401234567",
          "country": "Italy",
          "city": "Milan",
          "source": "Facebook Ads",
          "campaign": "IT-Spring-2026",
          "status": "NEW",
          "priority": 4,
          "createdAt": "2026-04-10T09:21:31.256Z"
        }
      }
    }

Duplicate Phone (409):

    {
      "success": false,
      "error": { "message": "Lead with this phone number already exists" },
      "data": { "leadId": "existing-lead-id" }
    }

Duplicate Email (409):

    {
      "success": false,
      "error": { "message": "Lead with this email already exists" },
      "data": { "leadId": "existing-lead-id" }
    }

Validation Error (400):

    {
      "success": false,
      "error": {
        "message": "Validation failed",
        "details": [
          { "msg": "Phone number is required", "param": "phone", "location": "body" }
        ]
      }
    }

# ================================================================================ 3. LIST YOUR LEADS

Retrieve all leads you have submitted, with pagination, filtering and search.

GET /leads

Query Parameters:

PARAM TYPE DEFAULT DESCRIPTION

---

page integer 1 Page number
limit integer 50 Results per page (max 200)
status string — Filter by lead status (see table below)
search string — Search by name, phone, or email

Example (cURL):

curl -X GET "https://platform.saxoltd.com/api/external/leads?page=1&limit=20&status=NEW" \
 -H "x-api-key: YOUR_API_KEY"

Success Response (200):

{
"success": true,
"data": {
"leads": [
{
"id": "abc123def456",
"firstName": "Marco",
"lastName": "Rossi",
"email": "marco.rossi@example.com",
"phone": "+393401234567",
"country": "Italy",
"city": "Milan",
"source": "Facebook Ads",
"campaign": "IT-Spring-2026",
"status": "QUALIFIED",
"priority": 4,
"createdAt": "2026-04-10T09:21:31.256Z",
"updatedAt": "2026-04-10T12:30:00.000Z"
}
],
"pagination": {
"currentPage": 1,
"totalPages": 5,
"totalCount": 98,
"hasNext": true,
"hasPrev": false
}
}
}

# ================================================================================ 4. GET LEAD STATUS

Check the current status and assigned agent for a specific lead.

GET /leads/:leadId/status

Example (cURL):

curl -X GET https://platform.saxoltd.com/api/external/leads/abc123def456/status \
 -H "x-api-key: YOUR_API_KEY"

Success Response (200):

{
"success": true,
"data": {
"lead": {
"id": "abc123def456",
"firstName": "Marco",
"lastName": "Rossi",
"email": "marco.rossi@example.com",
"phone": "+393401234567",
"status": "QUALIFIED",
"priority": 4,
"lastContactAt": "2026-04-10T14:00:00.000Z",
"nextFollowUpAt": "2026-04-12T10:00:00.000Z",
"createdAt": "2026-04-10T09:21:31.256Z",
"updatedAt": "2026-04-10T14:00:00.000Z",
"assignedAgent": {
"firstName": "Daniel",
"lastName": "Green",
"email": "daniel.green@crm.com"
}
}
}
}

Not Found (404):

    {
      "success": false,
      "error": { "message": "Lead not found or not accessible" }
    }

================================================================================
LEAD STATUS VALUES
================================================================================

STATUS DESCRIPTION

---

NEW Just received, not yet contacted
NO_ANSWER_1 First call attempt, no answer
NO_ANSWER_2 Second call attempt, no answer
NO_ANSWER_3 Third call attempt, no answer
NO_ANSWER_4 Fourth call attempt, no answer
VOICE_MAIL Reached voicemail
CALLBACK Client requested a callback
NOT_INTERESTED Client declined
QUALIFIED Client is qualified and interested
DEMO_ACCOUNT Client opened a demo account
FTD First-time deposit made
CONVERTED Fully converted client

================================================================================
ERROR CODES
================================================================================

HTTP CODE MEANING

---

200 Success
201 Lead created successfully
400 Validation error — check the "details" array in the response
401 Missing or invalid API key
403 Provider account is blocked/inactive
404 Lead not found
409 Duplicate lead (phone or email already exists in the system)
500 Server error — contact support

================================================================================
IMPORTANT NOTES
================================================================================

- Phone number is the ONLY required field. We strongly recommend sending
  firstName, lastName, email, and country for better lead quality.

- Phone and email must be unique. If a lead with the same phone or email
  already exists, a 409 error is returned with the existing lead ID.

- The API key is tied to your provider account. All leads submitted with
  your key are automatically assigned to your designated office.

- You can only view leads that YOU submitted. You cannot access leads
  from other providers.

- Keep your API key confidential. If compromised, contact SAXO LTD
  immediately to have it rotated.

- There is no hard rate limit, but please keep requests reasonable
  (no more than 10 requests per second).

================================================================================
SUPPORT
================================================================================

For technical support or API key issues, contact your SAXO LTD
account manager.

================================================================================
