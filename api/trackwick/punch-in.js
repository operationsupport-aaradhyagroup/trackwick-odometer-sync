export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const configuredSecret = process.env.TRACKWICK_WEBHOOK_SECRET;
  if (configuredSecret) {
    const incomingSecret = req.headers["x-webhook-secret"];
    if (incomingSecret !== configuredSecret) {
      return res.status(401).json({ ok: false, error: "Invalid webhook secret" });
    }
  }

  const body = req.body || {};

  console.log("TRACKWICK_PUNCH_IN", JSON.stringify(body));

  const required = {
    iden: body.iden,
    employee_id: body.employee_id,
    punch_in_time: body.punch_in_time,
    bike_starting_odometer_photo: body.bike_starting_odometer_photo,
    bike_starting_odometer_km: body.bike_starting_odometer_km
  };

  return res.status(200).json({
    ok: true,
    phase: "PUNCH_IN_RECEIVED",
    received: required,
    message: "Punch In webhook is working. Persistent storage will be connected next."
  });
}
