import { describe, it, expect } from 'vitest';
import { appendHistory, mergeHistory } from '../src/history.js';
import type { HistoryPoint, ParsedRegion } from '../src/types.js';
import { parseRegion } from '../src/utils.js';
import type { NemRegion } from '../src/types.js';

const makeRegion = (regionId: NemRegion['REGIONID'], price: number): ParsedRegion => {
  return parseRegion({
    SETTLEMENTDATE: '2026-04-14T05:25:00',
    REGIONID: regionId,
    PRICE: price,
    PRICE_STATUS: 'FIRM',
    APCFLAG: 0,
    MARKETSUSPENDEDFLAG: 0,
    TOTALDEMAND: 1000,
    NETINTERCHANGE: 0,
    SCHEDULEDGENERATION: 800,
    SEMISCHEDULEDGENERATION: 200,
    INTERCONNECTORFLOWS: '[]',
  });
};

describe('appendHistory', () => {
  it('appends a new point to an empty history', () => {
    const regions = [makeRegion('NSW1', 100), makeRegion('VIC1', 90)];
    const result = appendHistory([], regions);
    expect(result).toHaveLength(1);
    expect(result[0].prices['NSW1']).toBe(100);
    expect(result[0].prices['VIC1']).toBe(90);
  });

  it('does not duplicate if last point is within 60 seconds', () => {
    const now = Date.now();
    const existing: HistoryPoint[] = [{ ts: now - 10_000, prices: { NSW1: 100 } }];
    const regions = [makeRegion('NSW1', 105)];
    const result = appendHistory(existing, regions);
    expect(result).toHaveLength(1);
  });

  it('appends if last point is older than 60 seconds', () => {
    const now = Date.now();
    const existing: HistoryPoint[] = [{ ts: now - 120_000, prices: { NSW1: 100 } }];
    const regions = [makeRegion('NSW1', 105)];
    const result = appendHistory(existing, regions);
    expect(result).toHaveLength(2);
    expect(result[1].prices['NSW1']).toBe(105);
  });

  it('caps history at 288 points', () => {
    const now = Date.now();
    const large: HistoryPoint[] = Array.from({ length: 288 }, (_, i) => ({
      ts: now - (290 - i) * 60_000,
      prices: { NSW1: 100 },
    }));
    const regions = [makeRegion('NSW1', 110)];
    const result = appendHistory(large, regions);
    expect(result.length).toBeLessThanOrEqual(288);
  });

  it('records all provided regions in the price snapshot', () => {
    const regions = [
      makeRegion('NSW1', 100),
      makeRegion('QLD1', 98),
      makeRegion('SA1', 138),
      makeRegion('TAS1', 88),
      makeRegion('VIC1', 92),
    ];
    const result = appendHistory([], regions);
    expect(result[0].prices['NSW1']).toBe(100);
    expect(result[0].prices['QLD1']).toBe(98);
    expect(result[0].prices['SA1']).toBe(138);
    expect(result[0].prices['TAS1']).toBe(88);
    expect(result[0].prices['VIC1']).toBe(92);
  });
});

describe('mergeHistory', () => {
  it('merges two arrays sorted by timestamp', () => {
    const now = Date.now();
    const a: HistoryPoint[] = [
      { ts: now - 300_000, prices: { NSW1: 100 } },
      { ts: now - 100_000, prices: { NSW1: 110 } },
    ];
    const b: HistoryPoint[] = [
      { ts: now - 200_000, prices: { NSW1: 105 } },
    ];
    const result = mergeHistory(a, b);
    expect(result).toHaveLength(3);
    expect(result[0].ts).toBeLessThan(result[1].ts);
    expect(result[1].ts).toBeLessThan(result[2].ts);
  });

  it('deduplicates points within 60 seconds', () => {
    const now = Date.now();
    const a: HistoryPoint[] = [{ ts: now - 100_000, prices: { NSW1: 100 } }];
    const b: HistoryPoint[] = [{ ts: now - 100_030, prices: { NSW1: 100 } }]; // 30ms later
    const result = mergeHistory(a, b);
    expect(result).toHaveLength(1);
  });

  it('prunes points older than 25 hours', () => {
    const now = Date.now();
    const old: HistoryPoint[] = [
      { ts: now - 26 * 60 * 60 * 1000, prices: { NSW1: 80 } }, // 26h ago
    ];
    const recent: HistoryPoint[] = [
      { ts: now - 60_000, prices: { NSW1: 100 } },
    ];
    const result = mergeHistory(old, recent);
    expect(result).toHaveLength(1);
    expect(result[0].prices['NSW1']).toBe(100);
  });

  it('returns empty array when both inputs are empty', () => {
    expect(mergeHistory([], [])).toEqual([]);
  });

  it('caps at 288 points', () => {
    const now = Date.now();
    const large: HistoryPoint[] = Array.from({ length: 300 }, (_, i) => ({
      ts: now - (300 - i) * 5 * 60_000,
      prices: { NSW1: 100 + i },
    }));
    const result = mergeHistory(large, []);
    expect(result.length).toBeLessThanOrEqual(288);
  });
});
