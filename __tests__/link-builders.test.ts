import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  bookingSearchLink,
  flightsSearchLink,
  isLookupLink,
  lookupLinkKind,
} from '../src/core'
import { airportCity, airportFor } from '../src/travel'
import { buildItem } from './helpers/items'
import { travelLookup } from './helpers/registry'

const SEARCH = 'https://www.booking.com/searchresults.html?ss='
const FLIGHTS = 'https://www.google.com/travel/flights?q='
const STAY =
  'checkin=2026-10-20&checkout=2026-10-25&group_adults=2&no_rooms=1&group_children=0'
const NIGHTS = { checkIn: '2026-10-20', checkOut: '2026-10-25' }

afterEach(() => {
  vi.restoreAllMocks()
})

// Names a structured record may hold: separators, scripts, a stray % or #.
const NAMES = [
  'W Osaka',
  'Hilton Osaka, Osaka',
  'Hotel Sacher Wien',
  'B&B Hotel #12',
  '100% Pure Inn?',
  'Ryokan 京都 & Spa',
  'Hôtel du Louvre',
  'Smith/Jones Lodge',
  'Name with\nnewline',
  "L'Hôtel (Paris)",
]

describe('bookingSearchLink', () => {
  it('builds the dated search the travel lookup builds', () => {
    expect(bookingSearchLink({ query: 'Hilton Osaka', ...NIGHTS })).toBe(
      `${SEARCH}Hilton%20Osaka&${STAY}`,
    )
  })

  it('matches the travel lookup when no page fits', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'))
    const result = await travelLookup.run(
      buildItem({ text: 'book a room at the Hilton Osaka 20-25 Oct' }),
      new Date(2026, 9, 4, 18, 30),
    )

    expect(result).toEqual({
      link: bookingSearchLink({ query: 'Hilton Osaka', ...NIGHTS }),
      failure: 'offline',
    })
  })

  it('carries the party, defaulting like the sites do', () => {
    const link = (party: object) =>
      bookingSearchLink({ query: 'Osaka', ...NIGHTS, ...party })

    expect(link({ adults: 3, children: 1, rooms: 2 })).toBe(
      `${SEARCH}Osaka&checkin=2026-10-20&checkout=2026-10-25&group_adults=3&no_rooms=2&group_children=1`,
    )
    // Three rooms need at least three adults.
    expect(link({ rooms: 3 })).toContain('group_adults=3&no_rooms=3')
    expect(link({ adults: 1 })).toContain('group_adults=1&no_rooms=1')
    expect(link({ adults: null, children: undefined })).toBe(
      `${SEARCH}Osaka&${STAY}`,
    )
  })

  it('falls back to the default party for a count out of range', () => {
    for (const party of [
      { adults: 0 },
      { adults: -1 },
      { adults: 2.5 },
      { adults: Number.NaN },
      { adults: 10_000 },
      { rooms: 0 },
      { children: -1 },
    ]) {
      expect(bookingSearchLink({ query: 'Osaka', ...NIGHTS, ...party })).toBe(
        `${SEARCH}Osaka&${STAY}`,
      )
    }
  })

  it('trims the query and the days', () => {
    expect(
      bookingSearchLink({
        query: '  Osaka ',
        checkIn: ' 2026-10-20',
        checkOut: '2026-10-25 ',
      }),
    ).toBe(`${SEARCH}Osaka&${STAY}`)
  })

  it('is null without a query or a 1–30 night stay of real days', () => {
    const cases: [string, string, string][] = [
      ['', '2026-10-20', '2026-10-25'],
      ['   ', '2026-10-20', '2026-10-25'],
      ['Osaka', '2026-10-20', '2026-10-20'],
      ['Osaka', '2026-10-25', '2026-10-20'],
      ['Osaka', '2026-10-01', '2026-11-01'],
      ['Osaka', '2026-02-30', '2026-03-02'],
      ['Osaka', '2026-13-01', '2026-13-03'],
      ['Osaka', '2026-10-20T15:00', '2026-10-25T11:00'],
      ['Osaka', '20/10/2026', '25/10/2026'],
      ['Osaka', '', ''],
      ['\ud800 Osaka', '2026-10-20', '2026-10-25'],
    ]
    for (const [query, checkIn, checkOut] of cases) {
      expect(bookingSearchLink({ query, checkIn, checkOut })).toBeNull()
    }
  })

  it('accepts exactly 30 nights, across a month and a year end', () => {
    expect(
      bookingSearchLink({
        query: 'Osaka',
        checkIn: '2026-12-15',
        checkOut: '2027-01-14',
      }),
    ).toContain('checkin=2026-12-15&checkout=2027-01-14')
    expect(
      bookingSearchLink({
        query: 'Osaka',
        checkIn: '2028-02-28',
        checkOut: '2028-03-01',
      }),
    ).not.toBeNull()
  })
})

