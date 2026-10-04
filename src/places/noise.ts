import { casual } from 'chrono-node/en'

import { isStayName } from './stays'

// Pure text clean-up for travel lines: what people type around the name.

const TYPOS: Record<string, string> = {
  htl: 'hotel',
  hotle: 'hotel',
  hotell: 'hotel',
  flt: 'flight',
  fligth: 'flight',
  flght: 'flight',
  acc: 'accommodation',
  accom: 'accommodation',
  accomodation: 'accommodation',
  rsvn: 'reservation',
  reservaton: 'reservation',
  nr: 'near',
}
const TYPO = new RegExp(
  `(^|[^\\p{L}\\p{N}])(${Object.keys(TYPOS).join('|')})(?![\\p{L}\\p{N}])`,
  'giu',
)

const EMOJI = '[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}]\\uFE0F?'
const LEAD = new RegExp(
  `^(?:${EMOJI}|[-*•·–—>]+(?=\\s)|\\[[ xX]?\\]|\\d{1,2}[.)](?=\\s)|day\\s*\\d+\\s*[:.–-])\\s*`,
  'iu',
)
const STAY_EMOJI = /^🏨\s*/u
const FLIGHT_EMOJI = /^[✈🛫🛬]️?\s*/u

const URL = /\s*(?:https?:\/\/|www\.)\S+/gi
// A bare airport code in brackets stays: "Florence (FLR)".
const BRACKETS = /\s*(?:\((?![A-Z]{3}\))[^)]*\)|\[[^\]]*\])/g
const PRICE =
  /~?(?:[A-Z]{0,2}[$€£¥₩]\s?\d[\d,.]*(?:k\b)?|\d[\d,.]*\s?(?:eur|usd|gbp|jpy|yen)\b)(?:\s*(?:\/|per\s+)\s*[a-z]+)?/gi

const COUNT = '(?:\\d+|a|an|one|two|three|four|five|six|seven)'
// Whole month and weekday words: "Mar" is March, "Marriott" isn't.
export const MONTH_SOURCE =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
export const WEEKDAY_SOURCE =
  '(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)'
const PEOPLE_WORD =
  '(?:adults?|kids?|child(?:ren)?|people|persons?|pax|guests?|ppl)'
export const PEOPLE_SOURCE =
  `\\b(?:for\\s+)?\\d+\\s*${PEOPLE_WORD}(?:\\s*(?:,|and|&|\\+)?\\s*\\d+\\s*${PEOPLE_WORD})*\\b` +
  // "for 20 Oct", "for 12th" are dates; "for 2 Sat" is 2 people on Saturday.
  `|\\bfor\\s+\\d+\\b(?!\\s*(?:[:.]\\d|[-/]\\d|am\\b|pm\\b|h\\b|\\d{1,2}(?:st|nd|rd|th)\\b|${MONTH_SOURCE}\\b|st\\b|nd\\b|rd\\b|th\\b))`
const ROOM_KIND =
  '(?:family|double|twin|single|triple|king|queen|deluxe|standard)'
// "2 standard rooms" before "for 2" can read as a party.
export const ROOMS_SOURCE = `\\b(?:\\d+\\s+(?:${ROOM_KIND}\\s+)?|${ROOM_KIND}\\s+)rooms?\\b`
export const DURATION_SOURCE =
  `\\b(?:for\\s+)?${COUNT}[\\s-]?(?:nights?|nts?|weeks?|wks?|days?)\\b` +
  '|\\b(?:the\\s+)?nights?\\s+(?:before|after)\\b|\\bfor\\s+the\\s+night\\b' +
  '|\\b(?:for|over)\\s+(?:the\\s+)?(?:christmas|easter|new\\s+year|thanksgiving|golden\\s+week|chinese\\s+new\\s+year|ramadan|diwali|halloween)\\b'
const PEOPLE = new RegExp(PEOPLE_SOURCE, 'gi')
const ROOMS = new RegExp(ROOMS_SOURCE, 'gi')
const DURATION = new RegExp(DURATION_SOURCE, 'gi')
const STAY_NOISE = [PEOPLE_SOURCE, ROOMS_SOURCE, DURATION_SOURCE].map(
  (source) => new RegExp(source, 'i'),
)
// Only at the ends: "booked: Hotel X", "Flights — booked", "Hotel ✓".
const STATUS =
  /^(?:booked|done|paid|sorted)\s*[:–—-]\s*|(?:(?:\s[-–—]\s*|\s|^)(?:[✓✔☑✅]\uFE0F?|booked|done|paid|sorted))+$/giu

