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
import { loadAuGeojson } from './geo.js';

// ── Colour mapping ──────────────────────────────────────────────────────────

// Subtle muted fills — states are background, labels carry emphasis
const PRICE_BAND_FILLS: Record<string, string> = {
  'price-negative': '#1e163d',
  'price-cheap': '#0c2218',
  'price-normal': '#0a1e28',
  'price-high': '#221c0c',
  'price-very-high': '#22140a',
  'price-cap': '#220a0a',
};

const PRICE_BAND_BORDERS: Record<string, string> = {
  'price-negative': '#4a3d8a',
  'price-cheap': '#1d5a35',
  'price-normal': '#15455a',
  'price-high': '#6a5820',
  'price-very-high': '#6a3515',
  'price-cap': '#6a1818',
};

// Bright label colours
const PRICE_BAND_LABEL_COLORS: Record<string, string> = {
  'price-negative': '#a78bfa',
  'price-cheap': '#4ade80',
  'price-normal': '#22d3ee',
  'price-high': '#fbbf24',
  'price-very-high': '#fb923c',
  'price-cap': '#ef4444',
};

const NON_NEM_FILL = '#0a0f18';
const NON_NEM_BORDER = '#182030';

// ── Flow line colour — GREEN to contrast blue states ────────────────────────
const FLOW_COLOR = '#22c55e';
const FLOW_GLOW = '#16a34a';

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
    toCoord: [-35, 139.5],
    matchNames: ['V-SA', 'V-S-MNSP1'],
  },
  {
    id: 'vic-tas',
    label: 'VIC ↔ TAS (Basslink)',
    from: 'VIC1',
    to: 'TAS1',
    fromCoord: [-38.8, 146.5],
    toCoord: [-41, 146.5],
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

// Real state boundaries load once from public data; re-render when ready
let auGeo: GeoJSON.FeatureCollection | null = null;
let geoRequested = false;
let pendingContainer: HTMLElement | null = null;
let pendingRegions: ParsedRegion[] | null = null;

export function renderMap(container: HTMLElement, regions: ParsedRegion[]): void {
  if (regions.length === 0) return;

  if (!auGeo) {
    pendingContainer = container;
    pendingRegions = regions;
    if (!geoRequested) {
      geoRequested = true;
      loadAuGeojson()
        .then((geo) => {
          auGeo = geo;
          if (pendingContainer && pendingRegions) {
            renderMap(pendingContainer, pendingRegions);
          }
        })
        .catch((err) => {
          console.error('Failed to load map boundaries:', err);
          geoRequested = false; // allow retry on the next render
        });
    }
    return;
  }

  const regionMap = new Map(regions.map((r) => [r.regionId, r]));

  // ── Initialise map once ─────────────────────────────────────────────────
  if (!map) {
    container.innerHTML = '<div id="nem-map"></div>';
    const mapEl = container.querySelector('#nem-map') as HTMLElement;

    map = L.map(mapEl, {
      zoomControl: true,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
      touchZoom: true,
      minZoom: 3,
      maxZoom: 8,
    });

    // Fit to Australia
    map.fitBounds([[-44, 112], [-10, 155]], { padding: [10, 10] });
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
  geoLayer = L.geoJSON(auGeo, {
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
        fillColor: PRICE_BAND_FILLS[bandClass] ?? '#0a1e28',
        fillOpacity: 0.8,
        color: PRICE_BAND_BORDERS[bandClass] ?? '#15455a',
        weight: 1.5,
      };
    },
    onEachFeature: (feature, layer) => {
      const rid = feature.properties?.id as string;
      const isNem = feature.properties?.nem === true;

      if (!isNem) {
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

      // Hover — brighten
      layer.on('mouseover', () => {
        (layer as L.Path).setStyle({ fillOpacity: 0.95, weight: 2.5 });
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

  // ── Interconnector flow lines (GREEN) ──────────────────────────────────
  for (const ic of INTERCONNECTORS) {
    let flowDirection = 0;
    for (const region of regions) {
      for (const flow of region.interconnectors) {
        if (ic.matchNames.includes(flow.name)) {
          flowDirection = flow.value;
          break;
        }
      }
      if (flowDirection !== 0) break;
    }

    const absMW = Math.abs(flowDirection);
    if (absMW < 1) continue;

    const coords: L.LatLngExpression[] =
      flowDirection > 0 ? [ic.fromCoord, ic.toCoord] : [ic.toCoord, ic.fromCoord];

    const lineWeight = Math.min(5, 2 + absMW / 150);

    // Glow layer
    const glow = L.polyline(coords, {
      color: FLOW_GLOW,
      weight: lineWeight + 6,
      opacity: 0.2,
      lineCap: 'round',
    }).addTo(map);
    flowLines.push(glow);

    // Main animated dashed line — GREEN
    const line = L.polyline(coords, {
      color: FLOW_COLOR,
      weight: lineWeight,
      dashArray: '12 8',
      opacity: 0.85,
      lineCap: 'round',
      className: 'flow-animated',
    }).addTo(map);
    flowLines.push(line);

    // MW label
    const lat1 = (coords[0] as number[])[0];
    const lng1 = (coords[0] as number[])[1];
    const lat2 = (coords[1] as number[])[0];
    const lng2 = (coords[1] as number[])[1];
    const midLat = (lat1 + lat2) / 2;
    const midLng = (lng1 + lng2) / 2;
    const dx = lng2 - lng1;
    const dy = lat2 - lat1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const offsetLat = midLat + (dx / len) * 0.8;
    const offsetLng = midLng - (dy / len) * 0.8;

    const arrow = flowDirection > 0 ? '→' : '←';
    const labelIcon = L.divIcon({
      className: 'map-flow-label',
      html: `<span>${arrow} ${formatMW(absMW)}</span>`,
      iconSize: [100, 24],
      iconAnchor: [50, 12],
    });
    flowLabels.push(
      L.marker([offsetLat, offsetLng], { icon: labelIcon, interactive: false }).addTo(map)
    );

    // Tooltip
    line.bindTooltip(
      `<strong>${ic.label}</strong><br>${formatMW(absMW)} ${flowDirection > 0 ? '→' : '←'}`,
      { sticky: true, className: 'map-tooltip' }
    );
  }
}
