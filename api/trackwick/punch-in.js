import { db, ensureSchema } from "../../lib/db.js";
import { checkSecret, parseTrackwickDateTime, numberOrNull } from "../../lib/helpers.js";

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
    const employeeIden = body.iden;
    const employeeId = body.employee_id || null;
    const parsed = parseTrackwickDateTime(body.punch_in_time);
    const startKm = numberOrNull(body.bike_starting_odometer_km);
    const startPhoto = body.bike_starting_odometer_photo || null;

    if (!employeeIden || !parsed?.date) {
      return res.status(200).json({
        ok: true,
        phase: "PUNCH_IN_IGNORED",
        message: "employee iden or punch-in date missing",
        received: body
      });
    }

    const sql = db();
    const rows = await sql`
      INSERT INTO attendance_odometer
        (employee_id, employee_iden, attendance_date, start_km, start_photo, punch_in_time, updated_at)
      VALUES
        (${employeeId}, ${employeeIden}, ${parsed.date}, ${startKm}, ${startPhoto},
         ${parsed.isoWithIndiaOffset}, NOW())
      ON CONFLICT (employee_iden, attendance_date)
      DO UPDATE SET
        employee_id = COALESCE(EXCLUDED.employee_id, attendance_odometer.employee_id),
        start_km = EXCLUDED.start_km,
        start_photo = EXCLUDED.start_photo,
        punch_in_time = EXCLUDED.punch_in_time,
        updated_at = NOW()
      RETURNING *
    `;

    return res.status(200).json({
      ok: true,
      phase: "PUNCH_IN_STORED",
      attendance: rows[0]
    });
  } catch (error) {
    console.error("PUNCH_IN_ERROR", error);
    return res.status(500).json({ ok: false, phase: "PUNCH_IN_ERROR", message: error.message });
  }
}
