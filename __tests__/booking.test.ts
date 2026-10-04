import { describe, expect, it } from 'vitest'
import { bookingIntent, type BookingIntent } from '../src/travel/booking'

type IntentCase = {
  text: string
  tags?: string[]
  intent: BookingIntent | null
}

const CASES: IntentCase[] = [
  // Check-in: the rest is the stay's name, as typed
  {
    text: 'check in to W Osaka Hotel',
    intent: { kind: 'checkin', name: 'W Osaka Hotel' },
  },
  {
    text: 'check-in at Park Hyatt Tokyo',
    intent: { kind: 'checkin', name: 'Park Hyatt Tokyo' },
  },
  {
    text: 'Checkin at Hotel Nikko Kanazawa',
    intent: { kind: 'checkin', name: 'Hotel Nikko Kanazawa' },
  },
  {
    text: 'Check into the Hilton Osaka',
    intent: { kind: 'checkin', name: 'the Hilton Osaka' },
  },
  {
    text: 'Check in at: Ryokan Kurashiki',
    intent: { kind: 'checkin', name: 'Ryokan Kurashiki' },
  },
  { text: 'check-in at', intent: { kind: 'none' } },
  // A colon, "@" or a capitalised name is as clear as to/at/into (21a)
  {
    text: 'Checkin Hotel Nikko Kanazawa',
    intent: { kind: 'checkin', name: 'Hotel Nikko Kanazawa' },
  },
  {
    text: 'Check-in: Hoshinoya Kyoto',
    intent: { kind: 'checkin', name: 'Hoshinoya Kyoto' },
  },
  {
    text: 'Checkin @ Park Hyatt Tokyo',
    intent: { kind: 'checkin', name: 'Park Hyatt Tokyo' },
  },
  {
    text: 'Early check-in request at Hilton Osaka',
    intent: { kind: 'checkin', name: 'Hilton Osaka' },
  },
  // A when-phrase alone names nothing
  { text: 'Check in at 3pm', intent: { kind: 'none' } },
  { text: 'Check-in: 15:00', intent: { kind: 'none' } },
  { text: 'Check-in Oct 12', intent: { kind: 'none' } },
  {
    text: 'Check in to Park Hyatt at 3pm',
    intent: { kind: 'checkin', name: 'Park Hyatt' },
  },
  // Times and second clauses aren't part of the name
  {
    text: 'Check in at Hotel Sol Pelícanos 3pm',
    intent: { kind: 'checkin', name: 'Hotel Sol Pelícanos' },
  },
  {
    text: 'Check in to Hotel Granvia, dinner at Hyoki',
    intent: { kind: 'checkin', name: 'Hotel Granvia' },
  },
  // Only stay words, or a flight: nothing to look up
  { text: 'Check in to hotel', intent: { kind: 'none' } },
  { text: 'Check in at the Airbnb', intent: { kind: 'none' } },
  { text: 'Check in to flight BA 117', intent: { kind: 'none' } },
  // Otherwise it's not about a stay
  { text: 'check in', intent: null },
  { text: 'check in tomorrow', intent: null },
  { text: 'Check in online for flight', intent: null },
  { text: 'Checking out the market', intent: null },
  // Book a named hotel
  {
    text: 'book W Osaka hotel',
    intent: { kind: 'book', name: 'W Osaka', inCity: false },
  },
  {
    text: 'Book Hotel Nikko Kanazawa',
    intent: { kind: 'book', name: 'Nikko Kanazawa', inCity: false },
  },
  {
    text: 'book a room at the Hilton Osaka',
    intent: { kind: 'book', name: 'Hilton Osaka', inCity: false },
  },
  {
    text: 'Reserve room at Ryokan Kurashiki',
    intent: { kind: 'book', name: 'Kurashiki', inCity: false },
  },
  {
    text: 'book Zzqx Fakename Inn Osaka',
    intent: { kind: 'book', name: 'Zzqx Fakename Osaka', inCity: false },
  },
  {
    text: 'Book Hôtel Plaza Athénée',
    intent: { kind: 'book', name: 'Plaza Athénée', inCity: false },
  },
  // Book in a city
  {
    text: 'book Osaka hotel',
    intent: { kind: 'book', name: 'Osaka', inCity: false },
  },
  {
    text: 'book hotel in Osaka',
    intent: { kind: 'book', name: 'Osaka', inCity: true },
  },
  {
    text: 'Book a guest house near Shinjuku station',
    intent: { kind: 'book', name: 'Shinjuku station', inCity: true },
  },
  {
    text: 'reserve B&B at York',
    intent: { kind: 'book', name: 'York', inCity: true },
  },
  // Durations, people, rooms, dates and prices aren't part of the name
  {
    text: 'Book family room Hotel Sol Pelícanos',
    intent: { kind: 'book', name: 'Sol Pelícanos', inCity: false },
  },
  {
    text: 'Book hotel in Osaka for 2 adults 1 child',
    intent: { kind: 'book', name: 'Osaka', inCity: true },
  },
  {
    text: 'Book hotel in Osaka Oct 12–15',
    intent: { kind: 'book', name: 'Osaka', inCity: true },
  },
  {
    text: 'Book 2 rooms at Hotel Nikko Osaka',
    intent: { kind: 'book', name: 'Nikko Osaka', inCity: false },
  },
  // More verbs, lodging words and short forms
  {
    text: 'Get a hotel in Osaka',
    intent: { kind: 'book', name: 'Osaka', inCity: true },
  },
  {
    text: 'Sort out hotel Osaka',
    intent: { kind: 'book', name: 'Osaka', inCity: false },
  },
  {
    text: 'Find a place to stay in Osaka',
    intent: { kind: 'book', name: 'Osaka', inCity: true },
  },
  {
    text: 'Reserve villa in Algarve',
    intent: { kind: 'book', name: 'Algarve', inCity: true },
  },
  {
    text: 'Book Villa Cora',
    intent: { kind: 'book', name: 'Villa Cora', inCity: false },
  },
  {
    text: 'Book hotel block near Villa Cora',
    intent: { kind: 'book', name: 'Villa Cora', inCity: true },
  },
  {
    text: 'Book htl in Osaka',
    intent: { kind: 'book', name: 'Osaka', inCity: true },
  },
  {
    text: 'Book W Barcelona',
    intent: { kind: 'book', name: 'W Barcelona', inCity: false },
  },
  {
    text: 'Book hotel, Kyoto',
    intent: { kind: 'book', name: 'Kyoto', inCity: true },
  },
  {
    text: 'Book Premier Inn Leeds',
    intent: { kind: 'book', name: 'Premier Inn Leeds', inCity: false },
  },
  // A reason or an unnamed spot isn't a place; a lowercase city is
  { text: 'Book hotel for conference', intent: { kind: 'none' } },
  { text: 'Find a hotel near the station', intent: { kind: 'none' } },
  {
    text: 'Book hotel in osaka',
    intent: { kind: 'book', name: 'osaka', inCity: true },
  },
  {
    text: 'Book hotel near osaka station',
    intent: { kind: 'book', name: 'osaka station', inCity: true },
  },
  {
    text: 'Find somewhere to stay in lisbon',
    intent: { kind: 'book', name: 'lisbon', inCity: true },
  },
  // Packages, with a verb
  {
    text: 'Book flight + hotel Lisbon',
    intent: { kind: 'flight', to: 'Lisbon', from: null },
  },
  {
    text: 'Book flights and hotel Faro',
    intent: { kind: 'flight', to: 'Faro', from: null },
  },
  // The first of two jobs wins
  {
    text: 'Book hotel in Kyoto and Osaka',
    intent: { kind: 'book', name: 'Kyoto', inCity: true },
  },
  // The hotel tag stands in for an accommodation word
  {
    text: 'book Aman Kyoto',
    tags: ['Hotel'],
    intent: { kind: 'book', name: 'Aman Kyoto', inCity: false },
  },
  // Nothing to act on
  { text: 'book hotel', intent: { kind: 'none' } },
  { text: 'Book Hotel', intent: { kind: 'none' } },
  { text: 'book a room at the hotel', intent: { kind: 'none' } },
  { text: 'Book cruise Royal Caribbean', intent: { kind: 'none' } },
  // Booking a table, a tour or tickets is about a place (21a)
  { text: 'Reserve dinner table', intent: null },
  { text: 'Book restaurant Kikunoi', intent: null },
  { text: 'Book Antelope Canyon tour', intent: null },
  { text: 'Book Ghibli Museum tickets', intent: null },
  { text: 'Book campsite Zion', intent: null },
  { text: 'Book Airbnb in Gràcia', intent: null },
  { text: 'Book dinner at the Hilton', intent: null },
  { text: 'Reserve table at Hyatt', intent: null },
  // "Get/need/find" without a stay isn't a booking at all
  { text: 'Get SIM card', intent: null },
  // Not a booking verb: today's stay/place kinds apply
  { text: 'Booking reference 12345', intent: null },
  { text: 'Checking out the market', intent: null },
  { text: 'Hotel Nikko Kanazawa', intent: null },
  { text: 'Eiffel Tower', intent: null },
  { text: 'Bookstore in Jimbocho', intent: null },
]

