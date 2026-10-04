import { casual, GB, type ParsedResult } from 'chrono-node/en'

import {
  clauses,
  DURATION_SOURCE,
  MONTH_SOURCE,
  notWhen,
  PEOPLE_SOURCE,
  ROOMS_SOURCE,
  WEEKDAY_SOURCE,
} from '../places/noise'

// Dates and party typed on a booking line. Pure: `now` is the tap time.

export type Party = {
  adults: number | null
  children: number | null
  rooms: number | null
}

// Local YYYY-MM-DD days.
export type StayDates = { checkIn: string; checkOut: string }

export type BookingDetails = Party & { dates: StayDates | null }

type NoiseKind = 'rooms' | 'duration' | 'people'
type Noise = { kind: NoiseKind; text: string }

// Same order as `cleanLine`: "for 3 rooms" is rooms, never a party of 3.
const NOISE: [NoiseKind, RegExp][] = [
  ['rooms', new RegExp(ROOMS_SOURCE, 'gi')],
  ['duration', new RegExp(DURATION_SOURCE, 'gi')],
  ['people', new RegExp(PEOPLE_SOURCE, 'gi')],
  ['people', /\bfamily\s+of\s+\d+\b/gi],
]
const MARK = 0xe000
const MARKS = /[\ue000-\ue0ff]/gu
const MARK_ONLY = /^[\s\p{P}\ue000-\ue0ff]*$/u

const COUNTED =
  /(\d+)\s*(adults?|kids?|child(?:ren)?|people|persons?|pax|guests?|ppl)/gi
const BARE_COUNT = /(\d+)/
const ROOM_COUNT = /^(\d+)/
const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
}
const NIGHTS = /(\d+|[a-z]+)[\s-]?(nights?|nts?|weeks?|wks?)\b/i
const ONE_NIGHT = /\bfor\s+the\s+night\b/i
// "3 days" (2 nights or 3?), "the night before", "over Christmas".
const UNSURE_DURATION = /\bdays?\b|\bbefore\b|\bafter\b|\b(?:for|over)\s/i

const MAX_PEOPLE = 30
const MAX_CHILDREN = 10
// Booking.com caps a stay at 30 nights.
const MAX_NIGHTS = 30
// A date without a year this recently past is a slip, not next year's.
const RECENT_DAYS = 30
// A range end read into the next month ("31 Oct - 2") stays short.
const MAX_ROLLED_NIGHTS = 14

const DATE_WORD = `(?:${MONTH_SOURCE}|${WEEKDAY_SOURCE}|week(?:end)?|month|year)`
// "next weekend", "early June", "wk 42", "next Fri": no dates (user decision).
const VAGUE = new RegExp(
  [
    '\\bweek(?:end)?s?\\b|\\bwk\\b|\\bw/c\\b|\\bsometime\\b|(?:\\d|\\s|-)ish\\b',
    `\\bnext\\s+${DATE_WORD}\\b`,
    `\\b(?:early|mid|late|end\\s+of|start\\s+of|beginning\\s+of)[\\s-]+${MONTH_SOURCE}\\b`,
    `\\baround\\s+(?:${MONTH_SOURCE}\\b|\\d+\\b(?!\\s*(?:am|pm|h)\\b|[:.]\\d))`,
  ].join('|'),
  'i',
)
const FROM_DATE = /\bfrom\s+(?=\d)/gi
// "20/10-25/10": chrono reads "10-25/10" unless the dash is spaced.
const NUMERIC_RANGE =
  /(^|[^/.\d])(\d{1,2}[/.]\d{1,2})\s*[-–—]\s*(\d{1,2}[/.]\d{1,2})\b(?![/.]\d)/g
// "20-25/10": both days of the one month.
const DAYS_OF_MONTH =
  /(^|[^/.\d])(\d{1,2})\s*[-–—]\s*(\d{1,2})[/.](\d{1,2})\b(?![/.]\d)/g
