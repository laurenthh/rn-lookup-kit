import { describe, expect, it } from 'vitest'
import {
  cleanLine,
  clauses,
  fixTypos,
  hasStayNoise,
  placeQuery,
  stripWhen,
} from '../src/places/noise'

describe('cleanLine', () => {
  it.each([
    ['- book hotel in Osaka', 'book hotel in Osaka'],
    ['[ ] Train to Kyoto', 'Train to Kyoto'],
    ['1. Book hotel in Osaka', 'Book hotel in Osaka'],
    ['Day 3: Nara deer park', 'Nara deer park'],
    ['📍 Fushimi Inari', 'Fushimi Inari'],
    ['🏨 Osaka', 'hotel Osaka'],
    ['🏨 book hotel in Osaka', 'book hotel in Osaka'],
    ['✈️ Osaka', 'flight Osaka'],
    ['✈️ flight to Osaka', 'flight to Osaka'],
    [
      'Book hotel in Osaka https://www.booking.com/city/jp/osaka.html',
      'Book hotel in Osaka',
    ],
    ['Book Hotel Nikko Osaka (near station)', 'Book Hotel Nikko Osaka'],
    ['Flights to Florence (FLR) for 2', 'Flights to Florence (FLR)'],
    ['Flight to Orlando ($450)', 'Flight to Orlando'],
    ['Book hotel in Osaka ~¥15,000/night', 'Book hotel in Osaka'],
    ['Book hotel in Osaka for 2 adults 1 child', 'Book hotel in Osaka'],
    ['Book hotel Barcelona 2 nights for 2', 'Book hotel Barcelona'],
    ['Book apartment in Nerja for 2 weeks', 'Book apartment in Nerja'],
    // "for 20-02-2027" is a date, not a party of 20
    [
      'book hotel in madarao for 20-02-2027',
      'book hotel in madarao for 20-02-2027',
    ],
    ['Book 2 rooms at Hotel Nikko Osaka', 'Book at Hotel Nikko Osaka'],
    ['Book family room Hotel Sol', 'Book Hotel Sol'],
    ['Hotel night before in Miami', 'Hotel in Miami'],
    ['Flights for 4 to Orlando', 'Flights to Orlando'],
    ['Where to stay in Osaka?', 'Where to stay in Osaka'],
  ])('%s -> %s', (text, clean) => {
    expect(cleanLine(text)).toBe(clean)
  })

  it.each([
    ['Hotel in Nice for Christmas', 'Hotel in Nice'],
    ['Flights to Lisbon — booked', 'Flights to Lisbon'],
    ['booked: Hotel Granvia', 'Hotel Granvia'],
    ['Hotel booked ✅', 'Hotel'],
    // Status words only at the ends
    ['Taxi to Done Deal Café', 'Taxi to Done Deal Café'],
    ['Sorted Food Studio', 'Sorted Food Studio'],
    ['Well Done Steakhouse', 'Well Done Steakhouse'],
    ['Paid parking near hotel', 'Paid parking near hotel'],
  ])('%s -> %s', (text, clean) => {
    expect(cleanLine(text)).toBe(clean)
  })

  it('keeps a time after "for" (a pick-up time, not a party size)', () => {
    expect(cleanLine('Book taxi to Hotel Granvia for 7am')).toBe(
      'Book taxi to Hotel Granvia for 7am',
    )
  })

  it('drops a counted room kind whole, before "for 2" can read as a party', () => {
    expect(cleanLine('Book hotel Rome for 2 standard rooms 12 Oct')).toBe(
      'Book hotel Rome for 12 Oct',
    )
  })

  it('keeps a date after "for" (not a party size)', () => {
    for (const text of [
      'Book hotel Rome for 25 Jan',
      'Flight to Osaka for 12 October',
    ]) {
      expect(cleanLine(text)).toBe(text)
    }
  })

  it('drops a party before a weekday (23 follow-up)', () => {
    expect(cleanLine('Hotel Osaka for 2 Fri')).toBe('Hotel Osaka Fri')
    expect(cleanLine('Book Hilton Osaka for 2 Sat')).toBe(
      'Book Hilton Osaka Sat',
    )
  })
})

describe('fixTypos', () => {
  it.each([
    ['htl bcn', 'hotel bcn'],
    ['Book hotle in osaka', 'Book hotel in osaka'],
    ['Flt to Osaka', 'flight to Osaka'],
    ['fligth to Osaka', 'flight to Osaka'],
    ['Acc Granada', 'accommodation Granada'],
    ['Book accomodation', 'Book accommodation'],
    // Whole words only
    ['Accra', 'Accra'],
    ['Hotels.com', 'Hotels.com'],
  ])('%s -> %s', (text, fixed) => {
    expect(fixTypos(text)).toBe(fixed)
  })
})

