export function checkSecret(req) {
  const expected = process.env.TRACKWICK_WEBHOOK_SECRET;
  if (!expected) return true;
  return req.headers["x-webhook-secret"] === expected;
}

export function parseTrackwickDateTime(value) {
  if (!value || typeof value !== "string") return null;
  const m = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, mi, ss] = m;
  return {
    date: `${yyyy}-${mm}-${dd}`,
    isoWithIndiaOffset: `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}+05:30`
  };
}

export function normalizeDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  let m = s.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0,10);
  return null;
}

export function numberOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
