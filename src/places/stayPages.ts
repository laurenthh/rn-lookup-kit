import { airportCities } from './airports'
import {
  ACCOMMODATION_PHRASES,
  CHAIN_PHRASES,
  LODGING_PHRASES,
  tokenize,
} from './stays'
import { bookingPage, urlParts } from '../core/link'
import { normalize } from '../core/normalize'

const INSIGNIFICANT = new Set([
  ...ACCOMMODATION_PHRASES.flat(),
  'hotels',
  'a',
  'an',
  'the',
  'and',
  'of',
  'at',
  'in',
  'near',
  'for',
  'room',
])

// Booking, review and social sites: a hit there is never the stay's own site.
const DENIED_SITES = [
  'agoda',
  'airbnb',
  'booking',
  'cntraveler',
  'designhotels',
  'expedia',
  'facebook',
  'google',
  'hostelworld',
  'hotels',
  'hotelscombined',
  'instagram',
  'kayak',
  'lonelyplanet',
  'mrandmrssmith',
  'priceline',
  'reddit',
  'tablethotels',
  'telegraph',
  'tiktok',
  'timeout',
  'travelandleisure',
  'trip',
  'tripadvisor',
  'trivago',
  'twitter',
  'wikipedia',
  'wikivoyage',
  'x',
  'yelp',
  'youtu',
  'youtube',
]
const DENIED_HOST = new RegExp(
  `(^|\\.)(${DENIED_SITES.join('|')})(\\.[a-z]{2,3}){1,2}$`,
)

// Part of a hotel's name ("Villa Cora"), but never its brand.
const LODGING = new Set(LODGING_PHRASES.flat())
const CHAIN_WORDS = new Set(CHAIN_PHRASES.flat())

const BRAND_STOPS = new Set([
  ...LODGING,
  ...CHAIN_WORDS,
  // Hotel-name filler
  'boutique',
  'budget',
  'casa',
  'collection',
  'grand',
  'hostal',
  'house',
  'international',
  'new',
  'old',
  'palace',
  'palazzo',
  'plaza',
  'plus',
  'pousada',
  'premier',
  'royal',
  'spa',
  // Where it is, not what it is
  'airport',
  'bay',
  'beach',
  'center',
  'central',
  'centre',
  'city',
  'downtown',
  'garden',
  'gardens',
  'market',
  'park',
  'square',
  'station',
  'tower',
  'towers',
  'view',
])
const BRAND_MIN_LENGTH = 4
const CITY_IN_HOST_MIN_LENGTH = 5

// Hangul is matched decomposed: `tokenize` normalises to NFD (Jamo).
const CJK_WORD =
  /^[\u1100-\u11ff\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]+$/

const nameWords = (name: string) =>
  tokenize(name).filter((token) => !INSIGNIFICANT.has(token))

const isCjkName = (name: string) => {
  const words = tokenize(name)
  return words.length > 0 && words.every((word) => CJK_WORD.test(word))
}

// Destinations the airport table can't name (no airport of their own).
const NO_AIRPORT = ['amalfi', 'hakone', 'kamakura', 'kyoto', 'nara', 'siena']
// Same city, two languages (build-airports.ts' EXONYM; scripts share nothing).
const EXONYMS: Record<string, string> = {
  bruxelles: 'brussels',
  firenze: 'florence',
  goteborg: 'gothenburg',
  hannover: 'hanover',
  koln: 'cologne',
  lisboa: 'lisbon',
  milano: 'milan',
  munchen: 'munich',
  napoli: 'naples',
  praha: 'prague',
  roma: 'rome',
  torino: 'turin',
  venezia: 'venice',
  warszawa: 'warsaw',
  wien: 'vienna',
}
const cityKey = (word: string) => EXONYMS[word] ?? word

// City names and the distinctive words of longer ones ("york"); a word many
// city names share ("city", "lake", "grand") isn't a place by itself.
let cityWords: { places: Set<string>; wholeNames: string[] } | null = null
const cityTables = () => {
  if (cityWords !== null) {
    return cityWords
  }
  const whole = new Set<string>(NO_AIRPORT)
  const shared = new Map<string, number>()
  for (const city of airportCities()) {
    const tokens = tokenize(city)
    if (tokens.length === 1) {
      whole.add(tokens[0] ?? '')
    } else {
      for (const token of new Set(tokens)) {
        shared.set(token, (shared.get(token) ?? 0) + 1)
      }
    }
  }
  const distinctive = [...shared]
    .filter(([token, count]) => count === 1 && token.length >= 4)
    .map(([token]) => token)
  const usable = (word: string) => word !== '' && !BRAND_STOPS.has(word)
  cityWords = {
    places: new Set(
      [...whole, ...distinctive, ...Object.keys(EXONYMS)].filter(usable),
    ),
    wholeNames: [...whole].filter(
      (word) => usable(word) && word.length >= CITY_IN_HOST_MIN_LENGTH,
    ),
  }
  return cityWords
}
const isPlace = (word: string) => cityTables().places.has(word)

