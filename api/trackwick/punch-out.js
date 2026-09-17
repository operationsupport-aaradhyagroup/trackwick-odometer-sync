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
    const parsed = parseTrackwickDateTime(body.punch_out_time);
    const endKm = numberOrNull(body.bike_ending_odometer_km);
    const endPhoto = body.bike_ending_odometer_photo || null;

    if (!employeeIden || !parsed?.date) {
      return res.status(200).json({
        ok: true,
        phase: "PUNCH_OUT_IGNORED",
        message: "employee iden or punch-out date missing",
        received: body
      });
    }

    const sql = db();
    const rows = await sql`
      INSERT INTO attendance_odometer
        (employee_id, employee_iden, attendance_date, end_km, end_photo, punch_out_time, updated_at)
      VALUES
        (${employeeId}, ${employeeIden}, ${parsed.date}, ${endKm}, ${endPhoto},
         ${parsed.isoWithIndiaOffset}, NOW())
      ON CONFLICT (employee_iden, attendance_date)
      DO UPDATE SET
        employee_id = COALESCE(EXCLUDED.employee_id, attendance_odometer.employee_id),
        end_km = EXCLUDED.end_km,
        end_photo = EXCLUDED.end_photo,
        punch_out_time = EXCLUDED.punch_out_time,
        updated_at = NOW()
      RETURNING *
    `;

    const row = rows[0];
    const start = row.start_km === null ? null : Number(row.start_km);
    const end = row.end_km === null ? null : Number(row.end_km);

    return res.status(200).json({
      ok: true,
      phase: "PUNCH_OUT_STORED",
      attendance: row,
      totalKm: start !== null && end !== null && end >= start ? end - start : null,
      odometerValid: start !== null && end !== null ? end >= start : null
    });
  } catch (error) {
    console.error("PUNCH_OUT_ERROR", error);
    return res.status(500).json({ ok: false, phase: "PUNCH_OUT_ERROR", message: error.message });
  }
}
