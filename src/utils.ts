import type { RegionId, NemRegion, ParsedRegion, InterconnectorFlow } from './types.js';

export const REGION_LABELS: Record<RegionId, string> = {
  NSW1: 'NSW',
  QLD1: 'QLD',
  SA1: 'SA',
  TAS1: 'TAS',
  VIC1: 'VIC',
};

export const REGION_EMOJI: Record<RegionId, string> = {
  NSW1: '🦘',
  QLD1: '🌞',
  SA1: '🍷',
  TAS1: '🍎',
  VIC1: '☕',
};

export const REGION_ORDER: RegionId[] = ['NSW1', 'QLD1', 'VIC1', 'SA1', 'TAS1'];

/** Price band thresholds ($/MWh) */
export const PRICE_BANDS = {
  CHEAP: 50,
  NORMAL: 150,
  HIGH: 500,
  VERY_HIGH: 3000,
  // Above VERY_HIGH = market cap / negative = negative prices
} as const;

/** Return a CSS class name for the price level */
export function priceBandClass(price: number): string {
  if (price < 0) return 'price-negative';
  if (price < PRICE_BANDS.CHEAP) return 'price-cheap';
  if (price < PRICE_BANDS.NORMAL) return 'price-normal';
  if (price < PRICE_BANDS.HIGH) return 'price-high';
  if (price < PRICE_BANDS.VERY_HIGH) return 'price-very-high';
  return 'price-cap';
}

/** Format a number as $/MWh */
export function formatPrice(price: number): string {
  if (price < 0) return `-$${Math.abs(price).toFixed(0)}`;
  if (price >= 10000) return `$${(price / 1000).toFixed(1)}k`;
  return `$${price.toFixed(0)}`;
}

/** Format MW with comma-separator */
export function formatMW(mw: number): string {
  return `${Math.round(mw).toLocaleString('en-AU')} MW`;
}

/** Format a percentage */
export function formatPct(pct: number): string {
  return `${pct.toFixed(1)}%`;
}

/** Format relative time e.g. "2 min ago" */
export function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ${diffMin % 60}m ago`;
}

/** Format a Date as HH:MM AEST */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Australia/Sydney',
    hour12: false,
  });
}

/** Format a Date as HH:MM */
export function formatTimeShort(date: Date): string {
  return date.toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Australia/Sydney',
  });
}

/** Parse interconnector flows from the JSON string in the API response */
export function parseInterconnectors(raw: string): InterconnectorFlow[] {
  try {
    return JSON.parse(raw) as InterconnectorFlow[];
  } catch {
    return [];
  }
}

/** Parse a raw NEM API region record into a typed ParsedRegion */
export function parseRegion(raw: NemRegion): ParsedRegion {
  const totalGen = raw.SCHEDULEDGENERATION + raw.SEMISCHEDULEDGENERATION;
  const semiScheduledPct =
    totalGen > 0 ? (raw.SEMISCHEDULEDGENERATION / totalGen) * 100 : 0;

  // SETTLEMENTDATE is in format "2026-04-14T05:25:00" — treat as AEST/AEDT (UTC+10/+11)
  // For display purposes we just parse it and display in AU tz
  const settlementDate = new Date(raw.SETTLEMENTDATE + '+10:00');

  return {
    regionId: raw.REGIONID,
    price: raw.PRICE,
    priceStatus: raw.PRICE_STATUS,
    totalDemand: raw.TOTALDEMAND,
    netInterchange: raw.NETINTERCHANGE,
    scheduledGen: raw.SCHEDULEDGENERATION,
    semiScheduledGen: raw.SEMISCHEDULEDGENERATION,
    totalGen,
    semiScheduledPct,
    interconnectors: parseInterconnectors(raw.INTERCONNECTORFLOWS),
    settlementDate,
    apcFlag: raw.APCFLAG !== 0,
    marketSuspended: raw.MARKETSUSPENDEDFLAG !== 0,
  };
}

/** Deduplicate interconnectors (each flow appears in two regions) */
export function deduplicateInterconnectors(
  regions: ParsedRegion[]
): InterconnectorFlow[] {
  const seen = new Set<string>();
  const result: InterconnectorFlow[] = [];
  for (const region of regions) {
    for (const ic of region.interconnectors) {
      if (!seen.has(ic.name)) {
        seen.add(ic.name);
        result.push(ic);
      }
    }
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

/** Friendly interconnector name */
export function interconnectorLabel(name: string): string {
  const labels: Record<string, string> = {
    'NSW1-QLD1': 'NSW → QLD',
    'VIC1-NSW1': 'VIC → NSW',
    'V-SA': 'VIC → SA',
    'T-V-MNSP1': 'TAS → VIC',
    'N-Q-MNSP1': 'Murraylink (NSW/QLD)',
    'V-S-MNSP1': 'Heywood 2 (VIC/SA)',
  };
  return labels[name] ?? name;
}

/** Calculate NEM-wide totals */
export function calcNemTotals(regions: ParsedRegion[]): {
  totalDemand: number;
  totalGen: number;
  totalSemiScheduled: number;
  semiScheduledPct: number;
  avgPrice: number;
} {
  if (regions.length === 0) {
    return { totalDemand: 0, totalGen: 0, totalSemiScheduled: 0, semiScheduledPct: 0, avgPrice: 0 };
  }
  const totalDemand = regions.reduce((s, r) => s + r.totalDemand, 0);
  const totalGen = regions.reduce((s, r) => s + r.totalGen, 0);
  const totalSemiScheduled = regions.reduce((s, r) => s + r.semiScheduledGen, 0);
  const semiScheduledPct = totalGen > 0 ? (totalSemiScheduled / totalGen) * 100 : 0;
  const avgPrice = regions.reduce((s, r) => s + r.price, 0) / regions.length;
  return { totalDemand, totalGen, totalSemiScheduled, semiScheduledPct, avgPrice };
}
