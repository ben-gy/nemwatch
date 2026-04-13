import { describe, it, expect } from 'vitest';
import {
  formatPrice,
  formatMW,
  formatPct,
  priceBandClass,
  parseInterconnectors,
  parseRegion,
  deduplicateInterconnectors,
  calcNemTotals,
} from '../src/utils.js';
import type { NemRegion } from '../src/types.js';

// ── formatPrice ──────────────────────────────────────────────────────────────

describe('formatPrice', () => {
  it('formats a normal positive price', () => {
    expect(formatPrice(99.9)).toBe('$100');
  });

  it('formats zero', () => {
    expect(formatPrice(0)).toBe('$0');
  });

  it('formats a negative price', () => {
    expect(formatPrice(-50)).toBe('-$50');
  });

  it('formats large price > 10000 in k notation', () => {
    expect(formatPrice(15000)).toBe('$15.0k');
  });

  it('formats price at exactly 10000 boundary', () => {
    expect(formatPrice(10000)).toBe('$10.0k');
  });

  it('formats a normal $150 price', () => {
    expect(formatPrice(150)).toBe('$150');
  });
});

// ── formatMW ─────────────────────────────────────────────────────────────────

describe('formatMW', () => {
  it('formats MW with AU locale commas', () => {
    expect(formatMW(6889.28)).toBe('6,889 MW');
  });

  it('formats zero MW', () => {
    expect(formatMW(0)).toBe('0 MW');
  });

  it('formats 1000 MW', () => {
    expect(formatMW(1000)).toBe('1,000 MW');
  });

  it('rounds fractional MW', () => {
    expect(formatMW(1234.7)).toBe('1,235 MW');
  });
});

// ── formatPct ────────────────────────────────────────────────────────────────

describe('formatPct', () => {
  it('formats 0%', () => {
    expect(formatPct(0)).toBe('0.0%');
  });

  it('formats 100%', () => {
    expect(formatPct(100)).toBe('100.0%');
  });

  it('formats decimal percentage', () => {
    expect(formatPct(13.456)).toBe('13.5%');
  });
});

// ── priceBandClass ────────────────────────────────────────────────────────────

describe('priceBandClass', () => {
  it('returns price-negative for negative prices', () => {
    expect(priceBandClass(-1)).toBe('price-negative');
  });

  it('returns price-cheap for price < 50', () => {
    expect(priceBandClass(49)).toBe('price-cheap');
  });

  it('returns price-normal for price between 50 and 150', () => {
    expect(priceBandClass(99)).toBe('price-normal');
  });

  it('returns price-high for price between 150 and 500', () => {
    expect(priceBandClass(300)).toBe('price-high');
  });

  it('returns price-very-high for price between 500 and 3000', () => {
    expect(priceBandClass(1000)).toBe('price-very-high');
  });

  it('returns price-cap for price >= 3000', () => {
    expect(priceBandClass(15000)).toBe('price-cap');
  });

  it('boundary: 50 is price-normal not price-cheap', () => {
    expect(priceBandClass(50)).toBe('price-normal');
  });

  it('boundary: 150 is price-high not price-normal', () => {
    expect(priceBandClass(150)).toBe('price-high');
  });
});

// ── parseInterconnectors ─────────────────────────────────────────────────────

describe('parseInterconnectors', () => {
  it('parses valid JSON string', () => {
    const raw = '[{"name":"NSW1-QLD1","value":-136.9,"exportlimit":411.5,"importlimit":-1078}]';
    const result = parseInterconnectors(raw);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('NSW1-QLD1');
    expect(result[0].value).toBeCloseTo(-136.9);
  });

  it('returns empty array for invalid JSON', () => {
    expect(parseInterconnectors('not-json')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseInterconnectors('')).toEqual([]);
  });

  it('parses multiple interconnectors', () => {
    const raw = '[{"name":"A","value":100,"exportlimit":200,"importlimit":-200},{"name":"B","value":-50,"exportlimit":100,"importlimit":-100}]';
    const result = parseInterconnectors(raw);
    expect(result).toHaveLength(2);
    expect(result[1].name).toBe('B');
  });
});

// ── parseRegion ───────────────────────────────────────────────────────────────

const makeRaw = (overrides: Partial<NemRegion> = {}): NemRegion => ({
  SETTLEMENTDATE: '2026-04-14T05:25:00',
  REGIONID: 'NSW1',
  PRICE: 99.9,
  PRICE_STATUS: 'FIRM',
  APCFLAG: 0,
  MARKETSUSPENDEDFLAG: 0,
  TOTALDEMAND: 6889.28,
  NETINTERCHANGE: -341.23,
  SCHEDULEDGENERATION: 5852.84,
  SEMISCHEDULEDGENERATION: 690.92,
  INTERCONNECTORFLOWS: '[{"name":"VIC1-NSW1","value":208.6,"exportlimit":572.6,"importlimit":-417.5}]',
  ...overrides,
});