// "5 Oct-7 Oct", "20 Oct - 22": chrono reads "-7" as a UTC offset and
// "Oct - 22" as a year, but stops cleanly at "to".
const WORD_DASH = /(\p{L}\.?)\s*[-–—]\s*(?=\d)/gu
const NUMERIC_DATE = /\d[/.]\d/
// "9 & 10 Oct": nights listed, not a range.
const LISTED = /\d\s*(?:&|and|\+|,)\s*$/i
const MONTH_INDEX = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec'.split('|')
const MONTH_WORD = new RegExp(`\\b${MONTH_SOURCE}\\b`, 'gi')
const ENDS_IN_MONTH = new RegExp(`\\b${MONTH_SOURCE}\\.?$`, 'i')
const ENDS_IN_DAY = /\d(?:st|nd|rd|th)?$/i
// "Oct 20–25", "5 Oct - 7", "Oct 20 – 25 Nov": ends chrono misses or cuts.
const RANGE_TO = new RegExp(
  `^\\s*(?:[-–—]|to|until|till)\\s*(\\d{1,2})(?:st|nd|rd|th)?\\b(?![:./]\\d)(?:\\s*(${MONTH_SOURCE})\\.?(?=[\\s,;]|$))?`,
  'i',
)
const RANGE_START = /^\s*(?:[-–—]|to|until|till)\s*\d/i
const WEEKDAY_DAY = new RegExp(
  `\\b${WEEKDAY_SOURCE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?![:.]\\d)|\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${WEEKDAY_SOURCE}\\b`,
  'i',
)
const INNER_RANGE = /\d(?:\s+[-–—]\s*|\s*[-–—]\s+|\s+to\s+)\d/i
// ", 2026 - Oct 25, 2026": a year or range end split off by `clauses`.
const DATE_GOES_ON = /^(?:\d{4}\b|[-–—]|(?:to|until|till)\b)/i
const MONTH_AFTER = new RegExp(`^\\s*(${MONTH_SOURCE})\\.?(?=[\\s,;]|$)`, 'i')

const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const localDate = (year: number, month: number, day: number) => {
  const date = new Date(year, month, day, 12)
  return date.getMonth() === month && date.getDate() === day ? date : null
}

const ymd = (day: string): [number, number, number] => {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number)
  return [year, month - 1, date]
}

const addDays = (day: string, count: number) => {
  const [year, month, date] = ymd(day)
  return iso(new Date(year, month, date + count, 12))
}

export const nightsBetween = (checkIn: string, checkOut: string) =>
  Math.round(
    (Date.UTC(...ymd(checkOut)) - Date.UTC(...ymd(checkIn))) / 86_400_000,
  )

const count = (word: string) => {
  const value = /^\d+$/.test(word) ? Number(word) : NUMBER_WORDS[word]
  return value === undefined ? null : value
}

const within = (value: number | null, max: number, min = 1) =>
  value !== null && value >= min && value <= max ? value : null

// The first clause, with what `cleanLine` drops held aside as `noise`.
const firstClause = (text: string) => {
  const noise: Noise[] = []
  const marked = NOISE.reduce(
    (line, [kind, pattern]) =>
      line.replace(pattern, (match) => {
        noise.push({ kind, text: match })
        return ` ${String.fromCharCode(MARK + noise.length - 1)} `
      }),
    text,
  )
  const [first = '', ...rest] = clauses(marked)
  // "Book hotel Rome, 2 ppl", "Oct 20, 2026": noise alone or the rest of a
  // date belongs to the first clause.
  const belongs = (clause: string) =>
    MARK_ONLY.test(clause) ||
    DATE_GOES_ON.test(clause.replace(MARKS, '').trim())
  const trailing = rest.findIndex((clause) => !belongs(clause))
  const kept = [first, ...rest.slice(0, trailing === -1 ? undefined : trailing)]
  const line = kept.join(', ')
  const used = (line.match(MARKS) ?? []).flatMap((mark) => {
    const found = noise[mark.charCodeAt(0) - MARK]
    return found === undefined ? [] : [found]
  })
  return {
    clause: line.replace(MARKS, ' ').replace(/\s+/g, ' ').trim(),
    noise: used,
  }
}

const sum = (counted: RegExpMatchArray[], kids: boolean) =>
  counted
    .filter(([, , word = '']) => /^(?:kid|child)/i.test(word) === kids)
    .reduce<number | null>(
      (total, [, value]) => (total ?? 0) + Number(value),
      null,
    )

