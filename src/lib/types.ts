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
  conversionRate: number | null;
  status: SourceStatus;
}

export interface TopPost {
  text: string;
  permalink: string | null;
  stats: string;
}

export interface SocialMediaRow {
  platform: string;
  followers: number | null;
  views: string | null;
  metricLabel: string;
  highestPerformingPost: TopPost | null;
  status: SourceStatus;
}

export interface DashboardData {
  month: string;
  daysComplete: number;
  daysAvailable: number;
  leadSources: LeadSourceRow[];
  totals: {
    leadCount: number;
    appointments: number;
    sold: number;
    trackingForLeads: number | null;
    trackingForSold: number | null;
    ninetyDayAvg: number | null;
  };
  websiteTraffic: WebsiteTraffic;
  socialMedia: SocialMediaRow[];
  generatedAt: string;
}
