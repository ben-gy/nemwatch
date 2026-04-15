import type { AppState, ParsedRegion, RegionId } from './types.js';
import {
  REGION_LABELS,
  REGION_EMOJI,
  REGION_ORDER,
  priceBandClass,
  formatPrice,
  formatMW,
  formatPct,
  formatRelativeTime,
  formatTime,
  deduplicateInterconnectors,
  interconnectorLabel,
  calcNemTotals,
} from './utils.js';

export function renderHeader(
  el: HTMLElement,
  state: AppState
): void {
  const totals = calcNemTotals(state.regions);
  const timestamp = state.regions[0]?.settlementDate;
  const timeStr = timestamp ? formatTime(timestamp) + ' AEST' : '—';

  el.innerHTML = `
    <div class="header-brand">
      <span class="header-icon">⚡</span>
      <span class="header-title">NEM Watch</span>
      <span class="header-sub">Live Australian Electricity Market</span>
    </div>
    <div class="header-meta">
      ${state.regions.length > 0 ? `
        <span class="header-stat">
          <span class="stat-label">NEM avg</span>
          <span class="stat-value ${priceBandClass(totals.avgPrice)}">${formatPrice(totals.avgPrice)}/MWh</span>
        </span>
        <span class="header-stat">
          <span class="stat-label">Semi-sched</span>
          <span class="stat-value">${formatPct(totals.semiScheduledPct)}</span>
        </span>
        <span class="header-stat">
          <span class="stat-label">Updated</span>
          <span class="stat-value">${timeStr}</span>
        </span>
      ` : ''}
      <button class="about-btn" id="about-btn" title="About NEM Watch">?</button>
      <span class="refresh-badge ${state.loading ? 'loading' : ''}" title="Next refresh in ${state.nextRefreshIn}s">
        ${state.loading ? '<span class="spinner"></span>' : `<span class="countdown">${state.nextRefreshIn}s</span>`}
      </span>
    </div>
  `;
}

export function renderError(el: HTMLElement, error: string): void {
  el.innerHTML = `
    <div class="error-banner">
      <span class="error-icon">⚠</span>
      <span>${error}</span>
    </div>
  `;
}

export function clearError(el: HTMLElement): void {
  el.innerHTML = '';
}

function renderCard(region: ParsedRegion): string {
  const bandClass = priceBandClass(region.price);
  const genPct = region.totalGen > 0
    ? Math.min(100, (region.totalGen / region.totalDemand) * 100)
    : 0;

  const apcBadge = region.apcFlag
    ? '<span class="badge badge-warn" title="Administered Price Cap active">APC</span>'
    : '';
  const suspendedBadge = region.marketSuspended
    ? '<span class="badge badge-bad" title="Market suspended">SUSP</span>'
    : '';

  return `
    <div class="region-card" data-region="${region.regionId}">
      <div class="card-header">
        <span class="region-label">${REGION_EMOJI[region.regionId]} ${REGION_LABELS[region.regionId]}</span>
        <div class="card-badges">${apcBadge}${suspendedBadge}</div>
      </div>

      <div class="price-display ${bandClass}">
        <span class="price-value">${formatPrice(region.price)}</span>
        <span class="price-unit">/MWh <span class="glossary-link" data-term="spot-price">ℹ</span></span>
      </div>

      <div class="card-stats">
        <div class="stat-row">
          <span class="stat-label">Demand <span class="glossary-link" data-term="demand">ℹ</span></span>
          <span class="stat-val mono">${formatMW(region.totalDemand)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Generation <span class="glossary-link" data-term="generation">ℹ</span></span>
          <span class="stat-val mono">${formatMW(region.totalGen)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Semi-sched <span class="glossary-link" data-term="semi-scheduled">ℹ</span></span>
          <span class="stat-val mono">${formatPct(region.semiScheduledPct)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Net interchange <span class="glossary-link" data-term="net-interchange">ℹ</span></span>
          <span class="stat-val mono ${region.netInterchange > 0 ? 'text-good' : 'text-warn'}">${region.netInterchange > 0 ? '+' : ''}${formatMW(region.netInterchange)}</span>
        </div>
      </div>

      <div class="gen-bar-container" title="Generation vs demand">
        <div class="gen-bar-track">
          <div class="gen-bar-fill" style="width:${Math.min(100, genPct).toFixed(1)}%"></div>
        </div>
        <span class="gen-bar-label">${genPct.toFixed(0)}% gen/demand</span>
      </div>

      <div class="semi-bar-container" title="Semi-scheduled (wind + large solar) as % of generation">
        <div class="semi-bar-track">
          <div class="semi-bar-fill" style="width:${region.semiScheduledPct.toFixed(1)}%"></div>
        </div>
        <span class="semi-bar-label">semi-sched</span>
      </div>
    </div>
  `;
}

export function renderCards(el: HTMLElement, regions: ParsedRegion[]): void {
  if (regions.length === 0) {
    el.innerHTML = `<div class="loading-state"><span class="spinner-lg"></span><span>Loading NEM data…</span></div>`;
    return;
  }
  const ordered = REGION_ORDER.map((rid) => regions.find((r) => r.regionId === rid)).filter(Boolean) as ParsedRegion[];
  el.innerHTML = ordered.map(renderCard).join('');
}

export function renderInterconnectors(
  el: HTMLElement,
  regions: ParsedRegion[]
): void {
  const ics = deduplicateInterconnectors(regions);
  if (ics.length === 0) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = `
    <div class="panel-title">Interconnector Flows <span class="glossary-link" data-term="interconnector">ℹ</span></div>
    <div class="ic-grid">
      ${ics.map((ic) => {
        const isExport = ic.value > 0;
        const absMW = Math.abs(ic.value);
        const pct = ic.exportlimit > 0 ? Math.min(100, (absMW / ic.exportlimit) * 100) : 0;
        return `
          <div class="ic-row">
            <span class="ic-name">${interconnectorLabel(ic.name)}</span>
            <div class="ic-bar-track">
              <div class="ic-bar-fill ${isExport ? 'export' : 'import'}" style="width:${pct.toFixed(1)}%"></div>
            </div>
            <span class="ic-value mono ${isExport ? 'text-good' : 'text-muted'}">${isExport ? '→' : '←'} ${formatMW(absMW)}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

export function renderLastUpdated(el: HTMLElement, lastUpdated: Date | null): void {
  if (!lastUpdated) return;
  el.textContent = `Last fetched ${formatRelativeTime(lastUpdated)}`;
}

export function renderPriceLegend(el: HTMLElement): void {
  const bands = [
    { cls: 'price-negative', label: 'Negative' },
    { cls: 'price-cheap', label: '< $50' },
    { cls: 'price-normal', label: '$50–$150' },
    { cls: 'price-high', label: '$150–$500' },
    { cls: 'price-very-high', label: '$500–$3k' },
    { cls: 'price-cap', label: '> $3k' },
  ];
  el.innerHTML = `
    <div class="price-legend">
      ${bands.map((b) => `<span class="legend-item"><span class="legend-swatch ${b.cls}"></span>${b.label}</span>`).join('')}
    </div>
  `;
}

export function getActiveRegions(): Set<RegionId> {
  try {
    const raw = localStorage.getItem('nemwatch_active_regions');
    if (raw) {
      const parsed = JSON.parse(raw) as RegionId[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return new Set(parsed);
      }
    }
  } catch { /* ignore */ }
  return new Set(REGION_ORDER);
}

export function saveActiveRegions(regions: Set<RegionId>): void {
  try {
    localStorage.setItem('nemwatch_active_regions', JSON.stringify([...regions]));
  } catch { /* ignore */ }
}
