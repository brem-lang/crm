API integration
affiliate
POST
create
{{host}}/api/lead_management/api/affiliates
HEADERS
authorization
AFF_3_1c3fcc3cac32092698f62abxxxx

Body
raw (json)
View More
json
{
"country_name": "cy",
"description": "test 007 ",
"phone": "0035799261501",
"email": "t1eaddd0012039smk@gmail.com",
"first_name": "john2",
"last_name": "doe",
"custom_fields":
{"Source_ID": "fb",
"How_Much_Invested": "10000",
"Outline_Your_Case": "some des "
}
}

Example Request
create
View More
curl
curl --location -g '{{host}}/api/lead_management/api/affiliates' \
--header 'authorization: AFF_3_1c3fcc3cac32092698f62abxxxx' \
--data-raw '{
"country_name": "cy",
"description": "test 007 ",
"phone": "0035799261501",
"email": "t1eaddd0012039smk@gmail.com",
"first_name": "john2",
"last_name": "doe",
"custom_fields":
{"Source_ID": "fb",
"How_Much_Invested": "10000",
"Outline_Your_Case": "some des "
}
}

'
Example Response
Body
Headers (0)
No response body
This request doesn't return any response body
GET
index
{{host}}/api/lead_management/api/affiliates
HEADERS
Cache-Control
no-cache

Postman-Token
<calculated when request is sent>

Content-Type
multipart/form-data; boundary=<calculated when request is sent>

Content-Length
<calculated when request is sent>

Host
<calculated when request is sent>

User-Agent
PostmanRuntime/7.39.1

Accept
_/_

Accept-Encoding
gzip, deflate, br

Connection
keep-alive

authorization
AFF_1_2f2a9a4860e8e12d8aea23440001b92e545y745745

Body
formdata
start_date
20.01.2019

end_date
20.2.2026

URL : https://api.capital-trading-group.com/api/lead_management/api/affiliates

authorization : AFF_2_5e31dea948669301d62dbb82ff1a791f
