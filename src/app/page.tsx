"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { DashboardData, LeadSourceRow, SourceStatus } from "@/lib/types";
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

// Distinguishes "nothing posted yet this month" from "not actually connected" —
// the latest post regardless of month, so a fresh-month zero reads as quiet
// rather than broken.
function formatLastPost(iso: string): string {
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">{children}</p>
  );
}

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayStr(): string {
  return dateToStr(new Date());
}

function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return dateToStr(new Date(y, m - 1, d + delta));
}

function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Builds a 7-wide grid of calendar cells for the given month, padded with the
// tail of the previous month and the head of the next so every week is full.
function getCalendarCells(year: number, month: number): { date: Date; inMonth: boolean }[] {
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInThisMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), inMonth: false });
  }
  for (let d = 1; d <= daysInThisMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false });
  }
  return cells;
}

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function DatePicker({
  value,
  max,
  onChange,
}: {
  value: string;
  max: string;
  onChange: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => parseDateStr(value).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => parseDateStr(value).getMonth());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function toggleOpen() {
    if (!open) {
      const d = parseDateStr(value);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
    setOpen((v) => !v);
  }

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  const cells = getCalendarCells(viewYear, viewMonth);
  const label = parseDateStr(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        className="flex items-center gap-2 rounded-lg border border-hairline bg-surface px-3 py-1.5 text-sm font-medium text-neutral-200 transition-colors hover:border-accent/50 focus:border-accent focus:outline-none"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
        {label}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-hairline bg-surface-2 p-3 shadow-2xl shadow-black/60">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-surface hover:text-accent"
            >
              ‹
            </button>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-200">
              {new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-surface hover:text-accent"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-y-1 text-center text-[10px] font-semibold uppercase text-neutral-600">
            {WEEKDAY_LABELS.map((w, i) => (
              <div key={i}>{w}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-y-1">
            {cells.map(({ date, inMonth }, i) => {
              const dStr = dateToStr(date);
              const isSelected = dStr === value;
              const isToday = dStr === todayStr();
              const isFuture = dStr > max;
              return (
                <button
                  type="button"
                  key={i}
                  disabled={isFuture}
                  onClick={() => {
                    onChange(dStr);
                    setOpen(false);
                  }}
                  className={[
                    "tabular mx-auto flex h-7 w-7 items-center justify-center rounded-md text-xs transition-colors",
                    !inMonth ? "text-neutral-700" : "text-neutral-300",
                    isSelected ? "bg-accent font-bold text-neutral-950" : !isFuture ? "hover:bg-surface hover:text-neutral-50" : "",
                    isToday && !isSelected ? "border border-accent/60 text-accent" : "",
                    isFuture ? "cursor-not-allowed opacity-30" : "",
                  ].join(" ")}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

type SortKey = "label" | "leadCount" | "appointments" | "sold" | "trackingForLeads" | "trackingForSold" | "ninetyDayAvg";

function SortableHeader({
  label,
  sortKey,
  align = "right",
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  align?: "left" | "right";
  sort: { key: SortKey; dir: "asc" | "desc" } | null;
  onSort: (key: SortKey) => void;
}) {
  const active = sort?.key === sortKey;
  return (
    <th className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`group inline-flex items-center gap-1 transition-colors hover:text-accent ${align === "right" ? "flex-row-reverse" : ""} ${active ? "text-accent" : ""}`}
      >
        {label}
        <span className={`text-[8px] ${active ? "opacity-100" : "opacity-0 group-hover:opacity-40"}`}>
          {active && sort.dir === "asc" ? "▲" : "▼"}
        </span>
      </button>
    </th>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [overrides, setOverrides] = useState<Overrides | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr());
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);

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

  function toggleSort(key: SortKey) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "desc" };
      if (prev.dir === "desc") return { key, dir: "asc" };
      return null;
    });
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

  const heroStats = [
    { label: "MTD Leads", value: data.totals.leadCount, pace: data.totals.trackingForLeads },
    { label: "Appointments", value: data.totals.appointments, pace: data.totals.trackingForAppointments },
    { label: "Sold", value: data.totals.sold, pace: data.totals.trackingForSold },
  ];

  const sortedLeadSources: LeadSourceRow[] = sort
    ? [...data.leadSources].sort((a, b) => {
        const av = a[sort.key];
        const bv = b[sort.key];
        if (typeof av === "string" || typeof bv === "string") {
          const cmp = String(av).localeCompare(String(bv));
          return sort.dir === "asc" ? cmp : -cmp;
        }
        if (av === null && bv === null) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;
        return sort.dir === "asc" ? av - bv : bv - av;
      })
    : data.leadSources;

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
              <DatePicker value={selectedDate} max={todayStr()} onChange={changeDate} />
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
                <SortableHeader label="Lead source" sortKey="label" align="left" sort={sort} onSort={toggleSort} />
                <SortableHeader label="MTD leads" sortKey="leadCount" sort={sort} onSort={toggleSort} />
                <SortableHeader label="Appts" sortKey="appointments" sort={sort} onSort={toggleSort} />
                <SortableHeader label="Sold" sortKey="sold" sort={sort} onSort={toggleSort} />
                <SortableHeader label="Pace (leads)" sortKey="trackingForLeads" sort={sort} onSort={toggleSort} />
                <SortableHeader label="Pace (sold)" sortKey="trackingForSold" sort={sort} onSort={toggleSort} />
                <SortableHeader label="90d avg" sortKey="ninetyDayAvg" sort={sort} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {sortedLeadSources.map((row) => (
                <tr key={row.key} className="group border-t border-hairline transition-colors hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <StatusDot status={row.status} />
                      <span className="text-neutral-200">{row.label}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editing && row.status !== "live" ? (
                      <input
                        type="number"
                        className="w-20 rounded border border-hairline bg-neutral-800 px-2 py-1 text-right tabular font-mono focus:border-accent focus:outline-none"
                        value={overrides?.leadSources[row.key]?.leadCount ?? row.leadCount}
                        onChange={(e) => setLeadOverride(row.key, "leadCount", e.target.value)}
                      />
                    ) : (
                      <span className="tabular font-mono text-xl font-bold text-neutral-50">
                        {row.leadCount.toLocaleString()}
                      </span>
                    )}
                  </td>
                  {(["appointments", "sold"] as const).map((field) => (
                    <td key={field} className="tabular px-4 py-3 text-right font-mono text-base text-neutral-300">
                      {editing && row.status !== "live" ? (
                        <input
                          type="number"
                          className="w-20 rounded border border-hairline bg-neutral-800 px-2 py-1 text-right focus:border-accent focus:outline-none"
                          value={overrides?.leadSources[row.key]?.[field] ?? row[field]}
                          onChange={(e) => setLeadOverride(row.key, field, e.target.value)}
                        />
                      ) : (
                        <span className="inline-flex items-center justify-end gap-1.5">
                          {field === "sold" && row.soldFlag && (
                            <span
                              title="Sold is far higher than appointments booked this month — worth a manual check in BKD before reporting this number. Often a sign of bulk-imported or backfilled records."
                              className="cursor-help text-amber-400"
                            >
                              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                                <path d="M12 2 1 21h22L12 2Zm0 6.5 6.6 11.5H5.4L12 8.5ZM11 11h2v5h-2v-5Zm0 6.5h2v2h-2v-2Z" />
                              </svg>
                            </span>
                          )}
                          {row[field].toLocaleString()}
                        </span>
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
                {s.lastPostAt && (
                  <p className="mt-2 text-xs text-neutral-600">Last posted {formatLastPost(s.lastPostAt)}</p>
                )}
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
