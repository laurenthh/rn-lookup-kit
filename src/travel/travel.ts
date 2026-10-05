import { airportCities, airportCity, airportFor } from '../places/airports'
import {
  clauseBookingIntent,
  isPlaceBooking,
  stayPhraseIntent,
  type BookingIntent,
} from './booking'
import {
  bookingDetails,
  partyDetails,
  type BookingDetails,
  type StayDates,
} from './details'
import {
  clauses,
  hasDate,
  hasStayNoise,
  placeQuery,
  stripWhen,
} from '../places/noise'
import { diningBookLink, travelDiningName } from '../dining/dining'
import { foodKey, normalize } from '../core/normalize'
import { isMoneyTransfer, isOffTopic, stayReference } from '../places/offTopic'
import {
  areaMatch,
  isAgodaHotel,
  isBookingHotel,
  isOfficialSite,
} from '../places/stayPages'
import { hasHotelTag, isAirbnb, isStayName } from '../places/stays'
import type { TransportIntent } from '../places/transport'
import type {
  Lookup,
  LookupInput,
  NoteLine,
  ResolveReason,
} from '../core/types'
import { linkPatch, type Resolver } from '../core/resolve'
import { bookingQuery, flightsQuery, partyOrDefault } from '../core/build'
import { nightsBetween } from '../core/stay'
import {
  BOOKING_SEARCH_PREFIX,
  DIRECTIONS_LOOKUP_PREFIX,
  FLIGHTS_LOOKUP_PREFIX,
  isLookupLink,
  MAPS_LOOKUP_PREFIX,
  WEBSITE_LOOKUP_PREFIX,
} from '../core/link'

export const travelKind = (
  item: Pick<LookupInput, 'text' | 'tags'>,
): 'stay' | 'place' =>
  hasHotelTag(item) || (isStayName(item.text) && !isAirbnb(item.text))
    ? 'stay'
    : 'place'

const mapsLink = (text: string) =>
  `${MAPS_LOOKUP_PREFIX}${encodeURIComponent(text)}`

const websiteLink = (text: string) =>
  `${WEBSITE_LOOKUP_PREFIX}${encodeURIComponent(text)}`

const flightsLink = ({
  intent: { to, from },
  adults,
}: {
  intent: Extract<TransportIntent, { kind: 'flight' }>
  adults: number | null
}) =>
  `${FLIGHTS_LOOKUP_PREFIX}${encodeURIComponent(flightsQuery({ from, to, adults }))}`

// The app's own line, matched by shape (one or two sides of " → ", with
// nothing else on the line) AND by content: every captured side must be
// a city this table can actually produce. A regex alone can't check that
// second part, so this is a predicate (`NoteLine.owns` now accepts
// either) — see Findings for the one residual this still can't rule out
// (a user line whose two sides both happen to be airport cities).
const NOTE_SHAPE = /^(?:(.+) → (.+)|→ (.+)|(.+) →)$/

export const AIRPORT_NOTE_OWNS = (line: string): boolean => {
  const match = NOTE_SHAPE.exec(line)
  if (match === null) {
    return false
  }
  const [, both1, both2, toOnly, fromOnly] = match
  const sides =
    both1 !== undefined
      ? [both1, both2]
      : toOnly !== undefined
        ? [toOnly]
        : [fromOnly]
  const cities = airportCities()
  return sides.every((side) => side !== undefined && cities.has(side))
}

// Twintails' one accepted travel note line (21c): a flight written with
// airport codes gets its cities spelled out, because that's information
// the user didn't type. Only for flights — a ground/transit endpoint
// that happens to be a code ("Taxi to KIX") names the airport itself, not
// a city to arrive in, so expanding it would misdescribe the trip.
const airportNoteLine = ({
  to,
  from,
}: Extract<TransportIntent, { kind: 'flight' }>): NoteLine | null => {
  const toCity = airportCity(to)
  const fromCity = airportCity(from)
  if (toCity === null && fromCity === null) {
    return null
  }
  // Both ends resolve to the same city (LHR → LGW): nothing new to say.
  if (toCity !== null && toCity === fromCity) {
    return null
  }
  const text =
    fromCity === null
      ? `→ ${toCity}`
      : toCity === null
        ? `${fromCity} →`
        : `${fromCity} → ${toCity}`
  return { text, owns: AIRPORT_NOTE_OWNS }
}

