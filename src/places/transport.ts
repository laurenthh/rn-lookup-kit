import { DATE_WORDS } from './dateWords'
import { stripWhen } from './noise'
import { isStayName } from './stays'

export type TravelMode = 'transit' | 'driving' | 'walking' | 'bicycling'

export type TransportIntent =
  | { kind: 'flight'; to: string; from: string | null }
  | { kind: 'ground'; to: string; from: string | null; mode: TravelMode }

const MODES: Record<TravelMode, string[]> = {
  driving: [
    'transfers?',
    'shuttle',
    'uber',
    'lyft',
    'grab',
    'taxi',
    'cab',
    'drive',
    'rental car',
    'hire car',
  ],
  transit: [
    'water taxi',
    'water bus',
    'vaporetto',
    'trains?',
    'transit',
    'public transport',
    'tube',
    'rail',
    'metro',
    'subway',
    'tram',
    'ferry',
    'bus',
    'coach',
    'express',
    'shinkansen',
    'nozomi',
    'hikari',
    'kodama',
    'eurostar',
    'tgv',
    'ice',
    'flixbus',
    'haruka',
    'aerob[uú]s',
    'narita express',
    "n'ex",
    'megabus',
    'greyhound',
    'amtrak',
    'national express',
    'boat',
  ],
  walking: ['walk'],
  bicycling: ['bike', 'cycle'],
}
const MODE_WORDS = Object.values(MODES).flat()
const MODE = `(?:${MODE_WORDS.join('|')})\\b`
const FLIGHT_WORDS = ['flights?', 'flying', 'fly', 'plane', 'airfare']
// Airline names are flight words, never an origin ("Book Qantas to Sydney").
const AIRLINES = [
  'qantas',
  'jetstar',
  'japan airlines',
  'all nippon airways',
  'british airways',
  'emirates',
  'qatar airways',
  'qatar',
  'singapore airlines',
  'cathay pacific',
  'cathay',
  'lufthansa',
  'klm',
  'air france',
  'ryanair',
  'easyjet',
  'virgin atlantic',
  'virgin australia',
  'virgin',
  'delta',
  'united airlines',
  'united',
  'american airlines',
  'southwest',
  'jetblue',
  'alaska airlines',
  'air canada',
  'westjet',
  'aer lingus',
  'iberia',
  'vueling',
  'tap air portugal',
  'turkish airlines',
  'etihad',
  'air new zealand',
  'air india',
  'airasia',
  'air asia',
  'cebu pacific',
  'korean air',
  'asiana',
  'eva air',
  'china airlines',
  'wizz air',
  'norwegian',
  'finnair',
  'icelandair',
  'jet2',
  'thai airways',
  'vietnam airlines',
  'malaysia airlines',
  'philippine airlines',
  'aeromexico',
  'latam',
  'avianca',
  'zipair',
  'frontier',
  'spirit',
]
// Also ordinary words: a flight only with a destination after them
// ("Delta to Atlanta", not "Virgin Mary statue – Plaza").
const AMBIGUOUS_AIRLINES = [
  'virgin',
  'united',
  'delta',
  'norwegian',
  'qatar',
  'cathay',
  'emirates',
  'jet2',
  'frontier',
  'spirit',
]
// Short codes only count in capitals, right before to/from.
const AIRLINE_CODES: Record<string, string> = {
  BA: 'British Airways',
  ANA: 'All Nippon Airways',
  JAL: 'Japan Airlines',
  AA: 'American Airlines',
  UA: 'United Airlines',
}
const AIRLINE_CODE = new RegExp(
  `\\b(${Object.keys(AIRLINE_CODES).join('|')})\\b(?=\\s+(?:to|from)\\b)`,
  'g',
)

const LEAD_VERBS = [
  'book',
  'reserve',
  'take',
  'catch',
  'get',
  'call',
  'order',
  'need',
  'arrange',
  'check',
]
const ARTICLES = ['a', 'an', 'the', 'my', 'our']
const MODIFIERS = [
  'night',
  'overnight',
  'airport',
  'hotel',
  'early',
  'late',
  'morning',
  'evening',
  'local',
  'limousine',
  'private',
  'shared',
  'direct',
  '\\d{1,2}[:.]\\d{2}',
  '\\d{1,2}\\s?(?:am|pm)',
]
const FLIGHT_ADJECTIVES = [
  'return',
  'one-way',
  'one way',
  'round-trip',
  'round trip',
  'cheap',
  'budget',
  'direct',
  'last-minute',
]

