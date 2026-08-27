// Client for BKD.ai's MCP endpoint (Settings > API Keys > "Create MCP key").
//
// NOTE: as of 2026-08-24 the auth header format hasn't been confirmed — the CRM's
// "Connect to Claude" button doesn't fire a request yet, and there's no public docs
// page. This client uses the standard `Authorization: Bearer <key>` scheme, which is
// the most likely convention but returned "Invalid or expired token" on first try.
// Once you have the correct format from BKD.ai/AutoAgents support, only `callTool`
// below needs to change.
import { LEAD_SOURCES } from "@/lib/leadSources";

const MCP_URL =
  process.env.BKD_MCP_URL ??
  "https://rixrkhumtmhzfgavzjyn.supabase.co/functions/v1/mcp";
const API_KEY = process.env.BKD_API_KEY;

export const bkdConfigured = Boolean(API_KEY);

interface JsonRpcResponse<T> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: { code: number; message: string };
}

let requestId = 0;

async function rpc<T>(method: string, params: unknown): Promise<T> {
  if (!API_KEY) throw new Error("BKD_API_KEY not configured");

  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${API_KEY}`,
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

async function callTool<T>(name: string, args: Record<string, unknown>) {
  return rpc<T>("tools/call", { name, arguments: args });
}

export interface BkdLeadCounts {
  // channel label ("via X") -> counts
  [channel: string]: { leads: number; appointments: number; sold: number };
}

/**
 * Pulls MTD lead/appointment/sold counts per active channel.
 * Throws on any failure — callers should catch and fall back to manual overrides.
 */
export async function fetchMonthToDateCounts(monthStart: Date): Promise<BkdLeadCounts> {
  await initialize();
  const { tools } = await listTools();

  // Try to find a reasonable tool for contacts/leads. Exact tool names are unknown
  // until we get docs, so this searches by common naming patterns.
  const contactsTool = tools.find((t) =>
    /contact|lead/i.test(t.name)
  );
  const dealsTool = tools.find((t) => /deal/i.test(t.name));

  if (!contactsTool) throw new Error("No contacts/leads tool exposed by BKD MCP server");

  const contacts = await callTool<{ items: { leadSource: string; createdAt: string; stage: string }[] }>(
    contactsTool.name,
    { createdAfter: monthStart.toISOString() }
  );

  const deals = dealsTool
    ? await callTool<{ items: { leadSource: string; status: string; closedAt: string }[] }>(
        dealsTool.name,
        { closedAfter: monthStart.toISOString() }
      )
    : { items: [] };

  const counts: BkdLeadCounts = {};
  for (const src of LEAD_SOURCES) {
    if (!src.bkdChannel) continue;
    counts[src.bkdChannel] = { leads: 0, appointments: 0, sold: 0 };
  }

  for (const c of contacts.items ?? []) {
    const bucket = counts[c.leadSource];
    if (!bucket) continue;
    bucket.leads += 1;
    if (c.stage && /appt|appointment|scheduled/i.test(c.stage)) bucket.appointments += 1;
  }

  for (const d of deals.items ?? []) {
    const bucket = counts[d.leadSource];
    if (!bucket) continue;
    if (d.status && /sold|won|complete/i.test(d.status)) bucket.sold += 1;
  }

  return counts;
}