// Flights keep a trailing date/time (Google's `q=` reads it); directions don't.
const directionsLink = ({
  to,
  from,
  mode,
}: Extract<TransportIntent, { kind: 'ground' }>) =>
  `${DIRECTIONS_LOOKUP_PREFIX}${encodeURIComponent(stripWhen(to) || to)}&travelmode=${mode}` +
  (from === null
    ? ''
    : `&origin=${encodeURIComponent(stripWhen(from) || from)}`)

export type TravelIntent =
  BookingIntent | { kind: 'stay' | 'place' } | { kind: 'dine'; name: string }

// Foods that are also trip destinations; airport cities count too, except
// Salmon (Idaho), which a shopping list means as the fish.
const FOOD_PLACES = new Set([
  'turkey',
  'champagne',
  'dijon',
  'cognac',
  'tequila',
  'prosecco',
])
let cityKeys: ReadonlySet<string> | null = null

const isFoodPlace = (clause: string) => {
  const key = normalize(clause.trim())
  cityKeys ??= new Set([...airportCities()].map(normalize))
  return FOOD_PLACES.has(key) || (key !== 'salmon' && cityKeys.has(key))
}

// Dishes and drinks a trip goes out for: "Ramen" means "find ramen".
const EAT_OUT = [
  'ramen',
  'udon',
  'sushi',
  'sashimi',
  'pizza',
  'tacos',
  'burrito',
  'burger',
  'hamburger',
  'cheeseburger',
  'hot dog',
  'fish and chips',
  'pho',
  'banh mi',
  'pad thai',
  'curry',
  'kebab',
  'doner',
  'falafel',
  'shawarma',
  'tapas',
  'pintxos',
  'paella',
  'dim sum',
  'dumplings',
  'gyoza',
  'bao',
  'oysters',
  'lobster',
  'lobster roll',
  'bratwurst',
  'pretzel',
  'lasagna',
  'pastrami',
  'bagel',
  'bbq',
  'barbecue',
  'fondue',
  'poutine',
  'gelato',
  'ice cream',
  'crepes',
  'waffles',
  'churros',
  'croissant',
  'pastel de nata',
  'doughnuts',
  'donuts',
  'macarons',
  'mochi',
  'baklava',
  'cinnamon buns',
  'coffee',
  'espresso',
  'cappuccino',
  'hot chocolate',
  'latte',
  'flat white',
  'tea',
  'afternoon tea',
  'matcha',
  'chai',
  'bubble tea',
  'boba',
  'beer',
  'craft beer',
  'cider',
  'wine',
  'sake',
  'mezcal',
  'cocktails',
]
let eatOutKeys: ReadonlySet<string> | null = null

// A count doesn't change the dish: "2 beers" is still beer.
const dishKey = (text: string) =>
  foodKey(text)
    .split(' ')
    .filter((token) => !/\d/.test(token))
    .join(' ')

const isEatOut = (clause: string) =>
  (eatOutKeys ??= new Set(EAT_OUT.map(dishKey))).has(dishKey(clause))

// Staples the food data has no bare entry for.
const STAPLES = new Set([
  'chicken',
  'beef',
  'pork',
  'lamb',
  'pepper',
  'cream',
  'biscuit',
  'muesli',
  'coffee bean',
  'ground coffee',
  'tea bag',
])

export type IsGrocery = (text: string) => boolean

// A grocery line ("2 bananas", "Oat milk") is shopping, not a Maps search.
// The whole line is checked too: "Fish and chips" splits into clauses.
const isJustFood = ({
  clause,
  line,
  isGrocery,
}: {
  clause: string
  line: string
  isGrocery: IsGrocery
}) =>
  (STAPLES.has(dishKey(clause)) || isGrocery(clause)) &&
  !isEatOut(clause) &&
  !isEatOut(line) &&
  !isFoodPlace(clause)