const LEAD =
  `^(?:(?:${LEAD_VERBS.join('|')})\\s+)?(?:seats?\\s+on\\s+)?` +
  `(?:(?:${ARTICLES.join('|')})\\s+)?(?:(?:${MODIFIERS.join('|')})\\s+)*`
const FLIGHT_WORD = `(?:${FLIGHT_WORDS.join('|')})\\b`
const AIRLINE = `(?:${AIRLINES.join('|')})\\b`

const FLIGHT_LEAD = new RegExp(
  `${LEAD}(?:(?:${FLIGHT_ADJECTIVES.join('|')})\\s+)*` +
    `(?:(${FLIGHT_WORD})(?:\\s+(?:with\\s+)?${AIRLINE})?|(${AIRLINE})(?:\\s+(${FLIGHT_WORD}))?)` +
    `(?:\\s+tickets?\\b)?`,
  'i',
)
const GROUND_LEAD = new RegExp(
  `${LEAD}(${MODE})(?:\\s+(?:(?:a|an|the)\\s+)?${MODE}|\\s+\\d{1,4}[a-z]?\\b)*(?:\\s+tickets?\\b)?`,
  'i',
)
// "JL5", "NH 880", "U2 8341": capitals, never "#AB123", "Gate B12", "A380".
const FLIGHT_NUMBER = '(?:[A-Z]{2}|[A-Z]\\d|\\d[A-Z])\\s?\\d{1,4}\\b'
const NOT_A_DATE = `(?!\\s*(?:\\d|${DATE_WORDS})[a-z]*\\b)`
const FLIGHT_NUMBER_LEAD = new RegExp(
  `^(?:(?:[Bb]ook|[Rr]eserve|[Tt]ake|[Cc]atch)\\s+)?(?:[Ff]light\\s+)?` +
    `(?:\\p{Lu}\\p{L}+\\s+)?${FLIGHT_NUMBER}${NOT_A_DATE}`,
  'u',
)
const LEADING_FLIGHT_NUMBER = new RegExp(
  `^\\s*${FLIGHT_NUMBER}${NOT_A_DATE}`,
  'u',
)
const TRAILING_FLIGHT_NUMBER = new RegExp(`(\\S)\\s+${FLIGHT_NUMBER}$`, 'u')

const ARROW = '\\s*(?:→|->|=>|⇒)\\s*|\\s+>\\s+'
const SEPARATOR = `${ARROW}|\\s*[–—]\\s*|\\s+-\\s+|\\s+[Tt]o\\s+`
const NEXT_LEG = new RegExp(`(?:${SEPARATOR}).*$`)
const IATA_PAIR =
  /^\s*([A-Z]{3})\s*(?:-|–|—|->|→|=>|>|\s[Tt]o\s)\s*([A-Z]{3})\b(.*)$/
// The origin and destination start like names ("Lisbon to Porto", not
// "coffee to go" or "Starbucks to go").
const ROUTE = new RegExp(`^\\s*([^a-z\\s].*?)(?:${SEPARATOR})([^a-z\\s].*)$`)
const BARE_ROUTE = new RegExp(`^(.+?)(${SEPARATOR})(.+)$`)
const TO_FROM = /^\s*to\s+(.+?)\s+from\s+(.+)$/i
const FROM_TO = /^\s*from\s+(.+?)\s+to\s+(.+)$/i
const TO_ONLY = /^\s*to\s+(.+)$/i
const FROM_ONLY = /^\s*from\b/i
const EMPTY = /^\s*$/
const DANGLING_TO = /^\s*to\s*$/i
const LEADING_PUNCTUATION = /^[\s:–—-]+/
const LEADING_ARROW = /^(?:→|->|=>|⇒|>)\s*/
const NAME_START = /^\s*[^a-z\s\d]/
const CURRENCY =
  /^(?:USD|EUR|GBP|JPY|AUD|CAD|CHF|CNY|HKD|NZD|SGD|THB|KRW|INR|MXN|SEK|NOK|DKK)$/