// chrono-node reads "at 7-Eleven", "Night train" and "Sunday Inn" as times.
const AFTER_SPAN = /^[-\p{L}\p{N}_]/u
const RANGE_END = new RegExp(
  `^\\s*[-–—]\\s*\\d{1,2}(?:st|nd|rd|th)?\\b(?:\\s*${MONTH_SOURCE}\\.?(?=\\s|$))?`,
  'i',
)
const MONTH_AFTER = new RegExp(`^\\s*${MONTH_SOURCE}\\.?(?=\\s|$)`, 'i')
const NAME_WORD =
  /^(?:on\s+)?(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*|jan|feb|mar|apr|may|june?|july?|aug|sep|sept|oct|nov|dec|[a-z]+ber|january|february|march|april|august|morning|afternoon|evening|night|midnight|midday|noon|today|tonight|tomorrow)\.?$/i
const BEFORE_WORD = /^\s+\p{L}/u
// "Hotel Friday", "Midnight Sun Hotel": a capitalised word in a name.
const CAPITALISED = /^\p{Lu}[\p{L}\p{M}]*$/u
const PREVIOUS_WORD = /(\S+)\s+$/u
const NEXT_WORD = /^\s+(\S+)/u
const LINE_END = /^[\s\p{P}]*$/u
const NOT_NAME = ['at', 'on', 'by', 'from', 'until', 'in', 'for', 'to']

const inTitleCase = ({ text, start, end }: Span & { text: string }) => {
  const words = text.slice(start, end).trim().split(/\s+/)
  if (!words.every((word) => CAPITALISED.test(word))) {
    return false
  }
  const previous = PREVIOUS_WORD.exec(text.slice(0, start))?.[1] ?? ''
  const next = NEXT_WORD.exec(text.slice(end))?.[1] ?? ''
  // At the end, "Hotel Friday" is a name but "Osaka Friday" is a day.
  if (words.length === 1 && LINE_END.test(text.slice(end))) {
    return isStayName(previous)
  }
  return (
    (CAPITALISED.test(previous) &&
      !NOT_NAME.includes(previous.toLowerCase())) ||
    CAPITALISED.test(next)
  )
}
const DANGLING = /\s+(?:on|at|by|for|from|until|till|in|@|-|–)$/i

type Span = { start: number; end: number; day?: boolean }

// A chrono match that is part of a word or a name, not a date or time.
export const notWhen = ({
  text,
  start,
  end,
  matched,
}: Span & { text: string; matched: string }) => {
  const after = text.slice(end)
  const word = matched.trim()
  return (
    AFTER_SPAN.test(after) ||
    /-$/.test(matched) ||
    /^night$/i.test(word) ||
    (NAME_WORD.test(word) && BEFORE_WORD.test(after)) ||
    inTitleCase({ text, start, end })
  )
}

const whenSpans = (text: string): Span[] => {
  const results = casual.parse(text)
  return results.flatMap((result, index) => {
    const start = result.index
    let end = start + result.text.length
    const range = RANGE_END.exec(text.slice(end))
    const limit = results[index + 1]?.index ?? text.length
    if (range && /\d$/.test(result.text)) {
      end = Math.min(end + range[0].length, limit)
    }
    // chrono reads "Oct 12 - 15 Nov" as "Oct 12 - 15", leaving "Nov".
    const month = /\d$/.test(text.slice(start, end).trim())
      ? MONTH_AFTER.exec(text.slice(end))
      : null
    if (month) {
      end = Math.min(end + month[0].length, limit)
    }
    const dropped = notWhen({ text, start, end, matched: result.text })
    const day = ['day', 'weekday', 'month'].some((unit) =>
      result.start.isCertain(unit as 'day'),
    )
    return dropped ? [] : [{ start, end, day }]
  })
}

const TRAILING_PUNCTUATION = /[\s?!.,;:]+$/
const SPACES = /\s{2,}/g