const clauseIntent = ({
  text,
  tags,
  noisy,
  line,
  isGrocery,
}: Pick<LookupInput, 'text' | 'tags'> & {
  noisy: () => boolean
  line: string
  isGrocery: IsGrocery
}): TravelIntent => {
  const booking = clauseBookingIntent({ text, tags })
  if (booking !== null) {
    return booking
  }
  if (isPlaceBooking(text)) {
    return { kind: 'place' }
  }
  if (isOffTopic(text)) {
    return { kind: 'none' }
  }
  const reference = stayReference(text)
  if (reference !== null) {
    return { kind: reference }
  }
  const phrase = stayPhraseIntent({ clause: text, noisy })
  if (phrase !== null) {
    return phrase
  }
  const kind = travelKind({ text, tags })
  return kind === 'place' && isJustFood({ clause: text, line, isGrocery })
    ? { kind: 'none' }
    : { kind }
}

const ACTIONABLE: TravelIntent['kind'][] = [
  'flight',
  'ground',
  'book',
  'checkin',
]
// Classification only needs the start of a pasted wall of text.
const MAX_LENGTH = 300

// The first clause wins, unless it's admin ("Check out 11am, taxi to KIX").
// `isGrocery` adds to the staples above; without food data pass () => false.
export const travelIntent = (
  { text: full, tags }: Pick<LookupInput, 'text' | 'tags'>,
  { isGrocery }: { isGrocery: IsGrocery },
): TravelIntent => {
  const text = full.slice(0, MAX_LENGTH)
  if (isMoneyTransfer(text)) {
    return { kind: 'none' }
  }
  const [first = '', ...rest] = clauses(text)
  // Only a verbless stay line needs this (chrono runs again).
  const noisy = () => hasStayNoise(text) || hasDate(first)
  const intent = clauseIntent({
    text: first,
    tags,
    noisy,
    line: text,
    isGrocery,
  })
  // "Book table at Narisawa": a table, not a hotel or a Maps search.
  if (intent.kind === 'none' || intent.kind === 'place') {
    const name = travelDiningName(text)
    if (name !== null) {
      return { kind: 'dine', name }
    }
  }
  if (intent.kind !== 'none') {
    return intent
  }
  const later = rest
    .map((clause) => clauseBookingIntent({ text: clause, tags }))
    .find((found) => found !== null && ACTIONABLE.includes(found.kind))
  return later ?? intent
}

