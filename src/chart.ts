// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
import type { HistoryPoint, RegionId } from './types.js';
import { REGION_ORDER, REGION_LABELS, formatTimeShort, formatPrice } from './utils.js';

const REGION_COLORS: Record<RegionId, string> = {
  NSW1: '#22d3ee',
  QLD1: '#a3e635',
  VIC1: '#818cf8',
  SA1: '#fb923c',
  TAS1: '#34d399',
};

const CHART_HEIGHT = 160;
const PADDING = { top: 12, right: 16, bottom: 28, left: 52 };

export function renderChart(
  container: HTMLElement,
  history: HistoryPoint[],
  activeRegions: Set<RegionId>
): void {
  const width = container.clientWidth || 800;
  const innerW = width - PADDING.left - PADDING.right;
  const innerH = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  if (history.length < 2) {
    container.innerHTML = `<div class="chart-empty">Loading price history…</div>`;
    return;
  }

  // Collect all prices for active regions
  const allPrices: number[] = [];
  for (const point of history) {
    for (const rid of REGION_ORDER) {
      if (!activeRegions.has(rid)) continue;
      const p = point.prices[rid];
      if (p !== undefined) allPrices.push(p);
    }
  }
  if (allPrices.length === 0) {
    container.innerHTML = `<div class="chart-empty">No data for selected regions.</div>`;
    return;
  }

  const minPrice = Math.max(0, Math.min(...allPrices) - 10);
  const maxPrice = Math.max(...allPrices) + 20;
  const timeMin = history[0].ts;
  const timeMax = history[history.length - 1].ts;
  const timeRange = timeMax - timeMin || 1;

  const xScale = (ts: number) => ((ts - timeMin) / timeRange) * innerW;
  const yScale = (price: number) =>
    innerH - ((price - minPrice) / (maxPrice - minPrice)) * innerH;

  // Build path strings per region
  const paths: string[] = [];
  for (const rid of REGION_ORDER) {
    if (!activeRegions.has(rid)) continue;
    const points = history
      .map((p) => ({
        x: xScale(p.ts) + PADDING.left,
        y: yScale(p.prices[rid] ?? minPrice) + PADDING.top,
        valid: p.prices[rid] !== undefined,
      }))
      .filter((p) => p.valid);
    if (points.length < 2) continue;
    const d = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');
    const prices = history
      .map((p) => p.prices[rid])
      .filter((v): v is number => v !== undefined);
    const tip = `${REGION_LABELS[rid]}: now ${formatPrice(prices[prices.length - 1])}/MWh · 24h range ${formatPrice(Math.min(...prices))} to ${formatPrice(Math.max(...prices))}`;
    paths.push(
      `<path d="${d}" stroke="${REGION_COLORS[rid]}" stroke-width="1.5" fill="none" opacity="0.85"/>` +
        `<path d="${d}" stroke="transparent" stroke-width="10" fill="none" pointer-events="stroke" data-tip="${tip}" aria-label="${tip}"/>`
    );
  }

  // Y-axis ticks
  const yTicks: string[] = [];
  const tickCount = 4;
  for (let i = 0; i <= tickCount; i++) {
    const price = minPrice + ((maxPrice - minPrice) * i) / tickCount;
    const y = yScale(price) + PADDING.top;
    yTicks.push(
      `<line x1="${PADDING.left}" x2="${PADDING.left + innerW}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--border-subtle)" stroke-dasharray="2,4"/>` +
        `<text x="${PADDING.left - 4}" y="${y.toFixed(1)}" text-anchor="end" dominant-baseline="middle" class="chart-tick">$${Math.round(price)}</text>`
    );
  }

  // X-axis ticks (every ~2 hours)
  const xTicks: string[] = [];
  const tickEveryMs = 2 * 60 * 60 * 1000;
  const startTick = Math.ceil(timeMin / tickEveryMs) * tickEveryMs;
  for (let ts = startTick; ts <= timeMax; ts += tickEveryMs) {
    const x = xScale(ts) + PADDING.left;
    xTicks.push(
      `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${PADDING.top}" y2="${PADDING.top + innerH}" stroke="var(--border-subtle)" stroke-dasharray="2,4"/>` +
        `<text x="${x.toFixed(1)}" y="${PADDING.top + innerH + 14}" text-anchor="middle" class="chart-tick">${formatTimeShort(new Date(ts))}</text>`
    );
  }

  const svgHeight = CHART_HEIGHT;
  container.innerHTML = `
    <svg width="100%" height="${svgHeight}" viewBox="0 0 ${width} ${svgHeight}" preserveAspectRatio="none">
      ${yTicks.join('')}
      ${xTicks.join('')}
      ${paths.join('')}
    </svg>
  `;
}

export function renderLegend(container: HTMLElement, activeRegions: Set<RegionId>, onToggle: (rid: RegionId) => void): void {
  container.innerHTML = REGION_ORDER.map((rid) => {
    const active = activeRegions.has(rid);
    return `<button class="legend-btn ${active ? 'active' : ''}" data-rid="${rid}" style="--region-color:${REGION_COLORS[rid]}">
      <span class="legend-dot"></span>${REGION_LABELS[rid]}
    </button>`;
  }).join('');

  container.querySelectorAll<HTMLButtonElement>('.legend-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const rid = btn.dataset.rid as RegionId;
      onToggle(rid);
    });
  });
}