const partyOf = (noise: Noise[]): Party => {
  let adults: number | null = null
  let children: number | null = null
  let rooms: number | null = null
  for (const { kind, text } of noise) {
    if (kind === 'rooms') {
      rooms ??= Number(ROOM_COUNT.exec(text)?.[1] ?? 1)
    }
    if (kind !== 'people') {
      continue
    }
    const counted = [...text.matchAll(COUNTED)]
    // "for 2", "family of 4": all adults (no split was typed).
    adults ??=
      counted.length > 0
        ? sum(counted, false)
        : Number(BARE_COUNT.exec(text)?.[1])
    children ??= counted.length > 0 ? sum(counted, true) : null
  }
  return {
    adults: within(adults, MAX_PEOPLE),
    children: within(children, MAX_CHILDREN, 0),
    rooms: within(rooms, MAX_PEOPLE),
  }
}

// Nights typed ("3 nights", "a week"); 'unsure' when a stay length can't
// be trusted to set the check-out.
const nightsOf = (noise: Noise[]): number | 'unsure' | null => {
  const duration = noise.find(({ kind }) => kind === 'duration')?.text
  if (duration === undefined) {
    return null
  }
  if (ONE_NIGHT.test(duration)) {
    return 1
  }
  const nights = NIGHTS.exec(duration)
  if (
    nights === null ||
    UNSURE_DURATION.test(duration.replace(/^for\s/i, ''))
  ) {
    return 'unsure'
  }
  const value = count((nights[1] ?? '').toLowerCase())
  return value === null
    ? 'unsure'
    : /^w/i.test(nights[2] ?? '')
      ? value * 7
      : value
}

const startOfDay = (now: Date) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate())

// "Fri 13" or "Fri 12 Oct" (a Monday): the day and weekday disagree.
const weekdayClash = ({ start, text }: ParsedResult) => {
  if (!start.isCertain('weekday')) {
    return false
  }
  const date = start.date()
  if (start.isCertain('day')) {
    return date.getDay() !== start.get('weekday')
  }
  const typed = WEEKDAY_DAY.exec(text)
  return Number(typed?.[1] ?? typed?.[2] ?? date.getDate()) !== date.getDate()
}

const dated = (parser: typeof GB, text: string, today: Date) =>
  parser.parse(text, today, { forwardDate: true }).filter(
    (result) =>
      (result.start.isCertain('day') || result.start.isCertain('weekday')) &&
      // "-14", "+9", "GMT" read as a UTC offset shift the day.
      !result.start.isCertain('timezoneOffset') &&
      !notWhen({
        text,
        start: result.index,
        end: result.index + result.text.length,
        matched: result.text,
      }),
  )

// Day-first (en-GB); month-first words only when GB finds no date at all.
const parse = (text: string, today: Date) => {
  const found = dated(GB, text, today)
  return found.length > 0
    ? found
    : dated(casual, text, today).filter(
        ({ text: span }) => !NUMERIC_DATE.test(span),
      )
}

const monthOf = (word: string | undefined) =>
  word === undefined ? -1 : MONTH_INDEX.indexOf(word.slice(0, 3).toLowerCase())

// The first `month`/`day` after `start`, this year or next.
const nextDay = ({
  start,
  month,
  day,
}: {
  start: Date
  month: number
  day: number
}) => {
  for (const year of [start.getFullYear(), start.getFullYear() + 1]) {
    const date = localDate(year, month, day)
    if (date !== null && date > start) {
      return iso(date)
    }
  }
  return null
}

// "3 Oct" typed on 4 Oct: forwardDate made it next year's 3 Oct.
const recentlyPast = ({ start }: ParsedResult, today: Date) => {
  if (start.isCertain('year') || !start.isCertain('month')) {
    return false
  }
  const month = start.get('month') ?? 0
  const day = start.get('day') ?? 0
  return [today.getFullYear(), today.getFullYear() - 1].some((year) => {
    const date = localDate(year, month - 1, day)
    return (
      date !== null &&
      date < today &&
      nightsBetween(iso(date), iso(today)) <= RECENT_DAYS
    )
  })
}

