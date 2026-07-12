import type { AppState, RegionId } from './types.js';
import { fetchNemSummary } from './api.js';
import { loadHistory, saveHistory, appendHistory } from './history.js';
import {
  renderHeader,
  renderCards,
  renderInterconnectors,
  renderError,
  clearError,
  renderLastUpdated,
  renderPriceLegend,
  getActiveRegions,
  saveActiveRegions,
} from './ui.js';
import { renderChart, renderLegend } from './chart.js';
import { renderMap } from './map.js';
import { lookupTerm } from './glossary.js';
import { initTooltip } from './tooltip.js';
import './style.css';

const REFRESH_INTERVAL = 5 * 60; // 5 minutes in seconds

const state: AppState = {
  regions: [],
  lastUpdated: null,
  loading: false,
  error: null,
  nextRefreshIn: REFRESH_INTERVAL,
  history: [],
};

let activeRegions = getActiveRegions();
let abortController: AbortController | null = null;
let countdownTimer: ReturnType<typeof setInterval> | null = null;

// DOM refs — set after mount
let headerEl!: HTMLElement;
let errorEl!: HTMLElement;
let mapEl!: HTMLElement;
let cardsEl!: HTMLElement;
let interconnectorsEl!: HTMLElement;
let chartContainerEl!: HTMLElement;
let chartLegendEl!: HTMLElement;
let lastUpdatedEl!: HTMLElement;
let priceLegendEl!: HTMLElement;

async function fetchData(): Promise<void> {
  if (abortController) abortController.abort();
  abortController = new AbortController();

  state.loading = true;
  state.error = null;
  render();

  try {
    const regions = await fetchNemSummary(abortController.signal);
    state.regions = regions;
    state.lastUpdated = new Date();
    state.history = appendHistory(state.history, regions);
    saveHistory(state.history);
    state.error = null;
    resetCountdown();
  } catch (err) {
    if ((err as Error).name === 'AbortError') return;
    state.error = `Failed to load data from AEMO: ${(err as Error).message}. Retrying in ${REFRESH_INTERVAL}s.`;
  } finally {
    state.loading = false;
    render();
  }
}

function resetCountdown(): void {
  state.nextRefreshIn = REFRESH_INTERVAL;
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    state.nextRefreshIn = Math.max(0, state.nextRefreshIn - 1);
    updateCountdownDisplay();
    if (state.nextRefreshIn === 0) {
      void fetchData();
    }
  }, 1000);
}

function updateCountdownDisplay(): void {
  const badge = headerEl.querySelector('.refresh-badge');
  const countdown = headerEl.querySelector('.countdown');
  if (countdown) {
    countdown.textContent = `${state.nextRefreshIn}s`;
  }
  if (badge && !state.loading) {
    badge.setAttribute('title', `Next refresh in ${state.nextRefreshIn}s`);
  }
  renderLastUpdated(lastUpdatedEl, state.lastUpdated);
}

function render(): void {
  renderHeader(headerEl, state);
  if (state.error) {
    renderError(errorEl, state.error);
  } else {
    clearError(errorEl);
  }
  renderCards(cardsEl, state.regions);
  renderMap(mapEl, state.regions);
  renderInterconnectors(interconnectorsEl, state.regions);
  renderChart(chartContainerEl, state.history, activeRegions);
  renderLegend(chartLegendEl, activeRegions, onToggleRegion);
  renderLastUpdated(lastUpdatedEl, state.lastUpdated);
}

function onToggleRegion(rid: RegionId): void {
  if (activeRegions.has(rid)) {
    if (activeRegions.size > 1) activeRegions.delete(rid);
  } else {
    activeRegions.add(rid);
  }
  saveActiveRegions(activeRegions);
  renderChart(chartContainerEl, state.history, activeRegions);
  renderLegend(chartLegendEl, activeRegions, onToggleRegion);
}

