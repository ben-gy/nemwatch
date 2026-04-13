# Site Plan: NEM Watch

## Overview
- **Name:** NEM Watch
- **Repo name:** nemwatch
- **Tagline:** Live Australian electricity prices and grid demand — updated every 5 minutes

## Target Audience
Australian households and small businesses monitoring electricity costs, energy analysts, renewable energy advocates, and policy researchers tracking the National Electricity Market (NEM) in real time. Also useful for people with solar + battery who want to understand when to export or charge.

## Value Proposition
The AEMO data dashboard is dense and unintuitive. NEM Watch makes the same live NEM data instantly readable — colour-coded spot prices, per-region demand, interconnector flows, and a running 24-hour price chart built from in-browser history. Bookmarkable, no login, no ads. Answers "is power cheap or expensive right now?" in one glance.

## Data Sources
| Source | URL | What it provides | Update frequency | Auth required? |
|--------|-----|------------------|-----------------|----------------|
| AEMO NEM Summary API | https://visualisations.aemo.com.au/aemo/apps/api/report/ELEC_NEM_SUMMARY | Live price ($/MWh), demand (MW), scheduled + semi-scheduled generation, interconnector flows for all 5 NEM regions | Every 5 minutes | No |

## Key Features
1. **Live spot price cards** — One card per NEM region (NSW, VIC, QLD, SA, TAS) showing current price $/MWh with colour-coded severity (green/yellow/orange/red/black)
2. **Demand vs generation bar** — Visual fill bar showing total demand vs total generation for each region
3. **Semi-scheduled % indicator** — Percentage of generation from semi-scheduled sources (primarily wind + utility solar), indicating renewable mix
4. **Interconnector flows panel** — Shows MW flowing between regions with direction arrows
5. **24-hour price chart** — Line chart per region built from localStorage-cached API snapshots, auto-populates as you leave the tab open
6. **Auto-refresh** — Polls every 5 minutes aligned to NEM dispatch intervals, with countdown timer
7. **Price alerts** — Optional localStorage setting to show a banner when any region exceeds a user-set threshold
8. **Last-updated timestamp** — Shows the SETTLEMENTDATE from the API so users know data freshness

## Style Direction
**Tone:** Technical/monitoring — professional, data-dense, precise
**Colour palette:** Dark background (deep navy #05080f), with cyan/teal accent for normal prices, yellow for elevated, orange for high, red for critical, dark red/black for market cap events. Matches the aesthetic of energy trading terminals and monitoring dashboards.
**UI density:** Compact/data-dense — numbers in monospace, tight rows
**Dark/light theme:** Dark — this is a monitoring tool for analysts and energy-aware households who often check at night
**Reference sites:** AEMO's own NEM data dashboard, Gridwatch (UK), fuelaustralia.org (for clarity benchmark)

## Technical Architecture
- **Stack:** Vanilla TypeScript + Vite
- **Data strategy:** Runtime-fetch (AEMO public JSON endpoint, every 5 minutes) + localStorage for 24h history
- **Key libraries:** None — D3-style charts drawn with SVG/Canvas directly in TS (no external chart lib needed for this scope)

## Layout
- **Header (48px):** Logo/title left, region pill row right, auto-refresh countdown + last-updated
- **Main grid:** 5 region cards in a responsive CSS Grid (3+2 on desktop, 2+2+1 on tablet, 1-col on mobile)
- **Each region card:** Price (large, colour-coded) | demand bar | semi-sched % | region name + state flag emoji
- **Interconnectors panel:** Below cards, shows flows as directional arrows with MW labels
- **Price chart:** Full-width SVG line chart below, one line per region, 24h window from localStorage

## Pages/Views
Single page, scrollable. No routing needed.
