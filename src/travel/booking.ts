import type { LookupInput } from '../core/types'
import { clauses, stripWhen } from '../places/noise'
import { isAdmin } from '../places/offTopic'
import {
  ACCOMMODATION_PHRASES,
  hasHotelTag,
  isAirbnb,
  isStayName,
  LODGING_PHRASES,
} from '../places/stays'
import {
  isTransportLead,
  transportIntent,
  type TransportIntent,
} from '../places/transport'
import { normalize } from '../core/normalize'

export type BookingIntent =
  | { kind: 'checkin'; name: string }
  | { kind: 'book'; name: string; inCity: boolean }
  | TransportIntent
  | { kind: 'none' }

const CHECK_IN =
  /^(?:early\s+|late\s+)?check[\s-]?in(?:\s+request)?(?=to\b|[\s:@,-]|$)/i
const CHECK_IN_JOIN = /^(?:\s*(?:to|at|into)\b|\s*[:@])[\s:@,-]*/i
const NAME_START = /^[\p{Lu}\p{Lo}]/u
const FLIGHT_WORD = /\bflights?\b/i
const FLIGHT_NUMBER = /\b[A-Z]{2}\s?\d{1,4}\b/
// "book" commits to a stay; "get/need/find…" only when a stay is named.
const BOOK = /^(?:re)?(?:book|reserve)\b/i
const SOFT_BOOK =
  /^(?:get|need|find|sort(?:\s+out)?|arrange|organi[sz]e|look\s+for)\b/i
// "Book dinner at the Hilton" is about the restaurant, not a stay.
const PLACE_BOOKING_LEAD =
  /^(?:re)?(?:book|reserve)\s+(?:a\s+|the\s+)?(?:dinner|lunch|breakfast|brunch|table|tour|tickets?|restaurant|spa)\b/i
const MEAL_LEAD = /^(?:dinner|lunch|breakfast|brunch|drinks)\b/i
const TICKETS_END = /\btickets?$/i
const LABEL_LEAD =
  /^(?:directions|map|guide|day\s+trip|trip|visit)\s+(?:to|of)\b/i
// "Book hotel for conference", "Find a hotel near the station": a reason or
// an unnamed spot, not a place to search.
const PURPOSES = [
  'conference',
  'work',
  'wedding',
  'meeting',
  'trip',
  'event',
  'station',
  'airport',
  'beach',
  'centre',
  'center',
  'city',
  'town',
  'venue',
]
// "Hotel or hostel in Lisbon", "Osaka or Kyoto hotel": the first choice.
const OR_ALTERNATIVE = /\s+or\s+[\p{L}\p{M}]+(?=\s|$)/u
// "Emirates Palace hotel" names a hotel, not a city.
const HOTEL_NAME_WORDS = [
  'palace',
  'plaza',
  'grand',
  'manor',
  'castle',
  'mansion',
  'tower',
  'towers',
  'court',
]
const PLACE_BOOKINGS =
  /\b(?:restaurants?|dinner|lunch|brunch|table|tours?|tickets?|museum|campsite)\b/i
const WORD = /[\p{L}\p{M}\p{N}&]+/gu
const PREPOSITIONS = ['in', 'near', 'at']
const FILLERS = [
  'a',
  'an',
  'the',
  'my',
  'our',
  'room',
  'rooms',
  'bed',
  'beds',
  'dorm',
  'block',
  'for',
  'airbnb',
  'booking',
  'reservation',
]
// Not a name: "Accommodation Bali", "Hostels Bangkok", "Hotel booking Rome".
const GENERIC_STAYS = new Set([
  'accommodation',
  'place',
  'where',
  'somewhere',
  'hotels',
  'hostels',
  'motels',
  'resorts',
  'apartments',
  'villas',
])
const CHAIN_STAY_WORDS = new Set(['premier inn', 'holiday inn'])
// "Hotel: Osaka", "Hotel – Osaka": a label, not a name.
const LABEL = /^\s*[\p{L}\p{M}&]+\s*[:–—-]\s+/u
const LABEL_END = /\s[:–—-]\s*[\p{L}\p{M}&]+$/u
const BOOKING_WORDS = /\b(?:booking|reservation)\b/i
const PLACE_WORD = /^[\p{Lu}\p{Lo}]/u
const NOT_IN_PLACE = ['to', 'from', 'at', 'near', 'in', 'by', 'for', 'check']
const STAY_ADJECTIVES = new Set([
  'cheap',
  'budget',
  'nice',
  'good',
  'small',
  'boutique',
  'luxury',
  'beach',
  'central',
  'family',
  'cosy',
  'cozy',
  'quiet',
  'airport',
  'business',
])

