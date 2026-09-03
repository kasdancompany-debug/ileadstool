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
}

export interface WebsiteTraffic {
  sessions: number | null;
  uniqueVisitors: number | null;
  avgSessionDurationSec: number | null;
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
