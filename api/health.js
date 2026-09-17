export default function handler(req, res) {
  return res.status(200).json({
    ok: true,
    service: "trackwick-odometer-sync",
    version: "3.0.0",
    time: new Date().toISOString()
  });
}
