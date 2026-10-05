import { BOOKING_SEARCH_PREFIX, FLIGHTS_LOOKUP_PREFIX } from './link'

// Links for an app that already has the fields (a hotel record, a flight
// segment), not a free-text line. Each builds exactly the shape
// `lookupLinkKind` recognises, so the travel lookup and these agree.

export type StayParty = {
  adults?: number | null | undefined
  children?: number | null | undefined
  rooms?: number | null | undefined
}

export type BookingSearch = StayParty & {
  // What Booking.com's search box gets: a hotel name, "name, city", a city.
  query: string
  // Local days, YYYY-MM-DD.
  checkIn: string
  checkOut: string
}

export type FlightSearch = {
  // An IATA code or a place name, as the user wrote it.
  to: string
  from?: string | null | undefined
  // Local day of departure, YYYY-MM-DD.
  date?: string | null | undefined
  adults?: number | null | undefined
}

// The recognisers read counts as 1–4 digits.
const MAX_COUNT = 9999
// Booking.com caps a stay at 30 nights (as the booking-line parser does).
const MAX_NIGHTS = 30
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/
const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')

const countOf = (value: number | null | undefined, min: number) =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= min &&
  value <= MAX_COUNT
    ? value
    : null

// Days since the epoch for a real calendar day, else null.
const dayNumber = (day: string) => {
  const match = DAY.exec(day)
  if (match === null) {
    return null
  }
  const [year, month, date] = match.slice(1).map(Number) as [
    number,
    number,
    number,
  ]
  const at = new Date(Date.UTC(year, month - 1, date))
  return at.getUTCFullYear() === year &&
    at.getUTCMonth() === month - 1 &&
    at.getUTCDate() === date
    ? at.getTime() / 86_400_000
    : null
}

// A lone surrogate makes encodeURIComponent throw; a builder never does.
const encode = (text: string) => {
  try {
    return encodeURIComponent(text)
  } catch {
    return null
  }
}

// An untyped party is the sites' own default: 2 adults, 1 room, no children.
export const partyOrDefault = ({ adults, children, rooms }: StayParty) => {
  const roomCount = countOf(rooms, 1) ?? 1
  return {
    adults: countOf(adults, 1) ?? Math.max(2, roomCount),
    children: countOf(children, 0) ?? 0,
    rooms: roomCount,
  }
}

// The stay query `lookupLinkKind` accepts on a Booking.com page or search.
export const bookingQuery = ({
  checkIn,
  checkOut,
  ...party
}: StayParty & { checkIn: string; checkOut: string }) => {
  const { adults, children, rooms } = partyOrDefault(party)
  return `checkin=${checkIn}&checkout=${checkOut}&group_adults=${adults}&no_rooms=${rooms}&group_children=${children}`
}

// Google Flights reads the trip, and "for 2 adults", from `q=`.
export const flightsQuery = ({
  from,
  to,
  adults,
}: {
  from: string | null
  to: string
  adults: number | null
}) =>
  (from === null ? `flights to ${to}` : `flights from ${from} to ${to}`) +
  (adults === null ? '' : ` for ${adults} adult${adults === 1 ? '' : 's'}`)

// Booking.com's search for `query` on those nights; null without a query,
// or unless checkOut is 1–30 nights after checkIn. A count that isn't a
// whole number in range falls back to the default party.
export const bookingSearchLink = ({
  query,
  checkIn,
  checkOut,
  ...party
}: BookingSearch): string | null => {
  const search = encode(query.trim())
  const days = { checkIn: checkIn.trim(), checkOut: checkOut.trim() }
  const first = dayNumber(days.checkIn)
  const last = dayNumber(days.checkOut)
  if (search === null || search === '' || first === null || last === null) {
    return null
  }
  const nights = last - first
  return nights < 1 || nights > MAX_NIGHTS
    ? null
    : `${BOOKING_SEARCH_PREFIX}${search}&${bookingQuery({ ...days, ...party })}`
}

const spokenDay = (day: string) => {
  const match = DAY.exec(day)
  return match === null || dayNumber(day) === null
    ? null
    : `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`
}

// Google Flights for the trip; null without a destination. A blank `from`,
// a date that isn't a real YYYY-MM-DD day or a count out of range is left
// out of the query.
export const flightsSearchLink = ({
  to,
  from,
  date,
  adults,
}: FlightSearch): string | null => {
  const destination = to.trim()
  if (destination === '') {
    return null
  }
  const origin = from?.trim() || null
  const day = date == null ? null : spokenDay(date.trim())
  const query = encode(
    flightsQuery({
      from: origin,
      to: day === null ? destination : `${destination} on ${day}`,
      adults: countOf(adults, 1),
    }),
  )
  return query === null ? null : `${FLIGHTS_LOOKUP_PREFIX}${query}`
}
