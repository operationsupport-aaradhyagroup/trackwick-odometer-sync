# Trackwick Odometer Sync v3

This version adds persistent PostgreSQL storage.

## Endpoints

- `GET /api/health`
- `POST /api/trackwick/punch-in`
- `POST /api/trackwick/punch-out`
- `POST /api/trackwick/travel-expense`

## Required Vercel environment variables

```text
DATABASE_URL=postgresql://...
TRACKWICK_CUSTOMER_ID=...
TRACKWICK_API_KEY=...
TRACKWICK_WEBHOOK_SECRET=...
TRACKWICK_EXPENSE_UPDATE_URL=
```

`TRACKWICK_EXPENSE_UPDATE_URL` should remain blank until the exact Trackwick expense edit/update endpoint is captured.

## Trackwick Punch In payload

```json
{
  "iden": "{$employee_iden}",
  "employee_id": "{$employee_id}",
  "punch_in_time": "{$punch_in_time}",
  "bike_starting_odometer_photo": "{$form_data_Bike Starting Odometer Photo}",
  "bike_starting_odometer_km": "{$form_data_Bike Starting Odometer KM}"
}
```

URL:

```text
https://trackwick-odometer-sync.vercel.app/api/trackwick/punch-in
```

## Trackwick Punch Out payload

```json
{
  "iden": "{$employee_iden}",
  "employee_id": "{$employee_id}",
  "punch_out_time": "{$punch_out_time}",
  "bike_ending_odometer_photo": "{$form_data_Bike Ending Odometer Photo}",
  "bike_ending_odometer_km": "{$form_data_Bike Ending Odometer KM}"
}
```

URL:

```text
https://trackwick-odometer-sync.vercel.app/api/trackwick/punch-out
```

## Expense Create payload

```json
{
  "expense_title": "{$expense_title}",
  "expense_iden": "{$expense_iden}",
  "expense_type": "{$expense_type}",
  "claimed_date": "{$claimed_date}",
  "employee_iden": "{$employee_iden}",
  "employee_name": "{$employee_name}"
}
```

URL:

```text
https://trackwick-odometer-sync.vercel.app/api/trackwick/travel-expense
```

## Database behavior

The app automatically creates a table called `attendance_odometer`.

Unique key:
- `employee_iden`
- `attendance_date`

Punch In stores:
- start KM
- start photo
- punch-in time

Punch Out stores:
- end KM
- end photo
- punch-out time

Expense Create finds the row for the same employee and claimed date.

## Expected phases

Punch In:
- `PUNCH_IN_STORED`

Punch Out:
- `PUNCH_OUT_STORED`

Expense Create before expense update API is configured:
- `ODOMETER_FOUND_WAITING_FOR_EXPENSE_UPDATE_API`

If End KM < Start KM:
- `ODOMETER_INVALID_OR_INCOMPLETE`
