const TRACKWICK_BASE = "https://apis2s.trackwick.com";

function trackwickHeaders() {
  const customerId = process.env.TRACKWICK_CUSTOMER_ID;
  const apiKey = process.env.TRACKWICK_API_KEY;

  if (!customerId || !apiKey) {
    throw new Error("Missing TRACKWICK_CUSTOMER_ID or TRACKWICK_API_KEY");
  }

  return {
    "Content-Type": "application/json",
    "platform": "API",
    "tlp-cid": customerId,
    "tlp-t": String(Date.now()),
    "api-key": apiKey
  };
}

function normalizeDate(value) {
  if (!value) return null;

  const raw = String(value).trim();

  // Already yyyy-MM-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // dd-MM-yyyy
  const dmyDash = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmyDash) return `${dmyDash[3]}-${dmyDash[2]}-${dmyDash[1]}`;

  // dd/MM/yyyy
  const dmySlash = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmySlash) return `${dmySlash[3]}-${dmySlash[2]}-${dmySlash[1]}`;

  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return null;
}

async function getExpenseList({ employeeIden, date }) {
  const qs = new URLSearchParams({
    pt: "50",
    pn: "0",
    showForm: "true",
    employeeIds: employeeIden,
    dateFrom: date,
    dateTo: date
  });

  const response = await fetch(
    `${TRACKWICK_BASE}/cust/1/api/expense/list?${qs.toString()}`,
    {
      method: "GET",
      headers: trackwickHeaders()
    }
  );

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }

  if (!response.ok) {
    throw new Error(
      `Trackwick expense list failed: HTTP ${response.status} ${JSON.stringify(body)}`
    );
  }

  return body;
}

function findExpense(expenseResponse, expenseIden) {
  const rows =
    expenseResponse?.data ||
    expenseResponse?.expenses ||
    expenseResponse?.result ||
    [];

  if (!Array.isArray(rows)) return null;

  return (
    rows.find(
      (row) =>
        String(row?.iden || row?.expenseIden || row?.expense_iden || "") ===
        String(expenseIden)
    ) || null
  );
}

async function getAttendanceDetails({ employeeIden, date }) {
  /*
   * IMPORTANT:
   * The supplied Trackwick API documentation only documents:
   *   GET /integration/api/get?type=punchin|punchout...
   *   POST /cust/1/api/punch/in/out
   *
   * Those documented endpoints do NOT return odometer KM/photo details.
   * Therefore this function intentionally refuses to guess an undocumented API.
   *
   * When Trackwick gives you the attendance-detail endpoint, set:
   * TRACKWICK_ATTENDANCE_DETAIL_URL
   *
   * Supported placeholders:
   *   {employeeIden}
   *   {date}
   */
  const template = process.env.TRACKWICK_ATTENDANCE_DETAIL_URL;
  if (!template) {
    return {
      configured: false,
      reason:
        "TRACKWICK_ATTENDANCE_DETAIL_URL is not configured. The public docs supplied do not expose attendance odometer details."
    };
  }

  const url = template
    .replaceAll("{employeeIden}", encodeURIComponent(employeeIden))
    .replaceAll("{date}", encodeURIComponent(date));

  const response = await fetch(url, {
    method: "GET",
    headers: trackwickHeaders()
  });

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }

  if (!response.ok) {
    throw new Error(
      `Attendance detail fetch failed: HTTP ${response.status} ${JSON.stringify(body)}`
    );
  }

  return { configured: true, body };
}

function extractOdometer(attendanceBody) {
  /*
   * Once we receive one real attendance JSON response, map the exact
   * field names here. The function already checks common variants.
   */
  const root = attendanceBody?.data ?? attendanceBody ?? {};

  const startKm =
    root?.bikeStartingOdometerKm ??
    root?.bike_starting_odometer_km ??
    root?.startingOdometerKm ??
    root?.startKm ??
    null;

  const endKm =
    root?.bikeEndingOdometerKm ??
    root?.bike_ending_odometer_km ??
    root?.endingOdometerKm ??
    root?.endKm ??
    null;

  const startPhoto =
    root?.bikeStartingOdometerPhoto ??
    root?.bike_starting_odometer_photo ??
    root?.startingOdometerPhoto ??
    root?.startPhoto ??
    null;

  const endPhoto =
    root?.bikeEndingOdometerPhoto ??
    root?.bike_ending_odometer_photo ??
    root?.endingOdometerPhoto ??
    root?.endPhoto ??
    null;

  return { startKm, endKm, startPhoto, endPhoto };
}

