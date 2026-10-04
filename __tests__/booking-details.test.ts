import { describe, expect, it } from 'vitest'
import { bookingDetails, partyDetails } from '../src/travel/details'
import {
  FIRST_REFERENCE,
  HOTEL_DETAIL_LINES,
  RELATIVE_DETAIL_LINES,
  REVIEW_DETAIL_LINES,
  SECOND_REFERENCE,
  type DetailLine,
} from './fixtures/booking-detail-lines'

const LINES = [
  ...HOTEL_DETAIL_LINES,
  ...RELATIVE_DETAIL_LINES,
  ...REVIEW_DETAIL_LINES,
]
const atSecond = ([, first, second]: DetailLine) =>
  second === undefined ? first : second

const YEAR_TYPED = /\b20\d\d\b|\b\d{1,2}[./]\d{1,2}[./]\d{2}\b/

describe('booking details corpus', () => {
  it('has the 60 study lines, the relative forms and the review lines', () => {
    expect(HOTEL_DETAIL_LINES).toHaveLength(60)
    expect(RELATIVE_DETAIL_LINES.length).toBeGreaterThanOrEqual(15)
    expect(REVIEW_DETAIL_LINES.length).toBeGreaterThanOrEqual(90)
  })

  it.each(LINES)('%s', (...line) => {
    expect(bookingDetails(line[0], FIRST_REFERENCE)).toEqual(line[1])
    expect(bookingDetails(line[0], SECOND_REFERENCE)).toEqual(atSecond(line))
  })

  it('moves only dates without a year when `now` moves, or drops a past one', () => {
    for (const line of LINES.filter(([text]) => YEAR_TYPED.test(text))) {
      const second = atSecond(line)
      if (second?.dates) {
        expect(second).toEqual(line[1])
      }
    }
  })
})

describe('bookingDetails', () => {
  const datesOf = (text: string, now = FIRST_REFERENCE) =>
    bookingDetails(text, now)?.dates ?? null

  it('never gives a check-in before the tap day', () => {
    const now = new Date(2026, 9, 21, 9)
    expect(datesOf('Book hotel Osaka 20-25 Oct 2026', now)).toBe(null)
    expect(datesOf('Book hotel Osaka 21-25 Oct 2026', now)).toEqual({
      checkIn: '2026-10-21',
      checkOut: '2026-10-25',
    })
  })

  // Each of these failed under jest's UTC before the stage-2 fixes.
  it('never reads a dash or sign after a month as a UTC offset', () => {
    expect(datesOf('Hotel Osaka 12 Oct-14 Oct')).toEqual({
      checkIn: '2026-10-12',
      checkOut: '2026-10-14',
    })
    expect(datesOf('Hotel Osaka 20 Oct +9')).toBe(null)
    expect(datesOf('Hotel Osaka 20 Oct GMT')).toBe(null)
  })

  it('reads the day against the start of the tap day, not noon', () => {
    for (const hour of [0, 11, 12, 18, 23]) {
      expect(
        datesOf('Hotel Bath Sun–Tue', new Date(2026, 9, 4, hour, 30)),
      ).toEqual({
        checkIn: '2026-10-04',
        checkOut: '2026-10-06',
      })
    }
  })

  it('drops a date without a year that has just passed, rather than next year', () => {
    expect(datesOf('Hotel Osaka 3 Oct')).toBe(null)
    expect(datesOf('Hotel Osaka 2 Oct - 6 Oct')).toBe(null)
    expect(datesOf('Hotel Osaka 3 Oct', new Date(2026, 10, 10, 9))).toEqual({
      checkIn: '2027-10-03',
      checkOut: '2027-10-04',
    })
  })

  it('never turns a range end it cannot read into one night', () => {
    for (const text of [
      'Hotel Osaka 20 Oct - 2026',
      'Hotel Osaka 12 Oct - 3pm',
      'Book hotel Kyoto Oct 28–3',
    ]) {
      expect(datesOf(text)).toBe(null)
    }
  })

  it('reads an end day into the next month only for a short stay', () => {
    expect(datesOf('Hotel Osaka 31 Oct - 2')).toEqual({
      checkIn: '2026-10-31',
      checkOut: '2026-11-02',
    })
    expect(datesOf('Hotel Osaka 5 Oct - 4')).toBe(null)
  })

  it('keeps a weekday followed by a time', () => {
    expect(datesOf('Hotel Osaka Fri 10:30')).toEqual({
      checkIn: '2026-10-09',
      checkOut: '2026-10-10',
    })
  })

  it('stops at 30 nights', () => {
    expect(datesOf('Hotel Osaka 1 Nov - 1 Dec')).toEqual({
      checkIn: '2026-11-01',
      checkOut: '2026-12-01',
    })
    expect(datesOf('Hotel Osaka 1 Nov - 2 Dec')).toBe(null)
  })

  it('keeps a date after "next to", "around" a place and a word ending in -ish', () => {
    for (const text of [
      'Book hotel next to the station 12 Oct',
      'Hotel around Shibuya 12 Oct',
      'Hotel Spanish Steps Rome 12 Oct',
    ]) {
      expect(datesOf(text)?.checkIn).toBe('2026-10-12')
    }
  })

  it('ignores a party count out of range', () => {
    expect(
      bookingDetails('Book hotel Paris 12 Oct for 100 people', FIRST_REFERENCE)
        ?.adults,
    ).toBe(null)
  })

  it('reads only the first clause', () => {
    expect(
      bookingDetails(
        'Book hotel Rome, then flight to Paris 12 Oct',
        FIRST_REFERENCE,
      ),
    ).toBe(null)
  })
})

describe('partyDetails', () => {
  it('reads the party without dates', () => {
    expect(partyDetails('Flight to Osaka 20 Oct 2 adults')).toEqual({
      adults: 2,
      children: null,
      rooms: null,
    })
  })

  it('reads "for 2 standard rooms" as rooms, not a party', () => {
    expect(partyDetails('Book hotel Rome 12 Oct for 2 standard rooms')).toEqual(
      {
        adults: null,
        children: null,
        rooms: 2,
      },
    )
    expect(partyDetails('Hotel Rome 2 adults 2 double rooms')).toEqual({
      adults: 2,
      children: null,
      rooms: 2,
    })
  })

  it('never reads "for <date>" as a party', () => {
    for (const text of [
      'Flight to Osaka for 12 Oct',
      'Book hotel Rome for 25 Jan',
      'Hotel Osaka for 12th',
    ]) {
      expect(partyDetails(text).adults).toBe(null)
    }
  })

  // 23 follow-up: a weekday after "for N" is when, not what date.
  it.each([
    ['Book Hilton Osaka for 2 Sat', '2026-10-10'],
    ['Book hotel Osaka for 2 Fri', '2026-10-09'],
  ])('reads "%s" as 2 adults on the weekday', (text, checkIn) => {
    expect(bookingDetails(text, FIRST_REFERENCE)).toMatchObject({
      adults: 2,
      dates: { checkIn },
    })
  })

  it('reads "for 2 Sat 12 Oct" as 2 adults, no dates (weekday clash)', () => {
    expect(
      bookingDetails('Hotel Osaka for 2 Sat 12 Oct', FIRST_REFERENCE),
    ).toMatchObject({ adults: 2, dates: null })
  })
})
