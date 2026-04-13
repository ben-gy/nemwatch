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
import './style.css';

const REFRESH_INTERVAL = 5 * 60; // 5 minutes in seconds

const state: AppState = {
  regions: [],
  lastUpdated: null,
  loading: false,
  error: null,
  nextRefreshIn: REFRESH_INTERVAL,
  history: loadHistory(),
};

let activeRegions = getActiveRegions();
let abortController: AbortController | null = null;
let countdownTimer: ReturnType<typeof setInterval> | null = null;

// DOM refs — set after mount
let headerEl!: HTMLElement;
let errorEl!: HTMLElement;
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
      <section class="cards-section" id="cards-section"></section>
      <section class="ic-section panel" id="ic-section"></section>
      <section class="chart-section panel">
        <div class="panel-title">
          24-Hour Price History
          <span class="panel-sub">(builds as you keep the page open)</span>
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
          Semi-scheduled generation = primarily wind + utility-scale solar ·
          <a href="https://github.com/ben-gy/nemwatch" target="_blank" rel="noopener">GitHub</a>
        </span>
      </div>
    </footer>
  `;

  headerEl = document.getElementById('site-header')!;
  errorEl = document.getElementById('error-zone')!;
  cardsEl = document.getElementById('cards-section')!;
  interconnectorsEl = document.getElementById('ic-section')!;
  chartContainerEl = document.getElementById('chart-container')!;
  chartLegendEl = document.getElementById('chart-legend')!;
  lastUpdatedEl = document.getElementById('last-updated')!;
  priceLegendEl = document.getElementById('price-legend')!;

  renderPriceLegend(priceLegendEl);

  // Initial render (shows loading state)
  render();

  // Fetch on load
  void fetchData();

  // Redraw chart on resize
  let resizeTimer: ReturnType<typeof setTimeout>;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      renderChart(chartContainerEl, state.history, activeRegions);
    }, 200);
  });
}

mount();