describe('bookingIntent', () => {
  it.each(CASES)('$text', ({ text, tags, intent }) => {
    expect(bookingIntent({ text, tags: tags ?? [] })).toEqual(intent)
  })

  it('trims before matching', () => {
    expect(bookingIntent({ text: '  book hotel in Osaka ', tags: [] })).toEqual(
      { kind: 'book', name: 'Osaka', inCity: true },
    )
  })
})

const TRANSPORT_CASES: IntentCase[] = [
  // Flights: "flight(s)" or "fly", "to <X>", optional "from <Y>", either order
  {
    text: 'book flight to Osaka',
    intent: { kind: 'flight', to: 'Osaka', from: null },
  },
  { text: 'fly to Osaka', intent: { kind: 'flight', to: 'Osaka', from: null } },
  {
    text: 'reserve flights to Osaka',
    intent: { kind: 'flight', to: 'Osaka', from: null },
  },
  {
    text: 'flight from Tokyo to Osaka',
    intent: { kind: 'flight', to: 'Osaka', from: 'Tokyo' },
  },
  {
    text: 'flight to Osaka from Tokyo',
    intent: { kind: 'flight', to: 'Osaka', from: 'Tokyo' },
  },
  // "fly to" must be whole words
  { text: 'Flyer to Osaka', intent: null },
  // More lead words: verb, article, adjective, "tickets", plane/flying
  {
    text: 'book a flight to Osaka',
    intent: { kind: 'flight', to: 'Osaka', from: null },
  },
  {
    text: 'Book my flight to Osaka',
    intent: { kind: 'flight', to: 'Osaka', from: null },
  },
  {
    text: 'Book return flight to Osaka',
    intent: { kind: 'flight', to: 'Osaka', from: null },
  },
  {
    text: 'one-way flight to Osaka',
    intent: { kind: 'flight', to: 'Osaka', from: null },
  },
  {
    text: 'Plane to Osaka',
    intent: { kind: 'flight', to: 'Osaka', from: null },
  },
  {
    text: 'Flying to Osaka',
    intent: { kind: 'flight', to: 'Osaka', from: null },
  },
  // Ground: transit modes -> travelmode=transit
  {
    text: 'train to Osaka',
    intent: { kind: 'ground', mode: 'transit', to: 'Osaka', from: null },
  },
  {
    text: 'book bus to Osaka',
    intent: { kind: 'ground', mode: 'transit', to: 'Osaka', from: null },
  },
  {
    text: 'transit to Osaka Station',
    intent: {
      kind: 'ground',
      mode: 'transit',
      to: 'Osaka Station',
      from: null,
    },
  },
  {
    text: 'take the metro to Shibuya',
    intent: { kind: 'ground', mode: 'transit', to: 'Shibuya', from: null },
  },
  {
    text: 'subway to Ueno',
    intent: { kind: 'ground', mode: 'transit', to: 'Ueno', from: null },
  },
  {
    text: 'tram to the museum',
    intent: { kind: 'ground', mode: 'transit', to: 'the museum', from: null },
  },
  {
    text: 'shinkansen to Kyoto',
    intent: { kind: 'ground', mode: 'transit', to: 'Kyoto', from: null },
  },
  {
    text: 'ferry to Naoshima',
    intent: { kind: 'ground', mode: 'transit', to: 'Naoshima', from: null },
  },
  {
    text: 'Book train tickets to Osaka',
    intent: { kind: 'ground', mode: 'transit', to: 'Osaka', from: null },
  },
  {
    text: 'catch the train to Osaka',
    intent: { kind: 'ground', mode: 'transit', to: 'Osaka', from: null },
  },
  // Ground: driving modes -> travelmode=driving
  {
    text: 'taxi to Osaka Station',
    intent: {
      kind: 'ground',
      mode: 'driving',
      to: 'Osaka Station',
      from: null,
    },
  },
  {
    text: 'book a cab to the airport',
    intent: { kind: 'ground', mode: 'driving', to: 'the airport', from: null },
  },
  {
    text: 'get a taxi to the hotel',
    intent: { kind: 'ground', mode: 'driving', to: 'the hotel', from: null },
  },
  // from/to either order
  {
    text: 'train from Tokyo to Osaka',
    intent: { kind: 'ground', mode: 'transit', to: 'Osaka', from: 'Tokyo' },
  },
  {
    text: 'train to Osaka from Tokyo',
    intent: { kind: 'ground', mode: 'transit', to: 'Osaka', from: 'Tokyo' },
  },
  // Transport wins over stay/check-in/book-stay
  {
    text: 'taxi to W Osaka Hotel',
    intent: {
      kind: 'ground',
      mode: 'driving',
      to: 'W Osaka Hotel',
      from: null,
    },
  },
  {
    text: 'book taxi to hotel',
    intent: { kind: 'ground', mode: 'driving', to: 'hotel', from: null },
  },
  // No destination at all: flights have no useful place fallback
  { text: 'book flight', intent: { kind: 'none' } },
  { text: 'book a flight', intent: { kind: 'none' } },
  { text: 'flight to', intent: { kind: 'none' } },
  // A bare mode word (with only a verb/article) falls through to a place
  // search instead — "Taxi"/"Train"/"Bus" alone show nearby stops on Maps
  { text: 'Taxi', intent: null },
  { text: 'Train', intent: null },
  { text: 'Bus', intent: null },
  { text: 'book a taxi', intent: null },
  // A mode word with a dangling "to" is still claimed, but has no place
  { text: 'taxi to', intent: { kind: 'none' } },
  // Not transport: no "to <X>", keeps today's behaviour (not a booking verb)
  { text: 'Train ticket receipt', intent: null },
  { text: 'Bus pass', intent: null },
  { text: 'Ferry terminal', intent: null },
  { text: 'Taxi receipt', intent: null },
  // Routes: "A to B", "A - B", "A -> B", "A → B", "A – B", "A > B"
  {
    text: 'Train Kyoto to Nara',
    intent: { kind: 'ground', mode: 'transit', to: 'Nara', from: 'Kyoto' },
  },
  {
    text: 'Bus Lisbon - Porto',
    intent: { kind: 'ground', mode: 'transit', to: 'Porto', from: 'Lisbon' },
  },
  {
    text: 'Train Lisbon -> Porto',
    intent: { kind: 'ground', mode: 'transit', to: 'Porto', from: 'Lisbon' },
  },
  {
    text: 'Bus Lisbon → Porto',
    intent: { kind: 'ground', mode: 'transit', to: 'Porto', from: 'Lisbon' },
  },
  {
    text: 'TGV Paris–Lyon',
    intent: { kind: 'ground', mode: 'transit', to: 'Lyon', from: 'Paris' },
  },
  {
    text: 'Coach London > Bath',
    intent: { kind: 'ground', mode: 'transit', to: 'Bath', from: 'London' },
  },
  {
    text: 'Kyoto → Osaka',
    intent: { kind: 'ground', mode: 'transit', to: 'Osaka', from: 'Kyoto' },
  },
  // A lowercase word before "to" isn't an origin
  { text: 'Grab coffee to go', intent: null },
  // An unspaced hyphen is part of a name, except between airport codes
  {
    text: 'Bus to Senso-ji',
    intent: { kind: 'ground', mode: 'transit', to: 'Senso-ji', from: null },
  },
  // Airport codes and flight numbers are flights
  {
    text: 'MAN-AGP',
    intent: { kind: 'flight', to: 'AGP', from: 'MAN' },
  },
  {
    text: 'SYD to KIX',
    intent: { kind: 'flight', to: 'KIX', from: 'SYD' },
  },
  {
    text: 'Flight LHR-JFK Mon 9am',
    intent: { kind: 'flight', to: 'JFK Mon 9am', from: 'LHR' },
  },
  {
    text: 'Flight NRT→KIX JL 123',
    intent: { kind: 'flight', to: 'KIX', from: 'NRT' },
  },
  {
    text: 'JL5 Tokyo–New York',
    intent: { kind: 'flight', to: 'New York', from: 'Tokyo' },
  },
  {
    text: 'Jetstar JQ 25 to Osaka',
    intent: { kind: 'flight', to: 'Osaka', from: null },
  },
  { text: 'BA 117', intent: null },
  { text: 'Flight BA 117', intent: { kind: 'none' } },
  // A flight to a named place; "home", "back" or only "from" isn't one
  { text: 'Fly Tokyo', intent: { kind: 'flight', to: 'Tokyo', from: null } },
  { text: 'Flight home Sunday 6pm', intent: { kind: 'none' } },
  { text: 'Flight from Osaka', intent: { kind: 'none' } },
  // Modifiers before the mode, and more modes
  {
    text: 'Night train to Madrid',
    intent: { kind: 'ground', mode: 'transit', to: 'Madrid', from: null },
  },
  {
    text: 'Catch the 8:15 train to Kyoto',
    intent: { kind: 'ground', mode: 'transit', to: 'Kyoto', from: null },
  },
  {
    text: 'Reserve seats on Hikari to Osaka',
    intent: { kind: 'ground', mode: 'transit', to: 'Osaka', from: null },
  },
  {
    text: 'Shinkansen Nozomi 23 Tokyo→Kyoto',
    intent: { kind: 'ground', mode: 'transit', to: 'Kyoto', from: 'Tokyo' },
  },
  {
    text: 'Book airport transfer to Hotel Sol',
    intent: { kind: 'ground', mode: 'driving', to: 'Hotel Sol', from: null },
  },
  {
    text: 'Uber from JFK to hotel',
    intent: { kind: 'ground', mode: 'driving', to: 'hotel', from: 'JFK' },
  },
  {
    text: 'Water taxi to Murano',
    intent: { kind: 'ground', mode: 'transit', to: 'Murano', from: null },
  },
  {
    text: 'Walk to Meiji Shrine',
    intent: {
      kind: 'ground',
      mode: 'walking',
      to: 'Meiji Shrine',
      from: null,
    },
  },
  {
    text: 'Bike to Arashiyama',
    intent: {
      kind: 'ground',
      mode: 'bicycling',
      to: 'Arashiyama',
      from: null,
    },
  },
  { text: 'Walking tour Alfama', intent: null },
  // The first leg wins
  {
    text: 'Train to Kyoto then taxi to ryokan',
    intent: { kind: 'ground', mode: 'transit', to: 'Kyoto', from: null },
  },
  {
    text: 'Flight + hotel Barcelona',
    intent: { kind: 'flight', to: 'Barcelona', from: null },
  },
  // 21a review: flight numbers only at the start of the rest or end of `to`
  {
    text: 'Flight to LA 12 Oct',
    intent: { kind: 'flight', to: 'LA 12 Oct', from: null },
  },
  {
    text: 'Flight to HK 5 Dec',
    intent: { kind: 'flight', to: 'HK 5 Dec', from: null },
  },
  {
    text: 'Flight to SF 3 Nov',
    intent: { kind: 'flight', to: 'SF 3 Nov', from: null },
  },
  {
    text: 'Flights to LA 12',
    intent: { kind: 'flight', to: 'LA 12', from: null },
  },
  {
    text: 'Flight from LA 12 Oct to NYC',
    intent: { kind: 'flight', to: 'NYC', from: 'LA 12 Oct' },
  },
  {
    text: 'Flight NH 880 to Osaka',
    intent: { kind: 'flight', to: 'Osaka', from: null },
  },
  {
    text: 'Take flight JL5 to Osaka',
    intent: { kind: 'flight', to: 'Osaka', from: null },
  },
  {
    text: 'Fly BA 117 to London',
    intent: { kind: 'flight', to: 'London', from: null },
  },
  {
    text: 'Flight BA117 LHR-JFK',
    intent: { kind: 'flight', to: 'JFK', from: 'LHR' },
  },
  { text: 'LHR-JFK BA117', intent: { kind: 'flight', to: 'JFK', from: 'LHR' } },
  // Never flight numbers
  { text: 'Hotel booking confirmation #AB123', intent: null },
  { text: 'Gate B12 by 9', intent: null },
  { text: 'A380 upgrade', intent: null },
  // Airline names are flight words, never an origin
  {
    text: 'Book Qantas to Sydney',
    intent: { kind: 'flight', to: 'Sydney', from: null },
  },
  {
    text: 'Fly BA to Boston',
    intent: { kind: 'flight', to: 'Boston', from: null },
  },
  {
    text: 'Flight Emirates to Dubai',
    intent: { kind: 'flight', to: 'Dubai', from: null },
  },
  {
    text: 'easyJet to Nice',
    intent: { kind: 'flight', to: 'Nice', from: null },
  },
  { text: 'Qantas', intent: null },
  // More leads and vocabulary
  {
    text: 'Check flights to Tokyo',
    intent: { kind: 'flight', to: 'Tokyo', from: null },
  },
  {
    text: 'Cheap flights to Lisbon',
    intent: { kind: 'flight', to: 'Lisbon', from: null },
  },
  {
    text: 'Grab a taxi to Clarke Quay',
    intent: { kind: 'ground', mode: 'driving', to: 'Clarke Quay', from: null },
  },
  {
    text: 'Narita Express to Shinjuku',
    intent: { kind: 'ground', mode: 'transit', to: 'Shinjuku', from: null },
  },
  {
    text: 'Megabus to Manchester',
    intent: { kind: 'ground', mode: 'transit', to: 'Manchester', from: null },
  },
  { text: 'Grab Starbucks to go', intent: null },
  // Leading punctuation never leaks into the origin
  {
    text: 'Flight: LHR to JFK',
    intent: { kind: 'flight', to: 'JFK', from: 'LHR' },
  },
  {
    text: 'Flights – Manchester to Malaga',
    intent: { kind: 'flight', to: 'Malaga', from: 'Manchester' },
  },
  // Bare routes: two place names, an optional mode word at the end
  {
    text: 'Lisbon to Porto',
    intent: { kind: 'ground', mode: 'transit', to: 'Porto', from: 'Lisbon' },
  },
  {
    text: 'Lisbon - Porto',
    intent: { kind: 'ground', mode: 'transit', to: 'Porto', from: 'Lisbon' },
  },
  {
    text: 'London to Edinburgh train',
    intent: {
      kind: 'ground',
      mode: 'transit',
      to: 'Edinburgh',
      from: 'London',
    },
  },
  {
    text: 'Hotel to airport taxi',
    intent: { kind: 'ground', mode: 'driving', to: 'airport', from: 'Hotel' },
  },
  // Multi-leg: the first leg
  {
    text: 'Kyoto → Osaka → Nara',
    intent: { kind: 'ground', mode: 'transit', to: 'Osaka', from: 'Kyoto' },
  },
  {
    text: 'Train Tokyo - Kyoto - Osaka',
    intent: { kind: 'ground', mode: 'transit', to: 'Kyoto', from: 'Tokyo' },
  },
  // Not routes: a label, a when-word, a person or a stay at either end
  ...[
    'Dinner - Ichiran',
    'Coffee - Blue Bottle',
    'Museum - Louvre',
    'Tickets - Ghibli Museum',
    'Morning - Fushimi Inari',
    'Monday - Tokyo',
    'AM - Nara',
    'Trip to Nara',
    'Welcome to Osaka',
    'Gift to Mum',
    'Mum to Dad',
    'Plan A to Plan B',
    'Lisbon – Hotel',
    'Tokyo - Day 1',
    'Virgin Mary statue – Plaza',
  ].map((text) => ({ text, intent: null })),
  // Still routes
  {
    text: 'Frankfurt am Main to Köln',
    intent: {
      kind: 'ground',
      mode: 'transit',
      to: 'Köln',
      from: 'Frankfurt am Main',
    },
  },
  {
    text: 'Rio de Janeiro -> São Paulo',
    intent: {
      kind: 'ground',
      mode: 'transit',
      to: 'São Paulo',
      from: 'Rio de Janeiro',
    },
  },
  {
    text: 'Paris to Nice TGV',
    intent: { kind: 'ground', mode: 'transit', to: 'Nice', from: 'Paris' },
  },
  {
    text: 'Kyoto – Nara – Osaka',
    intent: { kind: 'ground', mode: 'transit', to: 'Nara', from: 'Kyoto' },
  },
  // An ambiguous airline name followed by a place or a mode word isn't one
  {
    text: 'Spirit Lake to Portland',
    intent: {
      kind: 'ground',
      mode: 'transit',
      to: 'Portland',
      from: 'Spirit Lake',
    },
  },
  {
    text: 'Spirit of Tasmania ferry to Devonport',
    intent: { kind: 'ground', mode: 'transit', to: 'Devonport', from: null },
  },
  {
    text: 'Virgin to Vegas',
    intent: { kind: 'flight', to: 'Vegas', from: null },
  },
  // Ambiguous airline names need a destination after them
  {
    text: 'Delta to Atlanta',
    intent: { kind: 'flight', to: 'Atlanta', from: null },
  },
  {
    text: 'Fly United to Chicago',
    intent: { kind: 'flight', to: 'Chicago', from: null },
  },
  {
    text: 'Emirates Dubai → Perth',
    intent: { kind: 'flight', to: 'Perth', from: 'Dubai' },
  },
  // Not routes
  { text: 'Passports – check expiry dates', intent: null },
  { text: 'Ask neighbour to feed cat', intent: null },
  { text: 'Lounge access — Priority Pass', intent: null },
  { text: 'Notes -> see email', intent: null },
  { text: 'Itinerary -> shared doc', intent: null },
  { text: 'Hotel – Osaka', intent: null },
  { text: 'Back to hotel', intent: null },
  // A bare code pair needs nothing after it but a date or a flight number
  { text: 'ATM - USD cash', intent: null },
  { text: 'GPS - SOS app', intent: null },
  { text: 'USD to JPY', intent: null },
  // Case and diacritics
  {
    text: 'TAXI TO OSAKA',
    intent: { kind: 'ground', mode: 'driving', to: 'OSAKA', from: null },
  },
  {
    text: 'train to Kōbe',
    intent: { kind: 'ground', mode: 'transit', to: 'Kōbe', from: null },
  },
]

describe('bookingIntent — transport', () => {
  it.each(TRANSPORT_CASES)('$text', ({ text, tags, intent }) => {
    expect(bookingIntent({ text, tags: tags ?? [] })).toEqual(intent)
  })
})