const NAME_WORD = /^[\p{Lu}\p{Lo}\d][\p{L}\p{M}\p{N}'’.&-]*$/u
const CONNECTORS = [
  'de',
  'la',
  'del',
  'of',
  'upon',
  'am',
  'on',
  'le',
  'du',
  'da',
]
// Allowed lowercase in a route only with a mode word ("Hotel to airport taxi").
const PLACE_NOUNS = [
  'airport',
  'hotel',
  'hostel',
  'station',
  'terminal',
  'port',
]
const TRAILING_MODE = new RegExp(
  `\\s+(?:by\\s+)?(${MODE}|${FLIGHT_WORD})(?:\\s+tickets?)?$`,
  'i',
)
const LATER_MODE = new RegExp(`\\s(${MODE})(?=\\s+(?:to|from)\\b)`, 'i')
const PLACE_THEN_TO = /^\s+\p{Lu}[^\s]*(?:\s+\S+)*?\s+[Tt]o\s/u
const TRAILING_BY = /\s+by\s+\S+$/i
// "Dinner - Gion", "Trip to Nara", "Gift to Mum": a label or a person, not
// a place to travel from or to.
const LABELS = [
  'breakfast',
  'brunch',
  'lunch',
  'dinner',
  'drinks',
  'coffee',
  'snacks',
  'trip',
  'visit',
  'road',
  'way',
  'path',
  'day',
  'directions',
  'route',
  'map',
  'guide',
  'intro',
  'welcome',
  'ticket',
  'tickets',
  'gift',
  'gifts',
  'present',
  'postcard',
  'letter',
  'email',
  'flyer',
  'notes',
  'plan',
  'shopping',
  'souvenirs',
  'sights',
  'museum',
  'photos',
  'thanks',
  'cheers',
  'am',
  'pm',
  'morning',
  'afternoon',
  'evening',
  'night',
  'weekend',
  'mum',
  'mom',
  'dad',
  'grandma',
  'grandpa',
  'nan',
  'sis',
  'bro',
]

type Trip = { to: string; from: string | null }

const trip = (to = '', from: string | null = null): Trip => {
  const origin = from?.trim() ?? ''
  return { to: to.trim(), from: origin === '' ? null : origin }
}

const firstLeg = (to: string) => to.replace(NEXT_LEG, '')

const iataTrip = (text: string): Trip | null => {
  const pair = IATA_PAIR.exec(text)
  if (!pair || CURRENCY.test(pair[1] ?? '') || CURRENCY.test(pair[2] ?? '')) {
    return null
  }
  return trip(`${pair[2] ?? ''}${pair[3] ?? ''}`, pair[1] ?? '')
}

const tripAfter = (
  text: string,
): Trip | 'empty' | 'dangling' | 'from' | 'bare' => {
  const rest = text
    .replace(LEADING_PUNCTUATION, '')
    .replace(LEADING_ARROW, 'to ')
  if (EMPTY.test(rest)) {
    return 'empty'
  }
  if (DANGLING_TO.test(rest)) {
    return 'dangling'
  }
  const toFrom = TO_FROM.exec(rest)
  if (toFrom) {
    return trip(toFrom[1], toFrom[2])
  }
  const fromTo = FROM_TO.exec(rest)
  if (fromTo) {
    return trip(fromTo[2], fromTo[1])
  }
  const toOnly = TO_ONLY.exec(rest)
  if (toOnly) {
    return trip(toOnly[1])
  }
  if (FROM_ONLY.test(rest)) {
    return 'from'
  }
  const pair = iataTrip(rest)
  if (pair) {
    return pair
  }
  const route = ROUTE.exec(rest)
  return route ? trip(firstLeg(route[2] ?? ''), route[1]) : 'bare'
}

const flightIntent = ({
  to,
  from,
}: Trip): TransportIntent | { kind: 'none' } => {
  const destination = to.replace(TRAILING_FLIGHT_NUMBER, '$1').trim()
  return destination === ''
    ? { kind: 'none' }
    : { kind: 'flight', to: destination, from }
}

const MODE_PATTERNS = (Object.keys(MODES) as TravelMode[]).flatMap((mode) =>
  MODES[mode].map((word) => ({ mode, pattern: new RegExp(`^${word}$`, 'i') })),
)

const modeOf = (word: string): TravelMode =>
  MODE_PATTERNS.find(({ pattern }) => pattern.test(word))?.mode ?? 'transit'

const isPlaceName = (text: string, { nouns }: { nouns: boolean }) => {
  const words = text.trim().split(/\s+/)
  return (
    words.length <= 3 &&
    !CURRENCY.test(text.trim()) &&
    words.every(
      (word, index) =>
        NAME_WORD.test(word) ||
        (nouns && PLACE_NOUNS.includes(word.toLowerCase())) ||
        (index > 0 && CONNECTORS.includes(word)),
    )
  )
}

// "Lisbon to Porto", "Tokyo – Kyoto", "Porto to Lisbon bus": both ends name
// places; a trailing mode word picks the mode.
const bareRoute = ({
  text,
  isAdmin,
}: {
  text: string
  isAdmin: (text: string) => boolean
}): TransportIntent | null => {
  const route = BARE_ROUTE.exec(text)
  if (!route) {
    return null
  }
  const from = (route[1] ?? '').replace(/^tickets?\s+/i, '')
  const to = firstLeg(route[3] ?? '')
  const mode = TRAILING_MODE.exec(to)
  const destination = mode ? to.slice(0, mode.index) : to
  const nouns = mode !== null || /[→>]/.test(route[2] ?? '')
  const checked = stripWhen(destination).replace(TRAILING_BY, '')
  const labelled = [from, checked].some((side) =>
    side
      .split(/\s+/)
      .some(
        (word, index) =>
          LABELS.includes(word.toLowerCase()) &&
          !(index > 0 && CONNECTORS.includes(word)),
      ),
  )
  const unnamed =
    labelled ||
    stripWhen(from) === '' ||
    isStayName(from) ||
    (isStayName(checked) && !PLACE_NOUNS.includes(checked))
  if (
    !isPlaceName(from, { nouns }) ||
    !isPlaceName(checked, { nouns }) ||
    isAdmin(checked) ||
    (!mode && unnamed)
  ) {
    return null
  }
  const word = mode?.[1] ?? ''
  return new RegExp(`^${FLIGHT_WORD}$`, 'i').test(word)
    ? { kind: 'flight', ...trip(destination, from) }
    : {
        kind: 'ground',
        mode: word === '' ? 'transit' : modeOf(word),
        ...trip(destination, from),
      }
}

const expandAirlineCodes = (text: string) =>
  text.replace(AIRLINE_CODE, (code) => AIRLINE_CODES[code] ?? code)

// Matches a flight/ground lead even with no destination (for "book a taxi").
export const isTransportLead = (text: string): boolean =>
  FLIGHT_LEAD.test(text) || GROUND_LEAD.test(text)

export const transportIntent = (
  line: string,
  { isAdmin = () => false }: { isAdmin?: (text: string) => boolean } = {},
): TransportIntent | { kind: 'none' } | null => {
  const text = expandAirlineCodes(line)
  const flight = FLIGHT_LEAD.exec(text)
  const airline =
    flight !== null && flight[1] === undefined && flight[3] === undefined
  const ambiguous =
    airline &&
    AMBIGUOUS_AIRLINES.includes((flight?.[2] ?? '').trim().toLowerCase())
  const rest = text
    .slice(flight?.[0].length ?? 0)
    .replace(LEADING_FLIGHT_NUMBER, '')
  // "Spirit of Tasmania ferry to Devonport": the mode word wins.
  const laterMode = ambiguous ? LATER_MODE.exec(rest) : null
  if (laterMode) {
    const found = tripAfter(rest.slice(laterMode.index + laterMode[0].length))
    return typeof found === 'object'
      ? { kind: 'ground', mode: modeOf(laterMode[1] ?? ''), ...found }
      : null
  }
  // "Delta Junction to Fairbanks" is a place, not Delta Air Lines.
  if (flight && !(ambiguous && PLACE_THEN_TO.test(rest))) {
    const found = tripAfter(rest)
    if (typeof found === 'object') {
      const named =
        found.from === null || isPlaceName(found.from, { nouns: false })
      return ambiguous && !named ? null : flightIntent(found)
    }
    // An airline alone needs a destination ("Qantas" is no flight).
    if (airline) {
      return null
    }
    // "Fly Tokyo" names a place; "Flight home", "Flight back" don't.
    const to = rest.replace(LEADING_PUNCTUATION, '').trim()
    return found === 'bare' && NAME_START.test(to)
      ? flightIntent(trip(to))
      : { kind: 'none' }
  }

  const ground = GROUND_LEAD.exec(text)
  if (ground) {
    const found = tripAfter(text.slice(ground[0].length))
    // A bare mode word ("Taxi", "book a taxi") falls through to a place search.
    if (found === 'dangling') {
      return { kind: 'none' }
    }
    return typeof found === 'object'
      ? { kind: 'ground', mode: modeOf(ground[1] ?? ''), ...found }
      : null
  }

  const numbered = FLIGHT_NUMBER_LEAD.exec(text)
  if (numbered) {
    const found = tripAfter(text.slice(numbered[0].length))
    return typeof found === 'object' ? flightIntent(found) : null
  }

  // A bare code pair is a flight only on its own ("ATM - USD cash" isn't).
  const pair = IATA_PAIR.exec(text)
  const tail = (pair?.[3] ?? '').replace(TRAILING_FLIGHT_NUMBER, '$1')
  const codes = iataTrip(text)
  if (codes && (stripWhen(tail) === '' || LEADING_FLIGHT_NUMBER.test(tail))) {
    return flightIntent(codes)
  }

  return bareRoute({ text, isAdmin })
}