// The range end chrono missed or cut short; 'invalid' when a typed end
// can't be read or can't follow the start ("Oct 28–3", "20 Oct - 2026").
const rangeEnd = (result: ParsedResult, text: string) => {
  const start = result.start.date()
  const after = text.slice(result.index + result.text.length)
  const matched = result.text.trim()
  if (!result.end && INNER_RANGE.test(matched)) {
    return 'invalid'
  }
  if (result.end) {
    // "Oct 20 - 25 Nov": the month after the match is the end's.
    const single = (matched.match(MONTH_WORD) ?? []).length === 1
    const month =
      ENDS_IN_DAY.test(matched) && single
        ? monthOf(MONTH_AFTER.exec(after)?.[1])
        : -1
    const day = result.end.date().getDate()
    return month === -1
      ? iso(result.end.date())
      : (nextDay({ start, month, day }) ?? 'invalid')
  }
  const to = RANGE_TO.exec(after)
  if (to === null) {
    return RANGE_START.test(after) ? 'invalid' : null
  }
  const day = Number(to[1])
  const month = monthOf(to[2])
  if (month !== -1) {
    return nextDay({ start, month, day }) ?? 'invalid'
  }
  // "5 Oct - 7" is 7 Oct; "31 Oct - 2" is 2 Nov, but "5 Oct - 4" isn't 4 Nov.
  if (ENDS_IN_MONTH.test(matched)) {
    const later = day > start.getDate()
    const month = (start.getMonth() + (later ? 0 : 1)) % 12
    const end = nextDay({ start, month, day })
    return end === null ||
      (!later && nightsBetween(iso(start), end) > MAX_ROLLED_NIGHTS)
      ? 'invalid'
      : end
  }
  // "Oct 20–25" stays in October.
  const same = localDate(start.getFullYear(), start.getMonth(), day)
  return ENDS_IN_DAY.test(matched) && same !== null && same > start
    ? iso(same)
    : 'invalid'
}

const normalise = (text: string) =>
  text
    .replace(FROM_DATE, '')
    .replace(NUMERIC_RANGE, '$1$2 - $3')
    .replace(DAYS_OF_MONTH, '$1$2/$4 - $3/$4')
    .replace(WORD_DASH, '$1 to ')

const stayDates = ({
  clause,
  nights,
  now,
}: {
  clause: string
  nights: number | 'unsure' | null
  now: Date
}): StayDates | null => {
  if (VAGUE.test(clause)) {
    return null
  }
  const text = normalise(clause)
  // Against the start of the day: chrono's weekdays turn over at noon.
  const today = startOfDay(now)
  const [first, second] = parse(text, today)
  if (
    first === undefined ||
    weekdayClash(first) ||
    recentlyPast(first, today) ||
    LISTED.test(text.slice(0, first.index))
  ) {
    return null
  }
  const checkIn = iso(first.start.date())
  const typedEnd =
    rangeEnd(first, text) ??
    (second === undefined ? null : iso(second.start.date()))
  if (typedEnd === 'invalid') {
    return null
  }
  const checkOut =
    typedEnd ??
    (nights === 'unsure'
      ? null
      : addDays(checkIn, nights === null ? 1 : nights))
  if (checkOut === null || checkIn < iso(today)) {
    return null
  }
  const stay = nightsBetween(checkIn, checkOut)
  // "20 Oct 2 nights 25 Oct": the typed nights and dates disagree.
  const clash =
    typedEnd !== null && typeof nights === 'number' && nights !== stay
  return stay < 1 || stay > MAX_NIGHTS || clash ? null : { checkIn, checkOut }
}

// `text` is the item's line; only its first clause is read.
export const partyDetails = (text: string): Party =>
  partyOf(firstClause(text).noise)

export const bookingDetails = (
  text: string,
  now: Date,
): BookingDetails | null => {
  const { clause, noise } = firstClause(text)
  const party = partyOf(noise)
  const dates = stayDates({ clause, nights: nightsOf(noise), now })
  return dates === null && Object.values(party).every((value) => value === null)
    ? null
    : { dates, ...party }
}
