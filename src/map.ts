import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ParsedRegion, RegionId } from './types.js';
import {
  REGION_LABELS,
  priceBandClass,
  formatPrice,
  formatMW,
} from './utils.js';
import { NEM_GEOJSON } from './geo.js';

const PRICE_BAND_FILLS: Record<string, string> = {
  'price-negative': '#7c3aed',
  'price-cheap': '#16a34a',
  'price-normal': '#0891b2',
  'price-high': '#ca8a04',
  'price-very-high': '#ea580c',
  'price-cap': '#dc2626',
};

const PRICE_BAND_BORDERS: Record<string, string> = {
  'price-negative': '#a78bfa',
  'price-cheap': '#4ade80',
  'price-normal': '#22d3ee',
  'price-high': '#fbbf24',
  'price-very-high': '#fb923c',
  'price-cap': '#ef4444',
};

let map: L.Map | null = null;
let geoLayer: L.GeoJSON | null = null;
let labelMarkers: L.Marker[] = [];

export function renderMap(container: HTMLElement, regions: ParsedRegion[]): void {
  if (regions.length === 0) return;

  const regionMap = new Map(regions.map((r) => [r.regionId, r]));

  // Initialize map on first call
  if (!map) {
    container.innerHTML = '<div id="nem-map" style="width:100%;height:100%;"></div>';
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

    // Fit to NEM states (east coast Australia)
    map.fitBounds([[-44, 133], [-10, 155]], { padding: [10, 10] });
  }

  // Remove old layers
  if (geoLayer) {
    map.removeLayer(geoLayer);
  }
  for (const m of labelMarkers) {
    map.removeLayer(m);
  }
  labelMarkers = [];

  // Add GeoJSON regions with price-based styling
  geoLayer = L.geoJSON(NEM_GEOJSON as GeoJSON.FeatureCollection, {
    style: (feature) => {
      const rid = feature?.properties?.id as RegionId;
      const region = regionMap.get(rid);
      const bandClass = region ? priceBandClass(region.price) : 'price-normal';
      return {
        fillColor: PRICE_BAND_FILLS[bandClass] ?? '#0891b2',
        fillOpacity: 0.6,
        color: PRICE_BAND_BORDERS[bandClass] ?? '#22d3ee',
        weight: 1.5,
      };
    },
    onEachFeature: (feature, layer) => {
      const rid = feature.properties?.id as RegionId;
      const region = regionMap.get(rid);
      if (!region) return;

      // Tooltip on hover
      layer.bindTooltip(
        `<strong>${REGION_LABELS[rid]}</strong><br>` +
        `Spot price: ${formatPrice(region.price)}/MWh<br>` +
        `Demand: ${formatMW(region.totalDemand)}<br>` +
        `Generation: ${formatMW(region.totalGen)}`,
        { sticky: true, className: 'map-tooltip' }
      );

      // Click to scroll to card
      layer.on('click', () => {
        const card = document.querySelector(`.region-card[data-region="${rid}"]`);
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    },
  }).addTo(map);

  // Add price labels at region centers
  const centroids: Record<RegionId, L.LatLngExpression> = {
    QLD1: [-22, 147],
    NSW1: [-32, 147],
    VIC1: [-37.2, 145],
    SA1: [-30, 137],
    TAS1: [-42, 146.5],
  };

  for (const [rid, latlng] of Object.entries(centroids) as Array<[RegionId, L.LatLngExpression]>) {
    const region = regionMap.get(rid);
    if (!region) continue;
    const bandClass = priceBandClass(region.price);
    const color = PRICE_BAND_BORDERS[bandClass] ?? '#22d3ee';

    const icon = L.divIcon({
      className: 'map-price-marker',
      html: `<div class="map-marker-inner" style="color:${color}">
        <span class="map-marker-name">${REGION_LABELS[rid]}</span>
        <span class="map-marker-price">${formatPrice(region.price)}</span>
      </div>`,
      iconSize: [80, 40],
      iconAnchor: [40, 20],
    });

    const marker = L.marker(latlng, { icon, interactive: false }).addTo(map);
    labelMarkers.push(marker);
  }
}