describe('stripWhen', () => {
  it.each([
    ['Hotel Sol Pelícanos 3pm', 'Hotel Sol Pelícanos'],
    ['Hotel Granvia Kyoto 15:00', 'Hotel Granvia Kyoto'],
    ['Osaka Oct 12–15', 'Osaka'],
    // A word that starts like a month isn't one.
    ['Hotel Osaka Oct 12 - 15 Marriott', 'Hotel Osaka Marriott'],
    ['Book Oct 12-15 Novotel Osaka', 'Book Novotel Osaka'],
    ['Hotel Oct 20-25 Marina Bay Sands', 'Hotel Marina Bay Sands'],
    ['Osaka Fri–Sun', 'Osaka'],
    ['bcn fri-sun', 'bcn'],
    ['Osaka 12 Oct', 'Osaka'],
    ['Osaka 12/10', 'Osaka'],
    ['Lisbon in June', 'Lisbon'],
    ['office 8am', 'office'],
    ['airport 05:30', 'airport'],
    ['Hotel Granvia Kyoto for 7am', 'Hotel Granvia Kyoto'],
    ['hotel tomorrow at 9am', 'hotel'],
    ['Osaka on Friday', 'Osaka'],
    ['Hotel Rome 4-7 Nov', 'Hotel Rome'],
    ['Book hotel Madrid 10th-12th March', 'Book hotel Madrid'],
    ['Flight to Bali next Tuesday', 'Flight to Bali'],
    ['Ferry to Naxos 9.30am', 'Ferry to Naxos'],
    // A when-phrase alone leaves nothing
    ['Friday', ''],
    ['at 3pm', ''],
    // Weekday/month names inside names, "Night train", "7-Eleven"
    ['Sun cream', 'Sun cream'],
    ['Sunday Inn', 'Sunday Inn'],
    ['Hotel Monday Kyoto', 'Hotel Monday Kyoto'],
    ['The Saturday Hotel', 'The Saturday Hotel'],
    ['March to Kyoto', 'March to Kyoto'],
    ['Night train to Madrid', 'Night train to Madrid'],
    ['Withdraw yen at 7-Eleven ATM', 'Withdraw yen at 7-Eleven ATM'],
    ['Hotel 1898 Barcelona', 'Hotel 1898 Barcelona'],
    ['Route 66 drive', 'Route 66 drive'],
    // Casual words inside Title-Case names
    ['Midnight Sun Hotel', 'Midnight Sun Hotel'],
    ['Taxi to Morning Glory Cafe', 'Taxi to Morning Glory Cafe'],
    ['Check in to Hotel Friday', 'Check in to Hotel Friday'],
    ['Check in to Hotel Tonight', 'Check in to Hotel Tonight'],
    ['Check in to The Morning Hotel', 'Check in to The Morning Hotel'],
    ['Walk to Sept-Îles', 'Walk to Sept-Îles'],
    // A range runs to its month
    ['Osaka Oct 12 - 15 Nov', 'Osaka'],
    ['Flight to Osaka Friday 9am', 'Flight to Osaka'],
    // A lone day/month at the end is a name only after a stay word
    ['Book hotel in Osaka Friday', 'Book hotel in Osaka'],
    ['Check in to Hilton Osaka Friday', 'Check in to Hilton Osaka'],
    ['Book hotel in Osaka October', 'Book hotel in Osaka'],
    ['Check in to Hotel Sol Monday', 'Check in to Hotel Sol'],
    ['Check in to Hotel Noon', 'Check in to Hotel Noon'],
    ['Check in to Hotel Tomorrow', 'Check in to Hotel Tomorrow'],
  ])('%s -> %s', (text, stripped) => {
    expect(stripWhen(text)).toBe(stripped)
  })
})

describe('clauses', () => {
  it.each([
    [
      'Train to Kyoto then taxi to ryokan',
      ['Train to Kyoto', 'taxi to ryokan'],
    ],
    ['Check out 11am, taxi to KIX', ['Check out 11am', 'taxi to KIX']],
    [
      'Book hotel near Osaka station and dinner at Kani Doraku',
      ['Book hotel near Osaka station', 'dinner at Kani Doraku'],
    ],
    ['Charger + power bank', ['Charger', 'power bank']],
    // A capitalised place after a comma qualifies the name
    ['Check in to Hotel Granvia, Kyoto', ['Check in to Hotel Granvia, Kyoto']],
    ['Fly to Osaka, then train to Kyoto', ['Fly to Osaka', 'train to Kyoto']],
    ['Sun cream, hats, swimsuits', ['Sun cream', 'hats', 'swimsuits']],
    ['Bed and breakfast in York', ['Bed and breakfast in York']],
    // A package is one job: the first noun, with the place
    ['Flight + hotel Barcelona', ['Flight to Barcelona']],
    ['Flights and hotel for Osaka', ['Flights to Osaka']],
    ['Flight + hotel + car Lisbon', ['Flight to Lisbon']],
    ['Hotel + car Lisbon', ['Hotel in Lisbon']],
    // "or" isn't a second job
    ['Hotel or hostel in Lisbon', ['Hotel or hostel in Lisbon']],
  ])('%s', (text, parts) => {
    expect(clauses(text)).toEqual(parts)
  })
})

describe('hasStayNoise', () => {
  it('spots durations, people and rooms, not dates or times', () => {
    expect(hasStayNoise('Hotel Osaka 3 nights')).toBe(true)
    expect(hasStayNoise('Hotel Osaka for 2')).toBe(true)
    expect(hasStayNoise('Book 2 rooms')).toBe(true)
    expect(hasStayNoise('Hotel Casa Fuster')).toBe(false)
    expect(hasStayNoise('Hotel Osaka 3pm')).toBe(false)
  })
})

describe('placeQuery', () => {
  it('drops decoration and pasted links but keeps the rest of the line', () => {
    expect(placeQuery('Day 3: Nara deer park, Todai-ji')).toBe(
      'Nara deer park, Todai-ji',
    )
    expect(
      placeQuery('Dinner at La Cava, Benidorm https://x.example/menu'),
    ).toBe('Dinner at La Cava, Benidorm')
    expect(placeQuery("  Ben & Jerry's  ")).toBe("Ben & Jerry's")
  })
})