describe('parseRegion', () => {
  it('parses regionId correctly', () => {
    const r = parseRegion(makeRaw());
    expect(r.regionId).toBe('NSW1');
  });

  it('calculates totalGen correctly', () => {
    const r = parseRegion(makeRaw());
    expect(r.totalGen).toBeCloseTo(5852.84 + 690.92);
  });

  it('calculates semiScheduledPct correctly', () => {
    const r = parseRegion(makeRaw());
    const expected = (690.92 / (5852.84 + 690.92)) * 100;
    expect(r.semiScheduledPct).toBeCloseTo(expected);
  });

  it('handles zero total generation (no divide by zero)', () => {
    const r = parseRegion(makeRaw({ SCHEDULEDGENERATION: 0, SEMISCHEDULEDGENERATION: 0 }));
    expect(r.semiScheduledPct).toBe(0);
    expect(r.totalGen).toBe(0);
  });

  it('sets apcFlag true when APCFLAG non-zero', () => {
    const r = parseRegion(makeRaw({ APCFLAG: 1 }));
    expect(r.apcFlag).toBe(true);
  });

  it('sets marketSuspended true when MARKETSUSPENDEDFLAG non-zero', () => {
    const r = parseRegion(makeRaw({ MARKETSUSPENDEDFLAG: 1 }));
    expect(r.marketSuspended).toBe(true);
  });

  it('parses interconnectors from JSON string', () => {
    const r = parseRegion(makeRaw());
    expect(r.interconnectors).toHaveLength(1);
    expect(r.interconnectors[0].name).toBe('VIC1-NSW1');
  });

  it('handles malformed interconnector JSON gracefully', () => {
    const r = parseRegion(makeRaw({ INTERCONNECTORFLOWS: 'bad' }));
    expect(r.interconnectors).toEqual([]);
  });
});

// ── deduplicateInterconnectors ───────────────────────────────────────────────

describe('deduplicateInterconnectors', () => {
  it('deduplicates interconnectors appearing in multiple regions', () => {
    const raw1 = makeRaw({ REGIONID: 'NSW1', INTERCONNECTORFLOWS: '[{"name":"VIC1-NSW1","value":200,"exportlimit":500,"importlimit":-400}]' });
    const raw2 = makeRaw({ REGIONID: 'VIC1', INTERCONNECTORFLOWS: '[{"name":"VIC1-NSW1","value":200,"exportlimit":500,"importlimit":-400}]' });
    const r1 = parseRegion(raw1);
    const r2 = parseRegion(raw2);
    const result = deduplicateInterconnectors([r1, r2]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('VIC1-NSW1');
  });

  it('returns empty array for regions with no interconnectors', () => {
    const r = parseRegion(makeRaw({ INTERCONNECTORFLOWS: '[]' }));
    expect(deduplicateInterconnectors([r])).toEqual([]);
  });
});

// ── calcNemTotals ─────────────────────────────────────────────────────────────

describe('calcNemTotals', () => {
  it('returns zeros for empty regions array', () => {
    const result = calcNemTotals([]);
    expect(result.totalDemand).toBe(0);
    expect(result.avgPrice).toBe(0);
    expect(result.semiScheduledPct).toBe(0);
  });

  it('calculates total demand correctly', () => {
    const r1 = parseRegion(makeRaw({ TOTALDEMAND: 1000 }));
    const r2 = parseRegion(makeRaw({ REGIONID: 'VIC1', TOTALDEMAND: 2000 }));
    expect(calcNemTotals([r1, r2]).totalDemand).toBeCloseTo(3000);
  });

  it('calculates avgPrice correctly', () => {
    const r1 = parseRegion(makeRaw({ PRICE: 100 }));
    const r2 = parseRegion(makeRaw({ REGIONID: 'VIC1', PRICE: 200 }));
    expect(calcNemTotals([r1, r2]).avgPrice).toBeCloseTo(150);
  });

  it('calculates semiScheduledPct correctly across regions', () => {
    const r1 = parseRegion(makeRaw({ SCHEDULEDGENERATION: 900, SEMISCHEDULEDGENERATION: 100 }));
    const r2 = parseRegion(makeRaw({ REGIONID: 'VIC1', SCHEDULEDGENERATION: 800, SEMISCHEDULEDGENERATION: 200 }));
    const totals = calcNemTotals([r1, r2]);
    // totalSemi = 300, totalGen = 2000, pct = 15%
    expect(totals.semiScheduledPct).toBeCloseTo(15);
  });
});
