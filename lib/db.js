import postgres from "postgres";

let sqlClient;

export function db() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }
  if (!sqlClient) {
    sqlClient = postgres(process.env.DATABASE_URL, {
      ssl: "require",
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10
    });
  }
  return sqlClient;
}

export async function ensureSchema() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS attendance_odometer (
      id BIGSERIAL PRIMARY KEY,
      employee_id TEXT,
      employee_iden TEXT NOT NULL,
      attendance_date DATE NOT NULL,
      start_km NUMERIC,
      start_photo TEXT,
      end_km NUMERIC,
      end_photo TEXT,
      punch_in_time TIMESTAMPTZ,
      punch_out_time TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (employee_iden, attendance_date)
    )
  `;
}
