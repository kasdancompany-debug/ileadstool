"use client";

import { useEffect, useState, useCallback } from "react";
import type { DashboardData, SourceStatus } from "@/lib/types";
import type { Overrides } from "@/lib/overrides";

function StatusDot({ status }: { status: SourceStatus }) {
  const color =
    status === "live" ? "bg-emerald-500" : status === "manual" ? "bg-amber-500" : "bg-red-500";
  const label = status === "live" ? "Live" : status === "manual" ? "Manual entry" : "Connection error";
  return (
    <span className="inline-flex items-center gap-1.5" title={label}>
      <span className={`h-2 w-2 rounded-full ${color}`} />
    </span>
  );
}

function num(n: number | null) {
  return n === null ? "—" : n.toLocaleString();
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [overrides, setOverrides] = useState<Overrides | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [dashRes, overridesRes] = await Promise.all([
      fetch("/api/dashboard", { cache: "no-store" }),
      fetch("/api/overrides", { cache: "no-store" }),
    ]);
    setData(await dashRes.json());
    setOverrides(await overridesRes.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard client-side data fetch on mount
    load();
  }, [load]);

  async function save() {
    if (!overrides) return;
    setSaving(true);
    await fetch("/api/overrides", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(overrides),
    });
    setSaving(false);
    setEditing(false);
    load();
  }

  function setLeadOverride(key: string, field: "leadCount" | "appointments" | "sold", value: string) {
    setOverrides((prev) => {
      if (!prev) return prev;
      const n = value === "" ? undefined : Number(value);
      return {
        ...prev,
        leadSources: {
          ...prev.leadSources,
          [key]: { ...prev.leadSources[key], [field]: n },
        },
      };
    });
  }

  if (!data) {
    return <div className="p-8 text-neutral-400">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-neutral-100 md:p-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{data.month}</h1>
            <p className="text-sm text-neutral-400">
              Days complete: {data.daysComplete} / {data.daysAvailable}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-500">
              Updated {new Date(data.generatedAt).toLocaleTimeString()}
            </span>
            {editing ? (
              <>
                <button
                  onClick={save}
                  disabled={saving}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
              >
                Edit manual values
              </button>
            )}
            <button
              onClick={load}
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-neutral-800">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="bg-neutral-900 text-left text-neutral-400">
                <th className="px-3 py-2 font-medium">Lead source</th>
                <th className="px-3 py-2 font-medium">MTD Lead count</th>
                <th className="px-3 py-2 font-medium">Appts generated</th>
                <th className="px-3 py-2 font-medium">Sold</th>
                <th className="px-3 py-2 font-medium">Tracking for (Leads)</th>
                <th className="px-3 py-2 font-medium">Tracking for (Sold)</th>
                <th className="px-3 py-2 font-medium">90 day avg</th>
              </tr>
            </thead>
            <tbody>
              {data.leadSources.map((row) => (
                <tr key={row.key} className="border-t border-neutral-800 hover:bg-neutral-900/50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <StatusDot status={row.status} />
                      {row.label}
                    </div>
                  </td>
                  {(["leadCount", "appointments", "sold"] as const).map((field) => (
                    <td key={field} className="px-3 py-2 tabular-nums">
                      {editing && row.status !== "live" ? (
                        <input
                          type="number"
                          className="w-20 rounded border border-neutral-700 bg-neutral-800 px-2 py-1"
                          value={overrides?.leadSources[row.key]?.[field] ?? row[field]}
                          onChange={(e) => setLeadOverride(row.key, field, e.target.value)}
                        />
                      ) : (
                        row[field].toLocaleString()
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-2 tabular-nums text-neutral-400">{num(row.trackingForLeads)}</td>
                  <td className="px-3 py-2 tabular-nums text-neutral-400">{num(row.trackingForSold)}</td>
                  <td className="px-3 py-2 tabular-nums text-neutral-400">{num(row.ninetyDayAvg)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-neutral-700 bg-neutral-900 font-semibold">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 tabular-nums">{data.totals.leadCount.toLocaleString()}</td>
                <td className="px-3 py-2 tabular-nums">{data.totals.appointments.toLocaleString()}</td>
                <td className="px-3 py-2 tabular-nums">{data.totals.sold.toLocaleString()}</td>
                <td className="px-3 py-2 tabular-nums text-neutral-400">{num(data.totals.trackingForLeads)}</td>
                <td className="px-3 py-2 tabular-nums text-neutral-400">{num(data.totals.trackingForSold)}</td>
                <td className="px-3 py-2 tabular-nums text-neutral-400">{num(data.totals.ninetyDayAvg)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
            <div className="mb-3 flex items-center gap-2">
              <StatusDot status={data.websiteTraffic.status} />
              <h2 className="font-medium">Website Traffic</h2>
            </div>
            <dl className="space-y-1 text-sm text-neutral-300">
              <div className="flex justify-between">
                <dt className="text-neutral-500">Sessions</dt>
                <dd>{num(data.websiteTraffic.sessions)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Unique visitors</dt>
                <dd>{num(data.websiteTraffic.uniqueVisitors)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Conversion</dt>
                <dd>
                  {data.websiteTraffic.conversionRate === null
                    ? "—"
                    : `${(data.websiteTraffic.conversionRate * 100).toFixed(1)}%`}
                </dd>
              </div>
            </dl>
            {data.websiteTraffic.status !== "live" && (
              <p className="mt-3 text-xs text-neutral-500">
                Not connected to GA4 yet — showing manually entered values.
              </p>
            )}
          </div>

          {data.socialMedia.map((s) => (
            <div key={s.platform} className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
              <div className="mb-3 flex items-center gap-2">
                <StatusDot status={s.status} />
                <h2 className="font-medium">{s.platform}</h2>
              </div>
              <dl className="space-y-1 text-sm text-neutral-300">
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Followers</dt>
                  <dd>{num(s.followers)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-neutral-500">{s.metricLabel}</dt>
                  <dd>{s.views ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500">Top post</dt>
                  <dd className="truncate text-right">{s.highestPerformingPost ?? "—"}</dd>
                </div>
              </dl>
              {s.status !== "live" && (
                <p className="mt-3 text-xs text-neutral-500">
                  Not connected to {s.platform} yet — showing manually entered values.
                </p>
              )}
            </div>
          ))}
        </div>

        <p className="mt-6 text-xs text-neutral-600">
          Dot legend:{" "}
          <span className="text-emerald-500">● live</span> ·{" "}
          <span className="text-amber-500">● manual</span> ·{" "}
          <span className="text-red-500">● connection error</span>
        </p>
      </div>
    </div>
  );
}
