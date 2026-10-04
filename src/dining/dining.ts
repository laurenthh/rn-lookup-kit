import { diningPage, isGenericName } from './diningPages'
import {
  BEFORE_AREA,
  BEFORE_NAME,
  CHORES,
  CONNECTORS,
  isBookingWord,
  isDiningWord,
  isFoodWord,
  LEAD_VERBS,
  MEAL_NAME_TAILS,
  MEALS,
  NOT_NAME,
  PREAMBLE,
  VENUE_TYPES,
  WHEN,
} from './diningWords'
import { cleanLine } from '../places/noise'
import { isMoneyTransfer, isOffTopic } from '../places/offTopic'
import { isAirbnb, isStayName, tokenize } from '../places/stays'
import { transportIntent } from '../places/transport'
import type { Lookup } from '../core/types'
import { linkPatch, type Resolver } from '../core/resolve'
import { isLookupLink, MAPS_LOOKUP_PREFIX } from '../core/link'
import { normalize } from '../core/normalize'

export type DiningIntent =
  | { kind: 'book'; name: string }
  | { kind: 'venue'; query: string }
  | { kind: 'none' }

// Classification only needs the start of a pasted wall of text.
const MAX_LENGTH = 300

const LEAD_BOOK =
  /^(?:re)?book\b|^reserve\b|^rsvn?\b|^reserv(?:ation|aton)s?\b|^resevation\b|^reso\b/i
// Lowercase only: "Starbucks Reserve Roastery" is a name.
const BOOK_WORD =
  /\b(?:book(?:ed|ing)?|reserve[ds]?|reservations?|resevation|reso|rsvn?)\b/u
// Lowercase anywhere, or leading a line: "Kitchen Table" is a name.
const TABLE = /\btable\b|\bTable\s+(?:for|at)\b/u
// "for 2", "x4", "6pax", "2名", "pour 4": never "for 2 nights".
const PARTY_SOURCE =
  '\\b\\d{1,3}\\s*(?:pax|ppl|people|persons?|pers|guests?|covers?|seats?)\\b|\\d{1,3}\\s*[人名]|(?:^|\\s)x\\s?\\d{1,2}\\b|\\bpour\\s+\\d{1,2}\\b|\\bfor\\s+(?:\\d{1,2}|two|three|four|five|six|eight|ten|twelve)\\b(?!\\s*(?:[:.]\\d|[-/]\\d|am\\b|pm\\b|h\\b|nights?\\b|days?\\b|weeks?\\b|months?\\b|mins?\\b|minutes?\\b|hours?\\b|hrs?\\b))|\\b(?:party|group)\\s+of\\s+\\d+'
const TIME_SOURCE =
  '\\b\\d{1,2}(?:[:.h]\\d{2})?\\s*(?:am|pm)\\b|\\b\\d{1,2}[:.h]\\d{2}\\b|\\b\\d{1,2}h\\b'
const PARTY = new RegExp(PARTY_SOURCE, 'i')
const TIME = new RegExp(TIME_SOURCE, 'i')
const BOOKING_NOTE =
  /\b(?:wait\s*list|tasting\s+menu|omakase|cash\s+only|anniversary)\b/i
const NO_BOOKING =
  /\bno\s+(?:res|rezzies|reservations?|bookings?)\b|\bwalk[\s-]?ins?\b|\bqueue\b|\bfirst[\s-]come\b/i
// No venue to find: "Italian somewhere in West Village", "Pasta night at home".
const NO_VENUE =
  /\b(?:somewhere|some\s+place|someplace|mentioned|recommended|at\s+home|homemade|home-made|vs|versus|notes|recipe|invites?|leftovers|groceries)\b/i
