export type SourceStatus = "live" | "manual" | "error";

export interface LeadSourceRow {
  key: string;
  label: string;
  leadCount: number;
  appointments: number;
  sold: number;
  trackingForLeads: number | null;
  trackingForSold: number | null;
  ninetyDayAvg: number | null;
  status: SourceStatus;
  // True when `sold` is wildly out of line with `appointments` for this source —
  // a signal worth a manual check in BKD before trusting the number, not proof
  // it's wrong (sold counts close-date, appointments counts booked-date, so some
  // gap is normal — this only fires on gaps too large to be that).
  soldFlag: boolean;
}

export interface WebsiteTraffic {
  sessions: number | null;
  uniqueVisitors: number | null;
  conversionRate: number | null;
  status: SourceStatus;
}

export interface TopPost {
  text: string;
  permalink: string | null;
  stats: string;
}

export interface StatChip {
  label: string;
  value: string;
}

export interface SocialMediaRow {
  platform: string;
  followers: number | null;
  metricLabel: string;
  metricValue: string | null;
  breakdown: StatChip[];
  lastPostAt: string | null;
  highestPerformingPost: TopPost | null;
  status: SourceStatus;
}

export interface DashboardData {
  month: string;
  asOfDate: string;
  daysComplete: number;
  daysAvailable: number;
  leadSources: LeadSourceRow[];
  totals: {
    leadCount: number;
    appointments: number;
    sold: number;
    trackingForLeads: number | null;
    trackingForAppointments: number | null;
    trackingForSold: number | null;
    ninetyDayAvg: number | null;
  };
  websiteTraffic: WebsiteTraffic;
  socialMedia: SocialMediaRow[];
  generatedAt: string;
}