// Most name words, and at least one longer than a letter.
const isMajority = ({ hits, words }: { hits: string[]; words: string[] }) =>
  hits.length * 2 > words.length && hits.some((word) => word.length >= 2)

// One of the name's own words when it has any: a chain and a city alone are
// another property ("Hilton Garden Inn Osaka" isn't hilton-osaka).
const hitsOwnWord = ({ hits, words }: { hits: string[]; words: string[] }) => {
  const own = words.filter((word) => !CHAIN_WORDS.has(word) && !isPlace(word))
  return own.length === 0 || own.some((word) => hits.includes(word))
}

// The word that names this hotel and no other ("Sacher" in "Hotel Sacher
// Wien"): past stay, chain and generic words and the place, which is a
// known city or else the last word. Its address may translate the place.
const brandWord = (words: string[]) => {
  const named = words.filter((word) => !BRAND_STOPS.has(word))
  const unplaced = named.filter((word) => !isPlace(word))
  const candidates =
    unplaced.length === named.length && named.length > 1
      ? named.slice(0, -1)
      : unplaced
  // A lone last word after a chain or a city is the neighbourhood: "The
  // Hoxton Shoreditch", "Ibis Budget Osaka Umeda".
  if (
    candidates.length === 1 &&
    words.length > 1 &&
    candidates[0] === words[words.length - 1]
  ) {
    return null
  }
  const longest = candidates.reduce(
    (best, word) => (word.length > best.length ? word : best),
    '',
  )
  return longest.length >= BRAND_MIN_LENGTH ? longest : null
}

const SPELLED_MIN_LENGTH = 8
const SPELLED_MIN_WORDS = 3

// The whole name run together is a host label: "Inn at the Market, Seattle"
// at innatthemarket.com.
const spellsName = ({ labels, name }: { labels: string[]; name: string }) => {
  const tokens = tokenize(name)
  while (tokens.length > 1 && isPlace(tokens[tokens.length - 1] ?? '')) {
    tokens.pop()
  }
  const spelled = tokens.join('')
  return (
    tokens.length >= SPELLED_MIN_WORDS &&
    spelled.length >= SPELLED_MIN_LENGTH &&
    labels.includes(spelled)
  )
}

const PORTAL = /^(?:visit|go|discover)?-?(.+?)-?(?:info|tourism|travel)?$/

const SECOND_LEVEL = new Set([
  'ac',
  'co',
  'com',
  'go',
  'ne',
  'net',
  'or',
  'org',
])

// The name the site registered: "barcelona" in www.barcelona.com, "hyatt" in
// tokyo.park.hyatt.com, "hotelx" in hotelx.tokyo (a city TLD is no portal).
const siteLabel = (labels: string[]) => {
  const rest = labels.slice(0, -1)
  const last = rest[rest.length - 1] ?? ''
  return rest.length > 1 && SECOND_LEVEL.has(last)
    ? (rest[rest.length - 2] ?? '')
    : last
}

// barcelona.cat, osaka-info.jp, visitlondon.com: the city's own site.
const isCityPortal = ({
  labels,
  cities,
}: {
  labels: string[]
  cities: string[]
}) => {
  const city = PORTAL.exec(siteLabel(labels))?.[1]
  return city !== undefined && cities.includes(city)
}

// Another city, and not the name's, in the address is another property:
// hyatt-regency-osaka for "Hyatt Regency Tokyo".
const namesOtherCity = ({
  labels,
  urlWords,
  cities,
}: {
  labels: string[]
  urlWords: string[]
  cities: string[]
}) => {
  const ours = cities.map(cityKey)
  const other = (word: string) =>
    word.length >= 4 && isPlace(word) && !ours.includes(cityKey(word))
  return (
    urlWords.some(other) ||
    labels.some((label) =>
      cityTables().wholeNames.some(
        (city) => label.includes(city) && !ours.includes(cityKey(city)),
      ),
    )
  )
}

const slugMatches = ({
  slug,
  name,
  endExtra,
}: {
  slug: string
  name: string
  endExtra: boolean
}) => {
  const slugWords = slug.split('-')
  const words = nameWords(name)
  const hits = words.filter((word) => slugWords.includes(word))
  if (!isMajority({ hits, words })) {
    return false
  }
  // Another hotel's words: "best-western-plus-bryce-canyon-grand-hotel" for
  // "Best Western Grand Canyon". Booking.com garbles accented names
  // ("atha-c-na-c-e"), so those are only held to the majority.
  const significant = slugWords.filter(
    (word) =>
      word.length >= 3 &&
      !/\d/.test(word) &&
      !INSIGNIFICANT.has(word) &&
      !LODGING.has(word),
  )
  const extras = significant.filter((word) => !words.includes(word))
  if (normalize(name) !== name.toLowerCase()) {
    return true
  }
  if (!hitsOwnWord({ hits, words })) {
    return false
  }
  if (extras.length === 0) {
    return true
  }
  // A whole-name match may carry one more word at an end: "generator-
  // berlin-mitte", "grand-villa-cora" (Booking.com only).
  const [extra] = extras
  return (
    endExtra &&
    extras.length === 1 &&
    hits.length === words.length &&
    (significant[0] === extra || significant[significant.length - 1] === extra)
  )
}