// Somewhere to go, not to eat: "Book Eiffel Tower for 2 9am", "Golf at St
// Andrews 8am for 4" — unless a meal or venue word says otherwise ("Opera
// Café"). Area words only count lowercase: "Covent Garden", "Madison Park".
const NOT_DINING =
  /\b(?:tours?|tickets?|spa|massage|museum|gallery|campsite|class(?:es)?|lessons?|shows?|musical|concerts?|gigs?|onsen|pass|cruise|flights?|hotels?|hostels?|towers?|castle|palace|cathedral|basilica|temple|shrine|zoo|aquarium|exhibition|stadium|arena|theatre|theater|cinema|film|movie|matinee|opera|train|rail|trip|lagoon|hamm?am|gym|pilates|yoga|salon|barber|nails|dentist|golf|bowling|karaoke|escape|tasting(?!\s+menu))\b/i
const NOT_DINING_LOWER =
  /\b(?:gardens?|park|view|studio|desk|seats?|meeting|baths?|tee)\b/u
const DELIVERY =
  /\b(?:deliveroo|uber\s?eats|doordash|grubhub|just\s?eat|seamless|menulog|foodpanda|postmates)\b/i

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]️?/gu
const PARTY_ANYWHERE = new RegExp(PARTY_SOURCE, 'gi')
const TIME_ANYWHERE = new RegExp(TIME_SOURCE, 'gi')
const TIME_RANGE = /\b\d{1,2}(?::\d{2})?\s*[-–]\s*(?=\d)/g
const DATE =
  /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?=\s|$)/gi
