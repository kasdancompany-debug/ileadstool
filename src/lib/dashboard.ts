import { LEAD_SOURCES } from "@/lib/leadSources";
import { bkdConfigured, fetchMonthToDateCounts } from "@/lib/sources/bkd";
import { ga4Configured, fetchGa4MonthToDate } from "@/lib/sources/ga4";
import { instagramConfigured, fetchInstagramStats } from "@/lib/sources/instagram";
import { facebookConfigured, fetchFacebookStats } from "@/lib/sources/facebook";
import { readOverrides, type Overrides } from "@/lib/overrides";
import type { DashboardData, LeadSourceRow, SocialMediaRow, SourceStatus, TopPost } from "@/lib/types";

function manualTopPost(text: string | undefined): TopPost | null {
  return text ? { text, permalink: null, stats: "" } : null;
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  const cut = s.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

// Dealership posts are almost always "Congratulations to X on..." or a review
// shoutout ("Thank you X, it was a pleasure...") — pull just the name out for a
// short, scannable label instead of showing the whole caption.
function shortenPostText(raw: string): string {
  const text = raw.trim();
  if (!text) return "(no caption)";

  const congrats = text.match(/congratulations to ([a-z][a-z .&']*?)(?:\s+(?:on|for)\b|[!.,\n]|$)/i);
  if (congrats) return `Congrats ${titleCase(congrats[1])}`;

  const thanks = text.match(/thank you ([a-z][a-z .&']*?)(?:[,!.\n]|$)/i);
  if (thanks && !/^[A-Z\s.&']+$/.test(thanks[1])) return `Thanks ${titleCase(thanks[1])}`;

  const firstLine =
    text
      .split("\n")
      .map((l) => l.replace(/\p{Extended_Pictographic}/gu, "").trim())
      .find(Boolean) ?? text;
  const firstSentence = firstLine.match(/^[^.!?]*[.!?]?/)?.[0]?.trim() || firstLine;
  return truncate(firstSentence, 42);
}

// Projects a month-to-date count to a full-month pace, matching the sheet's
// "Tracking for" columns: count / daysComplete * daysAvailable.
function projectPace(count: number, daysComplete: number, daysAvailable: number): number | null {
  if (daysComplete <= 0) return null;
  return Math.round((count / daysComplete) * daysAvailable);
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Resolves the "as of" date the dashboard should treat as the current day —
// defaults to today, or an explicit YYYY-MM-DD to look at any single month as
// it stood on that day (e.g. "2026-08-10" = day 10 of August, ignoring
// anything after Aug 10 even though the real month has since finished).
// Future dates clamp to today since no source has data past the present.
function resolveAsOfDate(dateParam?: string): Date {
  const today = new Date();
  if (!dateParam) return today;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateParam);
  if (!match) return today;
  const [, y, m, d] = match;
  const parsed = new Date(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(parsed.getTime())) return today;
  return parsed > today ? today : parsed;
}

async function fetchBkd(
  monthStart: Date,
  asOf: Date
): Promise<{ counts: Awaited<ReturnType<typeof fetchMonthToDateCounts>> | null; error: string | null }> {
  if (!bkdConfigured) return { counts: null, error: null };
  try {
    return { counts: await fetchMonthToDateCounts(monthStart, asOf), error: null };
  } catch (e) {
    return { counts: null, error: e instanceof Error ? e.message : String(e) };
  }
}

async function fetchWebsiteTraffic(
  monthStart: Date,
  asOf: Date,
  overrides: Overrides
): Promise<DashboardData["websiteTraffic"]> {
  if (!ga4Configured) {
    return {
      sessions: overrides.websiteTraffic.sessions ?? null,
      uniqueVisitors: overrides.websiteTraffic.uniqueVisitors ?? null,
      avgSessionDurationSec: overrides.websiteTraffic.avgSessionDurationSec ?? null,
      status: "manual",
    };
  }
  try {
    const ga4 = await fetchGa4MonthToDate(monthStart, asOf);
    return { ...ga4, status: "live" };
  } catch {
    return {
      sessions: overrides.websiteTraffic.sessions ?? null,
      uniqueVisitors: overrides.websiteTraffic.uniqueVisitors ?? null,
      avgSessionDurationSec: overrides.websiteTraffic.avgSessionDurationSec ?? null,
      status: "error",
    };
  }
}

async function fetchInstagramRow(monthStart: Date, asOf: Date, overrides: Overrides): Promise<SocialMediaRow> {
  if (!instagramConfigured) {
    const manual = overrides.socialMedia["instagram"];
    return {
      platform: "Instagram",
      followers: manual?.followers ?? null,
      metricLabel: "Views",
      metricValue: manual?.views ?? null,
      breakdown: [],
      lastPostAt: null,
      highestPerformingPost: manualTopPost(manual?.highestPerformingPost),
      status: "manual",
    };
  }
  try {
    const ig = await fetchInstagramStats(monthStart, asOf);
    return {
      platform: "Instagram",
      followers: ig.followers,
      metricLabel: "Views",
      metricValue: ig.viewsThisMonth.toLocaleString(),
      breakdown: [{ label: "Posts", value: ig.postCountThisMonth.toLocaleString() }],
      lastPostAt: ig.lastPostAt,
      highestPerformingPost: ig.topPost
        ? {
            text: shortenPostText(ig.topPost.caption),
            permalink: ig.topPost.permalink,
            stats: `${ig.topPost.views.toLocaleString()} views · ${ig.topPost.likes.toLocaleString()} likes · ${ig.topPost.comments.toLocaleString()} comments`,
          }
        : null,
      status: "live",
    };
  } catch {
    const manual = overrides.socialMedia["instagram"];
    return {
      platform: "Instagram",
      followers: manual?.followers ?? null,
      metricLabel: "Views",
      metricValue: manual?.views ?? null,
      breakdown: [],
      lastPostAt: null,
      highestPerformingPost: manualTopPost(manual?.highestPerformingPost),
      status: "error",
    };
  }
}

async function fetchFacebookRow(monthStart: Date, asOf: Date, overrides: Overrides): Promise<SocialMediaRow> {
  if (!facebookConfigured) {
    const manual = overrides.socialMedia["facebook"];
    return {
      platform: "Facebook",
      followers: manual?.followers ?? null,
      metricLabel: "Engagement",
      metricValue: manual?.views ?? null,
      breakdown: [],
      lastPostAt: null,
      highestPerformingPost: manualTopPost(manual?.highestPerformingPost),
      status: "manual",
    };
  }
  try {
    const fb = await fetchFacebookStats(monthStart, asOf);
    return {
      platform: "Facebook",
      followers: fb.followers,
      metricLabel: "Engagement",
      metricValue: fb.engagementThisMonth.toLocaleString(),
      breakdown: [
        { label: "Likes", value: fb.likesThisMonth.toLocaleString() },
        { label: "Comments", value: fb.commentsThisMonth.toLocaleString() },
        { label: "Shares", value: fb.sharesThisMonth.toLocaleString() },
        { label: "Posts", value: fb.postCountThisMonth.toLocaleString() },
      ],
      lastPostAt: fb.lastPostAt,
      highestPerformingPost: fb.topPost
        ? {
            text: shortenPostText(fb.topPost.message),
            permalink: fb.topPost.permalink,
            stats: `${fb.topPost.likes.toLocaleString()} likes · ${fb.topPost.comments.toLocaleString()} comments · ${fb.topPost.shares.toLocaleString()} shares`,
          }
        : null,
      status: "live",
    };
  } catch {
    const manual = overrides.socialMedia["facebook"];
    return {
      platform: "Facebook",
      followers: manual?.followers ?? null,
      metricLabel: "Engagement",
      metricValue: manual?.views ?? null,
      breakdown: [],
      lastPostAt: null,
      highestPerformingPost: manualTopPost(manual?.highestPerformingPost),
      status: "error",
    };
  }
}

export async function getDashboardData(dateParam?: string): Promise<DashboardData> {
  const asOf = resolveAsOfDate(dateParam);
  const daysAvailable = daysInMonth(asOf.getFullYear(), asOf.getMonth());
  const daysComplete = asOf.getDate();
  const monthStart = new Date(asOf.getFullYear(), asOf.getMonth(), 1);
  const monthLabel = asOf.toLocaleString("en-US", { month: "long", year: "numeric" });

  const overrides = await readOverrides();

  // These four sources are independent of each other — fetch concurrently
  // instead of one after another, since a serial chain was the main cause of
  // slow page loads (each source is its own network round trip).
  const [bkdResult, websiteTraffic, instagramRow, facebookRow] = await Promise.all([
    fetchBkd(monthStart, asOf),
    fetchWebsiteTraffic(monthStart, asOf, overrides),
    fetchInstagramRow(monthStart, asOf, overrides),
    fetchFacebookRow(monthStart, asOf, overrides),
  ]);
  const { counts: bkdCounts, error: bkdError } = bkdResult;

  const leadSources: LeadSourceRow[] = LEAD_SOURCES.map((src) => {
    const live = src.bkdChannel ? bkdCounts?.[src.bkdChannel] : undefined;
    const manual = overrides.leadSources[src.key];

    const leadCount = live?.leads ?? manual?.leadCount ?? 0;
    const appointments = live?.appointments ?? manual?.appointments ?? 0;
    const sold = live?.sold ?? manual?.sold ?? 0;
    const status: SourceStatus = live ? "live" : manual ? "manual" : bkdError ? "error" : "manual";

    // Trailing 90-day lead rate, scaled to a full month of this length — same
    // units as "Pace (leads)" so the two are directly comparable.
    const ninetyDayAvg = live ? Math.round((live.ninetyDayLeads / 90) * daysAvailable) : null;

    return {
      key: src.key,
      label: src.label,
      leadCount,
      appointments,
      sold,
      trackingForLeads: projectPace(leadCount, daysComplete, daysAvailable),
      trackingForSold: projectPace(sold, daysComplete, daysAvailable),
      ninetyDayAvg,
      status,
    };
  });

  const totals = leadSources.reduce(
    (acc, r) => {
      acc.leadCount += r.leadCount;
      acc.appointments += r.appointments;
      acc.sold += r.sold;
      return acc;
    },
    { leadCount: 0, appointments: 0, sold: 0 }
  );

  const ninetyDayLeadTotal = Object.values(bkdCounts ?? {}).reduce((sum, c) => sum + c.ninetyDayLeads, 0);
  const totalsNinetyDayAvg = bkdCounts ? Math.round((ninetyDayLeadTotal / 90) * daysAvailable) : null;

  const socialMedia: DashboardData["socialMedia"] = [instagramRow, facebookRow];

  return {
    month: monthLabel,
    asOfDate: toDateStr(asOf),
    daysComplete,
    daysAvailable,
    leadSources,
    totals: {
      ...totals,
      trackingForLeads: projectPace(totals.leadCount, daysComplete, daysAvailable),
      trackingForAppointments: projectPace(totals.appointments, daysComplete, daysAvailable),
      trackingForSold: projectPace(totals.sold, daysComplete, daysAvailable),
      ninetyDayAvg: totalsNinetyDayAvg,
    },
    websiteTraffic,
    socialMedia,
    generatedAt: new Date().toISOString(),
  };
}
