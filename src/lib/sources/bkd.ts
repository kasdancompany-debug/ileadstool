// Client for BKD.ai's MCP endpoint (Settings > API Keys > "Connect Claude").
//
// Auth: the endpoint is a full OAuth2 resource server (confirmed via its
// .well-known/oauth-protected-resource — bearer tokens only, scope
// "openid profile email offline_access"), not a static API key. A plain
// `Authorization: Bearer <api key>` — what this file originally tried — gets
// "Invalid or expired token" back. Setup is a one-time consent flow instead:
//   1. Set BKD_OAUTH_CLIENT_ID / BKD_OAUTH_CLIENT_SECRET / BKD_OAUTH_REDIRECT_URI
//      (a client registered via the MCP server's dynamic client registration
//      endpoint — see .well-known/oauth-authorization-server).
//   2. Visit /api/auth/bkd/start while logged into BKD.ai as marketing@saultnissan.ca.
//   3. The callback saves BKD_REFRESH_TOKEN into .env.local automatically.
import { LEAD_SOURCES } from "@/lib/leadSources";

const MCP_URL = process.env.BKD_MCP_URL ?? "https://rixrkhumtmhzfgavzjyn.supabase.co/functions/v1/mcp";
const AUTH_BASE = process.env.BKD_AUTH_URL ?? "https://rixrkhumtmhzfgavzjyn.supabase.co/auth/v1";
export const BKD_AUTHORIZATION_ENDPOINT = `${AUTH_BASE}/oauth/authorize`;
export const BKD_TOKEN_ENDPOINT = `${AUTH_BASE}/oauth/token`;

const CLIENT_ID = process.env.BKD_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.BKD_OAUTH_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.BKD_REFRESH_TOKEN;

export const bkdConfigured = Boolean(CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN);

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.token;

  const res = await fetch(BKD_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: REFRESH_TOKEN!,
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
    }),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`BKD token refresh failed: ${res.status} ${await res.text()}`);

  const tokens = (await res.json()) as TokenResponse;
  cachedToken = { token: tokens.access_token, expiresAt: Date.now() + tokens.expires_in * 1000 };
  return cachedToken.token;
}

interface JsonRpcResponse<T> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: { code: number; message: string };
}

let requestId = 0;

async function rpc<T>(method: string, params: unknown): Promise<T> {
  if (!bkdConfigured) throw new Error("BKD not configured");
  const token = await getAccessToken();

  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`BKD MCP ${method} failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as JsonRpcResponse<T>;
  if (json.error) throw new Error(`BKD MCP ${method} error: ${json.error.message}`);
  if (json.result === undefined) throw new Error(`BKD MCP ${method} returned no result`);
  return json.result;
}

async function initialize() {
  return rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "iLeads-Dashboard", version: "0.1.0" },
  });
}

interface ToolsListResult {
  tools: { name: string; description?: string }[];
}

async function listTools() {
  return rpc<ToolsListResult>("tools/list", {});
}

interface ToolCallResult {
  content?: { type: string; text?: string }[];
  isError?: boolean;
}

// Tool results come back MCP-standard: { content: [{ type: "text", text: "<json>" }] },
// not the bare object directly — the actual payload is JSON-encoded inside the text block.
async function callTool<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const result = await rpc<ToolCallResult>("tools/call", { name, arguments: args });
  const text = result.content?.find((c) => c.type === "text")?.text;
  if (!text) throw new Error(`BKD tool ${name} returned no text content`);
  if (result.isError) throw new Error(`BKD tool ${name} error: ${text}`);
  return JSON.parse(text) as T;
}

interface AnalyticsResult {
  results: { bucket: string; value: number }[];
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface BkdLeadCounts {
  // channel label ("via X") -> counts
  [channel: string]: { leads: number; appointments: number; sold: number; ninetyDayLeads: number };
}

/**
 * Pulls lead/appointment/sold counts per active channel via the `bkd_analytics`
 * tool, broken down by lead source, for [monthStart, asOf] inclusive, plus each
 * channel's raw lead total over the trailing 90 days ending on asOf (callers turn
 * that into a per-month average). Throws on any failure — callers should catch
 * and fall back to manual overrides.
 */
export async function fetchMonthToDateCounts(monthStart: Date, asOf: Date): Promise<BkdLeadCounts> {
  await initialize();
  const { tools } = await listTools();

  const analyticsTool = tools.find((t) => t.name === "bkd_analytics") ?? tools.find((t) => /analytics/i.test(t.name));
  if (!analyticsTool) throw new Error("No analytics tool exposed by BKD MCP server");

  const from_date = toDateStr(monthStart);
  const to_date = toDateStr(asOf);

  const ninetyDaysAgo = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate() - 89);
  const ninetyDayFrom = toDateStr(ninetyDaysAgo);

  const [leads, sold, appointments, ninetyDayLeads] = await Promise.all([
    callTool<AnalyticsResult>(analyticsTool.name, { metric: "leads", group_by: "source", from_date, to_date }),
    callTool<AnalyticsResult>(analyticsTool.name, { metric: "sold_units", group_by: "source", from_date, to_date }),
    callTool<AnalyticsResult>(analyticsTool.name, { metric: "appointments", group_by: "source", from_date, to_date }),
    callTool<AnalyticsResult>(analyticsTool.name, { metric: "leads", group_by: "source", from_date: ninetyDayFrom, to_date }),
  ]);

  const byBucket = (r: AnalyticsResult) => {
    const map = new Map<string, number>();
    for (const row of r.results ?? []) map.set(row.bucket.toLowerCase(), row.value);
    return map;
  };
  const leadsByBucket = byBucket(leads);
  const soldByBucket = byBucket(sold);
  const apptsByBucket = byBucket(appointments);
  const ninetyDayByBucket = byBucket(ninetyDayLeads);

  const counts: BkdLeadCounts = {};
  for (const src of LEAD_SOURCES) {
    if (!src.bkdChannel) continue;
    const key = src.bkdChannel.toLowerCase();
    counts[src.bkdChannel] = {
      leads: leadsByBucket.get(key) ?? 0,
      appointments: apptsByBucket.get(key) ?? 0,
      sold: soldByBucket.get(key) ?? 0,
      ninetyDayLeads: ninetyDayByBucket.get(key) ?? 0,
    };
  }

  return counts;
}
