import type { DashboardData } from "@/lib/types";

// Mirrors the block layout of the "Ilead tracker" Google Sheet (one month
// snapshot per block: month/days header, lead source table, website traffic +
// total rows, then a social media table) so the output can be pasted straight
// into the sheet without re-typing anything.
// https://docs.google.com/spreadsheets/d/1-KORmzPT24Cjg4ELkBuPT8iJgIwDlAa-hTE8-Jz6t5c

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function row(cells: (string | number | null)[]): string {
  return cells.map((c) => csvEscape(c === null ? "" : String(c))).join(",");
}

function formatDuration(sec: number | null): string {
  if (sec === null) return "";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function buildSheetCsv(data: DashboardData): string {
  const rows: string[] = [];

  rows.push(row(["", data.month, "", "", "", "Days complete", data.daysComplete]));
  rows.push(row(["", "", "", "", "", "Days available", data.daysAvailable]));
  rows.push(row([]));
  rows.push(
    row([
      "",
      "Lead source",
      "MTD Lead count",
      "Appts generated",
      "Sold",
      "Tracking for (LEADS)",
      "Tracking For (Sold)",
      "90 days Monthly average",
    ])
  );

  for (const src of data.leadSources) {
    rows.push(
      row([
        "",
        src.label,
        src.leadCount,
        src.appointments,
        src.sold,
        src.trackingForLeads,
        src.trackingForSold,
        src.ninetyDayAvg,
      ])
    );
  }

  const wt = data.websiteTraffic;
  const sessionsCell =
    wt.sessions === null
      ? ""
      : `${wt.sessions.toLocaleString()} Sessions${
          wt.uniqueVisitors !== null ? ` (${wt.uniqueVisitors.toLocaleString()} Unique Visitors)` : ""
        }`;
  const avgSessionCell = wt.avgSessionDurationSec !== null ? `Avg session=${formatDuration(wt.avgSessionDurationSec)}` : "";
  rows.push(row(["", "Website Traffic", sessionsCell, "", avgSessionCell, "", "", ""]));

  rows.push(
    row([
      "",
      "Total:",
      data.totals.leadCount,
      data.totals.appointments,
      data.totals.sold,
      data.totals.trackingForLeads,
      data.totals.trackingForSold,
      data.totals.ninetyDayAvg,
    ])
  );

  rows.push(row([]));
  rows.push(row(["", "SOCIAL MEDIA", "FOLLOWERS", "VIEWS", "Highest Performing Post", "", "", ""]));

  for (const s of data.socialMedia) {
    rows.push(
      row(["", s.platform.toUpperCase(), s.followers, s.metricValue, s.highestPerformingPost?.text ?? "", "", "", ""])
    );
  }

  // Leading ﻿ (BOM) keeps Excel/Sheets from mangling special characters on import.
  return "﻿" + rows.join("\r\n") + "\r\n";
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
