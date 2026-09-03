// Google Analytics 4 (GA4) Data API client.
//
// Auth: OAuth refresh token, not a service account — this GCP org has a policy
// blocking service-account key downloads (iam.disableServiceAccountKeyCreation), so
// setup is a one-time consent flow instead:
//   1. Set GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REDIRECT_URI
//      (from the "iLeads Dashboard" OAuth client in Google Cloud Console).
//   2. Visit /api/auth/google/start while logged in as marketing@saultnissan.ca.
//   3. The callback saves GOOGLE_REFRESH_TOKEN and (if detectable) GA4_PROPERTY_ID
//      into .env.local automatically.
import { OAuth2Client } from "google-auth-library";

const PROPERTY_ID = process.env.GA4_PROPERTY_ID;
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

export const ga4Configured = Boolean(PROPERTY_ID && CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN);

let client: OAuth2Client | null = null;
function getClient() {
  if (!client) {
    client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET);
    client.setCredentials({ refresh_token: REFRESH_TOKEN });
  }
  return client;
}

export interface Ga4Metrics {
  sessions: number;
  uniqueVisitors: number;
  avgSessionDurationSec: number;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function fetchGa4MonthToDate(monthStart: Date, asOf: Date): Promise<Ga4Metrics> {
  if (!ga4Configured) throw new Error("GA4 not configured");

  const { token } = await getClient().getAccessToken();

  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: toDateStr(monthStart), endDate: toDateStr(asOf) }],
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "averageSessionDuration" },
        ],
      }),
      cache: "no-store",
    }
  );

  if (!res.ok) throw new Error(`GA4 runReport failed: ${res.status} ${await res.text()}`);

  const json = await res.json();
  const row = json.rows?.[0]?.metricValues ?? [];
  const sessions = Number(row[0]?.value ?? 0);
  const uniqueVisitors = Number(row[1]?.value ?? 0);
  // averageSessionDuration comes back in seconds.
  const avgSessionDurationSec = Number(row[2]?.value ?? 0);

  return { sessions, uniqueVisitors, avgSessionDurationSec };
}
