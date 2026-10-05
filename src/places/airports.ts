import airports from './airports.json'
import { DATE_WORDS } from './dateWords'

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

// A flight's `to`/`from` names a city only when the user typed a bare
// IATA/metro code for it ("MAN", "KIX 12 Oct", "LHR Sun 20:10" — the
// trailing date/day stays unread here, only the leading code matters); a
// code the user wrote alongside a typed name ("Florence (FLR)") doesn't
// start with the code, so this returns null and that side keeps its
// already-typed city. The code must also be *bounded* on the right by
// something that could only be noise, never a word of its own: nothing,
// punctuation, a digit, or a day/month word — "BAR mitzvah", "NYC
// Marathon", "THE Hague" fail this and are never read as codes, but
// "SFO-Oakland", "NYC!", "KIX, 12 Oct" pass. An unknown code (`airportFor`
// returns null) is treated the same as an untyped side: the plan only
// says what a *known* code adds. Public (`/travel`): the city to show under
// a location field, case-sensitive so a typed "bus" or "the" is no code.
const CODE_PREFIX = /^([A-Z]{3})\b/
// No `[a-z]*` tail on the word branch: with one, "mar" would also open
// "Marathon" (and "sat" "Saturn", "sun" "Sunday" dropping the day's own
// final "day"...) since `\b` only re-anchors at the end of the match, not
// against a real word boundary mid-string. The short forms are all the
// keep-cases need ("Mon", "Fri", "Oct") — DATE_WORDS' `\b` right after
// the abbreviation itself is what keeps "Marathon" out.
const FULL_DATE_WORDS =
  'monday|tuesday|wednesday|thursday|friday|saturday|sunday|sept|' +
  'january|february|march|april|june|july|august|september|october|' +
  'november|december'
const CODE_BOUNDARY = new RegExp(
  `^(?:[.,!?;:-]|\\s*\\d|\\s+(?:${DATE_WORDS}|${FULL_DATE_WORDS})\\b)`,
  'i',
)
// A real code that isn't a city worth saying: "USA" is a tiny Concord,
// NH airport that shadows the country code every "Flight to USA" types.
// "AUS" (Austin) and the other coincidental real-word codes (IND, CAN,
// MAR, SUN, DAD, BBQ...) stay — see Findings for why those are accepted.
const CODE_STOPS = new Set(['USA'])

export const airportCity = (side: string | null | undefined): string | null => {
  if (typeof side !== 'string') {
    return null
  }
  const trimmed = side.trim()
  const code = CODE_PREFIX.exec(trimmed)?.[1]
  if (code === undefined || CODE_STOPS.has(code)) {
    return null
  }
  const rest = trimmed.slice(code.length)
  return rest !== '' && !CODE_BOUNDARY.test(rest) ? null : airportFor(code)
}
