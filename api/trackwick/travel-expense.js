import { db, ensureSchema } from "../../lib/db.js";
import { checkSecret, normalizeDate } from "../../lib/helpers.js";

const BASE = "https://apis2s.trackwick.com";

function trackwickHeaders() {
  return {
    "Content-Type": "application/json",
    "platform": "API",
    "tlp-cid": process.env.TRACKWICK_CUSTOMER_ID || "",
    "tlp-t": String(Date.now()),
    "api-key": process.env.TRACKWICK_API_KEY || ""
  };
}

async function getExpenseList(employeeIden, date) {
  const url = new URL(`${BASE}/cust/1/api/expense/list`);
  url.searchParams.set("pt", "50");
  url.searchParams.set("pn", "0");
  url.searchParams.set("showForm", "true");
  url.searchParams.set("employeeIds", employeeIden);
  url.searchParams.set("dateFrom", date);
  url.searchParams.set("dateTo", date);

  const r = await fetch(url, { headers: trackwickHeaders() });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!r.ok) throw new Error(`Trackwick expense list failed ${r.status}: ${text}`);
  return data;
}

function findExpense(resp, expenseIden) {
  const candidates = resp?.data || resp?.expenses || resp?.result || [];
  if (!Array.isArray(candidates)) return null;
  return candidates.find(x =>
    x?.iden === expenseIden ||
    x?.expenseIden === expenseIden ||
    x?.expense_iden === expenseIden
  ) || null;
}

async function updateExpense(expense, expenseIden, odometer) {
  const template = process.env.TRACKWICK_EXPENSE_UPDATE_URL;
  if (!template) return { configured: false };

  const expenseId = expense?.id || expense?._id || expense?.dbId || "";
  const url = template
    .replace("{expenseId}", encodeURIComponent(expenseId))
    .replace("{expenseIden}", encodeURIComponent(expenseIden));

  const payload = {
    data: {
      "Start KM": odometer.startKm,
      "Starting Odometer Photo": odometer.startPhoto,
      "End KM": odometer.endKm,
      "Ending Odometer Photo": odometer.endPhoto,
      "Total KM": odometer.totalKm
    }
  };

  const r = await fetch(url, {
    method: "POST",
    headers: trackwickHeaders(),
    body: JSON.stringify(payload)
  });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!r.ok) throw new Error(`Expense update failed ${r.status}: ${text}`);
  return { configured: true, data };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "POST only" });
  }
  if (!checkSecret(req)) {
    return res.status(401).json({ ok: false, message: "Invalid webhook secret" });
  }

  try {
    await ensureSchema();

    const body = req.body || {};
    const expenseIden = body.expense_iden;
    const employeeIden = body.employee_iden;
    const claimedDate = normalizeDate(body.claimed_date);

    if (!expenseIden || !employeeIden || !claimedDate) {
      return res.status(200).json({
        ok: true,
        phase: "EXPENSE_IGNORED",
        message: "expense_iden, employee_iden or claimed_date missing",
        received: body
      });
    }

    const expenseResponse = await getExpenseList(employeeIden, claimedDate);
    const expense = findExpense(expenseResponse, expenseIden);

    if (!expense) {
      return res.status(200).json({
        ok: true,
        phase: "EXPENSE_NOT_FOUND",
        expenseIden,
        employeeIden,
        claimedDate
      });
    }

    const sql = db();
    const rows = await sql`
      SELECT *
      FROM attendance_odometer
      WHERE employee_iden = ${employeeIden}
        AND attendance_date = ${claimedDate}
      LIMIT 1
    `;

    if (!rows.length) {
      return res.status(200).json({
        ok: true,
        phase: "ATTENDANCE_ODOMETER_NOT_FOUND",
        expenseFound: true,
        expenseIden,
        employeeIden,
        claimedDate,
        message: "No Punch In/Punch Out odometer record has been stored for this employee/date."
      });
    }

    const row = rows[0];
    const startKm = row.start_km === null ? null : Number(row.start_km);
    const endKm = row.end_km === null ? null : Number(row.end_km);
    const totalKm = startKm !== null && endKm !== null && endKm >= startKm
      ? endKm - startKm
      : null;

    const odometer = {
      startKm,
      startPhoto: row.start_photo,
      endKm,
      endPhoto: row.end_photo,
      totalKm,
      odometerValid: startKm !== null && endKm !== null ? endKm >= startKm : null
    };

    if (!odometer.odometerValid) {
      return res.status(200).json({
        ok: true,
        phase: "ODOMETER_INVALID_OR_INCOMPLETE",
        expenseFound: true,
        attendanceFound: true,
        expenseIden,
        employeeIden,
        claimedDate,
        odometer,
        message: "Start/end KM are incomplete or End KM is lower than Start KM. Expense was not updated."
      });
    }

    const result = await updateExpense(expense, expenseIden, odometer);

    if (!result.configured) {
      return res.status(200).json({
        ok: true,
        phase: "ODOMETER_FOUND_WAITING_FOR_EXPENSE_UPDATE_API",
        expenseFound: true,
        attendanceFound: true,
        expenseIden,
        employeeIden,
        claimedDate,
        odometer,
        message: "Database lookup is working. Set TRACKWICK_EXPENSE_UPDATE_URL after the exact Trackwick expense edit/update request is identified."
      });
    }

    return res.status(200).json({
      ok: true,
      phase: "COMPLETED",
      expenseIden,
      employeeIden,
      claimedDate,
      odometer,
      updateResult: result.data
    });
  } catch (error) {
    console.error("TRAVEL_EXPENSE_ERROR", error);
    return res.status(500).json({
      ok: false,
      phase: "TRAVEL_EXPENSE_ERROR",
      message: error.message
    });
  }
}
