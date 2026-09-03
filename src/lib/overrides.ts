// Manual-entry fallback store for anything not yet wired to a live API
// (GA4/Instagram before you connect them, or a lead source if BKD.ai auth is still
// unresolved).
//
// Storage backend auto-selects based on environment:
//   - DATABASE_URL set  -> Postgres (works on Vercel/any serverless host — this is
//     the "deploy-ready" path). Any Postgres works: Vercel Postgres, Neon, Supabase,
//     etc. — just drop the connection string in as DATABASE_URL.
//   - DATABASE_URL unset -> local JSON file under data/ (fine for `npm run dev`,
//     but doesn't survive on serverless hosting, which has an ephemeral filesystem).
//
// NOTE: the Postgres path is written to spec but hasn't been exercised against a real
// database yet (no Postgres instance available in dev) — worth a smoke test the first
// time DATABASE_URL is set.
import { promises as fs } from "fs";
import path from "path";
import { Pool } from "pg";

export interface Overrides {
  leadSources: Record<string, { leadCount?: number; appointments?: number; sold?: number }>;
  websiteTraffic: { sessions?: number; uniqueVisitors?: number; avgSessionDurationSec?: number };
  socialMedia: Record<string, { followers?: number; views?: string; highestPerformingPost?: string }>;
}

const EMPTY: Overrides = { leadSources: {}, websiteTraffic: {}, socialMedia: {} };

const DATABASE_URL = process.env.DATABASE_URL;

// ---- Postgres backend -----------------------------------------------------

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL?.includes("localhost") ? undefined : { rejectUnauthorized: false },
    });
  }
  return pool;
}

// Single-row JSONB blob, same shape as the file store. Simple and sufficient for a
// single-user dashboard; revisit if this ever needs multi-user concurrent editing.
async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = getPool().query(`
      CREATE TABLE IF NOT EXISTS dashboard_overrides (
        id INT PRIMARY KEY DEFAULT 1,
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT single_row CHECK (id = 1)
      );
    `).then(() => undefined);
  }
  return schemaReady;
}

async function readOverridesFromPostgres(): Promise<Overrides> {
  await ensureSchema();
  const { rows } = await getPool().query<{ data: Overrides }>(
    "SELECT data FROM dashboard_overrides WHERE id = 1"
  );
  return rows[0] ? { ...EMPTY, ...rows[0].data } : EMPTY;
}

async function writeOverridesToPostgres(data: Overrides): Promise<void> {
  await ensureSchema();
  await getPool().query(
    `INSERT INTO dashboard_overrides (id, data, updated_at) VALUES (1, $1, now())
     ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = now()`,
    [data]
  );
}

// ---- Local file backend (dev fallback) -------------------------------------

const FILE = path.join(process.cwd(), "data", "overrides.json");

async function readOverridesFromFile(): Promise<Overrides> {
  try {
    const raw = await fs.readFile(FILE, "utf-8");
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return EMPTY;
  }
}

async function writeOverridesToFile(data: Overrides): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(data, null, 2));
}

// ---- Public API --------------------------------------------------------

export async function readOverrides(): Promise<Overrides> {
  return DATABASE_URL ? readOverridesFromPostgres() : readOverridesFromFile();
}

export async function writeOverrides(data: Overrides): Promise<void> {
  return DATABASE_URL ? writeOverridesToPostgres(data) : writeOverridesToFile(data);
}
