"use client";

import { useEffect, useState, useCallback } from "react";
import type { DashboardData, SourceStatus } from "@/lib/types";
import type { Overrides } from "@/lib/overrides";

function StatusDot({ status }: { status: SourceStatus }) {
  const color =
    status === "live" ? "bg-emerald-400" : status === "manual" ? "bg-amber-400" : "bg-red-400";
  const glow =
    status === "live" ? "shadow-[0_0_8px_rgba(52,211,153,0.8)]" : status === "manual" ? "shadow-[0_0_8px_rgba(251,191,36,0.6)]" : "shadow-[0_0_8px_rgba(248,113,113,0.6)]";
  const label = status === "live" ? "Live" : status === "manual" ? "Manual entry" : "Connection error";
  return (
    <span className="inline-flex items-center gap-1.5" title={label}>
      <span className={`h-1.5 w-1.5 rounded-full ${color} ${glow}`} />
    </span>
  );
}

function num(n: number | null) {
  return n === null ? "—" : n.toLocaleString();
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">{children}</p>
  );
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [overrides, setOverrides] = useState<Overrides | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr());

  const load = useCallback(async (date?: string) => {
    setPending(true);
    const qs = date ? `?date=${date}` : "";
    const [dashRes, overridesRes] = await Promise.all([
      fetch(`/api/dashboard${qs}`, { cache: "no-store" }),
      fetch("/api/overrides", { cache: "no-store" }),
    ]);
    const dashData: DashboardData = await dashRes.json();
    setData(dashData);
    setSelectedDate(dashData.asOfDate);
    setOverrides(await overridesRes.json());
    setPending(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard client-side data fetch on mount
    load();
  }, [load]);

  function changeDate(next: string) {
    setSelectedDate(next);
    load(next);
  }

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
    load(selectedDate);
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
    return (
      <div className="flex min-h-screen items-center justify-center text-neutral-500">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          Loading dashboard…
        </div>
      </div>
    );
  }

  const monthProgress = Math.min(100, Math.round((data.daysComplete / data.daysAvailable) * 100));
  const isToday = selectedDate >= todayStr();
  const maxLeadCount = Math.max(1, ...data.leadSources.map((r) => r.leadCount));

  const heroStats = [
    { label: "MTD Leads", value: data.totals.leadCount, pace: data.totals.trackingForLeads },
    { label: "Appointments", value: data.totals.appointments, pace: data.totals.trackingForAppointments },
    { label: "Sold", value: data.totals.sold, pace: data.totals.trackingForSold },
  ];

  return (
    <div className="min-h-screen p-6 text-neutral-100 md:p-10">
      <div className={`mx-auto max-w-6xl transition-opacity ${pending ? "opacity-60" : "opacity-100"}`}>
        {/* Header */}
        <div className="mb-10 border-b border-hairline pb-7">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <Eyebrow>Sault Nissan · Internal</Eyebrow>
              <h1 className="mt-1 text-5xl font-black tracking-tight text-neutral-50 md:text-6xl">
                {data.month}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="mr-1 text-xs text-neutral-600">
                Updated {new Date(data.generatedAt).toLocaleTimeString()}
              </span>
              {editing ? (
                <>
                  <button
                    onClick={save}
                    disabled={saving}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-neutral-950 transition-colors hover:bg-orange-400 disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="rounded-lg border border-hairline px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-surface-2"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="rounded-lg border border-hairline px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-surface-2"
                >
                  Edit manual values
                </button>
              )}
              <button
                onClick={() => load(selectedDate)}
                className="rounded-lg border border-hairline px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-surface-2"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-5">
            <div className="flex items-center gap-1.5">
              <button
                aria-label="Previous day"
                onClick={() => changeDate(addDays(selectedDate, -1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-hairline text-neutral-400 transition-colors hover:bg-surface-2 hover:text-neutral-100"
              >
                ‹
              </button>
              <input
                type="date"
                value={selectedDate}
                max={todayStr()}
                onChange={(e) => e.target.value && changeDate(e.target.value)}
                className="[color-scheme:dark] rounded-lg border border-hairline bg-surface px-3 py-1.5 text-sm text-neutral-200 focus:border-accent focus:outline-none"
              />
              <button
                aria-label="Next day"
                disabled={isToday}
                onClick={() => changeDate(addDays(selectedDate, 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-hairline text-neutral-400 transition-colors hover:bg-surface-2 hover:text-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                ›
              </button>
              {!isToday && (
                <button
                  onClick={() => changeDate(todayStr())}
                  className="ml-1 rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:bg-surface-2 hover:text-neutral-100"
                >
                  Today
                </button>
              )}
            </div>

            <div className="flex min-w-[180px] flex-1 items-center gap-3">
              <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-neutral-800">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${monthProgress}%` }}
                />
              </div>
              <p className="whitespace-nowrap text-xs text-neutral-500">
                Day {data.daysComplete} of {data.daysAvailable}
              </p>
            </div>
          </div>
        </div>

        {/* Hero KPI band */}
        <div className="mb-10 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-3">
          {heroStats.map((h) => (
            <div key={h.label} className="bg-surface px-6 py-8 sm:px-9 sm:py-10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">{h.label}</p>
              <p className="tabular mt-3 font-mono text-6xl font-black leading-none tracking-tight text-neutral-50 sm:text-7xl">
                {h.value.toLocaleString()}
              </p>
              {h.pace !== null ? (
                <p className="tabular mt-3 text-sm text-accent">
                  <span aria-hidden>→</span> pacing for{" "}
                  <span className="font-semibold">{h.pace.toLocaleString()}</span> by day {data.daysAvailable}
                </p>
              ) : (
                <p className="mt-3 text-sm text-neutral-600">—</p>
              )}
            </div>
          ))}
        </div>

        {/* Lead source table */}
        <Eyebrow>Lead Sources</Eyebrow>
        <div className="mt-3 overflow-x-auto rounded-xl border border-hairline bg-surface shadow-2xl shadow-black/40">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-neutral-500">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider">Lead source</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider">MTD leads</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider">Appts</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider">Sold</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider">Pace (leads)</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider">Pace (sold)</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider">90d avg</th>
              </tr>
            </thead>
            <tbody>
              {data.leadSources.map((row) => (
                <tr key={row.key} className="group border-t border-hairline transition-colors hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <StatusDot status={row.status} />
                      <span className="text-neutral-200">{row.label}</span>
                    </div>
                  </td>
                  <td className="relative px-4 py-3 text-right">
                    {editing && row.status !== "live" ? (
                      <input
                        type="number"
                        className="w-20 rounded border border-hairline bg-neutral-800 px-2 py-1 text-right tabular font-mono focus:border-accent focus:outline-none"
                        value={overrides?.leadSources[row.key]?.leadCount ?? row.leadCount}
                        onChange={(e) => setLeadOverride(row.key, "leadCount", e.target.value)}
                      />
                    ) : (
                      <>
                        {row.leadCount > 0 && (
                          <div
                            aria-hidden
                            className="pointer-events-none absolute inset-y-1.5 right-0 rounded-l-md bg-accent/[0.12]"
                            style={{ width: `${Math.max(6, (row.leadCount / maxLeadCount) * 100)}%` }}
                          />
                        )}
                        <span className="tabular relative font-mono text-base font-bold text-neutral-50">
                          {row.leadCount.toLocaleString()}
                        </span>
                      </>
                    )}
                  </td>
                  {(["appointments", "sold"] as const).map((field) => (
                    <td key={field} className="tabular px-4 py-3 text-right font-mono text-neutral-300">
                      {editing && row.status !== "live" ? (
                        <input
                          type="number"
                          className="w-20 rounded border border-hairline bg-neutral-800 px-2 py-1 text-right focus:border-accent focus:outline-none"
                          value={overrides?.leadSources[row.key]?.[field] ?? row[field]}
                          onChange={(e) => setLeadOverride(row.key, field, e.target.value)}
                        />
                      ) : (
                        row[field].toLocaleString()
                      )}
                    </td>
                  ))}
                  <td className="tabular px-4 py-3 text-right font-mono text-xs text-neutral-500">{num(row.trackingForLeads)}</td>
                  <td className="tabular px-4 py-3 text-right font-mono text-xs text-neutral-500">{num(row.trackingForSold)}</td>
                  <td className="tabular px-4 py-3 text-right font-mono text-xs text-neutral-600">{num(row.ninetyDayAvg)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-accent/40 bg-surface-2 font-semibold">
                <td className="px-4 py-3.5 text-neutral-100">Total</td>
                <td className="tabular px-4 py-3.5 text-right font-mono text-lg text-neutral-50">{data.totals.leadCount.toLocaleString()}</td>
                <td className="tabular px-4 py-3.5 text-right font-mono text-neutral-100">{data.totals.appointments.toLocaleString()}</td>
                <td className="tabular px-4 py-3.5 text-right font-mono text-neutral-100">{data.totals.sold.toLocaleString()}</td>
                <td className="tabular px-4 py-3.5 text-right font-mono text-xs text-neutral-500">{num(data.totals.trackingForLeads)}</td>
                <td className="tabular px-4 py-3.5 text-right font-mono text-xs text-neutral-500">{num(data.totals.trackingForSold)}</td>
                <td className="tabular px-4 py-3.5 text-right font-mono text-xs text-neutral-600">{num(data.totals.ninetyDayAvg)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Website + social stat cards */}
        <div className="mt-10">
          <Eyebrow>Traffic &amp; Social</Eyebrow>
          <div className="mt-3 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-hairline bg-surface p-5 shadow-2xl shadow-black/40">
              <div className="mb-4 flex items-center gap-2">
                <StatusDot status={data.websiteTraffic.status} />
                <h2 className="text-sm font-semibold text-neutral-200">Website Traffic</h2>
              </div>
              <p className="tabular font-mono text-4xl font-black tracking-tight text-neutral-50">
                {num(data.websiteTraffic.sessions)}
              </p>
              <p className="mb-4 text-xs text-neutral-500">sessions this month</p>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between border-t border-hairline pt-2">
                  <dt className="text-neutral-500">Unique visitors</dt>
                  <dd className="tabular font-mono text-neutral-200">{num(data.websiteTraffic.uniqueVisitors)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Conversion</dt>
                  <dd className="tabular font-mono text-neutral-200">
                    {data.websiteTraffic.conversionRate === null
                      ? "—"
                      : `${(data.websiteTraffic.conversionRate * 100).toFixed(1)}%`}
                  </dd>
                </div>
              </dl>
              {data.websiteTraffic.status !== "live" && (
                <p className="mt-3 text-xs text-neutral-600">
                  Not connected to GA4 yet — showing manually entered values.
                </p>
              )}
            </div>

            {data.socialMedia.map((s) => (
              <div key={s.platform} className="rounded-xl border border-hairline bg-surface p-5 shadow-2xl shadow-black/40">
                <div className="mb-4 flex items-center gap-2">
                  <StatusDot status={s.status} />
                  <h2 className="text-sm font-semibold text-neutral-200">{s.platform}</h2>
                </div>
                <p className="tabular font-mono text-4xl font-black tracking-tight text-neutral-50">
                  {num(s.followers)}
                </p>
                <p className="mb-4 text-xs text-neutral-500">followers</p>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between gap-4 border-t border-hairline pt-2">
                    <dt className="shrink-0 text-neutral-500">{s.metricLabel}</dt>
                    <dd className="tabular text-right font-mono text-neutral-200">{s.metricValue ?? "—"}</dd>
                  </div>
                  {s.breakdown.map((b) => (
                    <div key={b.label} className="flex justify-between gap-4">
                      <dt className="shrink-0 text-neutral-500">{b.label}</dt>
                      <dd className="tabular text-right font-mono text-neutral-200">{b.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 border-l-2 border-accent/50 pl-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Top post</p>
                  {s.highestPerformingPost ? (
                    <>
                      {s.highestPerformingPost.permalink ? (
                        <a
                          href={s.highestPerformingPost.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 block truncate text-sm text-neutral-300 underline decoration-neutral-700 underline-offset-2 hover:text-accent hover:decoration-accent"
                        >
                          {s.highestPerformingPost.text}
                        </a>
                      ) : (
                        <p className="mt-1 truncate text-sm text-neutral-300">{s.highestPerformingPost.text}</p>
                      )}
                      {s.highestPerformingPost.stats && (
                        <p className="mt-1 text-xs text-neutral-500">{s.highestPerformingPost.stats}</p>
                      )}
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-neutral-500">—</p>
                  )}
                </div>
                {s.status !== "live" && (
                  <p className="mt-3 text-xs text-neutral-600">
                    Not connected to {s.platform} yet — showing manually entered values.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <p className="mt-8 text-xs text-neutral-600">
          Dot legend:{" "}
          <span className="text-emerald-400">● live</span> ·{" "}
          <span className="text-amber-400">● manual</span> ·{" "}
          <span className="text-red-400">● connection error</span>
        </p>
      </div>
    </div>
  );
}
