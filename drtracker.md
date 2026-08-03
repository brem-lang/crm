API (Server Side)
If you wish to send leads from your systems, you can use the API way to send your leads.
In order to do that, all you have to do is to implement a simple HTTP POST as follows.
You can use this postman as an helper :)

URL: https://tracker.doctor-mailer.com/repost.php?act=register
Type: POST
Content-Type: application/x-www-form-urlencoded
Parameters:

"ApiKey":YOUR-KEY
"ApiPassword":YOUR-PASSWORD
"CampaignID":Campaign ID
"ClickID":Click ID (optional)
"FirstName":First Name
"LastName":Last Name
"Email":Email Address
"PhoneNumber":Phone Number (including prefix)
"Language":language (2 letters code)
"Description":Description
"Note":Note
"Page":Source Page
"IP":IP Address
"SubSource":Your Sub Source
"P1":Free Parameter #1
"P2":Free Parameter #2
"P3":Free Parameter #3
"P4":Free Parameter #4
"P5":Free Parameter #5

Responses:

Success(ret_code == 200 or 201):
{"ret_code":"200","ret_message":"OK","url":"https:\/\/link2shortner.link\/go2offer.php?suid=TVRJN12345ZOREUyWHAbCdEfdz12&o=3f6c12345eca","leadid":"pa6JX^123$Jq7c1","brand_id":123,"uniqueid":"JR123DAbF1.128271123492956","clickid":""}

Failure(ret_code == 4## or 5##):
{"ret_code":"404","ret_message":"ERROR! NO MORE FALLBACKS AVAILABLE","ret_valid":false,"uniqueid":"Q6a1kw75yx.123271123492755","clickid":"","url":"https:\/\/link2shortner.link\/go2offer.php?suid=TVRJN123AbZOReDfghU&o=9fa1237abcf79"}

In order to fetch leads statuses please use:

URL: https://tracker.doctor-mailer.com/repost.php?act=get_leads_status
Type: POST
Content-Type: application/x-www-form-urlencoded
Parameters:

"ApiKey":YOUR-KEY
"ApiPassword":YOUR-PASSWORD
"DateFrom":Date (YYYY-MM-DD hh:mm:ss)
"DateTo":Date (YYYY-MM-DD hh:mm:ss)
"Grouped":"0" (Options: "0" or "1" [grouped per lead_id])

Responses:

Success(ret_code == 200):
{"ret_code":"200","ret_message":{"leads":[{"leadid":"5HhJu^123$G6eDh","clickid":"","email":"test@gmail.com","status":"Calling","registration_date":"2025-04-06 12:32:49"}]},"ret_valid":true}

Failure(ret_code == 404):
{"ret_code":"404","ret_message":"ERROR: Please select no more then 90 days","ret_valid":false}

In order to fetch depositors please use:

URL: https://tracker.doctor-mailer.com/repost.php?act=get_depositors
Type: POST
Content-Type: application/x-www-form-urlencoded
Parameters:

"ApiKey":YOUR-KEY
"ApiPassword":YOUR-PASSWORD
"DateFrom":Date (YYYY-MM-DD hh:mm:ss)
"DateTo":Date (YYYY-MM-DD hh:mm:ss)
"Grouped":"0" (Options: "0" or "1" [grouped per brand_id])

Responses:

Success(ret_code == 200):
{"ret_code":"200","ret_message":{"deposits":[{"leadid":"pa6JX^123$Jq7c1","clickid":"","email":"test-please-ignore-2025-04-10-02@gmail.com","date_deposited":"2025-04-10 14:12:15","amount":"0"}]},"ret_valid":true}

Failure(ret_code == 404):
{"ret_code":"404","ret_message":"ERROR: Please select no more then 90 days","ret_valid":false}
