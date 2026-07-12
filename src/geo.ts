// Real ABS state boundaries, fetched once from public/data/au-states.geojson
// and re-keyed to NEM region ids (NSW1, QLD1, SA1, TAS1, VIC1).
// WA, NT and the ACT are kept for context but flagged nem: false.
import type { RegionId } from './types.js';

// ABS state code → NEM region id. States absent here are not NEM regions.
const STATE_TO_REGION: Partial<Record<string, RegionId>> = {
  NSW: 'NSW1',
  QLD: 'QLD1',
  SA: 'SA1',
  TAS: 'TAS1',
  VIC: 'VIC1',
};

interface SourceProps {
  code: string;
  name: string;
}

let cached: GeoJSON.FeatureCollection | null = null;

export async function loadAuGeojson(): Promise<GeoJSON.FeatureCollection> {
  if (cached) return cached;
  const res = await fetch('data/au-states.geojson');
  if (!res.ok) throw new Error(`HTTP ${res.status} loading au-states.geojson`);
  const raw = (await res.json()) as GeoJSON.FeatureCollection;
  cached = {
    ...raw,
    features: raw.features.map((feature) => {
      const { code, name } = feature.properties as unknown as SourceProps;
      const regionId = STATE_TO_REGION[code];
      return {
        ...feature,
        properties: {
          id: regionId ?? code,
          name,
          nem: regionId !== undefined,
        },
      };
    }),
  };
  return cached;
}