// One letter apart: romanisations differ ("Namba", "nanba").
const isOneEditApart = (a: string, b: string) => {
  if (Math.abs(a.length - b.length) > 1) {
    return false
  }
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  let edits = 0
  for (let i = 0, j = 0; j < long.length; j += 1) {
    if (short[i] === long[j]) {
      i += 1
    } else {
      edits += 1
      if (edits > 1) {
        return false
      }
      if (short.length === long.length) {
        i += 1
      }
    }
  }
  return true
}

// One letter off a word that isn't a known city, same first letter: Namba is
// nanba, but Geneva isn't genova and Essen isn't assen. Exonyms match.
const isLooseMatch = (word: string, slugWord: string) =>
  word === slugWord ||
  cityKey(word) === cityKey(slugWord) ||
  (!isPlace(word) &&
    word[0] === slugWord[0] &&
    word.length >= 5 &&
    slugWord.length >= 5 &&
    isOneEditApart(word, slugWord))

const sharesWord = ({ slug, name }: { slug: string; name: string }) => {
  const slugWords = slug.split('-')
  return nameWords(name).some(
    (word) =>
      word.length >= 2 &&
      slugWords.some((slugWord) => isLooseMatch(word, slugWord)),
  )
}

// A guide still says so in its host past the name's words: hiltontravelguide
// for "Hilton Tokyo", but not travelodge for "Travelodge London".
const GUIDE_LABEL = /guide|travel/
const isGuide = ({ labels, words }: { labels: string[]; words: string[] }) =>
  labels.some((label) =>
    GUIDE_LABEL.test(
      words
        .filter((word) => word.length >= BRAND_MIN_LENGTH)
        .reduce((rest, word) => rest.replaceAll(word, '-'), label),
    ),
  )

export const isOfficialSite = ({
  url,
  name,
}: {
  url: string
  name: string
}) => {
  const parts = urlParts(url)
  if (parts === null || DENIED_HOST.test(parts.host)) {
    return false
  }
  const labels = parts.host.split('.')
  const haystack = normalize(`${parts.host}${parts.path}`)
  const urlWords = haystack.split(/[^\p{L}\p{N}]+/u)
  const words = nameWords(name)
  const cities = words.filter(isPlace)
  const placed = cities.some(
    (city) =>
      urlWords.some((word) => cityKey(word) === cityKey(city)) ||
      labels.some((label) => label.includes(city)),
  )
  if (
    isCityPortal({ labels, cities }) ||
    isGuide({ labels, words }) ||
    (cities.length > 0 &&
      !placed &&
      namesOtherCity({ labels, urlWords, cities }))
  ) {
    return false
  }
  // A one-letter word ("W") only counts as a whole word of the address.
  const hits = words.filter((word) =>
    word.length >= 2 ? haystack.includes(word) : urlWords.includes(word),
  )
  // The brand alone must keep the name's city: granvia-kyoto isn't Granvia
  // Osaka. In the path it is a whole word; a host may run words together.
  const brand = brandWord(words)
  const branded =
    brand !== null &&
    (labels.some((label) => label.includes(brand)) ||
      urlWords.includes(brand)) &&
    (cities.length === 0 || placed)
  return (
    (isMajority({ hits, words }) && hitsOwnWord({ hits, words })) ||
    branded ||
    spellsName({ labels, name })
  )
}

export const isBookingHotel = ({
  url,
  name,
}: {
  url: string
  name: string
}) => {
  const page = bookingPage(url)
  return (
    page?.site === 'booking' &&
    page.type === 'hotel' &&
    slugMatches({ slug: page.slug, name, endExtra: true })
  )
}

// How a Booking.com city/area page fits the name: the whole name or one
// word. A CJK name can't match a romanised slug: the site filter decides.
export const areaMatch = ({
  url,
  name,
}: {
  url: string
  name: string
}): 'exact' | 'partial' | null => {
  const page = bookingPage(url)
  if (page?.site !== 'booking' || page.type !== 'area') {
    return null
  }
  if (page.slug === tokenize(name).join('-')) {
    return 'exact'
  }
  return isCjkName(name) || sharesWord({ slug: page.slug, name })
    ? 'partial'
    : null
}

export const isAgodaHotel = ({ url, name }: { url: string; name: string }) => {
  const page = bookingPage(url)
  // The Decision: no extra slug words at all on Agoda.
  return (
    page?.site === 'agoda' &&
    slugMatches({ slug: page.slug, name, endExtra: false })
  )
}
