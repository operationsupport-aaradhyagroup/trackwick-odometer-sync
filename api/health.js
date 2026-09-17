export default function handler(req, res) {
  return res.status(200).json({
    ok: true,
    service: "trackwick-odometer-sync",
    time: new Date().toISOString()
  });
}