type Phrase = { length: number; lodging: boolean }

const isCapitalised = (word = '') => NAME_START.test(word)

const phraseAt = ({
  words,
  normalized,
  index,
}: {
  words: string[]
  normalized: string[]
  index: number
}): Phrase | null => {
  const matches = (phrase: string[]) =>
    phrase.every((token, offset) => normalized[index + offset] === token)
  const accommodation = ACCOMMODATION_PHRASES.find(matches)
  // "Premier Inn Leeds": the stay word is part of the chain's name.
  if (
    accommodation &&
    CHAIN_STAY_WORDS.has(`${normalized[index - 1]} ${normalized[index]}`)
  ) {
    return null
  }
  if (accommodation) {
    return { length: accommodation.length, lodging: false }
  }
  const lodging = LODGING_PHRASES.find(matches)
  if (!lodging) {
    return null
  }
  // "Villa Cora" is a name; "villa in Algarve" is a kind of stay.
  const next = words[index + lodging.length]
  const generic = GENERIC_STAYS.has(normalized[index] ?? '')
  return !generic && isCapitalised(words[index]) && isCapitalised(next)
    ? null
    : { length: lodging.length, lodging: true }
}

// Drops stay words and filler; `tail` follows a leading in/near/at.
const stayWords = (words: string[]) => {
  const normalized = words.map(normalize)
  const kept: string[] = []
  let tail: { words: string[]; preposition: string } | null = null
  let index = 0

  while (index < words.length) {
    const phrase = phraseAt({ words, normalized, index })
    if (phrase) {
      index += phrase.length
      continue
    }
    const word = words[index] ?? ''
    const key = normalized[index] ?? ''
    if (tail === null && kept.length === 0 && PREPOSITIONS.includes(key)) {
      tail = { words: words.slice(index + 1), preposition: key }
    }
    if (!FILLERS.includes(key) && !PREPOSITIONS.includes(key)) {
      kept.push(word)
    }
    index += 1
  }

  return { kept, tail }
}

const checkInName = (text: string): string | 'none' | null => {
  const lead = CHECK_IN.exec(text)
  if (!lead) {
    return null
  }
  const rest = text.slice(lead[0].length)
  const join = CHECK_IN_JOIN.exec(rest)
  if (!join && !NAME_START.test(rest.trim())) {
    return null
  }
  const name = stripWhen(rest.slice(join ? join[0].length : 0))
  const { kept } = stayWords(name.match(WORD) ?? [])
  const flight = FLIGHT_WORD.test(name) || FLIGHT_NUMBER.test(name)
  return kept.length === 0 || flight ? 'none' : name
}

const firstClause = (text: string) => clauses(text)[0] ?? ''

export const isPlaceBooking = (clause: string) =>
  PLACE_BOOKING_LEAD.test(clause) ||
  MEAL_LEAD.test(clause) ||
  LABEL_LEAD.test(clause) ||
  TICKETS_END.test(clause)

// "Book hotel, Kyoto": a place after only stay words is where to stay.
const withCommaPlace = (rest: string) => {
  const [before = '', ...after] = rest.split(',')
  return after.length > 0 &&
    stayWords(before.match(WORD) ?? []).kept.length === 0
    ? `${before} in ${after.join(',')}`
    : rest
}

