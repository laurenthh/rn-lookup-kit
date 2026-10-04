import airports from './airports.json'

// JSON import widens to Record<string, string>; the data test checks shape.
const AIRPORTS = airports as Record<string, string>

export const airportFor = (code: string): string | null =>
  AIRPORTS[code.trim().toUpperCase()] ?? null

// Every city the table can produce, for a caller that needs to tell its
// own output apart from arbitrary text (the travel lookup's airport note
// line, 21c stage 2). Built once, lazily, on first use.
let cities: ReadonlySet<string> | null = null
export const airportCities = (): ReadonlySet<string> =>
  (cities ??= new Set(Object.values(AIRPORTS)))
