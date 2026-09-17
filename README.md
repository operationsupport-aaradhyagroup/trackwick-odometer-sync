# Trackwick Travel Expense Odometer Sync

This is a small Vercel Node.js middleware for:

Trackwick Expense Create webhook
→ identify employee + claimed date
→ verify Travel Expense via Trackwick Expense List API
→ fetch Attendance details
→ copy Start KM / Start Photo / End KM / End Photo
→ update the same Travel Expense.

## What already works

The project uses the documented Trackwick Expense List endpoint:

GET https://apis2s.trackwick.com/cust/1/api/expense/list

with:
- showForm=true
- employeeIds=<employee id/idEN>
- dateFrom=yyyy-MM-dd
- dateTo=yyyy-MM-dd

It also sends the documented headers:
- platform: API
- tlp-cid
- tlp-t
- api-key

## What Trackwick documentation does NOT provide

The supplied API documentation does not document:
1. An attendance-detail endpoint that returns odometer KM + odometer photos.
2. An expense update endpoint that updates custom form fields.

Therefore the project does not guess these APIs.

As soon as Trackwick confirms those two endpoints, set:

TRACKWICK_ATTENDANCE_DETAIL_URL=
TRACKWICK_EXPENSE_UPDATE_URL=

The code will then continue automatically.

## Deploy to Vercel

1. Create a new GitHub repo, for example:
   trackwick-odometer-sync

2. Upload all files in this project.

3. Import that repository into Vercel.

4. Add Environment Variables:
   TRACKWICK_CUSTOMER_ID
   TRACKWICK_API_KEY
   TRACKWICK_WEBHOOK_SECRET

5. Deploy.

## Health check

Open:

https://YOUR-PROJECT.vercel.app/api/health

Expected result:

{
  "ok": true,
  "service": "trackwick-odometer-sync"
}

## Trackwick Webhook

Create webhook:

Title:
Travel Expense Odometer Sync

Trigger:
Expense Create

URL:
https://YOUR-PROJECT.vercel.app/api/trackwick/travel-expense

HTTP Get:
OFF

Webhook header:

X-Webhook-Secret: <same value as TRACKWICK_WEBHOOK_SECRET>

Post Data:

{
  "expense_title": "{$expense_title}",
  "expense_iden": "{$expense_iden}",
  "expense_type": "{$expense_type}",
  "claimed_date": "{$claimed_date}",
  "employee_iden": "{$employee_iden}",
  "employee_name": "{$employee_name}"
}

## First test

Submit one Travel Expense.

Then Vercel:
Project → Logs

Search for:

TRACKWICK_EXPENSE_CREATE

The endpoint will also return a phase value. Initially it should reach:

EXPENSE_VERIFIED_WAITING_FOR_ATTENDANCE_API

That confirms:
- Webhook works
- Employee/date parsing works
- Trackwick authentication works
- Expense lookup works

Then we only need the actual attendance-detail endpoint and the custom expense-form update endpoint.

## Required Trackwick form titles

These must remain exactly as configured in Trackwick:

Start KM
Starting Odometer Photo
End KM
Ending Odometer Photo
Total KM
