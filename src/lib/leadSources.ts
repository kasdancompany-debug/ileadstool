// Canonical list of lead sources, matching the "August 2026" Google Sheet tracker.
// `bkdChannel` is the exact "via <name>" label used in BKD.ai Settings > Lead Settings > Active Channels.
// Sources with no bkdChannel don't have a known live feed yet and stay manual-entry only.
export interface LeadSourceConfig {
  key: string;
  label: string;
  bkdChannel: string | null;
}

export const LEAD_SOURCES: LeadSourceConfig[] = [
  { key: "autotrader", label: "Autotrader", bkdChannel: "AutoTrader" },
  { key: "autocorp-trade", label: "Autocorp (Trade)", bkdChannel: "Autocorp Trade" },
  { key: "autocorp-credit", label: "Autocorp (Credit)", bkdChannel: "Autocorp (Credit)" },
  { key: "autocorp-drive", label: "Autocorp (Drive)", bkdChannel: "Autocorp (Drive)" },
  { key: "cargurus", label: "CarGurus", bkdChannel: "CarGurus" },
  { key: "drivingit", label: "DrivingIt", bkdChannel: "DrivingIT" },
  { key: "meta", label: "Meta", bkdChannel: "META" },
  { key: "website", label: "Website", bkdChannel: "Website" },
  { key: "podium", label: "Podium", bkdChannel: "Podium" },
  { key: "pureinfluencer", label: "PureInfluencer", bkdChannel: "PureInfluencer" },
  { key: "leadsbridge-oil", label: "LeadsBridge (9.99 Oil)", bkdChannel: "Leadsbridge ($9.99 Oil Change)" },
  { key: "demo-deals", label: "DEMO DEALS", bkdChannel: "Demo Deals" },
  { key: "vip-sale", label: "VIP SALE EVENT", bkdChannel: "VIP Private Sale" },
  { key: "payoff-qr", label: "Pay Off Loan - QR Code", bkdChannel: "Step 1 - Pay Off Car Loan" },
  { key: "payoff-step2", label: "Pay Off Loan - Step 2", bkdChannel: "Step 2 - Pay Off Car Loan" },
  { key: "payoff-step3", label: "Pay Off Loan - Step 3", bkdChannel: "Step 3 - Pay Off Car Loan" },
];
