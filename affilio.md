Affilio API
This Documentation page contains the API methods that affiliates can use to send or retrieve data from our system.

Authentication
To access this API, authorization is required using both affiliate credentials and a unique API key.

Each API key is individually associated to a single affiliate and must be supplied in the apiKey header with every API request. In addition to the API key, the request must also provide appropriate authentication credentials, specifically the right password and username, to ensure secure and permitted access to the system.

Additionally, affiliates must obtain valid endpoint URLs to establish a connection with our system.

Errors
Clients will receive responses in the JSON format.
Ex: {"success": false, "requestId": null, "message": "Full authentication is required to access this resource", "error": "Invalid credentials"}

Type of error details:

Request body is empty;

Invalid username or password

The API key is empty or wrong;

Wrong request body format;

POST
register-lead
https://your-api-url.com/api/register-lead
Sending data:
The API endpoint for sending traffic is /register-lead

In the “Request Headers” section we can see that the affiliate credentials must be provided as header parameters

The URL will be provided your affiliate manager

Request Parameters and Expected Formats
{
"firstName": "(required) Max 255 characters. Example: "John".",

"lastName": "(required) Max 255 characters. Example: "Doe".",

"email": "(required) Valid email, max 255 characters. Example: "example@site.com".",

"password": "(required) Min 8 characters, must include a capital letter and a number. Example: "Str0ngPass!".",

"phone": "(required) Valid international format. Example: "+14155552671".",

"ip": "(required) Valid IPv4 or IPv6. Example: "192.168.1.1".",

"userAgent": "(optional) Example: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)".",

"linkId": "(required if lid is missing) Identifies traffic link. Ask your affiliate manager.",

"lid": "(required if linkId is missing) Identifies traffic link. Example: 12345.",

"funnelName": "(required) Max 255 characters. Example: "Main-Funnel".",

"countryCode": "(required) Two-letter ISO code. Example: "DE".",

"language": "(required) Two-letter code. Example: "EN".",

"mpc1": "(optional) Free param. Max 10240 characters.",

"mpc2": "(optional) Free param. Max 10240 characters.",

"mpc3": "(optional) Free param. Max 10240 characters.",

"mpc4": "(optional) Free param. Max 10240 characters.",

"mpc5": "(optional) Free param. Max 10240 characters.",

"mpc6": "(optional) Free param. Max 10240 characters."
}

Errors
Type of error details:

Data validation failed in request body fields

Internal system settings

Traffic rejected by brand

HEADERS
username
Test.Aff

password
affiliate.pass123

apiKey
c5077c68-c5ee-4bc9-ae45-170bfdad1234

Example of API key

Content-Type
application/json

Request body format

Body
raw (json)
View More
json
{
"firstName": "John",
"lastName": "Wick",
"email": "test123@email.com",
"phone": "+493012345678",
"password": "1234Abcd",
"ip": "192.168.0.1",
// "linkId": "782384f1-b1af-44a2-81f0-f2c2916a2a2c", -either provide linkId OR lid field
"lid":"1",
"funnelName": "testFunnel",
"countryCode":"GB",
"language": "EN",
"userAgent":"Mozilla/5.0",
"mpc1": "test1",
"mpc2": "test2",
"mpc3": "test3",
"mpc4": "test4",
"mpc5": "test5",
"mpc6": "test6"
}
Example Request
request success
View More
curl
curl --location 'https://your-api-url.com/api/register-lead' \
--header 'username: Test.Aff' \
--header 'password: affiliate.pass123' \
--header 'apiKey: c5077c68-c5ee-4bc9-ae45-170bfdad1234' \
--header 'Content-Type: application/json' \
--data-raw '{
"firstName": "John",
"lastName": "Wick",
"email": "test123@email.com",
"phone": "+493012345678",
"password": "1234Abcd",
"ip": "192.168.0.1",
// "linkId": "782384f1-b1af-44a2-81f0-f2c2916a2a2c", -either provide linkId OR lid field
"lid":"1",
"funnelName": "testFunnel",
"countryCode":"GB",
"language": "EN",
"userAgent":"Mozilla/5.0",
"mpc1": "test1",
"mpc2": "test2",
"mpc3": "test3",
"mpc4": "test4",
"mpc5": "test5",
"mpc6": "test6"
}'
200 OK
Example Response
Body
Headers (1)
json
{
"leadId": "76dbdafa-89e0-1234-asdf-9888d1184e44",
"autologin": "https://autologin.example.com/link/76dbdafa-89e0-1234-asdf-9888d1184e44"
}
POST
pull-leads
https://your-api-url.com/api/pull-leads
Retrieving data:
The API endpoint for retrieving lead data is /pull-leads

Just as with the /register-lead method, affiliate credentials must be provided in the header parameters to use this method

In the request body, the method requires content to be delivered in JSON format that will contain the time frame as well as pagination settings

Type:

Lead - displays only leads without deposit

Deposit - displays only converted leads

Optional field, if empty all results will be returned

Request Parameters and Expected Formats
"from": Must be in the correct datetime format ("YYYY-MM-DD HH:MM:SS"). Example: "2025-03-12 00:00:01".

"to": Must be in the correct datetime format ("YYYY-MM-DD HH:MM:SS"). Example: "2025-03-12 23:59:59".

"page": Pagination index, starting from 0 for the first page. Example: 0.

"size": Number of items per page, maximum 1000. Example: 100.

"type": Filter results by lead type. Allowed values: "Lead" (only leads without deposits) or "Deposit" (only converted leads). If empty, all results will be returned. Example: "Lead".

Errors
Type of error details:

Invalid request body format

Invalid datetime format

Incorrect pagination index

Invalid page size

Invalid lead type

Invalid credentials

Response Parameters
"totalItems": Total number of items returned in the response. Example: 50.

"data": List of lead data, containing the details for each lead. Example:

"id": Unique identifier for the lead. Example: "48c93772-abcd-41b2-883e-ced2ae169f09".

"leadId": ID associated with the lead. Example: 2139.

"affiliateId": Affiliate UUID associated with the lead. Example: "f062f5e4-f2bf-1234-a062-3652200f07fb".

"cid": Campaign ID associated with the lead. Example: 58.

"createdAt": Date and time when the lead was created. Example: "2025-03-12 16:13:29".

"ftd": First deposit date and time for the lead. Example: "2025-03-12 16:17:00".

"status": Call status of the lead. Example: "Deposit".

"funnelName": Name of the funnel associated with the lead. Example: "testFunnel".

"userAgent": User agent string from the lead's browser or device. Example: "Mozilla/5.0".

"firstname": First name of the lead. Example: "Garth".

"lastname": Last name of the lead. Example: "Cremin".

"email": Email address of the lead. Example: "test123@hotmail.com".

"campaign": Campaign UUID associated with the lead. Example: "5e123401-7b52-4f2f-9f39-2d464c01e289".

HEADERS
username
Test.Aff

password
affiliate.pass123

apiKey
c5077c68-c5ee-4bc9-ae45-170bfdad1234

Example of API key

Content-Type
application/json

Request body format

Body
raw (json)
json
{
"from": "2025-03-12 00:00:01",
"to": "2025-03-12 23:59:59",
"page": 0, //pagination index starts from 0 (first page)
"size": 1000, //maximum items per page is 1000
"type": "Lead" // type can be Lead or Deposit
}
