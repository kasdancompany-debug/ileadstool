import { LEAD_SOURCES } from "@/lib/leadSources";
import { bkdConfigured, fetchMonthToDateCounts } from "@/lib/sources/bkd";
import { ga4Configured, fetchGa4MonthToDate } from "@/lib/sources/ga4";
import { instagramConfigured, fetchInstagramStats } from "@/lib/sources/instagram";
import { facebookConfigured, fetchFacebookStats } from "@/lib/sources/facebook";
import { readOverrides } from "@/lib/overrides";
import type { DashboardData, LeadSourceRow, SourceStatus, TopPost } from "@/lib/types";

function manualTopPost(text: string | undefined): TopPost | null {
  return text ? { text, permalink: null, stats: "" } : null;
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

export async function getDashboardData(): Promise<DashboardData> {
  const now = new Date();
  const daysAvailable = daysInMonth(now.getFullYear(), now.getMonth());
  const daysComplete = now.getDate();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  const overrides = await readOverrides();

  let bkdCounts: Awaited<ReturnType<typeof fetchMonthToDateCounts>> | null = null;
  let bkdError: string | null = null;
  if (bkdConfigured) {
    try {
      bkdCounts = await fetchMonthToDateCounts(monthStart);
    } catch (e) {
      bkdError = e instanceof Error ? e.message : String(e);
    }
  }

  const leadSources: LeadSourceRow[] = LEAD_SOURCES.map((src) => {
    const live = src.bkdChannel ? bkdCounts?.[src.bkdChannel] : undefined;
    const manual = overrides.leadSources[src.key];

    const leadCount = live?.leads ?? manual?.leadCount ?? 0;
    const appointments = live?.appointments ?? manual?.appointments ?? 0;
    const sold = live?.sold ?? manual?.sold ?? 0;
    const status: SourceStatus = live ? "live" : manual ? "manual" : bkdError ? "error" : "manual";

    return {
      key: src.key,
      label: src.label,
      leadCount,
      appointments,
      sold,
      trackingForLeads: projectPace(leadCount, daysComplete, daysAvailable),
      trackingForSold: projectPace(sold, daysComplete, daysAvailable),
      ninetyDayAvg: null, // needs 3 months of history; not yet available from BKD.ai
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

  let websiteTraffic: DashboardData["websiteTraffic"];
  if (ga4Configured) {
    try {
      const ga4 = await fetchGa4MonthToDate();
      websiteTraffic = { ...ga4, status: "live" };
    } catch {
      websiteTraffic = {
        sessions: overrides.websiteTraffic.sessions ?? null,
        uniqueVisitors: overrides.websiteTraffic.uniqueVisitors ?? null,
        conversionRate: overrides.websiteTraffic.conversionRate ?? null,
        status: "error",
      };
    }
  } else {
    websiteTraffic = {
      sessions: overrides.websiteTraffic.sessions ?? null,
      uniqueVisitors: overrides.websiteTraffic.uniqueVisitors ?? null,
      conversionRate: overrides.websiteTraffic.conversionRate ?? null,
      status: "manual",
    };
  }

  const socialMedia: DashboardData["socialMedia"] = [];
  if (instagramConfigured) {
    try {
      const ig = await fetchInstagramStats();
      socialMedia.push({
        platform: "Instagram",
        followers: ig.followers,
        views: String(ig.viewsThisMonth),
        metricLabel: "Views",
        highestPerformingPost: ig.topPost
          ? {
              text: ig.topPost.caption || "(no caption)",
              permalink: ig.topPost.permalink,
              stats: `${ig.topPost.views.toLocaleString()} views · ${ig.topPost.likes.toLocaleString()} likes · ${ig.topPost.comments.toLocaleString()} comments`,
            }
          : null,
        status: "live",
      });
    } catch {
      const manual = overrides.socialMedia["instagram"];
      socialMedia.push({
        platform: "Instagram",
        followers: manual?.followers ?? null,
        views: manual?.views ?? null,
        metricLabel: "Views",
        highestPerformingPost: manualTopPost(manual?.highestPerformingPost),
        status: "error",
      });
    }
  } else {
    const manual = overrides.socialMedia["instagram"];
    socialMedia.push({
      platform: "Instagram",
      followers: manual?.followers ?? null,
      views: manual?.views ?? null,
      metricLabel: "Views",
      highestPerformingPost: manualTopPost(manual?.highestPerformingPost),
      status: "manual",
    });
  }

  if (facebookConfigured) {
    try {
      const fb = await fetchFacebookStats();
      socialMedia.push({
        platform: "Facebook",
        followers: fb.followers,
        views: `${fb.engagementThisMonth.toLocaleString()} (${fb.likesThisMonth.toLocaleString()} likes · ${fb.commentsThisMonth.toLocaleString()} comments · ${fb.sharesThisMonth.toLocaleString()} shares, across ${fb.postCountThisMonth} ${fb.postCountThisMonth === 1 ? "post" : "posts"})`,
        metricLabel: "Engagement",
        highestPerformingPost: fb.topPost
          ? {
              text: fb.topPost.message || "(no caption)",
              permalink: fb.topPost.permalink,
              stats: `${fb.topPost.likes.toLocaleString()} likes · ${fb.topPost.comments.toLocaleString()} comments · ${fb.topPost.shares.toLocaleString()} shares`,
            }
          : null,
        status: "live",
      });
    } catch {
      const manual = overrides.socialMedia["facebook"];
      socialMedia.push({
        platform: "Facebook",
        followers: manual?.followers ?? null,
        views: manual?.views ?? null,
        metricLabel: "Engagement",
        highestPerformingPost: manualTopPost(manual?.highestPerformingPost),
        status: "error",
      });
    }
  } else {
    const manual = overrides.socialMedia["facebook"];
    socialMedia.push({
      platform: "Facebook",
      followers: manual?.followers ?? null,
      views: manual?.views ?? null,
      metricLabel: "Engagement",
      highestPerformingPost: manualTopPost(manual?.highestPerformingPost),
      status: "manual",
    });
  }

  return {
    month: monthLabel,
    daysComplete,
    daysAvailable,
    leadSources,
    totals: {
      ...totals,
      trackingForLeads: projectPace(totals.leadCount, daysComplete, daysAvailable),
      trackingForSold: projectPace(totals.sold, daysComplete, daysAvailable),
      ninetyDayAvg: null,
    },
    websiteTraffic,
    socialMedia,
    generatedAt: new Date().toISOString(),
  };
}
