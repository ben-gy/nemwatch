import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ParsedRegion, RegionId } from './types.js';
import {
  REGION_LABELS,
  REGION_ORDER,
  priceBandClass,
  formatPrice,
  formatMW,
  formatPct,
} from './utils.js';
import { AU_GEOJSON } from './geo.js';

// ── Colour mapping ──────────────────────────────────────────────────────────

// Subtle, muted fills — let the price labels carry the colour intensity
const PRICE_BAND_FILLS: Record<string, string> = {
  'price-negative': '#2e1f5e',
  'price-cheap': '#0f3022',
  'price-normal': '#0c2a35',
  'price-high': '#2e2510',
  'price-very-high': '#2e1a0c',
  'price-cap': '#2e0c0c',
};

// Borders slightly brighter than fills, but still muted
const PRICE_BAND_BORDERS: Record<string, string> = {
  'price-negative': '#6d5cae',
  'price-cheap': '#2d7a4a',
  'price-normal': '#1a6070',
  'price-high': '#8a7530',
  'price-very-high': '#8a4a1a',
  'price-cap': '#8a2020',
};

// Label colours — these are bright and carry the visual emphasis
const PRICE_BAND_LABEL_COLORS: Record<string, string> = {
  'price-negative': '#a78bfa',
  'price-cheap': '#4ade80',
  'price-normal': '#22d3ee',
  'price-high': '#fbbf24',
  'price-very-high': '#fb923c',
  'price-cap': '#ef4444',
};

const NON_NEM_FILL = '#0e1520';
const NON_NEM_BORDER = '#1c2840';

// ── Interconnector definitions ──────────────────────────────────────────────

interface InterconnectorDef {
  id: string;
  label: string;
  from: RegionId;
  to: RegionId;
  fromCoord: L.LatLngExpression;
  toCoord: L.LatLngExpression;
  matchNames: string[];
}

const INTERCONNECTORS: InterconnectorDef[] = [
  {
    id: 'nsw-qld',
    label: 'NSW ↔ QLD',
    from: 'NSW1',
    to: 'QLD1',
    fromCoord: [-30.5, 151],
    toCoord: [-27, 151.5],
    matchNames: ['NSW1-QLD1', 'N-Q-MNSP1'],
  },
  {
    id: 'vic-nsw',
    label: 'VIC ↔ NSW',
    from: 'VIC1',
    to: 'NSW1',
    fromCoord: [-36.8, 146.5],
    toCoord: [-34.5, 148],
    matchNames: ['VIC1-NSW1'],
  },
  {
    id: 'vic-sa',
    label: 'VIC ↔ SA',
    from: 'VIC1',
    to: 'SA1',
    fromCoord: [-37, 142],
    toCoord: [-35, 140],
    matchNames: ['V-SA', 'V-S-MNSP1'],
  },
  {
    id: 'vic-tas',
    label: 'VIC ↔ TAS',
    from: 'VIC1',
    to: 'TAS1',
    fromCoord: [-38.8, 146],
    toCoord: [-41, 146],
    matchNames: ['T-V-MNSP1'],
  },
];

// ── Label positions ─────────────────────────────────────────────────────────

const REGION_CENTERS: Record<RegionId, L.LatLngExpression> = {
  QLD1: [-23, 147],
  NSW1: [-32.5, 147.5],
  VIC1: [-37, 145],
  SA1: [-30, 136.5],
  TAS1: [-42, 146.5],
};

// ── State ───────────────────────────────────────────────────────────────────

let map: L.Map | null = null;
let geoLayer: L.GeoJSON | null = null;
let labelMarkers: L.Marker[] = [];
let flowLines: L.Polyline[] = [];
let flowLabels: L.Marker[] = [];

