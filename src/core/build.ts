import { BOOKING_SEARCH_PREFIX, FLIGHTS_LOOKUP_PREFIX } from './link'
import {
  isDay,
  MAX_CHILDREN,
  MAX_NIGHTS,
  MAX_PEOPLE,
  nightsBetween,
  within,
  ymd,
} from './stay'

// Links for an app that already has the fields (a hotel record, a flight
// segment), not a free-text line. Each builds exactly the shape
// `lookupLinkKind` recognises. Every field may be missing: a record's
// fields often are, and "no link" (null) is the answer, never a throw.

type Field = string | null | undefined

export type StayParty = {
  adults?: number | null | undefined
  children?: number | null | undefined
  rooms?: number | null | undefined
}

export type BookingSearch = StayParty & {
  // What Booking.com's search box gets: a hotel name, "name, city", a city.
  query: Field
  // Local days, YYYY-MM-DD.
  checkIn: Field
  checkOut: Field
}

export type FlightSearch = {
  // An IATA code or a place name, as the user wrote it.
  to: Field
  from?: Field
  // Local day of departure, YYYY-MM-DD.
  date?: Field
  adults?: number | null | undefined
}

const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')

// Trimmed text, or '' for a missing (or, from untyped JS, non-string) field.
const textOf = (field: unknown) =>
  typeof field === 'string' ? field.trim() : ''

// A lone surrogate makes encodeURIComponent throw; a builder never does.
const encode = (text: string) => {
  try {
    return encodeURIComponent(text)
  } catch {
    return null
  }
}

// An untyped party is the sites' own default: 2 adults, 1 room, no
// children. A count past Booking.com's limits counts as untyped.
export const partyOrDefault = ({ adults, children, rooms }: StayParty) => {
  const roomCount = within(rooms, MAX_PEOPLE) ?? 1
  return {
    adults: within(adults, MAX_PEOPLE) ?? Math.max(2, roomCount),
    children: within(children, MAX_CHILDREN, 0) ?? 0,
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
// or unless checkOut is 1–30 nights after checkIn. A count out of the
// site's limits, or fewer adults than rooms, falls back to the default
// party.
export const bookingSearchLink = ({
  query,
  checkIn,
  checkOut,
  adults,
  children,
  rooms,
}: BookingSearch): string | null => {
  const search = encode(textOf(query))
  const days = { checkIn: textOf(checkIn), checkOut: textOf(checkOut) }
  if (
    search === null ||
    search === '' ||
    !isDay(days.checkIn) ||
    !isDay(days.checkOut)
  ) {
    return null
  }
  const nights = nightsBetween(days.checkIn, days.checkOut)
  if (nights < 1 || nights > MAX_NIGHTS) {
    return null
  }
  const typed = within(adults, MAX_PEOPLE)
  const roomCount = within(rooms, MAX_PEOPLE) ?? 1
  return `${BOOKING_SEARCH_PREFIX}${search}&${bookingQuery({
    ...days,
    adults: typed !== null && typed >= roomCount ? typed : null,
    children,
    rooms,
  })}`
}

const spokenDay = (day: string) => {
  if (!isDay(day)) {
    return null
  }
  const [year, month, date] = ymd(day)
  return `${date} ${MONTHS[month]} ${year}`
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
  const destination = textOf(to)
  if (destination === '') {
    return null
  }
  const day = spokenDay(textOf(date))
  const query = encode(
    flightsQuery({
      from: textOf(from) || null,
      to: day === null ? destination : `${destination} on ${day}`,
      adults: within(adults, MAX_PEOPLE),
    }),
  )
  return query === null ? null : `${FLIGHTS_LOOKUP_PREFIX}${query}`
}