function mount(): void {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <header class="site-header" id="site-header"></header>
    <div class="error-zone" id="error-zone"></div>
    <main class="main-content">
      <section class="map-section" id="map-section"></section>
      <section class="cards-section" id="cards-section"></section>
      <section class="ic-section panel" id="ic-section"></section>
      <section class="chart-section panel">
        <div class="panel-title">
          24-Hour Price History <span class="glossary-link" data-term="price-bands">ℹ</span>
        </div>
        <div class="chart-legend" id="chart-legend"></div>
        <div class="chart-container" id="chart-container"></div>
      </section>
    </main>
    <footer class="site-footer">
      <div id="price-legend"></div>
      <div class="footer-meta">
        <span id="last-updated" class="footer-updated"></span>
        <span class="footer-source">
          Data: <a href="https://www.aemo.com.au/" target="_blank" rel="noopener">AEMO</a> ·
          Built by <a href="https://benrichardson.dev/" target="_blank" rel="noopener">benrichardson.dev</a> · <a href="https://sites.benrichardson.dev" target="_blank" rel="noopener">more tools &amp; sites</a>
        </span>
      </div>
    </footer>
    <div class="tooltip" id="tooltip" hidden></div>
    <div class="modal-backdrop" id="about-modal" hidden>
      <div class="modal-panel">
        <button class="modal-close" id="modal-close">&times;</button>
        <h2 class="modal-title">About NEM Watch</h2>
        <div class="modal-body">
          <p>NEM Watch shows live wholesale electricity prices across Australia's <strong>National Electricity Market (NEM)</strong> — the interconnected power grid covering Queensland, New South Wales, Victoria, South Australia, and Tasmania.</p>
          <h3>What am I looking at?</h3>
          <p>Every 5 minutes, the Australian Energy Market Operator (AEMO) runs a dispatch process where generators bid to supply electricity. The <strong>spot price</strong> shown for each region is the cost of the most expensive generator needed to meet demand in that interval. Prices vary between regions because of differences in local supply, demand, and the capacity of interconnectors linking states.</p>
          <h3>What does the colour mean?</h3>
          <ul>
            <li><span class="legend-swatch price-negative"></span> <strong>Purple — Negative prices:</strong> Generators are paying to stay online (often when renewables flood the grid overnight)</li>
            <li><span class="legend-swatch price-cheap"></span> <strong>Green — Under $50/MWh:</strong> Cheap power, often during sunny/windy periods</li>
            <li><span class="legend-swatch price-normal"></span> <strong>Cyan — $50–$150/MWh:</strong> Normal range for the NEM</li>
            <li><span class="legend-swatch price-high"></span> <strong>Yellow — $150–$500/MWh:</strong> Elevated, often during peak demand</li>
            <li><span class="legend-swatch price-very-high"></span> <strong>Orange — $500–$3,000/MWh:</strong> High — supply is tight</li>
            <li><span class="legend-swatch price-cap"></span> <strong>Red — Over $3,000/MWh:</strong> Approaching the market price cap ($17,500/MWh)</li>
          </ul>
          <h3>What is "semi-scheduled generation"?</h3>
          <p>This is generation from large wind farms and utility-scale solar farms registered with AEMO. It's a useful proxy for how much of the grid is currently powered by variable renewables. It does <em>not</em> include rooftop solar panels.</p>
          <h3>Data source</h3>
          <p>All data comes from the <a href="https://www.aemo.com.au/" target="_blank" rel="noopener">AEMO NEM Summary API</a>, a public endpoint that updates every 5 minutes. No API key is required. Price history is collected automatically and stored as pre-built data.</p>
          <h3>Is this the price I pay on my bill?</h3>
          <p>No. The spot price is the <em>wholesale</em> price. Your retail electricity bill includes network charges, environmental certificates, retailer margins, and GST on top. But when spot prices spike, it puts upward pressure on retail prices — and if you're on a wholesale pass-through plan, the spot price directly affects your bill.</p>
        </div>
      </div>
    </div>
  `;

  headerEl = document.getElementById('site-header')!;
  errorEl = document.getElementById('error-zone')!;
  mapEl = document.getElementById('map-section')!;
  cardsEl = document.getElementById('cards-section')!;
  interconnectorsEl = document.getElementById('ic-section')!;
  chartContainerEl = document.getElementById('chart-container')!;
  chartLegendEl = document.getElementById('chart-legend')!;
  lastUpdatedEl = document.getElementById('last-updated')!;
  priceLegendEl = document.getElementById('price-legend')!;

  renderPriceLegend(priceLegendEl);
  initTooltip();

  // Initial render (shows loading state)
  render();

  // Load pipeline history, then fetch live data
  loadHistory().then((history) => {
    state.history = history;
    render();
  });
  void fetchData();

  // Glossary tooltip handler
  const tooltip = document.getElementById('tooltip')!;
  document.addEventListener('click', (e) => {
    const link = (e.target as HTMLElement).closest('.glossary-link');
    if (link) {
      e.preventDefault();
      e.stopPropagation();
      const entry = lookupTerm((link as HTMLElement).dataset.term!);
      if (!entry) return;
      tooltip.innerHTML = `<span class="tooltip-term">${entry.term}${entry.abbr ? ` (${entry.abbr})` : ''}</span>${entry.definition}`;
      const rect = link.getBoundingClientRect();
      tooltip.hidden = false;
      tooltip.style.left = Math.min(rect.left, window.innerWidth - 320) + 'px';
      tooltip.style.top = (rect.bottom + 8) + 'px';
    } else if (!(e.target as HTMLElement).closest('.tooltip')) {
      tooltip.hidden = true;
    }
  });

  // About modal handler
  const aboutModal = document.getElementById('about-modal')!;
  const modalClose = document.getElementById('modal-close')!;
  document.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('#about-btn')) {
      aboutModal.hidden = false;
    }
  });
  modalClose.addEventListener('click', () => { aboutModal.hidden = true; });
  aboutModal.addEventListener('click', (e) => {
    if (e.target === aboutModal) aboutModal.hidden = true;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      aboutModal.hidden = true;
      tooltip.hidden = true;
    }
  });

  // Redraw chart + map on resize
  let resizeTimer: ReturnType<typeof setTimeout>;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      renderChart(chartContainerEl, state.history, activeRegions);
      renderMap(mapEl, state.regions);
    }, 200);
  });
}

mount();