const tidy = (text: string) =>
  text.replace(SPACES, ' ').replace(TRAILING_PUNCTUATION, '').trim()

export const fixTypos = (text: string) =>
  text.replace(
    TYPO,
    (_, before: string, word: string) =>
      `${before}${TYPOS[word.toLowerCase()] ?? word}`,
  )

// 🏨/✈️ stand in for the stay/flight word unless the line already has one.
const stripLead = (text: string) => {
  let rest = text.trim()
  for (;;) {
    if (STAY_EMOJI.test(rest)) {
      const after = rest.replace(STAY_EMOJI, '')
      return isStayName(after) ? after : `hotel ${after}`
    }
    if (FLIGHT_EMOJI.test(rest)) {
      const after = rest.replace(FLIGHT_EMOJI, '')
      return /\b(?:flights?|fly|flying|plane)\b/i.test(after)
        ? after
        : `flight ${after}`
    }
    const next = rest.replace(LEAD, '')
    if (next === rest) {
      return rest
    }
    rest = next
  }
}

// A date ("Saturday", "Oct 12"), not just a time: also a booking line.
export const hasDate = (text: string) =>
  whenSpans(text).some(({ day }) => day === true)

// Durations, people counts and rooms: a line about booking a stay.
export const hasStayNoise = (text: string) =>
  STAY_NOISE.some((pattern) => pattern.test(text))

// Decoration, links, brackets, prices, people, rooms and durations go.
export const cleanLine = (text: string) =>
  tidy(
    stripLead(fixTypos(text))
      .replace(URL, '')
      .replace(BRACKETS, '')
      .replace(PRICE, '')
      .replace(STATUS, '')
      .replace(ROOMS, '')
      .replace(DURATION, '')
      .replace(PEOPLE, ''),
  )

// A Maps search keeps the whole line, minus decoration and pasted links.
export const placeQuery = (text: string) =>
  tidy(stripLead(text).replace(URL, '').replace(STATUS, '')) || text.trim()

// Dates and times anywhere ("Oct 12–15", "Fri–Sun", "at 9am", "05:30");
// the result can be empty.
export const stripWhen = (text: string) => {
  const spans = whenSpans(text)
  if (spans.length === 0) {
    return text.trim()
  }
  const kept = spans.reduceRight(
    (rest, { start, end }) => `${rest.slice(0, start)} ${rest.slice(end)}`,
    text,
  )
  return tidy(tidy(kept).replace(DANGLING, ''))
}

const PACKAGE_WORD =
  '(?:flights?|hotel|hostel|accommodation|car(?:\\s+hire)?|rental\\s+car)'
const PACKAGE = new RegExp(
  `^(?:(?:book|reserve|get|need)\\s+)?(${PACKAGE_WORD})((?:\\s*(?:\\+|&|\\band\\b)\\s*${PACKAGE_WORD})+)` +
    `(?:\\s+(?:package|deal))?\\s+(?:for\\s+|to\\s+|in\\s+)?(\\S.*)$`,
  'i',
)
const COMMA = /\s*[,;]\s*/
const JOINER = /\s*(?:\s\+\s|\bthen\b|\band\b(?!\s+breakfast))\s*/i
// ", Kyoto" or ", New York" qualifies the name before it.
const QUALIFIER = /^[\p{Lu}\p{Lo}][^\s]*(?:\s+\p{Lu}[^\s]*){0,2}$/u

// "Flight + hotel Barcelona" is a flight to Barcelona; otherwise each
// clause ("…, then …", "… and …") is a separate job.
export const clauses = (text: string) => {
  const line = cleanLine(text)
  const pack = PACKAGE.exec(line)
  if (pack) {
    const [, first = '', , place = ''] = pack
    const joiner = /^fl/i.test(first) ? 'to' : 'in'
    return [`${first} ${joiner} ${place}`]
  }
  const pieces = line.split(COMMA).reduce<string[]>((kept, piece) => {
    const last = kept[kept.length - 1]
    return last !== undefined && QUALIFIER.test(piece)
      ? [...kept.slice(0, -1), `${last}, ${piece}`]
      : [...kept, piece]
  }, [])
  return pieces
    .flatMap((piece) => piece.split(JOINER))
    .map(tidy)
    .filter((clause) => clause !== '')
}
