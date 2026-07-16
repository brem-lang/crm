# Affiliate Integration F

# Clients

## Send Clients

- URL : https://url.com/jetpack-api/api/client/store -> (replace url.com with url given by support )
- Method: POST
- Header: {‘Content-Type’: ‘application/json’}
  ### Body request fields:
  | Text             | Field        | Required |
  | ---------------- | ------------ | -------- |
  | First Name       | first_name   | Yes      |
  | Last Name        | last_name    | Yes      |
  | Email            | email        | Yes      |
  | Phone Number     | phone_number | Yes      |
  | Country Code     | country_code | Yes      |
  | Password         | password     | Yes      |
  | Currency         | currency     | Yes      |
  | Affiliate Token  | token        | Yes      |
  | Affiliate Source | source       | Yes      |
  | Tracking         | tracking     | Yes      |
  | Extra            | "extra": {   |
  "key": "value",
  "test": "test"
  } | No |

### A simple request example is like the code below:

```jsx
 {
    "first_name": "{{$randomFirstName}}",
    "last_name": "{{$randomLastName}}",
    "email": "{{$randomEmail}}",
    "phone_number": "{{$randomPhoneNumber}}",
    "country_code": "{{$randomCountryCode}}",
    "password":"{{$randomPassword}}",
    "currency":"EUR",
    "token": "{token}",
    "source": "{source}",
    "tracking": "test",
    "extra": {
        "key": "value",
        "test": "test"
    }
}
```

### And the response after the request has been accepted successfully, is like code below:

```jsx
{
    "success": true,
    "message": "Client has been created successfully!",
    "id": 2325,
    "url": "https://{brandulr.com}/auth/login?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL2JvLnRlYW0yMjcyMi54eXovamV0cGFjay1hcGkvYXBpL2NsaWVudC9zdG9yZSIsImlhdCI6MTc0NzkxODI4NSwiZXhwIjoxNzQ3OTIxODg1LCJuYmYiOjE3NDc5MTgyODUsImp0aSI6Inhkd1llM0NkbXRaS1h3M2EiLCJzdWIiOiIyMzI1IiwicHJ2IjoiMjMzZjhmMjZmZTVhMjkxMTc4MTVjOTQxMmU5YjliYTIwYTgyN2IxYiJ9.-YnUSq2bfAy7MmR1vcNiU1YP0uakMDR2b1bUNXSu2-A"
}
```

- Country Code stand for country ISO CODE, for example IT stands for Italy.
- Token will be generated when a new affiliate is created in the CRM, and you will find under your affiliate profile
- Source will be generated from CRM and given by us and is required
- Extra fields stands for Extra Marketing Information campaign.

## Get Clients & Deposits

### To get all Clients & Deposits :

- URL : https://url.com/jetpack-api/api/client/{token}/get-clients -> (replace url.com with url given by support )
- Method : GET
- {token} : Affiliate token

### Example of request to get all clients

```jsx
https://url.com/api/client/{token}/get-clients
```

### And response should be :

```jsx
{
    "success": true,
    "data": [
        {
            "id": 102,
            "status": "New",
            "email": "Kaylah_Feeney41@yahoo.com",
            "phone": "650-529-8764",
            "created_at": "2025-05-22T11:57:37.000000Z"
        },
    ]
}
```

### To get all Deposit Clients with filters :

- Url : https://url.com/jetpack-api/api/client/{token}/get-clients
- Add parameter : status ( FTD )
- Add parameter : date_start ( Date from you want clients result example 2025-01-01)
- Add parameter : date_end ( Date to you want clients result example 2025-12-31 )
- Method : GET
- {token} : Affiliate token

### Example request is :

```jsx
https://url.com/jetpack-api/api/client/{token}/get-clients?status=FTD&date_start=2025-01-01&date_end=2025-12-31
```

# Leads

## Send Leads

- URL : https://url.com/jetpack-api/api/aff/store -> (replace url.com with url given by support )
- Method: POST
- Header: {‘Content-Type’: ‘application/json’}

### Body request fields:

| Text             | Field        | Required |
| ---------------- | ------------ | -------- |
| First Name       | first_name   | Yes      |
| Last Name        | last_name    | Yes      |
| Email            | email        | Yes      |
| Phone Number     | phone        | Yes      |
| Country Code     | country_code | Yes      |
| Affiliate Token  | token        | Yes      |
| Affiliate Source | source       | Yes      |
| Tracking         | tracking     | No       |
| Extra            | "extra": {   |

"key": "value",
"keys": "test"
} | No |

### A simple request example is like the code below:

```jsx
{
    "first_name": "{{$randomFirstName}}",
    "last_name": "{{$randomLastName}}",
    "email": "{{$randomEmail}}",
    "phone": "{{$randomPhoneNumber}}",
    "country_code": "{{$randomCountryCode}}",
    "token":"4b7a2a92-23b5-4d01-a1cd-cc78dec1b68a",
    "source":"test",
    "tracking":"test",
    "extra": {
        "key": "value",
        "keys": "test"
    }
}
```

### And the response after the request has been accepted successfully, is like code below:

```jsx
{
    "success": true,
    "message": "Lead is registered successfully!",
    "id": 38215
}
```

- Country Code stand for country ISO CODE, for example IT stands for Italy.
- Token will be generated when a new affiliate is created in the CRM, and you will find under your affiliate profile
- Source will be generated from CRM and given by us and is required
- Extra fields stands for Extra Marketing Information campaign.

## Get Affiliate Leads

## To get all affiliate leads :

- URL : https://url.com/jetpack-api/api/affiliate/{token}/get-leads -> (replace url.com with url given by support )
- Method : GET
- {token} : Affiliate token

### Example how to get all leads request :

```jsx
https://url.com/jetpack-api/api/affiliate/{token}/get-leads
```

### And response should be :

```jsx
{
    "success": true,
    "data": [
        {
            "id": 38215,
            "first_name": "Dewayne",
            "last_name": "Lakin",
            "country": "Bhutan",
            "email": "Cale.Beahan@hotmail.com",
            "phone": "896-596-1261",
            "status": "New",
            "created_at": "2025-05-22T12:54:18.000000Z",
            "source": "test",
            "extra": {
                "key": "value",
                "keys": "test"
            },
            "registered_at": "2025-05-22 14:54:18",
            "tracking": null,
            "name": "Dewayne Lakin"
        },
    ]
}
```

### To get affiliate deposit leads:

- Url : https://url.com/jetpack-api/api/affiliate/{token}/get-leads
- Add parameter : status ( Name of status from CRM )
- Add parameter : date_start ( Date from you want leads result example 2025-01-01 )
- Add parameter : date_end ( Date to you want leads result example 2025-12-31 )

### Example request :

```jsx
https://url.com/jetpack-api/api/affiliate/{token}/get-leads?status=New&date_start=2025-01-01&date_end=2025-12-31
```

### To get affiliate leads with deposit example request :

```jsx
https://url.com/jetpack-api/api/affiliate/{token}/get-deposits
```

### Example response :

```jsx
{
    "success": true,
    "data": [
        {
            "id": 38215,
            "first_name": "Dewayne",
            "last_name": "Lakin",
            "email": "Cale.Beahan@hotmail.com",
            "phone": "896-596-1261",
            "deposit_at": "2025-05-22 15:20:31"
        }
    ]
}
```