describe('flightsSearchLink', () => {
  it('builds the query the travel lookup builds', () => {
    expect(flightsSearchLink({ to: 'Osaka' })).toBe(
      `${FLIGHTS}flights%20to%20Osaka`,
    )
    expect(flightsSearchLink({ from: 'Tokyo', to: 'Osaka' })).toBe(
      `${FLIGHTS}flights%20from%20Tokyo%20to%20Osaka`,
    )
    expect(flightsSearchLink({ to: 'Lisbon', adults: 1 })).toBe(
      `${FLIGHTS}${encodeURIComponent('flights to Lisbon for 1 adult')}`,
    )
  })

  it('matches the travel lookup for a typed flight', async () => {
    await expect(
      travelLookup.run(buildItem({ text: 'Flight SYD to KIX for 2 adults' })),
    ).resolves.toMatchObject({
      link: flightsSearchLink({ from: 'SYD', to: 'KIX', adults: 2 }),
    })
  })

  it('spells the date out after the destination', () => {
    expect(
      flightsSearchLink({
        from: 'SYD',
        to: 'KIX',
        date: '2026-10-05',
        adults: 2,
      }),
    ).toBe(
      `${FLIGHTS}${encodeURIComponent('flights from SYD to KIX on 5 Oct 2026 for 2 adults')}`,
    )
  })

  it('leaves out a blank origin, a bad date or count', () => {
    const plain = `${FLIGHTS}flights%20to%20KIX`
    for (const extra of [
      { from: '' },
      { from: '  ' },
      { from: null },
      { date: '2026-02-30' },
      { date: '5 Oct' },
      { date: '2026-10-05T09:30' },
      { date: null },
      { adults: 0 },
      { adults: 1.5 },
    ]) {
      expect(flightsSearchLink({ to: 'KIX', ...extra })).toBe(plain)
    }
  })

  it('is null without a destination', () => {
    expect(flightsSearchLink({ to: '' })).toBeNull()
    expect(flightsSearchLink({ from: 'SYD', to: '  ' })).toBeNull()
    expect(flightsSearchLink({ to: '\udc00' })).toBeNull()
  })
})

// The builders exist to make links the recognisers own: a lookup re-run
// may replace them, and the app shows them with the lookup's glyph.
describe('builders round-trip through the recognisers', () => {
  it.each(NAMES)('Booking.com search for %j is a booking link', (query) => {
    for (const party of [
      {},
      { adults: 1 },
      { adults: 30, children: 10, rooms: 9 },
    ]) {
      const link = bookingSearchLink({ query, ...NIGHTS, ...party })
      expect(link).not.toBeNull()
      expect(lookupLinkKind(link)).toBe('booking')
      expect(isLookupLink(link)).toBe(true)
    }
  })

  it.each(NAMES)('Google Flights to %j is a flights link', (place) => {
    for (const trip of [
      { to: place },
      { from: place, to: place },
      { from: 'SYD', to: place, date: '2026-10-05', adults: 3 },
      { from: place, to: 'KIX', adults: 1 },
    ]) {
      const link = flightsSearchLink(trip)
      expect(link).not.toBeNull()
      expect(lookupLinkKind(link)).toBe('flights')
      expect(isLookupLink(link)).toBe(true)
    }
  })
})

describe('airport lookups', () => {
  it('reads a city from the table, any case', () => {
    expect(airportFor('KIX')).toBe('Osaka')
    expect(airportFor(' nrt ')).toBe('Tokyo')
    expect(airportFor('XXX')).toBeNull()
  })

  it('names the city under a location field only for a code', () => {
    expect(airportCity('KIX')).toBe('Osaka')
    expect(airportCity('LHR')).toBe('London')
    expect(airportCity('KIX, 12 Oct')).toBe('Osaka')
    // A typed place or station, a lowercase word, the country code.
    for (const field of [
      'Osaka',
      'Kyoto Station',
      'bus',
      'the',
      'USA',
      'BAR mitzvah',
      'XXX',
      '',
      null,
    ]) {
      expect(airportCity(field)).toBeNull()
    }
  })
})
