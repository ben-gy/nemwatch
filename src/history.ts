import type { HistoryPoint, ParsedRegion, RegionId } from './types.js';

const STORAGE_KEY = 'nemwatch_history_v2';
const MAX_POINTS = 288; // 24h at 5-min intervals

export function loadHistory(): HistoryPoint[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryPoint[];
    if (!Array.isArray(parsed)) return [];
    // Prune points older than 25 hours
    const cutoff = Date.now() - 25 * 60 * 60 * 1000;
    return parsed.filter((p) => p.ts > cutoff);
  } catch {
    return [];
  }
}

export function saveHistory(history: HistoryPoint[]): void {
  try {
    // Keep only recent points
    const cutoff = Date.now() - 25 * 60 * 60 * 1000;
    const pruned = history.filter((p) => p.ts > cutoff).slice(-MAX_POINTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
  } catch {
    // localStorage unavailable — ignore
  }
}

export function appendHistory(
  history: HistoryPoint[],
  regions: ParsedRegion[]
): HistoryPoint[] {
  const prices: Partial<Record<RegionId, number>> = {};
  for (const r of regions) {
    prices[r.regionId] = r.price;
  }
  const point: HistoryPoint = { ts: Date.now(), prices };

  // Deduplicate: don't add if the last point is within 60 seconds
  const last = history[history.length - 1];
  if (last && Math.abs(last.ts - point.ts) < 60_000) {
    return history;
  }

  return [...history, point].slice(-MAX_POINTS);
}
