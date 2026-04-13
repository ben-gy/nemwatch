# NEM Watch

**Live Australian electricity spot prices and grid demand — updated every 5 minutes from AEMO data.**

🔗 **Live:** [https://nemwatch.benrichardson.dev](https://nemwatch.benrichardson.dev)

## What is this?

NEM Watch makes the Australian National Electricity Market data immediately readable. The AEMO publishes 5-minute settlement prices and generation data for all NEM regions, but their own dashboard is dense and hard to parse at a glance. NEM Watch surfaces the same data in a clean, dark monitoring interface that answers "is power cheap or expensive right now?" in one look.

Each of the five NEM regions (NSW, VIC, QLD, SA, TAS) gets a card showing the current spot price colour-coded by severity — cyan for normal, yellow for elevated, orange for high, red for critical. Generation bars show how much of demand is being met locally, and the semi-scheduled percentage indicates the share of variable renewables (wind + utility-scale solar) in the mix.

Interconnector flows show how electricity is moving between states in real time. A 24-hour price chart builds up as you leave the page open, storing snapshots in your browser's localStorage so the history persists across refreshes.

## Who is this for?

- **Households with solar or batteries** who want to know when to export or charge
- **Energy analysts and researchers** tracking the NEM in real time without wading through AEMO's tools
- **Renewable energy advocates** watching the renewable percentage across regions
- **Curious Australians** who've ever wondered why their bill is high or what "market cap" means

## Data Sources

| Source | What it provides | Update frequency |
|--------|------------------|-----------------|
| AEMO NEM Summary API | Spot price, demand, scheduled and semi-scheduled generation, interconnector flows for NSW, VIC, QLD, SA, TAS | Every 5 minutes |

No API key required. The AEMO NEM Summary endpoint is publicly accessible.

## Features

- **Live spot price cards** — Colour-coded price per region ($/MWh) with severity bands
- **Generation vs demand bars** — Visual fill showing how much local generation covers demand
- **Semi-scheduled % indicator** — Proxy for wind + utility solar share in each region
- **Interconnector flow panel** — MW flowing between states with directional arrows
- **24-hour price chart** — SVG line chart from in-browser localStorage history, per-region toggle
- **Auto-refresh every 5 minutes** — Countdown timer shows time to next fetch
- **Price legend** — Key explaining colour bands from negative through market cap

## Tech Stack

- **Runtime:** Vanilla TypeScript
- **Build:** Vite 6
- **Testing:** Vitest (45 tests)
- **Hosting:** GitHub Pages (static, no backend)
- **Data:** Runtime-fetch from AEMO public JSON API + localStorage for 24h history
- **Charts:** Custom SVG rendering (no external chart library)

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test

# Production build
npm run build

# Preview production build
npm run preview
```

## How it works

On page load and every 5 minutes thereafter, the app fetches `https://visualisations.aemo.com.au/aemo/apps/api/report/ELEC_NEM_SUMMARY`. The response contains one row per NEM region with the settlement date, spot price, total demand, scheduled generation, semi-scheduled generation, and interconnector flows (as a JSON-encoded string within the main JSON).

Each data fetch is appended to a `HistoryPoint` array stored in localStorage (capped at 288 points = 24 hours). The SVG chart is re-rendered from this accumulated history, so the longer you leave the tab open, the richer the price history becomes.

## License

MIT