// Night ranges and booking references aren't part of the stay's name.
const NIGHTS_LEAD = /^nights?\s*\d+(?:\s*[-–]\s*\d+)?\s*[:.]\s*/i
const BOOKING_REFERENCE =
  /\s*[-–—]?\s*(?:\b(?:conf(?:irmation)?|ref(?:erence)?|booking|res(?:ervation)?)\b\.?\s*(?:no\.?|number|#|:)?\s*|#)[a-z0-9-]*\d[a-z0-9-]*\b/gi

// The same start of the line `travelIntent` classified.
const lookupLine = (text: string) =>
  text
    .slice(0, MAX_LENGTH)
    .trim()
    .replace(NIGHTS_LEAD, '')
    .replace(BOOKING_REFERENCE, '')

const stayName = (text: string) => stripWhen(clauses(lookupLine(text))[0] ?? '')

const LABELS: Record<TravelIntent['kind'], string> = {
  checkin: 'Find website',
  book: 'Find hotels',
  flight: 'Find flights',
  ground: 'Get directions',
  stay: 'Find website',
  place: 'Find on map',
  dine: 'Book a table',
  none: 'Look up details',
}

const officialSite = async (name: string, resolver: Resolver) => {
  const { url, reason } = await resolver.resolveFirstResult(name)
  return url !== null && isOfficialSite({ url, name })
    ? linkPatch(url)
    : linkPatch(websiteLink(name), reason)
}

type Stay = BookingDetails & { dates: StayDates }

const stayQuery = ({ dates, ...party }: Stay) =>
  bookingQuery({ ...dates, ...party })

const agodaQuery = (stay: Stay) => {
  const { adults, children, rooms } = partyOrDefault(stay)
  const { checkIn, checkOut } = stay.dates
  return `checkIn=${checkIn}&los=${nightsBetween(checkIn, checkOut)}&rooms=${rooms}&adults=${adults}&children=${children}`
}

// A resolved page that already has a query stays as it is (a user link).
const withQuery = (url: string, query: string | null) =>
  query === null || /[?#]/.test(url) ? url : `${url}?${query}`

const stayPage = async ({
  name,
  inCity,
  stay,
  resolver,
}: {
  name: string
  inCity: boolean
  stay: Stay | null
  resolver: Resolver
}) => {
  const params = stay === null ? null : stayQuery(stay)
  const query = `site:booking.com ${name} hotel`
  const { url: booking, reason } = await resolver.resolveFirstResult(query)
  const area = booking === null ? null : areaMatch({ url: booking, name })
  const fits =
    area === 'exact' ||
    (inCity && area === 'partial') ||
    (booking !== null && isBookingHotel({ url: booking, name }))
  if (booking !== null && fits) {
    return linkPatch(withQuery(booking, params))
  }

  // An area page near the name beats a guess at another site's hotel.
  let agodaReason: ResolveReason | undefined
  if (!inCity && area === null) {
    const agoda = await resolver.resolveFirstResult(
      `site:agoda.com ${name} hotel`,
    )
    if (agoda.url !== null && isAgodaHotel({ url: agoda.url, name })) {
      return linkPatch(
        withQuery(agoda.url, stay === null ? null : agodaQuery(stay)),
        reason,
      )
    }
    agodaReason = agoda.reason
  }

  // A named hotel Booking.com doesn't list: its city's hotels instead.
  if (booking !== null && area !== null) {
    return linkPatch(withQuery(booking, params))
  }
  // With dates, Booking.com's own search beats a search engine's guess.
  return linkPatch(
    params === null
      ? websiteLink(query)
      : `${BOOKING_SEARCH_PREFIX}${encodeURIComponent(name)}&${params}`,
    reason,
    agodaReason,
  )
}

export const createTravelLookup = ({
  resolver,
  isGrocery,
  now: clock = () => new Date(),
}: {
  resolver: Resolver
  isGrocery: IsGrocery
  now?: () => Date
}): Lookup => ({
  id: 'travel',
  tags: ['travel'],
  label: (item) => LABELS[travelIntent(item, { isGrocery }).kind],
  applies: (item) =>
    (item.link === null || isLookupLink(item.link)) &&
    travelIntent(item, { isGrocery }).kind !== 'none',
  owns: AIRPORT_NOTE_OWNS,
  // `now` is the tap time: relative dates resolve against it.
  run: async (item, now = clock()) => {
    const text = item.text.trim()
    const intent = travelIntent(item, { isGrocery })

    if (text === '' || intent.kind === 'none') {
      return 'no-match'
    }

    switch (intent.kind) {
      case 'checkin':
        return officialSite(intent.name, resolver)
      case 'book': {
        const details = bookingDetails(lookupLine(text), now)
        const stay =
          details?.dates == null ? null : { ...details, dates: details.dates }
        return stayPage({ ...intent, stay, resolver })
      }
      case 'flight': {
        const { adults } = partyDetails(lookupLine(text))
        const link = flightsLink({ intent, adults })
        const noteLine = airportNoteLine(intent)
        return noteLine === null ? { link } : { link, noteLine }
      }
      case 'ground':
        return { link: directionsLink(intent) }
      case 'stay': {
        const name = stayName(text)
        return name === ''
          ? { link: websiteLink(text) }
          : officialSite(name, resolver)
      }
      case 'place':
        return { link: mapsLink(placeQuery(text)) }
      case 'dine':
        return diningBookLink(intent.name, resolver)
    }
  },
})