// `text` is one cleaned clause (see `clauses`).
export const clauseBookingIntent = ({
  text,
  tags,
}: Pick<LookupInput, 'text' | 'tags'>): BookingIntent | null => {
  // Checked first so transport wins over stay/check-in/book-stay.
  const transport = transportIntent(text, { isAdmin })
  if (transport !== null) {
    return transport
  }

  const checkIn = checkInName(text)
  if (checkIn !== null) {
    return checkIn === 'none'
      ? { kind: 'none' }
      : { kind: 'checkin', name: checkIn }
  }

  const verb = BOOK.exec(text) ?? SOFT_BOOK.exec(text)
  if (!verb) {
    return null
  }
  // A bare "book a taxi" isn't a hotel search either.
  if (isTransportLead(text)) {
    return null
  }
  const committed = BOOK.test(text)
  const stay = hasHotelTag({ tags }) || isStayName(text)
  if (
    isAirbnb(text) ||
    PLACE_BOOKING_LEAD.test(text) ||
    (!stay && PLACE_BOOKINGS.test(text))
  ) {
    return null
  }
  if (!stay) {
    return committed ? { kind: 'none' } : null
  }

  const rest = withCommaPlace(
    stripWhen(text.slice(verb[0].length)).replace(OR_ALTERNATIVE, ''),
  )
  const { kept, tail } = stayWords(rest.match(WORD) ?? [])
  const reason = kept.every((word) => PURPOSES.includes(normalize(word)))
  if (kept.length === 0 || reason) {
    return { kind: 'none' }
  }

  return {
    kind: 'book',
    name: kept.join(' '),
    // "near X" and "in X" name an area; "at the Hilton Osaka" a hotel.
    inCity:
      tail !== null &&
      (tail.preposition !== 'at' || !isStayName(tail.words.join(' '))),
  }
}

export const bookingIntent = (
  item: Pick<LookupInput, 'text' | 'tags'>,
): BookingIntent | null =>
  clauseBookingIntent({ text: firstClause(item.text), tags: item.tags })

// "Osaka", "京都", "Lisbon": up to 3 capitalised words, no preposition.
const looksLikePlace = (words: string[]) =>
  words.length > 0 &&
  words.length <= 3 &&
  words.every(
    (word) => PLACE_WORD.test(word) && !NOT_IN_PLACE.includes(normalize(word)),
  )

// Verbless stay phrases in one cleaned clause: "Osaka hotel", "Hotel near
// Javits Center", "hostel bed Lisbon 3 nights". A named stay ("Hotel Casa
// Fuster") is null; a stay word alone ("Hotel", "Hotel ✓") is none.
export const stayPhraseIntent = ({
  clause,
  noisy,
}: {
  clause: string
  noisy: () => boolean
}): BookingIntent | null => {
  if (isAirbnb(clause) || !isStayName(clause)) {
    return null
  }
  const words = stripWhen(clause).replace(OR_ALTERNATIVE, '').match(WORD) ?? []
  const normalized = words.map(normalize)
  const index = normalized.findIndex(
    (_, at) => phraseAt({ words, normalized, index: at }) !== null,
  )
  const phrase = index === -1 ? null : phraseAt({ words, normalized, index })
  if (phrase === null) {
    return null
  }

  const meaningful = (list: string[]) =>
    list.filter((word) => !FILLERS.includes(normalize(word)))
  const before = meaningful(words.slice(0, index))
  const after = meaningful(words.slice(index + phrase.length))
  const generic =
    !isCapitalised(words[index]) ||
    GENERIC_STAYS.has(normalized[index] ?? '') ||
    BOOKING_WORDS.test(clause) ||
    (index === 0 && LABEL.test(clause)) ||
    (index === words.length - phrase.length && LABEL_END.test(clause))
  if (before.length === 0 && after.length === 0) {
    return { kind: 'none' }
  }
  const book = (name: string[]): BookingIntent | null => {
    const { kept } = stayWords(name)
    if (kept.length === 0) {
      return null
    }
    // "Airport – Hotel": which airport?
    return kept.every((word) => PURPOSES.includes(normalize(word)))
      ? { kind: 'none' }
      : { kind: 'book', name: kept.join(' '), inCity: true }
  }

  const described = before.every((word) => STAY_ADJECTIVES.has(normalize(word)))
  if (described && ['in', 'near'].includes(normalize(after[0] ?? ''))) {
    return book(after.slice(1))
  }
  const hotelName = before.some((word) =>
    HOTEL_NAME_WORDS.includes(normalize(word)),
  )
  if (
    after.length === 0 &&
    generic &&
    !hotelName &&
    looksLikePlace(words.slice(0, index))
  ) {
    return book(before)
  }
  if (before.length === 0 && (generic || noisy())) {
    return book(after)
  }
  return null
}