async function updateExpense({ expenseId, expenseIden, odometer }) {
  /*
   * The supplied docs include Expense LIST and Expense STAGE UPDATE,
   * but not a documented endpoint to update custom expense form fields.
   *
   * When Trackwick confirms that endpoint, set TRACKWICK_EXPENSE_UPDATE_URL.
   *
   * Supported placeholders:
   *   {expenseId}
   *   {expenseIden}
   */
  const template = process.env.TRACKWICK_EXPENSE_UPDATE_URL;

  if (!template) {
    return {
      configured: false,
      reason:
        "TRACKWICK_EXPENSE_UPDATE_URL is not configured. Supplied docs do not document custom expense form-field update."
    };
  }

  const url = template
    .replaceAll("{expenseId}", encodeURIComponent(expenseId || ""))
    .replaceAll("{expenseIden}", encodeURIComponent(expenseIden || ""));

  // These titles must exactly match the Trackwick form field titles.
  const payload = {
    data: {
      "Start KM": odometer.startKm,
      "Starting Odometer Photo": odometer.startPhoto,
      "End KM": odometer.endKm,
      "Ending Odometer Photo": odometer.endPhoto,
      "Total KM":
        odometer.startKm != null && odometer.endKm != null
          ? Number(odometer.endKm) - Number(odometer.startKm)
          : null
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: trackwickHeaders(),
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }

  if (!response.ok) {
    throw new Error(
      `Expense update failed: HTTP ${response.status} ${JSON.stringify(body)}`
    );
  }

  return { configured: true, body, payload };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed. Use POST."
    });
  }

  try {
    const expectedSecret = process.env.TRACKWICK_WEBHOOK_SECRET;
    if (expectedSecret) {
      const actualSecret = req.headers["x-webhook-secret"];
      if (actualSecret !== expectedSecret) {
        return res.status(401).json({
          ok: false,
          error: "Invalid webhook secret"
        });
      }
    }

    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    console.log(
      "TRACKWICK_EXPENSE_CREATE",
      JSON.stringify({
        receivedAt: new Date().toISOString(),
        body
      })
    );

    const expenseIden =
      body.expense_iden || body.expenseIden || body.iden || null;
    const expenseType =
      body.expense_type || body.expenseType || body.type || null;
    const employeeIden =
      body.employee_iden || body.employeeIden || body.employee || null;
    const claimedDate = normalizeDate(
      body.claimed_date || body.claimedDate || body.date
    );

    if (!expenseIden || !employeeIden || !claimedDate) {
      return res.status(200).json({
        ok: false,
        ignored: true,
        reason:
          "Required webhook values are missing. Need expense_iden, employee_iden and claimed_date.",
        received: body
      });
    }

    // Keep this permissive initially because Trackwick may send different naming.
    if (
      expenseType &&
      !String(expenseType).toLowerCase().includes("travel") &&
      !String(expenseType).toLowerCase().includes("expense")
    ) {
      return res.status(200).json({
        ok: true,
        ignored: true,
        reason: `Expense type ignored: ${expenseType}`
      });
    }

    // 1. Verify/fetch the expense record using documented API.
    const expenseResponse = await getExpenseList({
      employeeIden,
      date: claimedDate
    });
    const expense = findExpense(expenseResponse, expenseIden);

    // 2. Attempt attendance detail only if endpoint has been configured.
    const attendanceResult = await getAttendanceDetails({
      employeeIden,
      date: claimedDate
    });

    if (!attendanceResult.configured) {
      return res.status(200).json({
        ok: true,
        phase: "EXPENSE_VERIFIED_WAITING_FOR_ATTENDANCE_API",
        expenseFound: Boolean(expense),
        expenseIden,
        employeeIden,
        claimedDate,
        message: attendanceResult.reason,
        nextStep:
          "Provide one Trackwick attendance-detail API response or endpoint that contains the odometer KM/photo fields."
      });
    }

    const odometer = extractOdometer(attendanceResult.body);

    // 3. Stop safely if mapping is not yet confirmed.
    if (
      odometer.startKm == null &&
      odometer.endKm == null &&
      !odometer.startPhoto &&
      !odometer.endPhoto
    ) {
      return res.status(200).json({
        ok: true,
        phase: "ATTENDANCE_RECEIVED_MAPPING_REQUIRED",
        expenseFound: Boolean(expense),
        attendanceSample: attendanceResult.body,
        message:
          "Attendance API responded, but odometer field names are not mapped yet. Use the returned attendanceSample to update extractOdometer()."
      });
    }

    // 4. Update expense only if the undocumented update URL is configured.
    const updateResult = await updateExpense({
      expenseId: expense?.id || expense?._id || null,
      expenseIden,
      odometer
    });

    if (!updateResult.configured) {
      return res.status(200).json({
        ok: true,
        phase: "ODOMETER_FOUND_WAITING_FOR_EXPENSE_UPDATE_API",
        expenseFound: Boolean(expense),
        odometer,
        message: updateResult.reason
      });
    }

    return res.status(200).json({
      ok: true,
      phase: "COMPLETED",
      expenseIden,
      employeeIden,
      claimedDate,
      odometer,
      trackwickUpdate: updateResult.body
    });
  } catch (error) {
    console.error("TRACKWICK_ODOMETER_SYNC_ERROR", error);

    return res.status(500).json({
      ok: false,
      error: error?.message || "Unknown error"
    });
  }
}