export function renderMap(container: HTMLElement, regions: ParsedRegion[]): void {
  if (regions.length === 0) return;

  const regionMap = new Map(regions.map((r) => [r.regionId, r]));

  // ── Initialise map once ─────────────────────────────────────────────────
  if (!map) {
    container.innerHTML = '<div id="nem-map"></div>';
    const mapEl = container.querySelector('#nem-map') as HTMLElement;

    map = L.map(mapEl, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
    });

    // Fit to full Australia — generous bounds to show WA/NT properly
    map.fitBounds([[-45, 110], [-9, 156]], { padding: [10, 10] });
  }

  // ── Clear old layers ────────────────────────────────────────────────────
  if (geoLayer) map.removeLayer(geoLayer);
  for (const m of labelMarkers) map.removeLayer(m);
  for (const l of flowLines) map.removeLayer(l);
  for (const l of flowLabels) map.removeLayer(l);
  labelMarkers = [];
  flowLines = [];
  flowLabels = [];

  // ── Render all states ───────────────────────────────────────────────────
  geoLayer = L.geoJSON(AU_GEOJSON as unknown as GeoJSON.FeatureCollection, {
    style: (feature) => {
      const rid = feature?.properties?.id as string;
      const isNem = feature?.properties?.nem === true;

      if (!isNem) {
        return {
          fillColor: NON_NEM_FILL,
          fillOpacity: 0.8,
          color: NON_NEM_BORDER,
          weight: 0.8,
        };
      }

      const region = regionMap.get(rid as RegionId);
      const bandClass = region ? priceBandClass(region.price) : 'price-normal';
      return {
        fillColor: PRICE_BAND_FILLS[bandClass] ?? '#0891b2',
        fillOpacity: 0.75,
        color: PRICE_BAND_BORDERS[bandClass] ?? '#22d3ee',
        weight: 1.5,
      };
    },
    onEachFeature: (feature, layer) => {
      const rid = feature.properties?.id as string;
      const isNem = feature.properties?.nem === true;

      if (!isNem) {
        // Non-NEM: dim tooltip
        layer.bindTooltip(
          `<strong>${feature.properties?.name}</strong><br><em>Not in the NEM</em>`,
          { sticky: true, className: 'map-tooltip map-tooltip-dim' }
        );
        return;
      }

      const region = regionMap.get(rid as RegionId);
      if (!region) return;

      const bandClass = priceBandClass(region.price);
      const labelColor = PRICE_BAND_LABEL_COLORS[bandClass] ?? '#22d3ee';

      // Rich tooltip on hover
      layer.bindTooltip(
        `<div class="map-tip-header" style="border-color:${labelColor}">
          <span class="map-tip-name">${REGION_LABELS[rid as RegionId]}</span>
          <span class="map-tip-price" style="color:${labelColor}">${formatPrice(region.price)}/MWh</span>
        </div>
        <div class="map-tip-stats">
          <div class="map-tip-row"><span>Demand</span><span>${formatMW(region.totalDemand)}</span></div>
          <div class="map-tip-row"><span>Generation</span><span>${formatMW(region.totalGen)}</span></div>
          <div class="map-tip-row"><span>Renewables</span><span>${formatPct(region.semiScheduledPct)}</span></div>
          <div class="map-tip-row"><span>Net interchange</span><span>${region.netInterchange > 0 ? '+' : ''}${formatMW(region.netInterchange)}</span></div>
        </div>`,
        { sticky: true, className: 'map-tooltip' }
      );

      // Hover highlight — brighten the fill
      layer.on('mouseover', () => {
        (layer as L.Path).setStyle({ fillOpacity: 0.7, weight: 2 });
      });
      layer.on('mouseout', () => {
        geoLayer?.resetStyle(layer);
      });

      // Click to scroll to card
      layer.on('click', () => {
        const card = document.querySelector(`.region-card[data-region="${rid}"]`);
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    },
  }).addTo(map);

  // ── Price labels on NEM regions ─────────────────────────────────────────
  for (const rid of REGION_ORDER) {
    const region = regionMap.get(rid);
    if (!region) continue;
    const center = REGION_CENTERS[rid];
    const bandClass = priceBandClass(region.price);
    const color = PRICE_BAND_LABEL_COLORS[bandClass] ?? '#22d3ee';

    const icon = L.divIcon({
      className: 'map-price-marker',
      html: `<div class="map-marker-inner">
        <span class="map-marker-name">${REGION_LABELS[rid]}</span>
        <span class="map-marker-price" style="color:${color}">${formatPrice(region.price)}</span>
      </div>`,
      iconSize: [90, 44],
      iconAnchor: [45, 22],
    });

    labelMarkers.push(L.marker(center, { icon, interactive: false }).addTo(map));
  }

  // ── Interconnector flow lines ───────────────────────────────────────────
  for (const ic of INTERCONNECTORS) {
    // Find total flow for this interconnector group
    let totalFlow = 0;
    let flowDirection = 0; // positive = from→to
    for (const region of regions) {
      for (const flow of region.interconnectors) {
        if (ic.matchNames.includes(flow.name)) {
          totalFlow += Math.abs(flow.value);
          flowDirection = flow.value;
          break;
        }
      }
    }

    // Deduplicate — only count once
    const absMW = Math.abs(flowDirection);
    if (absMW < 1) continue;

    // Determine direction for the arrow
    const coords: L.LatLngExpression[] =
      flowDirection > 0 ? [ic.fromCoord, ic.toCoord] : [ic.toCoord, ic.fromCoord];

    const lineWeight = Math.min(5, 2 + absMW / 200);

    // Glow layer (wider, semi-transparent underneath)
    const glow = L.polyline(coords, {
      color: '#22d3ee',
      weight: lineWeight + 4,
      opacity: 0.15,
      lineCap: 'round',
    }).addTo(map);
    flowLines.push(glow);

    // Main animated dashed line
    const line = L.polyline(coords, {
      color: '#22d3ee',
      weight: lineWeight,
      dashArray: '10 8',
      opacity: 0.8,
      lineCap: 'round',
      className: 'flow-animated',
    }).addTo(map);
    flowLines.push(line);

    // MW label at midpoint — offset perpendicular to the line
    const lat1 = (coords[0] as number[])[0];
    const lng1 = (coords[0] as number[])[1];
    const lat2 = (coords[1] as number[])[0];
    const lng2 = (coords[1] as number[])[1];
    const midLat = (lat1 + lat2) / 2;
    const midLng = (lng1 + lng2) / 2;
    // Offset perpendicular
    const dx = lng2 - lng1;
    const dy = lat2 - lat1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const offsetLat = midLat + (dx / len) * 0.8;
    const offsetLng = midLng - (dy / len) * 0.8;

    const arrow = flowDirection > 0 ? '→' : '←';
    const labelIcon = L.divIcon({
      className: 'map-flow-label',
      html: `<span>${arrow} ${formatMW(absMW)}</span>`,
      iconSize: [90, 22],
      iconAnchor: [45, 11],
    });
    flowLabels.push(L.marker([offsetLat, offsetLng], { icon: labelIcon, interactive: false }).addTo(map));

    // Tooltip on the line
    line.bindTooltip(
      `<strong>${ic.label}</strong><br>${formatMW(absMW)} ${flowDirection > 0 ? '→' : '←'}`,
      { sticky: true, className: 'map-tooltip' }
    );
  }
}
