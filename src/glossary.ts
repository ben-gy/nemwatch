export interface GlossaryEntry {
  term: string;
  abbr: string | null;
  definition: string;
}

const glossary: Record<string, GlossaryEntry> = {
  'spot-price': {
    term: 'Spot Price',
    abbr: null,
    definition:
      'The wholesale price of electricity set every 5 minutes by AEMO through a bidding process. Generators bid to supply power, and the price is set by the most expensive generator needed to meet demand. This is not the price you pay on your home bill — retail prices include network charges, green certificates, and retailer margins on top of the wholesale spot price.',
  },
  'mwh': {
    term: 'Megawatt Hour',
    abbr: 'MWh',
    definition:
      'A unit of energy equal to 1,000 kilowatt hours. Spot prices are quoted in dollars per MWh. For context, an average Australian home uses about 15–20 kWh per day, or roughly 0.015–0.02 MWh.',
  },
  'nem': {
    term: 'National Electricity Market',
    abbr: 'NEM',
    definition:
      'Australia\'s interconnected east-coast electricity grid, operated by AEMO. It covers Queensland, New South Wales, Victoria, South Australia, and Tasmania — about 80% of Australia\'s population. Western Australia and the Northern Territory have separate grids.',
  },
  'nem-region': {
    term: 'NEM Region',
    abbr: null,
    definition:
      'The NEM is split into five pricing regions, roughly matching state boundaries: NSW1 (New South Wales + ACT), QLD1 (Queensland), VIC1 (Victoria), SA1 (South Australia), and TAS1 (Tasmania). Each region has its own spot price because supply, demand, and interconnector capacity differ between states.',
  },
  'semi-scheduled': {
    term: 'Semi-Scheduled Generation',
    abbr: null,
    definition:
      'Generation from large wind farms and utility-scale solar farms that are registered with AEMO. These sources can\'t be dispatched on demand like a gas turbine — their output depends on weather. The semi-scheduled percentage shown here is a useful proxy for how much of the grid is currently powered by variable renewables. It does not include rooftop solar, which AEMO tracks separately.',
  },
  'demand': {
    term: 'Demand',
    abbr: null,
    definition:
      'The total amount of electricity being consumed in a region at this moment, measured in megawatts (MW). This includes homes, businesses, industry, and electric vehicles. Demand rises in summer (air conditioning) and winter (heating) and drops overnight.',
  },
  'generation': {
    term: 'Generation',
    abbr: null,
    definition:
      'The total amount of electricity being produced by power stations in a region, measured in megawatts (MW). This includes coal, gas, hydro, wind, and large-scale solar. When generation exceeds local demand, the surplus flows to neighbouring states via interconnectors.',
  },
  'interconnector': {
    term: 'Interconnector',
    abbr: null,
    definition:
      'High-voltage transmission lines that connect NEM regions, allowing electricity to flow between states. For example, the VIC–NSW interconnector lets Victorian power flow into New South Wales when NSW demand is high. Interconnectors have limited capacity, which is why prices can differ significantly between regions.',
  },
  'net-interchange': {
    term: 'Net Interchange',
    abbr: null,
    definition:
      'The net flow of electricity in or out of a region via interconnectors, measured in MW. A positive value means the region is importing power from neighbouring states. A negative value means it\'s exporting surplus power. Regions with lots of cheap generation (e.g. Queensland\'s solar) often export, while high-demand regions (e.g. NSW) often import.',
  },
  'apc': {
    term: 'Administered Price Cap',
    abbr: 'APC',
    definition:
      'A safety mechanism that AEMO activates when cumulative spot prices over a 7-day rolling window exceed a threshold (currently $1,398,100). Once triggered, the price is capped at $600/MWh until the cumulative price drops back. This prevents extreme sustained prices from causing financial distress to retailers and consumers.',
  },
  'market-suspended': {
    term: 'Market Suspended',
    abbr: 'SUSP',
    definition:
      'AEMO can suspend the market when normal price-setting mechanisms can\'t operate safely — for example, during major system security events or when the bidding system fails. During suspension, AEMO sets prices administratively rather than through the normal bidding process.',
  },
  'settlement-date': {
    term: 'Settlement Date',
    abbr: null,
    definition:
      'The timestamp of the 5-minute dispatch interval that this data represents. AEMO settles the market in 5-minute intervals — generators are paid and retailers are charged based on the spot price for each interval. The time shown is in Australian Eastern Standard Time (AEST).',
  },
  'dispatch-interval': {
    term: 'Dispatch Interval',
    abbr: null,
    definition:
      'The NEM operates in 5-minute cycles called dispatch intervals. Every 5 minutes, AEMO runs its dispatch engine to determine which generators should produce power and at what level, setting the spot price for that interval. This data updates at the end of each dispatch interval.',
  },
  'price-bands': {
    term: 'Price Bands',
    abbr: null,
    definition:
      'The colour coding used on this dashboard to indicate price severity. Negative prices (purple) mean generators are paying to stay online. Under $50/MWh (green) is cheap — often when renewables are plentiful. $50–$150 (cyan) is normal. $150–$500 (yellow) indicates elevated demand or tight supply. $500–$3,000 (orange) is high. Above $3,000 (red) is approaching the market price cap of $17,500/MWh.',
  },
};

export function lookupTerm(key: string): GlossaryEntry | null {
  return glossary[key] ?? null;
}

export function getAllTerms(): Array<GlossaryEntry & { key: string }> {
  return Object.entries(glossary).map(([key, entry]) => ({ key, ...entry }));
}