// People aren't part of the place: "Lunch w/ Priya", "Vegan place for mum".
const WITH_PEOPLE =
  /\s*\b(?:w\/|with|meet(?:ing)?)\s+(?:the\s+|my\s+)?(?:[\p{Lu}][\p{L}'’-]*|clients?|team|boss|mum|mom|dad|parents|friends?|family|colleagues?|kids)(?=[\s,.:;!?—–-]|$)/gu
// "Table for Sam at Brat", "Lunch for Priya and Sam at Dishoom".
const FOR_PEOPLE =
  /\s+for\s+(?:the\s+|my\s+)?(?:team|mum|mom|dad|parents|[\p{Lu}][\p{L}]*)(?:\s+(?:and|&)\s+[\p{Lu}][\p{L}]*)?(?=\s*[-–—:,?!.(]|\s+(?:at\b|@)|$)/gu
const SEPARATOR = /\s+[-–—]+\s+|\s*[—–]\s*|\s*[:;,]\s+|\s*!{2,}\s*|\s*\?+\s+/u
// "Movie 7pm then dinner": each part is a line of its own.
const THEN = /\s+then\s+/i
// A lone "Sam's" with no venue word is a friend's place, not a booking.
const POSSESSIVE_NAME = /^[\p{Lu}][\p{L}]*['’]s$/u
const AT_SIGN = /\s+@\s+|\s+@(?=\p{L})/gu
const NOTE_WORDS =
  /\b(?:queue|book(?:ed|ing)?|reserve|reservation|reso|rsvn?|table|lol|ugh|asap|again|ahead|early|way)\b/g
const EDGE_PUNCTUATION = /^[^\p{L}\p{N}&+@]+|[^\p{L}\p{N}&+.'’]+$/gu
const CAPITAL = /^(?:[dl]['’])?[\p{Lu}\p{Lo}]/u
const CJK =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u

type Token = { text: string; key: string }
type Run = {
  part: number
  start: number
  end: number
  area: boolean
  named: boolean
  // After "at", "@" or "from"
  introduced: boolean
  // Opens with a meal word: "Supper Club"
  meal: boolean
}

// A day or month inside a name stays ("Rising Sun pub", "Sunday in
// Brooklyn", "Mar y Sol", "Sat Bains"); one at a clause edge goes.
const keepsWhen = (tokens: Token[], index: number) => {
  const token = tokens[index] as Token
  const previous = tokens[index - 1]
  const next = tokens[index + 1]
  const after = tokens[index + 2]
  if (!CAPITAL.test(token.text) || next === undefined) {
    return false
  }
  const nameNext =
    (CAPITAL.test(next.text) && !WHEN.has(next.key)) ||
    VENUE_TYPES.has(next.key) ||
    ((CONNECTORS.has(next.key) || next.key === 'in') &&
      after !== undefined &&
      CAPITAL.test(after.text))
  const starts =
    previous === undefined ||
    LEAD_VERBS.has(previous.key) ||
    BEFORE_NAME.has(previous.key)
  const namePrevious =
    previous !== undefined &&
    CAPITAL.test(previous.text) &&
    !MEALS.has(previous.key) &&
    !LEAD_VERBS.has(previous.key) &&
    !WHEN.has(previous.key)
  return nameNext && (starts || namePrevious)
}

const tokensOf = (part: string): Token[] => {
  const tokens = part
    .split(/\s+/)
    .map((word) => word.replace(EDGE_PUNCTUATION, ''))
    .filter((word) => word !== '')
    .map((text) => ({ text, key: normalize(text).replace(/['’]s$/, '') }))
  return tokens.filter(
    ({ key }, index) => !WHEN.has(key) || keepsWhen(tokens, index),
  )
}

const isCapital = ({ text, key }: Token) =>
  CAPITAL.test(text) && !NOT_NAME.has(key)

// A word that names this venue and no other kind of place.
const isOwn = (token: Token, allLower: boolean) =>
  (CJK.test(token.text) ||
    (allLower ? /^\p{Ll}/u.test(token.text) : isCapital(token))) &&
  !isDiningWord(token.key) &&
  !isBookingWord(token.key) &&
  !CONNECTORS.has(token.key) &&
  !LEAD_VERBS.has(token.key) &&
  !BEFORE_NAME.has(token.key) &&
  !BEFORE_AREA.has(token.key)

// Without the date, time, party and decoration a link doesn't need.
const tidyPart = (part: string) =>
  part
    .replace(EMOJI, ' ')
    .replace(TIME_RANGE, '')
    .replace(TIME_ANYWHERE, ' ')
    .replace(DATE, ' ')
    .replace(PARTY_ANYWHERE, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()

const stripLead = (tokens: Token[]) => {
  let index = 0
  while (
    index < tokens.length &&
    (LEAD_VERBS.has(tokens[index]?.key ?? '') ||
      (index > 0 && ['a', 'the'].includes(tokens[index]?.key ?? '')))
  ) {
    index += 1
  }
  return index
}

// Runs of name words: own words joined by connectors and the venue-type
// words around them ("Brasserie Zédel", "Gelateria del Teatro"). Runs are
// in order, never overlap, and each holds an own word or two dining words.
const runsOf = ({
  tokens,
  part,
  from,
  allLower,
  ambiguous,
}: {
  tokens: Token[]
  part: number
  from: number
  allLower: boolean
  ambiguous: number
}): Run[] => {
  const own = (index: number) =>
    index !== ambiguous && isOwn(tokens[index] as Token, allLower)
  const nameWord = (index: number) => {
    const token = tokens[index]
    return (
      token !== undefined &&
      (own(index) ||
        (isCapital(token) &&
          isDiningWord(token.key) &&
          !isBookingWord(token.key)) ||
        (index === ambiguous &&
          isCapital(token) &&
          !LEAD_VERBS.has(token.key) &&
          !CHORES.has(token.key)))
    )
  }
  const joins = (index: number) =>
    (CONNECTORS.has(tokens[index]?.key ?? '') && nameWord(index + 1)) ||
    (tokens[index]?.key === 'by' && mealName(index - 1)) ||
    (tokens[index]?.key === 'in' &&
      WHEN.has(tokens[index - 1]?.key ?? '') &&
      nameWord(index + 1))
  // A meal word naming the venue: "Breakfast Club", "Dinner by Heston",
  // "Brunch & Co".
  const mealName = (index: number) => {
    const [meal, next, after] = tokens.slice(index, index + 3)
    return (
      meal !== undefined &&
      isCapital(meal) &&
      MEALS.has(meal.key) &&
      next !== undefined &&
      ((isCapital(next) && MEAL_NAME_TAILS.has(next.key)) ||
        (['&', 'by', 'and'].includes(next.key) &&
          after !== undefined &&
          isCapital(after)))
    )
  }
  // Two capitalised dining words are a name too: "Thai Diner", "Milk Bar".
  const lexName = (index: number) =>
    index !== ambiguous &&
    index + 1 !== ambiguous &&
    [tokens[index], tokens[index + 1]].every(
      (token) =>
        token !== undefined &&
        isCapital(token) &&
        isDiningWord(token.key) &&
        !isBookingWord(token.key),
    )

  const runs: Run[] = []
  for (let index = from; index < tokens.length; index += 1) {
    if (!own(index) && !lexName(index)) {
      continue
    }
    let start = index
    while (
      start - 1 >= from &&
      (nameWord(start - 1) || joins(start - 1)) &&
      (!MEALS.has(tokens[start - 1]?.key ?? '') || mealName(start - 1))
    ) {
      start -= 1
    }
    let end = index + 1
    while (end < tokens.length && (nameWord(end) || joins(end))) {
      end += 1
    }
    const before = tokens[start - 1]?.key ?? ''
    const named = tokens.slice(start, end).some((_, at) => own(start + at))
    const meal = MEALS.has(tokens[start]?.key ?? '')
    runs.push({
      part,
      start,
      end,
      area: BEFORE_AREA.has(before) && !(before === 'by' && meal),
      named,
      introduced: BEFORE_NAME.has(before),
      meal,
    })
    index = end - 1
  }
  return runs
}

const textOf = (tokens: Token[]) => tokens.map(({ text }) => text).join(' ')

type Parsed = {
  name: string
  query: string
  // A cuisine or dish before a name with nothing between ("Kaiseki dinner
  // Gion"): the name is an area to eat in, not a venue to book.
  area: boolean
}

const QUALIFIER_MAX_WORDS = 3

// The venue's name and Maps query from the cleaned line, or null when no
// part names one; the name is always a slice of one part (+ a qualifier).
const parse = (line: string): Parsed | null => {
  const cleaned = line.replace(AT_SIGN, ' at ')
  const allLower = !/\p{Lu}/u.test(cleaned)
  const parts = cleaned
    .split(SEPARATOR)
    .map(tidyPart)
    .map(tokensOf)
    .filter((tokens) => tokens.length > 0)
  const firstLead = parts[0] === undefined ? 0 : stripLead(parts[0])

  const runs = parts.flatMap((tokens, part) =>
    runsOf({
      tokens,
      part,
      from: part === 0 ? firstLead : 0,
      allLower,
      ambiguous: part === 0 && firstLead === 0 && !allLower ? 0 : -1,
    }),
  )
  const named = runs.filter(({ area, named }) => named && !area)
  // "Supper Club at Carousel": the event, then the venue.
  const chosen =
    (named[0]?.meal === true
      ? named.find(({ introduced }) => introduced)
      : undefined) ??
    named[0] ??
    runs.find(({ area }) => !area) ??
    runs[0]
  if (chosen === undefined) {
    return firstWordName(parts)
  }

  const tokens = parts[chosen.part] ?? []
  const before = tokens[chosen.start - 1]?.key ?? ''
  const next = parts[chosen.part + 1]
  const qualifier =
    chosen.end === tokens.length &&
    next !== undefined &&
    next.length <= QUALIFIER_MAX_WORDS &&
    next.every(isCapital)
      ? ` ${textOf(next)}`
      : ''
  const name = `${textOf(tokens.slice(chosen.start, chosen.end))}${qualifier}`
  const lead = chosen.part === 0 ? firstLead : 0
  const introduced = BEFORE_NAME.has(before) || chosen.start === lead
  const preamble = tokens
    .slice(lead, chosen.start)
    .every(
      ({ key }) => MEALS.has(key) || NOT_NAME.has(key) || PREAMBLE.has(key),
    )
  const query = `${textOf(tokens.slice(introduced || preamble ? chosen.start : lead))}${qualifier}`
  const opener = tokens[lead]
  return {
    name,
    query,
    area:
      chosen.area ||
      (!introduced &&
        firstLead === 0 &&
        opener !== undefined &&
        isFoodWord(opener.key)),
  }
}

// "Itsu sushi", "Sqirl breakfast", "Leon": a sentence-case first word is a
// name only alone or before dining words.
const firstWordName = (parts: Token[][]): Parsed | null => {
  const [tokens = []] = parts
  const [first, ...rest] = tokens
  if (
    first === undefined ||
    !isOwn(first, false) ||
    CHORES.has(first.key) ||
    !rest.every(({ key }) => !NOT_NAME.has(key) || key === 'anniversary')
  ) {
    return null
  }
  const named =
    (rest.length === 0 && parts.length === 1) ||
    rest.some(
      ({ key }) =>
        isDiningWord(key) || isBookingWord(key) || key === 'anniversary',
    ) ||
    (rest.length === 0 && parts.slice(1).every((part) => !part.some(isCapital)))
  // "Opera Bar 7pm for 4": the venue word after it is part of the name.
  const end = rest.findIndex(
    (token) =>
      !isCapital(token) || !isDiningWord(token.key) || isBookingWord(token.key),
  )
  const name = textOf(tokens.slice(0, end === -1 ? tokens.length : end + 1))
  return named ? { name, query: textOf(tokens), area: false } : null
}

type Signal = 'strong' | 'weak' | null

// Strong: a booking word, a table or a party size. Weak: a note, or a meal
// word outside the name with a time ("Monmouth Coffee 9am" has none).
const bookingSignal = ({
  raw,
  line,
  name,
}: {
  raw: string
  line: string
  name: string
}): Signal => {
  if (
    LEAD_BOOK.test(line) ||
    BOOK_WORD.test(raw) ||
    TABLE.test(raw) ||
    PARTY.test(raw)
  ) {
    return 'strong'
  }
  const own = new Set(wordsOf(name))
  // A capitalised meal word inside a line names the venue: "Monmouth Coffee".
  const meal = (line.match(/[\p{L}]+/gu) ?? []).some(
    (word, index) =>
      MEALS.has(normalize(word)) &&
      !own.has(normalize(word)) &&
      (index === 0 || !/^\p{Lu}/u.test(word)),
  )
  return BOOKING_NOTE.test(raw) || (meal && TIME.test(raw)) ? 'weak' : null
}

const wordsOf = (raw: string) =>
  (raw.match(/[\p{L}]+/gu) ?? []).map((word) => normalize(word))

const hasDiningWord = (raw: string) =>
  TABLE.test(raw) ||
  BOOKING_NOTE.test(raw) ||
  wordsOf(raw).some((word) => MEALS.has(word) || VENUE_TYPES.has(word))

const isNotDining = (raw: string) =>
  (NOT_DINING.test(raw) || NOT_DINING_LOWER.test(raw)) && !hasDiningWord(raw)

const hasMealOrTable = (raw: string) =>
  TABLE.test(raw) ||
  (raw.match(/[\p{L}]+/gu) ?? []).some((word) => MEALS.has(normalize(word)))

const CHORE_LEAD = /^(\p{L}+)/u

const isChore = (line: string) => {
  const first = normalize(CHORE_LEAD.exec(line)?.[1] ?? '')
  return CHORES.has(first) || isOffTopic(line) || transportIntent(line) !== null
}

const clauseIntent = (raw: string): DiningIntent => {
  if (
    raw === '' ||
    isMoneyTransfer(raw) ||
    DELIVERY.test(raw) ||
    NO_VENUE.test(raw) ||
    isNotDining(raw)
  ) {
    return { kind: 'none' }
  }
  const line = cleanLine(raw)
    .replace(WITH_PEOPLE, '')
    .replace(FOR_PEOPLE, '')
    .trim()
  if (line === '' || isChore(line)) {
    return { kind: 'none' }
  }
  // "Book Hilton Osaka Sat" is the travel lookup's hotel, not a table.
  if (LEAD_BOOK.test(line) && isStayName(raw) && !hasMealOrTable(raw)) {
    return { kind: 'none' }
  }
  const parsed = parse(line)
  if (parsed === null) {
    return { kind: 'none' }
  }
  const query = parsed.query.replace(NOTE_WORDS, ' ').replace(/\s{2,}/g, ' ')
  const signal = bookingSignal({ raw, line, name: parsed.name })
  const friend =
    POSSESSIVE_NAME.test(parsed.name) &&
    !wordsOf(raw).some((word) => VENUE_TYPES.has(word)) &&
    signal === 'weak'
  if (!parsed.area && !friend && !NO_BOOKING.test(raw) && signal !== null) {
    return { kind: 'book', name: parsed.name }
  }
  return { kind: 'venue', query: query.trim() || parsed.name }
}

export const diningIntent = (text: string): DiningIntent => {
  for (const clause of text.slice(0, MAX_LENGTH).trim().split(THEN)) {
    const intent = clauseIntent(clause)
    if (intent.kind !== 'none') {
      return intent
    }
  }
  return { kind: 'none' }
}

// Travel lists: "book/reserve <restaurant>" with a dining word — a meal or
// venue word, a table, a reservation word or a booking note. A party size
// or a time alone isn't one there (user decision, 22 stage 2).
const TRAVEL_LEAD = /^(?:re)?(?:book|reserve)\b|^rsvn?\b/i
const RESERVATION_WORD = /\breserv(?:ation|aton)s?\b|\bresevation\b|\breso\b/i

export const travelDiningName = (text: string): string | null => {
  const raw = text.slice(0, MAX_LENGTH).trim()
  if (!TRAVEL_LEAD.test(cleanLine(raw)) || isStayName(raw) || isAirbnb(raw)) {
    return null
  }
  const intent = diningIntent(raw)
  return intent.kind === 'book' &&
    (hasDiningWord(raw) || RESERVATION_WORD.test(raw))
    ? intent.name
    : null
}

const mapsLink = (text: string) =>
  `${MAPS_LOOKUP_PREFIX}${encodeURIComponent(text)}`

const QUERY_OR_HASH = /[?#].*$/

// OpenTable's page for the venue, else its own site, else a Maps search.
// "Sketch" alone finds a drawing app: the site search says "restaurant".
export const diningBookLink = async (name: string, resolver: Resolver) => {
  if (isGenericName(name)) {
    return linkPatch(mapsLink(name))
  }
  const openTable = await resolver.resolveFirstResult(
    `site:opentable.com ${name}`,
  )
  if (
    openTable.url !== null &&
    diningPage({ url: openTable.url, name }) === 'opentable'
  ) {
    return linkPatch(openTable.url.replace(QUERY_OR_HASH, ''))
  }
  const typed = tokenize(name).some((word) => VENUE_TYPES.has(word))
  const site = await resolver.resolveFirstResult(
    typed ? name : `${name} restaurant`,
  )
  if (site.url !== null && diningPage({ url: site.url, name }) === 'site') {
    return linkPatch(site.url, openTable.reason)
  }
  return linkPatch(mapsLink(name), openTable.reason, site.reason)
}

export const createDiningLookup = ({
  resolver,
}: {
  resolver: Resolver
}): Lookup => ({
  id: 'dining',
  tags: ['restaurants', 'dining', 'eat', 'cafes', 'bars'],
  // Only asked when `applies`, so never for `none`.
  label: (item) =>
    diningIntent(item.text).kind === 'book' ? 'Book a table' : 'Find on map',
  applies: (item) =>
    (item.link === null || isLookupLink(item.link)) &&
    diningIntent(item.text).kind !== 'none',
  run: async (item) => {
    const intent = diningIntent(item.text)
    switch (intent.kind) {
      case 'none':
        return 'no-match'
      case 'venue':
        return { link: mapsLink(intent.query) }
      case 'book':
        return diningBookLink(intent.name, resolver)
    }
  },
})
