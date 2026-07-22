// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
import type { HistoryPoint, ParsedRegion, RegionId } from './types.js';

const STORAGE_KEY = 'nemwatch_history_v2';
const MAX_POINTS = 288; // 24h at 5-min intervals
const CUTOFF_MS = 25 * 60 * 60 * 1000; // 25 hours

/** Load history from pipeline data + localStorage, merged and deduplicated */
export async function loadHistory(): Promise<HistoryPoint[]> {
  let pipelineData: HistoryPoint[] = [];
  try {
    const res = await fetch('/data/history.json');
    if (res.ok) {
      const parsed = await res.json();
      if (Array.isArray(parsed)) pipelineData = parsed;
    }
  } catch {
    // Pipeline data unavailable — ok, fall back to localStorage only
  }

  let localData: HistoryPoint[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as HistoryPoint[];
      if (Array.isArray(parsed)) localData = parsed;
    }
  } catch {
    // localStorage unavailable
  }

  return mergeHistory(pipelineData, localData);
}

/** Merge two history arrays, deduplicate within 60s, prune to 24h */
export function mergeHistory(
  a: HistoryPoint[],
  b: HistoryPoint[]
): HistoryPoint[] {
  const merged = [...a, ...b];
  merged.sort((x, y) => x.ts - y.ts);

  const cutoff = Date.now() - CUTOFF_MS;
  const deduped: HistoryPoint[] = [];
  for (const point of merged) {
    if (point.ts < cutoff) continue;
    const last = deduped[deduped.length - 1];
    if (!last || Math.abs(last.ts - point.ts) >= 60_000) {
      deduped.push(point);
    }
  }
  return deduped.slice(-MAX_POINTS);
}

export function saveHistory(history: HistoryPoint[]): void {
  try {
    const cutoff = Date.now() - CUTOFF_MS;
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
