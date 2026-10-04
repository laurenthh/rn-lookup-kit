import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Source: OurAirports `airports.csv` (public domain).
// Pinned 2026-10-03: 86,158 rows, sha256
// ff5143921ef72d767402c299a5d868f79166c5c589267aca13dce957c41bd2a2
// Delete .cache/ourairports/airports.csv to re-download the latest file.
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const CACHE = join(ROOT, '.cache', 'ourairports')
const SOURCE = join(CACHE, 'airports.csv')
const SOURCE_URL =
  'https://davidmegginson.github.io/ourairports-data/airports.csv'
const OUT = join(ROOT, 'src', 'places', 'airports.json')
const BUDGET_BYTES = 150 * 1024

type Row = Record<string, string>

// Copied from build-foods.ts; scripts share nothing (each build script is
// a one-off CLI, not a library — not worth a shared module for this).
const parseCsv = (text: string): Row[] => {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (c !== '\r') field += c
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  const header = rows.shift() ?? []
  return rows
    .filter((r) => r.length > 1)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])))
}

const loadSource = async (): Promise<string> => {
  if (!existsSync(SOURCE)) {
    console.log(`Downloading ${SOURCE_URL}`)
    const res = await fetch(SOURCE_URL)
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`)
    mkdirSync(CACHE, { recursive: true })
    writeFileSync(SOURCE, await res.text())
  }
  return readFileSync(SOURCE, 'utf8')
}

const WANTED_TYPES = new Set(['large_airport', 'medium_airport'])

// Codes neither the rules nor EXONYM (below) can safely reach.
const CITY_OVERRIDE: Record<string, string> = {
  NRT: 'Tokyo', // Narita, Tokyo's secondary gateway — reads like HND
  ZRH: 'Zürich', // municipality strips the umlaut; `name` keeps it
  EDI: 'Edinburgh', // never a bare (comma-free) municipality in the CSV
  KUL: 'Kuala Lumpur', // municipality "Sepang" is real, but not what a traveller means
  VRN: 'Verona', // municipality is suburb "Caselle" (Sommacampagna)
  TRN: 'Turin', // municipality is suburb "Caselle Torinese"; EXONYM needs an exact match
  NGO: 'Nagoya', // airport's own name never mentions the city ("Chubu Centrair...")
  TPE: 'Taipei', // airport's own name never mentions the city ("Taiwan Taoyuan...")
  FRA: 'Frankfurt', // shortened from the airport's own correct "Frankfurt am Main"
  DPS: 'Bali', // served city is "Denpasar"; "Bali" is what travellers say (2026-10-03)
  BEM: 'Beni Mellal', // name-prefix rule false match: name buries a place/person word first
  BUS: 'Batumi', // name-prefix rule false match
  IAR: 'Yaroslavl', // name-prefix rule false match
  MAJ: 'Majuro', // name-prefix rule false match
  RUN: 'Sainte-Marie', // name-prefix rule false match
  SKB: 'Basseterre', // name-prefix rule false match
  SVD: 'Kingstown', // name-prefix rule false match
  RFD: 'Rockford', // "Chicago/Rockford": the airport is in Rockford, 90 mi out
  CXR: 'Nha Trang', // municipality field is garbled multi-value text ("Nha Trang/nha Trang...")
}

// Local-language city names OurAirports sometimes uses in `municipality`
// where English (what a traveller types) differs. Scoped to large_airport
// only, same as the rules below (Australia's Roma Airport, RMA, is a
// medium_airport and a real, unrelated "Roma" this map must never touch).
const EXONYM: Record<string, string> = {
  Roma: 'Rome', // Italian
  Milano: 'Milan', // Italian
  Napoli: 'Naples', // Italian
  Firenze: 'Florence', // Italian
  Venezia: 'Venice', // Italian
  Torino: 'Turin', // Italian
  München: 'Munich', // German
  Köln: 'Cologne', // German
  Wien: 'Vienna', // German
  Praha: 'Prague', // Czech
  Lisboa: 'Lisbon', // Portuguese
  Warszawa: 'Warsaw', // Polish
  Bruxelles: 'Brussels', // French
  Hannover: 'Hanover', // German
  Göteborg: 'Gothenburg', // Swedish
}

// Pure city/metro IATA codes — not a physical airport, used in
// itineraries to mean "any airport serving this city" (airportFor('LON')
// should read the same as a real code). Verified against this CSV: each
// one is absent from it entirely, so merging them in can't shadow a real
// airport. A few codes travel sites also treat as "the city" (BER, BKK,
// HOU, LAX, OSL, SHA) are deliberately left out here — they're already a
// real, correctly-resolving scheduled airport above, so adding them
// again would be redundant at best.
const METRO_CITIES: Record<string, string> = {
  LON: 'London',
  NYC: 'New York',
  PAR: 'Paris',
  TYO: 'Tokyo',
  OSA: 'Osaka',
  MIL: 'Milan',
  ROM: 'Rome',
  WAS: 'Washington',
  CHI: 'Chicago',
  SEL: 'Seoul',
  STO: 'Stockholm',
  BJS: 'Beijing',
  MOW: 'Moscow',
  BUE: 'Buenos Aires',
  SAO: 'São Paulo',
  RIO: 'Rio de Janeiro',
  YTO: 'Toronto',
  YMQ: 'Montréal',
  REK: 'Reykjavík',
  JKT: 'Jakarta',
  DTT: 'Detroit',
}

// Cuts an airport's `name` at the earliest of these (not necessarily the
// first in this list) — the part before is usually the city, the part
// after is the brand (airport/terminal type, "International", a person).
const NAME_SEPARATORS = [
  ' Airport',
  ' International',
  ' Intl',
  ' / ',
  ' - ',
  ' Regional',
  ' Municipal',
]

const namePrefix = (name: string): string => {
  let cut = name.length
  for (const sep of NAME_SEPARATORS) {
    const idx = name.indexOf(sep)
    if (idx !== -1 && idx < cut) cut = idx
  }
  return name.slice(0, cut).trim()
}

// OurAirports' `municipality` mixes "City, Region/County" (the common
// case: strip from the first comma) with a parenthetical suburb/alias
// ("Oslo (Gardermoen)", "Paris (Roissy-en-France, Val-d'Oise)": strip the
// parens first, before any comma split) and, for a few US/French/Nordic
// airports, a "City1/City2" dual-city name (take the first, same as a
// comma: "Allentown/Bethlehem" -> "Allentown", "Raleigh/Durham" ->
// "Raleigh"). A few rows reverse the comma order ("Ingliston, Edinburgh")
// and are fixed below when the rules can; see CITY_OVERRIDE for the ones
// they can't. When `municipality` is blank, or a duplicate of `name`
// itself ("Nikolayevsk-na-Amure Airport" as both), the candidate is cut
// the same way a city is read out of `name` elsewhere (`namePrefix`)
// rather than kept as the raw, brand-laden original ("Boulia Airport" ->
// "Boulia", not "Boulia Airport").
const cleanCity = (municipality: string, name: string): string => {
  const trimmed = municipality.trim()
  const noParens = trimmed.replace(/\s*\([^)]*\)/g, '')
  const city = (noParens.split(/[,/]/)[0] ?? '').trim()
  const candidate = city === '' ? name : city
  return namePrefix(candidate) || candidate
}

// Leading word-prefixes of `phrase`, longest first, dropping at most
// `maxDrop` trailing words — "Istanbul Sabiha Gökçen" with maxDrop 2
// yields ["Istanbul Sabiha Gökçen", "Istanbul Sabiha", "Istanbul"].
const leadingPrefixes = (phrase: string, maxDrop: number): string[] => {
  const words = phrase.split(' ')
  const shortest = Math.max(words.length - maxDrop, 1)
  const out: string[] = []
  for (let n = words.length; n >= shortest; n--)
    out.push(words.slice(0, n).join(' '))
  return out
}

// How many trailing words a name-prefix match may drop before we stop
// trusting it. 2 is enough for "Athens Eleftherios Venizelos" -> Athens
// and "Istanbul Sabiha Gökçen" -> Istanbul; past that, a small airport's
// name is more often a person ("Robert L. Bradshaw") than a city.
const MAX_WORD_DROP = 2

type Gazetteer = ReadonlySet<string>

// A city gets into the gazetteer only by being some OTHER airport's
// bare (comma-free) municipality too — not by appearing in a name, and
// not just by repeating the same "Suburb, Region" municipality string
// across rows (that would validate the suburb, not the region/city).
const buildGazetteer = (rows: readonly Row[]): Gazetteer => {
  const freq = new Map<string, number>()
  for (const row of rows) {
    const m = (row['municipality'] ?? '').trim().replace(/\s*\([^)]*\)/g, '')
    if (m === '' || m.includes(',')) continue
    freq.set(m, (freq.get(m) ?? 0) + 1)
  }
  const gaz = new Set<string>()
  for (const [city, count] of freq) if (count >= 2) gaz.add(city)
  return gaz
}

// Rule 1 (21-roadmap stage 2): the airport's own name often states its
// real city more plainly than `municipality` does ("Brussels Airport"
// for BRU, whose municipality is the suburb "Zaventem"). Only trusted
// when the gazetteer backs the match, and only applied to large_airport
// rows — on medium airports the same shrink-to-one-word approach matches
// far more often, but mostly collides with other places' person-named
// airports (see CITY_OVERRIDE's note on BEM/BUS/IAR/MAJ/RUN/SKB/SVD).
const nameCandidate = (name: string, gaz: Gazetteer): string | null => {
  const prefix = namePrefix(name)
  if (prefix === '') return null
  for (const candidate of leadingPrefixes(prefix, MAX_WORD_DROP)) {
    if (gaz.has(candidate)) return candidate
  }
  return null
}

// Rule 2: a few rows reverse the usual "City, Region" order into
// "Suburb, City" (EDI's "Ingliston, Edinburgh"). Only trusted when the
// second part is gazetteer-backed and the first isn't — otherwise this
// would turn plenty of ordinary "City, Region" rows into their region.
const reversedCommaCandidate = (
  municipality: string,
  gaz: Gazetteer,
): string | null => {
  const stripped = municipality.trim().replace(/\s*\([^)]*\)/g, '')
  if (!stripped.includes(',')) return null
  const parts = stripped.split(',').map((p) => p.trim())
  const first = parts[0] ?? ''
  const second = parts.at(-1) ?? ''
  return gaz.has(second) && !gaz.has(first) ? second : null
}

const resolveCity = (row: Row, gaz: Gazetteer): string => {
  const override = CITY_OVERRIDE[row['iata_code'] ?? '']
  if (override !== undefined) return override
  const baseline = cleanCity(row['municipality'] ?? '', row['name'] ?? '')
  if (row['type'] !== 'large_airport') return baseline
  const resolved = gaz.has(baseline)
    ? baseline
    : (nameCandidate(row['name'] ?? '', gaz) ??
      reversedCommaCandidate(row['municipality'] ?? '', gaz) ??
      baseline)
  return EXONYM[resolved] ?? resolved
}

const main = async (): Promise<void> => {
  const rows = parseCsv(await loadSource())
  const gazetteer = buildGazetteer(rows)
  const errors: string[] = []
  const out: Record<string, string> = {}

  for (const row of rows) {
    const type = row['type'] ?? ''
    const iata = row['iata_code'] ?? ''
    const scheduled = row['scheduled_service'] ?? ''
    if (!WANTED_TYPES.has(type) || scheduled !== 'yes' || iata === '') continue
    if (!/^[A-Z]{3}$/.test(iata)) {
      errors.push(`unexpected iata code shape '${iata}'`)
      continue
    }
    if (out[iata] !== undefined) {
      errors.push(`duplicate iata code '${iata}'`)
      continue
    }
    out[iata] = resolveCity(row, gazetteer)
  }

  for (const [code, city] of Object.entries(METRO_CITIES)) {
    if (out[code] !== undefined) {
      errors.push(`metro code '${code}' collides with a real airport`)
      continue
    }
    out[code] = city
  }

  if (errors.length > 0) {
    console.error(errors.join('\n'))
    process.exit(1)
  }

  const sorted = Object.fromEntries(
    Object.entries(out).sort(([a], [b]) => a.localeCompare(b)),
  )
  const json = JSON.stringify(sorted)
  writeFileSync(OUT, `${json}\n`)
  const bytes = Buffer.byteLength(json, 'utf8')
  console.log(
    `${Object.keys(sorted).length} airports, ` +
      `${(bytes / 1024).toFixed(1)} KB -> ${OUT}`,
  )
  if (bytes > BUDGET_BYTES) {
    console.error(`airports.json exceeds the ${BUDGET_BYTES / 1024} KB budget`)
    process.exit(1)
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
})
