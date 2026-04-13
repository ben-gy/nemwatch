import type { NemSummaryResponse, ParsedRegion } from './types.js';
import { parseRegion, REGION_ORDER } from './utils.js';

const AEMO_URL =
  'https://visualisations.aemo.com.au/aemo/apps/api/report/ELEC_NEM_SUMMARY';

export async function fetchNemSummary(signal?: AbortSignal): Promise<ParsedRegion[]> {
  const res = await fetch(AEMO_URL, { signal });
  if (!res.ok) {
    throw new Error(`AEMO API error: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as NemSummaryResponse;
  const rows = data.ELEC_NEM_SUMMARY;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Unexpected AEMO response format');
  }
  const parsed = rows.map(parseRegion);
  // Sort by canonical region order
  return parsed.sort(
    (a, b) => REGION_ORDER.indexOf(a.regionId) - REGION_ORDER.indexOf(b.regionId)
  );
}
