export type RegionId = 'NSW1' | 'QLD1' | 'SA1' | 'TAS1' | 'VIC1';

export interface InterconnectorFlow {
  name: string;
  value: number;
  exportlimit: number;
  importlimit: number;
}

export interface NemRegion {
  SETTLEMENTDATE: string;
  REGIONID: RegionId;
  PRICE: number;
  PRICE_STATUS: string;
  APCFLAG: number;
  MARKETSUSPENDEDFLAG: number;
  TOTALDEMAND: number;
  NETINTERCHANGE: number;
  SCHEDULEDGENERATION: number;
  SEMISCHEDULEDGENERATION: number;
  INTERCONNECTORFLOWS: string; // JSON-encoded string
}

export interface NemSummaryResponse {
  ELEC_NEM_SUMMARY: NemRegion[];
}

export interface ParsedRegion {
  regionId: RegionId;
  price: number;
  priceStatus: string;
  totalDemand: number;
  netInterchange: number;
  scheduledGen: number;
  semiScheduledGen: number;
  totalGen: number;
  semiScheduledPct: number;
  interconnectors: InterconnectorFlow[];
  settlementDate: Date;
  apcFlag: boolean;
  marketSuspended: boolean;
}

export interface HistoryPoint {
  ts: number; // epoch ms
  prices: Partial<Record<RegionId, number>>;
}

export interface AppState {
  regions: ParsedRegion[];
  lastUpdated: Date | null;
  loading: boolean;
  error: string | null;
  nextRefreshIn: number; // seconds
  history: HistoryPoint[];
}
