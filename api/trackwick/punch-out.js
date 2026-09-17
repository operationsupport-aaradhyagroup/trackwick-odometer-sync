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

  console.log("TRACKWICK_PUNCH_OUT", JSON.stringify(body));

  const required = {
    iden: body.iden,
    employee_id: body.employee_id,
    punch_out_time: body.punch_out_time,
    bike_ending_odometer_photo: body.bike_ending_odometer_photo,
    bike_ending_odometer_km: body.bike_ending_odometer_km
  };

  return res.status(200).json({
    ok: true,
    phase: "PUNCH_OUT_RECEIVED",
    received: required,
    message: "Punch Out webhook is working. Persistent storage will be connected next."
  });
}
