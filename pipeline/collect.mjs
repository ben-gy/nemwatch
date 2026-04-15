/**
 * NEM Watch Data Pipeline — Price History Collector
 *
 * Fetches the current AEMO NEM Summary, extracts prices for all regions,
 * and appends a timestamped record to public/data/history.json.
 *
 * Runs via GitHub Actions every 15 minutes.
 * No npm dependencies — uses Node 20 built-in fetch.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HISTORY_PATH = join(__dirname, '..', 'public', 'data', 'history.json');
const AEMO_URL = 'https://visualisations.aemo.com.au/aemo/apps/api/report/ELEC_NEM_SUMMARY';
const MAX_POINTS = 288; // 24h at 5-min intervals (but collecting every 15min = ~96 points/day)
const CUTOFF_MS = 25 * 60 * 60 * 1000; // 25 hours

async function main() {
  // 1. Fetch current NEM data
  console.log('Fetching AEMO NEM Summary...');
  const res = await fetch(AEMO_URL);
  if (!res.ok) {
    throw new Error(`AEMO API returned ${res.status}: ${res.statusText}`);
  }
  const data = await res.json();
  const rows = data.ELEC_NEM_SUMMARY;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Unexpected AEMO response format');
  }

  // 2. Extract prices
  const prices = {};
  for (const row of rows) {
    prices[row.REGIONID] = row.PRICE;
  }
  const point = { ts: Date.now(), prices };
  console.log('Prices:', JSON.stringify(prices));

  // 3. Load existing history
  let history = [];
  try {
    const raw = await readFile(HISTORY_PATH, 'utf-8');
    history = JSON.parse(raw);
    if (!Array.isArray(history)) history = [];
  } catch {
    // File doesn't exist yet — start fresh
    console.log('No existing history file, creating new one.');
  }

  // 4. Deduplicate: skip if last point is within 60 seconds
  const last = history[history.length - 1];
  if (last && Math.abs(last.ts - point.ts) < 60_000) {
    console.log('Skipping — last point is too recent.');
    return;
  }

  // 5. Append + prune
  history.push(point);
  const cutoff = Date.now() - CUTOFF_MS;
  history = history.filter((p) => p.ts > cutoff).slice(-MAX_POINTS);

  // 6. Write back
  await mkdir(dirname(HISTORY_PATH), { recursive: true });
  await writeFile(HISTORY_PATH, JSON.stringify(history));
  console.log(`Wrote ${history.length} points to ${HISTORY_PATH}`);
}

main().catch((err) => {
  console.error('Pipeline failed:', err.message);
  process.exit(1);
});
