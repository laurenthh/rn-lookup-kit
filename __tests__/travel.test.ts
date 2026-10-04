import { afterEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { createTravelLookup, travelIntent as intentOf } from '../src/travel'
import { AIRPORT_NOTE_OWNS, travelKind } from '../src/travel/travel'
import { travelLookup } from './helpers/registry'
import { resolver } from './helpers/registry'
import { lookupLinkKind, applyLookupPatch, mergeNoteLine } from '../src/core'
import { buildItem } from './helpers/items'
import { travelIntent } from './helpers/travel'

const DDG = 'https://duckduckgo.com/?q=%5C'

const ddgLink = (query: string) => `${DDG}${encodeURIComponent(query)}`

// Serves a first-result page per query; unknown queries fail like offline.
const serve = (targets: Record<string, string>) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const query = decodeURIComponent(String(input).slice(DDG.length))
    const target = targets[query]
    if (target === undefined) {
      throw new TypeError('offline')
    }
    return new Response(
      `<meta http-equiv='refresh' content='0; url=/l/?uddg=${encodeURIComponent(target)}&rut=x'>`,
    )
  })

const queried = (fetchMock: MockInstance) =>
  fetchMock.mock.calls.map(([input]) =>
    decodeURIComponent(String(input).slice(DDG.length)),
  )

afterEach(() => {
  vi.restoreAllMocks()
})

type TravelCase = { text: string; tags?: string[]; kind: 'stay' | 'place' }

const CASES: TravelCase[] = [
  // Keyword hotels
  { text: 'Hotel Gracery Shinjuku', kind: 'stay' },
  { text: 'Generator Hostel Berlin', kind: 'stay' },
  { text: 'Ryokan Kurashiki', kind: 'stay' },
  { text: 'Cozy B&B Bath', kind: 'stay' },
  { text: 'Nice B & B by the sea', kind: 'stay' },
  { text: 'Downtown Bed and Breakfast', kind: 'stay' },
  { text: 'Backpackers Hostel Kyoto', kind: 'stay' },
  { text: 'Sunset Motel', kind: 'stay' },
  { text: 'Lakeside Lodge', kind: 'stay' },
  { text: 'Downtown Guesthouse', kind: 'stay' },
  { text: 'Riverside Guest House', kind: 'stay' },
  { text: 'Kyoto Minshuku Sakura', kind: 'stay' },
  { text: 'Marrakech Riad Dar', kind: 'stay' },
  { text: 'Nine Hours Capsule Hotel', kind: 'stay' },
  { text: 'Fes Pension Central', kind: 'stay' },
  { text: 'City Center Suites', kind: 'stay' },
  { text: 'Beachfront Resort', kind: 'stay' },
  { text: 'Cheap BnB Room', kind: 'stay' },
  // "inn" still catches this even with "holiday inn" gone from the chains
  { text: 'Holiday Inn Express Tokyo', kind: 'stay' },
  // Chains without keywords
  { text: 'Park Hyatt Tokyo', kind: 'stay' },
  { text: 'Ibis Styles Paris', kind: 'stay' },
  { text: 'Conrad Bangkok', kind: 'stay' },
  { text: 'Fairmont Banff', kind: 'stay' },
  { text: 'Shangri-La Singapore', kind: 'stay' },
  { text: 'Mandarin Oriental Bangkok', kind: 'stay' },
  { text: 'Waldorf Astoria Chicago', kind: 'stay' },
  { text: 'Crowne Plaza Dubai', kind: 'stay' },
  { text: 'Banyan Tree Phuket', kind: 'stay' },
  { text: 'Rosewood London', kind: 'stay' },
  { text: 'The Hoxton Amsterdam', kind: 'stay' },
  // hotel item-tag override
  { text: 'Random House B', tags: ['HOTEL'], kind: 'stay' },
  // Places with a keyword hiding inside another word
  { text: 'Dinner at Robatayaki', kind: 'place' },
  { text: 'Innsbruck old town', kind: 'place' },
  { text: 'Pinnacle Point', kind: 'place' },
  { text: "Finnegan's Pub", kind: 'place' },
  { text: 'Business Suite Rental', kind: 'place' },
  { text: 'Capsule wardrobe list', kind: 'place' },
  // Airbnb has no site of its own
  { text: 'Airbnb loft downtown', kind: 'place' },
  // Plain places
  { text: 'Senso-ji Temple', kind: 'place' },
  { text: 'Eiffel Tower', kind: 'place' },
  { text: 'Central Park', kind: 'place' },
  // Diacritics normalize before matching
  { text: 'Hôtel Plaza Athénée', kind: 'stay' },
  { text: 'Pensión Central', kind: 'stay' },
]

describe('travelKind', () => {
  it.each(CASES)('$text -> $kind', ({ text, tags, kind }) => {
    expect(travelKind({ text, tags: tags ?? [] })).toBe(kind)
  })
})

describe('travelKind — accepted trade-offs', () => {
  it('Aman Kyoto has no keyword or chain match, so it needs the hotel tag', () => {
    expect(travelKind({ text: 'Aman Kyoto', tags: [] })).toBe('place')
    expect(travelKind({ text: 'Aman Kyoto', tags: ['hotel'] })).toBe('stay')
  })

  it('星のや京都 is a known keyword-less miss, like Aman, without the hotel tag', () => {
    expect(travelKind({ text: '星のや京都', tags: [] })).toBe('place')
  })

  it('Hilton Head Island is an accepted stay: the hilton chain wins even though it names a place', () => {
    expect(travelKind({ text: 'Hilton Head Island', tags: [] })).toBe('stay')
  })

  it('Dingle Peninsula and Monterey Peninsula are places now that peninsula is not a chain', () => {
    expect(travelKind({ text: 'Dingle Peninsula', tags: [] })).toBe('place')
    expect(travelKind({ text: 'Monterey Peninsula', tags: [] })).toBe('place')
  })
})

describe('travelIntent', () => {
  it('prefers check-in and book intents over stay and place', () => {
    expect(
      travelIntent({ text: 'check in to W Osaka Hotel', tags: [] }),
    ).toEqual({ kind: 'checkin', name: 'W Osaka Hotel' })
    expect(travelIntent({ text: 'book W Osaka hotel', tags: [] })).toEqual({
      kind: 'book',
      name: 'W Osaka',
      inCity: false,
    })
    expect(travelIntent({ text: 'W Osaka Hotel', tags: [] })).toEqual({
      kind: 'stay',
    })
    expect(travelIntent({ text: 'Eiffel Tower', tags: [] })).toEqual({
      kind: 'place',
    })
  })

  it('prefers transport over a stay even when the destination names a hotel', () => {
    expect(travelIntent({ text: 'taxi to W Osaka Hotel', tags: [] })).toEqual({
      kind: 'ground',
      mode: 'driving',
      to: 'W Osaka Hotel',
      from: null,
    })
  })
})

describe('travelIntent — stay phrases without a verb (21a)', () => {
  it.each([
    ['Hotel near Javits Center', 'Javits Center'],
    ['Motel in Flagstaff', 'Flagstaff'],
    ['Cheap hotel in Osaka', 'Osaka'],
    ['Osaka hotel', 'Osaka'],
    ['京都 ryokan', '京都'],
    ['Where to stay in Osaka?', 'Osaka'],
    ['hostel bed Lisbon 3 nights', 'Lisbon'],
    ['Hotel Osaka 3 nights', 'Osaka'],
    ['🏨 Osaka', 'Osaka'],
  ])('%s is a city booking', (text, name) => {
    expect(travelIntent({ text, tags: [] })).toEqual({
      kind: 'book',
      name,
      inCity: true,
    })
  })

  it.each([
    'Hotel Casa Fuster',
    'Sunset Motel',
    'Park Hyatt Tokyo',
    'Inn at the Market, Seattle',
    'Generator Paris',
  ])('%s is a named stay', (text) => {
    expect(travelIntent({ text, tags: [] })).toEqual({ kind: 'stay' })
  })
})

describe('travelIntent — the 21a review', () => {
  it.each([
    ['Hotel booking Rome', 'Rome'],
    ['Hotel reservation Kyoto', 'Kyoto'],
    ['Hotel booking for Rome 3 nights', 'Rome'],
    ['Accommodation Bali', 'Bali'],
    ['Hotels in Lisbon', 'Lisbon'],
    ['Hostels Bangkok', 'Bangkok'],
    ['Hotel nr Gatwick', 'Gatwick'],
    ['Hotel for the night in Dover', 'Dover'],
    ['2 nights Edinburgh hotel', 'Edinburgh'],
    ['Lisbon hotel?', 'Lisbon'],
    ['Hotel: Osaka 3 nights', 'Osaka'],
  ])('%s is a city booking', (text, name) => {
    expect(travelIntent({ text, tags: [] })).toEqual({
      kind: 'book',
      name,
      inCity: true,
    })
  })

  it.each([
    ['Back to hotel', 'none'],
    ['Keys to hotel', 'none'],
    ['Leave bags at hotel', 'none'],
    ['Drop bags at hostel', 'none'],
    ['Walk from hostel', 'none'],
    ['Shuttle from hotel', 'none'],
    ['Pick up keys from apartment', 'none'],
    ['Laundry at hotel', 'place'],
    ['Pool at hotel', 'place'],
    ['Pharmacy near hotel', 'place'],
    ['Shops near hotel', 'place'],
    ['ATM near hotel', 'place'],
    ['Bus stop near hotel', 'place'],
    ['Night out near hostel', 'place'],
    ['Dinner at Hotel Okura', 'place'],
    ['Lunch at the Hilton', 'place'],
    ['Dinner at the Ritz-Carlton', 'place'],
    ['Hotel California tickets', 'place'],
    ['Hotel breakfast', 'none'],
    ['Ryokan dinner 18:30 (included)', 'none'],
    ['Confirm hotel booking Osaka', 'none'],
    ['Hotel booking confirmation #AB123', 'none'],
    ['Hotel', 'none'],
    ['Hotel ✓', 'none'],
    ['Flights ✓', 'none'],
    ['Flights booked', 'none'],
    ['Train ticket refund', 'none'],
    ['Transfer £50 to Sam', 'none'],
    ['Number 1 bus to Shibuya', 'place'],
    ['Upgrade to suite at Park Hyatt', 'stay'],
    ['Message in a Bottle bar', 'place'],
    ['Docs Burgers', 'place'],
    ['Roadside assistance number', 'none'],
    ['Travelodge Brighton', 'stay'],
    ['Sunday Inn', 'stay'],
    ['Hat shop Harajuku', 'place'],
    ['Top Hat bar', 'place'],
    ['Panama hat', 'none'],
    ['Hotel Monday Kyoto', 'stay'],
  ])('%s -> %s', (text, kind) => {
    expect(travelIntent({ text, tags: [] }).kind).toBe(kind)
  })

  it('classifies only the start of a very long line', () => {
    const text = `Train to Kyoto ${'and more '.repeat(200)}`
    expect(travelIntent({ text, tags: [] }).kind).toBe('ground')
  })
})

describe('travelIntent — chain names', () => {
  it.each([
    ['Ritz crackers', 'none'],
    ['Ritz-Carlton Kyoto', 'stay'],
    ['Generator rental for camping', 'place'],
    ['Nobu Malibu lunch', 'place'],
    ['W Barcelona', 'stay'],
    ['Walk W', 'place'],
  ])('%s -> %s', (text, kind) => {
    expect(travelIntent({ text, tags: [] }).kind).toBe(kind)
  })
})

describe('travelIntent — lines the lookup cannot help with', () => {
  it.each([
    'Passport',
    'Passports – check expiry dates',
    'Sun cream, hats, swimsuits',
    'Travel insurance docs',
    'Print boarding pass',
    'JR Pass voucher',
    'Download offline maps',
    'Set out-of-office',
    'Print hotel confirmation',
    'Hotel wifi password',
    'Cancel hotel Osaka',
    'Ryokan dinner 18:30 (included)',
    'Hostel checkout 10am',
    'Check out by 11',
    'Hotel check-in 3pm',
    'Online check-in opens 24h before',
    'Train ticket receipt',
    'book hotel',
  ])('%s -> none', (text) => {
    expect(travelIntent({ text, tags: [] })).toEqual({ kind: 'none' })
  })

  it.each([
    'Currency exchange',
    'Exchange JR Pass at Tokyo Station',
    'Pick up pocket wifi at KIX',
    'Downtown Bed and Breakfast',
    'Snacks + water',
    'Check out the Louvre',
  ])('%s still has a lookup', (text) => {
    expect(travelIntent({ text, tags: [] }).kind).not.toBe('none')
  })

  it('takes a later clause when the first is admin', () => {
    expect(
      travelIntent({ text: 'Check out 11am, taxi to KIX', tags: [] }),
    ).toEqual({ kind: 'ground', mode: 'driving', to: 'KIX', from: null })
  })
})

describe('travelIntent — food words', () => {
  it.each([
    'Banana',
    'Bananas',
    '2 bananas',
    'Milk',
    'Oat milk',
    'Chicken',
    'Coffee beans',
    'Salmon',
    'Cheddar',
    'Toilet paper',
    'Batteries',
    'Battery',
    'Camera battery',
    'Washing-up liquid',
    'Lamb chops',
    'Shampoo and conditioner',
    'Band-aids',
    'Deodorant',
  ])('%s -> none', (text) => {
    expect(travelIntent({ text, tags: [] })).toEqual({ kind: 'none' })
  })

  // Dishes and drinks people go out for, with or without a food-data entry.
  it.each([
    'Ramen',
    'Pizza',
    'Tacos',
    'Ice cream',
    'Fish and chips',
    'Coffee',
    'Tea',
    'Beer',
    '2 beers',
    'Wine',
    'Sushi',
    'Gelato',
    'Dim sum',
    'Lobster',
    'Pretzels',
    'Cinnamon buns',
    'Mezcal',
  ])('%s stays a place (eat out)', (text) => {
    expect(travelIntent({ text, tags: [] })).toEqual({ kind: 'place' })
  })

  it.each([
    'Nishiki Market',
    'Senso-ji',
    'Borough Market',
    'Banana Republic',
    'Visit Ben Thanh Market',
    'Battery Park',
    'Cheddar Gorge',
    'Soap Museum',
    'Coffee at Blue Bottle',
    'Turkey',
    'turkey',
    'Champagne',
    'Java',
    'Dijon',
    'Cognac',
    'Tequila',
    'Prosecco',
    'Bologna',
    'Philadelphia',
    'Shiraz',
  ])('%s stays a place', (text) => {
    expect(travelIntent({ text, tags: [] })).toEqual({ kind: 'place' })
  })

  it.each(['Taxi', 'Grab coffee to go'])(
    '%s keeps its Maps search (mode word, verb-led)',
    (text) => {
      expect(travelIntent({ text, tags: [] })).toEqual({ kind: 'place' })
    },
  )

  it('takes a later clause after a grocery one', () => {
    expect(travelIntent({ text: 'Milk, taxi to KIX', tags: [] })).toEqual({
      kind: 'ground',
      mode: 'driving',
      to: 'KIX',
      from: null,
    })
  })

  it('hides the lookup on a grocery line', () => {
    expect(travelLookup.applies(buildItem({ text: 'Bananas' }))).toBe(false)
  })

  it('keeps its staples without a food matcher', () => {
    const intent = (text: string) =>
      intentOf({ text, tags: [] }, { isGrocery: () => false })
    expect(intent('Chicken')).toEqual({ kind: 'none' })
    expect(intent('Oat milk')).toEqual({ kind: 'place' })
  })

  // Guards a foods.json rebuild: a new alias must not swallow a country.
  it.each(
    (
      'Argentina,Australia,Austria,Belgium,Brazil,Cambodia,Canada,Chile,' +
      'China,Colombia,Croatia,Cuba,Cyprus,Denmark,Egypt,Fiji,Finland,' +
      'France,Georgia,Germany,Ghana,Greece,Guinea,Iceland,India,' +
      'Indonesia,Ireland,Israel,Italy,Jamaica,Japan,Jordan,Kenya,Laos,' +
      'Lebanon,Malaysia,Malta,Mexico,Morocco,Nepal,Netherlands,' +
      'New Zealand,Norway,Oman,Peru,Philippines,Poland,Portugal,Qatar,' +
      'Scotland,Singapore,South Africa,Spain,Sri Lanka,Sweden,' +
      'Switzerland,Taiwan,Thailand,Tunisia,Turkey,Vietnam,Wales'
    ).split(','),
  )('%s is never read as a food', (text) => {
    expect(travelIntent({ text, tags: [] }).kind).not.toBe('none')
  })
})

describe('travelLookup.label', () => {
  it('is "Find website" for a stay and "Find on map" for a place', () => {
    expect(travelLookup.label(buildItem({ text: 'Ryokan Kurashiki' }))).toBe(
      'Find website',
    )
    expect(travelLookup.label(buildItem({ text: 'Eiffel Tower' }))).toBe(
      'Find on map',
    )
  })

  it('is "Find website" for a check-in and "Find hotels" for a booking', () => {
    expect(
      travelLookup.label(buildItem({ text: 'check in to W Osaka Hotel' })),
    ).toBe('Find website')
    expect(travelLookup.label(buildItem({ text: 'book Osaka hotel' }))).toBe(
      'Find hotels',
    )
  })

  it('is "Find flights" for a flight and "Get directions" for ground transport', () => {
    expect(travelLookup.label(buildItem({ text: 'flight to Osaka' }))).toBe(
      'Find flights',
    )
    expect(travelLookup.label(buildItem({ text: 'train to Osaka' }))).toBe(
      'Get directions',
    )
  })
})

describe('travelLookup.applies', () => {
  it('applies when the item has no link', () => {
    expect(travelLookup.applies(buildItem({ link: null }))).toBe(true)
  })

  it("applies when the link is one of the lookup's own links", () => {
    expect(
      travelLookup.applies(
        buildItem({
          link: 'https://www.google.com/maps/search/?api=1&query=x',
        }),
      ),
    ).toBe(true)
    expect(
      travelLookup.applies(
        buildItem({ link: 'https://duckduckgo.com/?q=%5Cx' }),
      ),
    ).toBe(true)
    expect(
      travelLookup.applies(
        buildItem({ link: 'https://www.booking.com/hotel/jp/w-osaka.html' }),
      ),
    ).toBe(true)
    expect(
      travelLookup.applies(
        buildItem({
          link: 'https://www.google.com/travel/flights?q=flights%20to%20Osaka',
        }),
      ),
    ).toBe(true)
    expect(
      travelLookup.applies(
        buildItem({
          link: 'https://www.google.com/maps/dir/?api=1&destination=Osaka&travelmode=transit',
        }),
      ),
    ).toBe(true)
  })

  it('hides the lookup where the travel lookup cannot help', () => {
    for (const text of ['Passport', 'book hotel', 'Hotel wifi password']) {
      expect(travelLookup.applies(buildItem({ text }))).toBe(false)
    }
    expect(
      travelLookup.applies(
        buildItem({
          text: 'Passport',
          link: 'https://www.google.com/maps/search/?api=1&query=Passport',
        }),
      ),
    ).toBe(false)
  })

  it('never replaces a link the user added', () => {
    expect(
      travelLookup.applies(buildItem({ link: 'https://booking.example' })),
    ).toBe(false)
  })

  it('never replaces a Booking.com link the user pasted', () => {
    const link =
      'https://www.booking.com/hotel/jp/w-osaka.en-gb.html?aid=304142&label=x&sid=y&checkin=2026-10-01'
    const item = buildItem({ text: 'book hotel in Osaka', link })

    expect(travelLookup.applies(item)).toBe(false)
    expect(
      applyLookupPatch({
        item: { ...item, note: null },
        patch: { link: 'https://www.booking.com/city/jp/osaka.html' },
      }).link,
    ).toBe(link)
  })
})

describe('travelLookup.run', () => {
  it('returns no-match for a blank name', () => {
    return expect(travelLookup.run(buildItem({ text: '   ' }))).resolves.toBe(
      'no-match',
    )
  })

  it('builds a maps link for a place, trimmed and percent-encoded', async () => {
    const result = await travelLookup.run(
      buildItem({ text: "  Ben & Jerry's  " }),
    )
    expect(result).toEqual({
      link: "https://www.google.com/maps/search/?api=1&query=Ben%20%26%20Jerry's",
    })
  })

  it('drops a "Day 3:" prefix from a maps link', async () => {
    const result = await travelLookup.run(
      buildItem({ text: 'Day 3: Nara deer park, Todai-ji' }),
    )
    expect(result).toEqual({
      link: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Nara deer park, Todai-ji')}`,
    })
  })

  it('builds a ducky website link for a stay, with the backslash prefix', async () => {
    serve({})
    const result = await travelLookup.run(buildItem({ text: 'Hotel Foo' }))
    expect(result).toEqual({
      link: 'https://duckduckgo.com/?q=%5CHotel%20Foo',
      failure: 'offline',
    })
  })

  it('percent-encodes a non-ASCII name for both link kinds', async () => {
    serve({})
    const place = await travelLookup.run(buildItem({ text: '星のや京都' }))
    expect(place).toEqual({
      link: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('星のや京都')}`,
    })

    const stay = await travelLookup.run(buildItem({ text: 'Hotel 星のや京都' }))
    expect(stay).toEqual({
      link: `https://duckduckgo.com/?q=%5C${encodeURIComponent('Hotel 星のや京都')}`,
      failure: 'offline',
    })
  })
})

describe('travelLookup.run — check-in', () => {
  const item = buildItem({ text: 'check in to W Osaka Hotel' })
  const marriott =
    'https://www.marriott.com/en-us/hotels/osaow-w-osaka/overview/'

  it("stores the hotel's official site", async () => {
    const fetchMock = serve({ 'W Osaka Hotel': marriott })

    await expect(travelLookup.run(item)).resolves.toEqual({ link: marriott })
    expect(queried(fetchMock)).toEqual(['W Osaka Hotel'])
  })

  it('falls back to the ducky link for the name when the result is not the official site', async () => {
    serve({
      'W Osaka Hotel': 'https://www.booking.com/hotel/jp/w-osaka.html',
    })

    await expect(travelLookup.run(item)).resolves.toEqual({
      link: ddgLink('W Osaka Hotel'),
    })
  })

  // A single tap still writes the fallback; the reason is for look up all.
  it.each([
    ['blocked', () => Promise.resolve(new Response('', { status: 202 }))],
    ['offline', () => Promise.reject(new TypeError('offline'))],
  ] as const)('falls back when %s, and says so', async (failure, respond) => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(respond)

    await expect(travelLookup.run(item)).resolves.toEqual({
      link: ddgLink('W Osaka Hotel'),
      failure,
    })
  })

  it('falls back to the ducky link for the name when offline', async () => {
    serve({})

    await expect(travelLookup.run(item)).resolves.toEqual({
      link: ddgLink('W Osaka Hotel'),
      failure: 'offline',
    })
  })
})

describe('travelLookup.run — named stay', () => {
  const sacher = 'https://www.sacher.com/en/vienna/'

  it("stores the hotel's official site for the cleaned name", async () => {
    const fetchMock = serve({ 'Hotel Sacher Wien': sacher })

    await expect(
      travelLookup.run(buildItem({ text: '- Hotel Sacher Wien ✓' })),
    ).resolves.toEqual({ link: sacher })
    expect(queried(fetchMock)).toEqual(['Hotel Sacher Wien'])
  })

  it('drops brackets and dates from the name', async () => {
    const hoxton = 'https://thehoxton.com/london/shoreditch/'
    const fetchMock = serve({ 'The Hoxton Shoreditch': hoxton })

    await expect(
      travelLookup.run(
        buildItem({ text: 'The Hoxton Shoreditch (2 nights) Oct 12' }),
      ),
    ).resolves.toEqual({ link: hoxton })
    expect(queried(fetchMock)).toEqual(['The Hoxton Shoreditch'])
  })

  it('drops booking references and night ranges from the name (review)', async () => {
    const fetchMock = serve({})

    for (const text of [
      'Park Hyatt Tokyo — conf #A1B2C3',
      'Night 1-3: Park Hyatt Tokyo',
      'Park Hyatt Tokyo, confirmation: 99812',
      'Park Hyatt Tokyo #4421',
    ]) {
      await expect(travelLookup.run(buildItem({ text }))).resolves.toEqual({
        link: ddgLink('Park Hyatt Tokyo'),
        failure: 'offline',
      })
    }
    expect(queried(fetchMock)).toEqual(Array(4).fill('Park Hyatt Tokyo'))
  })

  it('looks up the same start of a long line that was classified', async () => {
    const fetchMock = serve({})
    const text = `Park Hyatt Tokyo ${'x'.repeat(400)} Ritz`

    await travelLookup.run(buildItem({ text }))
    const [query = ''] = queried(fetchMock)
    expect(query.length).toBeLessThanOrEqual(300)
    expect(query).not.toContain('Ritz')
  })

  it('looks up a hotel-tagged stay by its name', async () => {
    const aman = 'https://www.aman.com/hotels/aman-kyoto'
    serve({ 'Aman Kyoto': aman })

    await expect(
      travelLookup.run(buildItem({ text: 'Aman Kyoto', tags: ['hotel'] })),
    ).resolves.toEqual({ link: aman })
  })

  it('falls back to the ducky link for the name when the result is not the official site', async () => {
    serve({
      'Park Hyatt Tokyo':
        'https://www.booking.com/hotel/jp/park-hyatt-tokyo.html',
    })

    await expect(
      travelLookup.run(buildItem({ text: 'Park Hyatt Tokyo' })),
    ).resolves.toEqual({ link: ddgLink('Park Hyatt Tokyo') })
  })
})

describe('travelLookup.run — book', () => {
  const BOOKING_W_OSAKA = 'https://www.booking.com/hotel/jp/w-osaka.html'
  const BOOKING_OSAKA = 'https://www.booking.com/city/jp/osaka.html'
  const BOOKING_OSAKA_INNS = 'https://www.booking.com/inns/city/jp/osaka.html'
  const BOOKING_KANAZAWA = 'https://www.booking.com/city/jp/kanazawa.html'
  const AGODA_NIKKO =
    'https://www.agoda.com/en-au/hotel-nikko-kanazawa/hotel/kanazawa-jp.html'
  const YOUTUBE = 'https://www.youtube.com/watch?v=1sgfODcZm6s'

  const run = (text: string) => travelLookup.run(buildItem({ text }))

  it("stores a named hotel's Booking.com page", async () => {
    const fetchMock = serve({
      'site:booking.com W Osaka hotel': BOOKING_W_OSAKA,
    })

    await expect(run('book W Osaka hotel')).resolves.toEqual({
      link: BOOKING_W_OSAKA,
    })
    expect(queried(fetchMock)).toEqual(['site:booking.com W Osaka hotel'])
  })

  it("stores the city's hotel list when the name is the city", async () => {
    const fetchMock = serve({
      'site:booking.com Osaka hotel': BOOKING_OSAKA,
    })

    await expect(run('book Osaka hotel')).resolves.toEqual({
      link: BOOKING_OSAKA,
    })
    await expect(run('book hotel in Osaka')).resolves.toEqual({
      link: BOOKING_OSAKA,
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('stores a partly matching area page when the item named a place', async () => {
    const shinjuku = 'https://www.booking.com/district/jp/tokyo/shinjuku.html'
    serve({ 'site:booking.com Shinjuku station hotel': shinjuku })

    await expect(run('book hotel near Shinjuku station')).resolves.toEqual({
      link: shinjuku,
    })
  })

  it("tries Agoda when Booking.com doesn't list a named hotel", async () => {
    const fetchMock = serve({
      'site:booking.com Nikko Kanazawa hotel': YOUTUBE,
      'site:agoda.com Nikko Kanazawa hotel': AGODA_NIKKO,
    })

    await expect(run('Book Hotel Nikko Kanazawa')).resolves.toEqual({
      link: AGODA_NIKKO,
    })
    expect(queried(fetchMock)).toEqual([
      'site:booking.com Nikko Kanazawa hotel',
      'site:agoda.com Nikko Kanazawa hotel',
    ])
  })

  it('skips Agoda when Booking.com returned an area page sharing a word', async () => {
    const fetchMock = serve({
      'site:booking.com Nikko Kanazawa hotel': BOOKING_KANAZAWA,
      'site:agoda.com Nikko Kanazawa hotel': AGODA_NIKKO,
    })

    await expect(run('Book Hotel Nikko Kanazawa')).resolves.toEqual({
      link: BOOKING_KANAZAWA,
    })
    expect(queried(fetchMock)).toEqual([
      'site:booking.com Nikko Kanazawa hotel',
    ])
  })

  it('rejects an Agoda page for another hotel of the same chain (live check)', async () => {
    serve({
      'site:booking.com Best Western Grand Canyon hotel': YOUTUBE,
      'site:agoda.com Best Western Grand Canyon hotel':
        'https://www.agoda.com/en-au/best-western-plus-bryce-canyon-grand-hotel/hotel/bryce-canyon-ut-us.html',
    })

    await expect(
      run('Reserve a room at Best Western Grand Canyon'),
    ).resolves.toEqual({
      link: ddgLink('site:booking.com Best Western Grand Canyon hotel'),
    })
  })

  it('stores a loosely matching landmark page (live check)', async () => {
    const nanba = 'https://www.booking.com/landmark/jp/nanba.html'
    serve({ 'site:booking.com Namba station hotel': nanba })

    await expect(run('Book hotel near Namba station')).resolves.toEqual({
      link: nanba,
    })
  })

  it('stores any Booking.com area page for a CJK place (live check)', async () => {
    const osaka = 'https://www.booking.com/city/jp/osaka.ja.html'
    const fetchMock = serve({ 'site:booking.com 大阪 hotel': osaka })

    await expect(run('Book hotel in 大阪')).resolves.toEqual({ link: osaka })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects an Agoda hotel that shares only the city (seen on device)', async () => {
    serve({
      'site:booking.com Zzqx Fakename Osaka hotel': BOOKING_OSAKA_INNS,
      'site:agoda.com Zzqx Fakename Osaka hotel':
        'https://www.agoda.com/imperial-hotel-osaka/hotel/osaka-jp.html',
    })

    await expect(run('book Zzqx Fakename Inn Osaka')).resolves.toEqual({
      link: BOOKING_OSAKA_INNS,
    })
  })

  it("falls back to the city's hotel list when Agoda misses too", async () => {
    serve({
      'site:booking.com Zzqx Fakename Osaka hotel': BOOKING_OSAKA_INNS,
      'site:agoda.com Zzqx Fakename Osaka hotel': YOUTUBE,
    })

    await expect(run('book Zzqx Fakename Inn Osaka')).resolves.toEqual({
      link: BOOKING_OSAKA_INNS,
    })
  })

  it('never stores the hotel list of another city', async () => {
    const fetchMock = serve({
      'site:booking.com Kyoto hotel': BOOKING_OSAKA,
    })

    await expect(run('book hotel in Kyoto')).resolves.toEqual({
      link: ddgLink('site:booking.com Kyoto hotel'),
    })
    // A city is never looked up on Agoda.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to the ducky Booking.com search when nothing fits', async () => {
    serve({
      'site:booking.com W Osaka hotel': YOUTUBE,
      'site:agoda.com W Osaka hotel': YOUTUBE,
    })

    await expect(run('book W Osaka hotel')).resolves.toEqual({
      link: ddgLink('site:booking.com W Osaka hotel'),
    })
  })

  it('falls back to the ducky Booking.com search when offline', async () => {
    serve({})

    await expect(run('book a room at the Hilton Osaka')).resolves.toEqual({
      link: ddgLink('site:booking.com Hilton Osaka hotel'),
      failure: 'offline',
    })
  })

  it('returns no-match without a request when there is nothing to book', async () => {
    const fetchMock = serve({})

    for (const text of ['book hotel', 'book flight', 'check in at']) {
      await expect(run(text)).resolves.toBe('no-match')
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('travelLookup.run — booking details (23)', () => {
  const W_OSAKA = 'https://www.booking.com/hotel/jp/w-osaka.html'
  const OSAKA = 'https://www.booking.com/city/jp/osaka.html'
  const AGODA_NIKKO =
    'https://www.agoda.com/en-au/hotel-nikko-kanazawa/hotel/kanazawa-jp.html'
  const YOUTUBE = 'https://www.youtube.com/watch?v=1sgfODcZm6s'
  const SUNDAY = new Date(2026, 9, 4, 18, 30)
  const STAY =
    'checkin=2026-10-20&checkout=2026-10-25&group_adults=2&no_rooms=1&group_children=0'

  const run = (text: string, now = SUNDAY) =>
    travelLookup.run(buildItem({ text }), now)

  it('adds the dates and party to a named hotel and a city page', async () => {
    serve({
      'site:booking.com W Osaka hotel': W_OSAKA,
      'site:booking.com Osaka hotel': OSAKA,
    })

    await expect(run('book W Osaka hotel 20-25 Oct')).resolves.toEqual({
      link: `${W_OSAKA}?${STAY}`,
    })
    await expect(
      run('Book hotel in Osaka 20-25/10 for 3 adults 1 child 2 rooms'),
    ).resolves.toEqual({
      link: `${OSAKA}?checkin=2026-10-20&checkout=2026-10-25&group_adults=3&no_rooms=2&group_children=1`,
    })
  })

  it('adds the check-in and nights to an Agoda hotel page', async () => {
    serve({
      'site:booking.com Nikko Kanazawa hotel': YOUTUBE,
      'site:agoda.com Nikko Kanazawa hotel': AGODA_NIKKO,
    })

    await expect(
      run('Book Hotel Nikko Kanazawa 12 Oct for 3 nights 2 adults'),
    ).resolves.toEqual({
      link: `${AGODA_NIKKO}?checkIn=2026-10-12&los=3&rooms=1&adults=2&children=0`,
    })
  })

  it('reads relative dates against an injected clock', async () => {
    serve({ 'site:booking.com W Osaka hotel': W_OSAKA })
    const lookup = createTravelLookup({
      resolver,
      isGrocery: () => false,
      now: () => new Date(2027, 2, 15, 9),
    })

    await expect(
      lookup.run(buildItem({ text: 'book W Osaka hotel 20-25 Oct' })),
    ).resolves.toEqual({
      link: `${W_OSAKA}?${STAY.replaceAll('2026', '2027')}`,
    })
  })

  it('searches Booking.com itself when there are dates and no page fits', async () => {
    serve({})

    await expect(
      run('book a room at the Hilton Osaka 20-25 Oct'),
    ).resolves.toEqual({
      link: `https://www.booking.com/searchresults.html?ss=Hilton%20Osaka&${STAY}`,
      failure: 'offline',
    })
  })

  it('keeps the plain links without dates, or with a past or vague date', async () => {
    serve({ 'site:booking.com Osaka hotel': OSAKA })

    for (const text of [
      'book hotel in Osaka for 2',
      'book hotel in Osaka 20 Oct 2025',
      'book hotel in Osaka next weekend',
    ]) {
      await expect(run(text)).resolves.toEqual({ link: OSAKA })
    }
  })

  it('leaves a resolved page that already has a query as it is', async () => {
    const tracked = `${OSAKA}?aid=1`
    serve({ 'site:booking.com Osaka hotel': tracked })

    await expect(run('book hotel in Osaka 20-25 Oct')).resolves.toEqual({
      link: tracked,
    })
  })

  it('resolves a weekday at tap time, and a re-tap refreshes the link', async () => {
    serve({ 'site:booking.com Osaka hotel': OSAKA })
    const text = 'book hotel in Osaka Fri'

    const first = await run(text)
    expect(first).toEqual({
      link: `${OSAKA}?checkin=2026-10-09&checkout=2026-10-10&group_adults=2&no_rooms=1&group_children=0`,
    })
    const link = first === 'no-match' ? null : (first.link ?? null)
    expect(travelLookup.applies(buildItem({ text, link }))).toBe(true)
    await expect(run(text, new Date(2026, 9, 10, 9))).resolves.toEqual({
      link: `${OSAKA}?checkin=2026-10-16&checkout=2026-10-17&group_adults=2&no_rooms=1&group_children=0`,
    })
  })

  it('reads "for <date>" as the date, never as a party', async () => {
    serve({
      'site:booking.com Rome hotel':
        'https://www.booking.com/city/it/rome.html',
    })

    await expect(run('Flight to Osaka for 12 Oct')).resolves.toEqual({
      link: `https://www.google.com/travel/flights?q=${encodeURIComponent('flights to Osaka for 12 Oct')}`,
    })
    await expect(run('Book hotel Rome for 25 Jan')).resolves.toEqual({
      link: 'https://www.booking.com/city/it/rome.html?checkin=2027-01-25&checkout=2027-01-26&group_adults=2&no_rooms=1&group_children=0',
    })
  })

  it('adds a typed party to a flights search', async () => {
    await expect(run('Flight to Osaka 20 Oct 2 adults')).resolves.toEqual({
      link: `https://www.google.com/travel/flights?q=${encodeURIComponent('flights to Osaka 20 Oct for 2 adults')}`,
    })
    await expect(run('Flights to Lisbon for 1')).resolves.toEqual({
      link: `https://www.google.com/travel/flights?q=${encodeURIComponent('flights to Lisbon for 1 adult')}`,
    })
  })

  it('builds only links the app recognises as its own', async () => {
    serve({
      'site:booking.com W Osaka hotel': W_OSAKA,
      'site:booking.com Nikko Kanazawa hotel': YOUTUBE,
      'site:agoda.com Nikko Kanazawa hotel': AGODA_NIKKO,
    })
    const built = await Promise.all(
      [
        'book W Osaka hotel 20-25 Oct 2 adults 1 child',
        'Book Hotel Nikko Kanazawa 12 Oct for 3 nights',
        'book hotel at the Hôtel & Spa Zürich 3-5 Jan 2 rooms',
        'Flight to Osaka 20 Oct 2 adults',
      ].map((text) => run(text)),
    )
    expect(
      built.map((result) =>
        result === 'no-match' ? null : lookupLinkKind(result.link ?? null),
      ),
    ).toEqual(['booking', 'agoda', 'booking', 'flights'])
  })
})

describe('travelLookup.run — transport', () => {
  const run = (text: string) => travelLookup.run(buildItem({ text }))

  it('builds a Google Flights link, with an optional origin', async () => {
    await expect(run('book flight to Osaka')).resolves.toEqual({
      link: 'https://www.google.com/travel/flights?q=flights%20to%20Osaka',
    })
    await expect(run('flight from Tokyo to Osaka')).resolves.toEqual({
      link: 'https://www.google.com/travel/flights?q=flights%20from%20Tokyo%20to%20Osaka',
    })
  })

  it('percent-encodes a non-ASCII destination in a flights link', async () => {
    await expect(run('fly to 京都')).resolves.toEqual({
      link: `https://www.google.com/travel/flights?q=${encodeURIComponent('flights to 京都')}`,
    })
  })

  it('builds a Google Maps directions link, with an optional origin', async () => {
    await expect(run('taxi to Osaka Station')).resolves.toEqual({
      link: 'https://www.google.com/maps/dir/?api=1&destination=Osaka%20Station&travelmode=driving',
    })
    await expect(run('train from Tokyo to Osaka')).resolves.toEqual({
      link: 'https://www.google.com/maps/dir/?api=1&destination=Osaka&travelmode=transit&origin=Tokyo',
    })
  })

  it('percent-encodes a non-ASCII destination in a directions link', async () => {
    await expect(run('train to 京都')).resolves.toEqual({
      link: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent('京都')}&travelmode=transit`,
    })
  })

  it('returns no-match for transport items with no destination, without a request', async () => {
    const fetchMock = serve({})

    for (const text of [
      'book flight',
      'book a flight',
      'flight to',
      'taxi to',
    ]) {
      await expect(run(text)).resolves.toBe('no-match')
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls through to a place link for a bare mode word, with or without a verb', async () => {
    for (const text of ['Taxi', 'Train', 'Bus', 'book a taxi']) {
      await expect(run(text)).resolves.toEqual({
        link: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`,
      })
    }
  })

  it('drops a flight number before the destination from the flights link', async () => {
    await expect(run('Flight NH 880 to Osaka')).resolves.toEqual({
      link: 'https://www.google.com/travel/flights?q=flights%20to%20Osaka',
    })
  })

  it('builds walking and cycling directions', async () => {
    await expect(run('Walk to Meiji Shrine')).resolves.toEqual({
      link: 'https://www.google.com/maps/dir/?api=1&destination=Meiji%20Shrine&travelmode=walking',
    })
    await expect(run('Bike from Kyoto to Arashiyama')).resolves.toEqual({
      link: 'https://www.google.com/maps/dir/?api=1&destination=Arashiyama&travelmode=bicycling&origin=Kyoto',
    })
  })

  it('builds a flights link from airport codes, keeping the date', async () => {
    // 21c: a coded flight also gets an airport-city note line — see the
    // dedicated "airport-code note line" describe block below.
    await expect(run('✈️ SYD → KIX 12 Oct')).resolves.toEqual({
      link: `https://www.google.com/travel/flights?q=${encodeURIComponent('flights from SYD to KIX 12 Oct')}`,
      noteLine: { text: 'Sydney → Osaka', owns: AIRPORT_NOTE_OWNS },
    })
  })

  it('strips pick-up times and clock times from a directions link', async () => {
    await expect(
      run('Book taxi to Hotel Granvia Kyoto for 7am'),
    ).resolves.toEqual({
      link: 'https://www.google.com/maps/dir/?api=1&destination=Hotel%20Granvia%20Kyoto&travelmode=driving',
    })
    await expect(run('Eurostar London → Paris 07:01')).resolves.toEqual({
      link: 'https://www.google.com/maps/dir/?api=1&destination=Paris&travelmode=transit&origin=London',
    })
  })

  it('strips a trailing time phrase from a directions link, but keeps it in a flights link', async () => {
    await expect(run('taxi to the airport at 9am')).resolves.toEqual({
      link: 'https://www.google.com/maps/dir/?api=1&destination=the%20airport&travelmode=driving',
    })
    await expect(run('train to Osaka tomorrow')).resolves.toEqual({
      link: 'https://www.google.com/maps/dir/?api=1&destination=Osaka&travelmode=transit',
    })
    await expect(
      run('train from Tokyo tonight to Osaka on Friday'),
    ).resolves.toEqual({
      link: 'https://www.google.com/maps/dir/?api=1&destination=Osaka&travelmode=transit&origin=Tokyo',
    })
    await expect(run('flight to Osaka tomorrow')).resolves.toEqual({
      link: `https://www.google.com/travel/flights?q=${encodeURIComponent('flights to Osaka tomorrow')}`,
    })
  })
})

// 21c: a flight written with airport codes gets a note line with the
// cities, since that's information the user didn't type.
describe('travelLookup.run — airport-code note line', () => {
  const run = (text: string) => travelLookup.run(buildItem({ text }))
  const flightsLink = (q: string) =>
    `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`

  it('writes both cities for a coded pair, whatever separator was typed', async () => {
    await expect(run('MAN-AGP')).resolves.toEqual({
      link: flightsLink('flights from MAN to AGP'),
      noteLine: { text: 'Manchester → Málaga', owns: AIRPORT_NOTE_OWNS },
    })
    await expect(run('SYD->KIX')).resolves.toEqual({
      link: flightsLink('flights from SYD to KIX'),
      noteLine: { text: 'Sydney → Osaka', owns: AIRPORT_NOTE_OWNS },
    })
    await expect(run('LHR to JFK')).resolves.toEqual({
      link: flightsLink('flights from LHR to JFK'),
      noteLine: { text: 'London → New York', owns: AIRPORT_NOTE_OWNS },
    })
  })

  it('resolves metro/city codes the same as a real airport code', async () => {
    await expect(run('LON-TYO')).resolves.toEqual({
      link: flightsLink('flights from LON to TYO'),
      noteLine: { text: 'London → Tokyo', owns: AIRPORT_NOTE_OWNS },
    })
  })

  it('writes one end only when just one side was coded', async () => {
    await expect(run('Flight to AGP')).resolves.toEqual({
      link: flightsLink('flights to AGP'),
      noteLine: { text: '→ Málaga', owns: AIRPORT_NOTE_OWNS },
    })
    // The origin is a bare code; the destination is already a typed city,
    // so only the origin's city is new information.
    await expect(run('Flight MAN to Malaga')).resolves.toEqual({
      link: flightsLink('flights from MAN to Malaga'),
      noteLine: { text: 'Manchester →', owns: AIRPORT_NOTE_OWNS },
    })
  })

  it('writes nothing with no destination at all ("Flight from MAN" has none to classify)', async () => {
    // No destination means `travelIntent` itself is 'none' (unchanged
    // 21a behaviour, like "flight to" alone) — there's no flight intent
    // to attach a note to.
    await expect(run('Flight from MAN')).resolves.toBe('no-match')
  })

  it('writes nothing when the user already typed both city names', async () => {
    await expect(run('Flights Manchester to Malaga')).resolves.toEqual({
      link: flightsLink('flights from Manchester to Malaga'),
    })
  })

  it('writes nothing for a bracketed code alongside an already-typed city', async () => {
    await expect(run('Flight to Florence (FLR)')).resolves.toEqual({
      link: flightsLink('flights to Florence (FLR)'),
    })
  })

  it('writes nothing when both ends resolve to the same city', async () => {
    await expect(run('LHR to LGW')).resolves.toEqual({
      link: flightsLink('flights from LHR to LGW'),
    })
    await expect(run('LHR-LGW')).resolves.toEqual({
      link: flightsLink('flights from LHR to LGW'),
    })
  })

  it('treats an unknown code like an untyped side, not a block on the known one', async () => {
    await expect(run('XQZ-AGP')).resolves.toEqual({
      link: flightsLink('flights from XQZ to AGP'),
      noteLine: { text: '→ Málaga', owns: AIRPORT_NOTE_OWNS },
    })
  })

  it('writes nothing for a wholly unknown code pair', async () => {
    await expect(run('XQZ-ZZZ')).resolves.toEqual({
      link: flightsLink('flights from XQZ to ZZZ'),
    })
  })

  it('drops the trailing date from the note but keeps it in the flights link', async () => {
    await expect(run('✈️ SYD → KIX 12 Oct')).resolves.toEqual({
      link: flightsLink('flights from SYD to KIX 12 Oct'),
      noteLine: { text: 'Sydney → Osaka', owns: AIRPORT_NOTE_OWNS },
    })
    await expect(run('Flight JFK Mon 9am')).resolves.toEqual({
      link: flightsLink('flights to JFK Mon 9am'),
      noteLine: { text: '→ New York', owns: AIRPORT_NOTE_OWNS },
    })
    await expect(run('Flight to AGP Monday')).resolves.toMatchObject({
      noteLine: { text: '→ Málaga' },
    })
    await expect(run('Flight to JFK Tuesday 9am')).resolves.toMatchObject({
      noteLine: { text: '→ New York' },
    })
    await expect(run('Flight to LHR September 3')).resolves.toMatchObject({
      noteLine: { text: '→ London' },
    })
  })

  it('keeps a code only when what follows it is noise, never a word of its own', async () => {
    const noNote = async (text: string) => {
      const result = await run(text)
      expect(
        result === 'no-match' ? undefined : result.noteLine,
      ).toBeUndefined()
    }
    // A capitalised word right after the code reads as a word, not noise.
    await noNote('Flight to NYC Marathon')
    await noNote('Flight to BAR mitzvah')
    await noNote('Flight to ART gallery')
    await noNote('Flight to CAT show')
    await noNote('Flight to DOG show')
    await noNote('Flight to PET expo')
    await noNote('Flight to THE Hague')
    await noNote('Flight to MRI appointment')
    await noNote('Flight to TSA PreCheck')
    await noNote('Flight to MAN city')
    await noNote('Flight to LAS VEGAS')

    // Nothing, punctuation, a digit or a day/month word all stay noise.
    await expect(run('Flight to SFO-Oakland')).resolves.toEqual({
      link: flightsLink('flights to SFO-Oakland'),
      noteLine: { text: '→ San Francisco', owns: AIRPORT_NOTE_OWNS },
    })
    await expect(run('Flight to NYC!')).resolves.toEqual({
      link: flightsLink('flights to NYC'),
      noteLine: { text: '→ New York', owns: AIRPORT_NOTE_OWNS },
    })
    await expect(run('Flight to MAN.')).resolves.toEqual({
      link: flightsLink('flights to MAN'),
      noteLine: { text: '→ Manchester', owns: AIRPORT_NOTE_OWNS },
    })
    await expect(run('Flight to KIX, 12 Oct')).resolves.toEqual({
      link: flightsLink('flights to KIX'),
      noteLine: { text: '→ Osaka', owns: AIRPORT_NOTE_OWNS },
    })
    await expect(run('Flight to LON Fri')).resolves.toEqual({
      link: flightsLink('flights to LON Fri'),
      noteLine: { text: '→ London', owns: AIRPORT_NOTE_OWNS },
    })
  })

  it('stops "USA" from shadowing the country as a tiny NH airport, but keeps "AUS"', async () => {
    await expect(run('Flight to USA')).resolves.toEqual({
      link: flightsLink('flights to USA'),
    })
    await expect(run('Flight to USA for Xmas')).resolves.toEqual({
      link: flightsLink('flights to USA for Xmas'),
    })
    await expect(run('Flight to AUS')).resolves.toEqual({
      link: flightsLink('flights to AUS'),
      noteLine: { text: '→ Austin', owns: AIRPORT_NOTE_OWNS },
    })
  })
})

describe('AIRPORT_NOTE_OWNS', () => {
  it('never matches a user line that merely types an arrow', () => {
    // People do type `→` themselves — the corpus has "Bus Lisbon → Porto",
    // "Tokyo→Kyoto", "Fly BCN→LHR" — so the shape alone can't be the
    // anchor; neither side here is a city the airport table produces.
    const userLines = [
      '3 nights',
      'Ref AB123',
      'Tokyo - Kyoto',
      'Tokyo -> Kyoto',
      'Tokyo→Kyoto',
      'MAN to AGP',
      'Gate B12',
      '→ see email',
      'Manchester → Málaga, then train',
      'Tokyo → Kyoto',
      'Tokyo → Kyoto.',
      'Hotel → Airport',
      'Mon → Fri',
      'Mum → Dad',
      'A → B',
      'JFK → LHR',
    ]
    for (const line of userLines) {
      expect(AIRPORT_NOTE_OWNS(line)).toBe(false)
    }
  })

  it('matches the exact shapes the note line writes, including multi-word cities', () => {
    const ownLines = [
      'Manchester → Málaga',
      '→ Málaga',
      'Manchester →',
      'London → New York',
      'São Paulo → Rio de Janeiro',
      '→ Palma de Mallorca',
    ]
    for (const line of ownLines) {
      expect(AIRPORT_NOTE_OWNS(line)).toBe(true)
    }
  })

  it('re-running the lookup replaces only its own line, leaving a same-shaped user line untouched', () => {
    const line = { text: 'Manchester → Málaga', owns: AIRPORT_NOTE_OWNS }
    for (const userLine of [
      'Tokyo → Kyoto',
      'Hotel → Airport',
      'Mon → Fri',
      'Tokyo → Kyoto.',
    ]) {
      const note = `${userLine}\nRef 123`
      expect(mergeNoteLine({ note, line })).toBe(
        `${userLine}\nRef 123\nManchester → Málaga`,
      )
    }
  })

  it('merging the same flight twice produces exactly one line, for a multi-word city too', async () => {
    const run = (text: string) => travelLookup.run(buildItem({ text }))
    for (const text of ['SAO-RIO', 'Flight to PMI']) {
      const result = await run(text)
      if (result === 'no-match' || result.noteLine === undefined) {
        throw new Error(`expected a note line for ${text}`)
      }
      const once = mergeNoteLine({ note: null, line: result.noteLine })
      const twice = mergeNoteLine({ note: once, line: result.noteLine })
      expect(twice).toBe(once)
      expect(twice.split('\n')).toHaveLength(1)
    }
  })
})

describe('travelLookup.run — transport link kinds round-trip', () => {
  const run = (text: string) => travelLookup.run(buildItem({ text }))

  const linkKind = async (text: string) => {
    const result = await run(text)
    return result === 'no-match' ? null : lookupLinkKind(result.link ?? null)
  }

  it.each([
    ['flight to Osaka & Kyoto #2?', 'flights'],
    ['flight from Tokyo to Osaka', 'flights'],
    ['train to Café Zürich & Co #3?', 'directions'],
    ['taxi to 100% Tokyo', 'directions'],
    ['flight to a+b', 'flights'],
    ['train from Tokyo to Osaka', 'directions'],
  ] as const)('%s -> %s', async (text, kind) => {
    await expect(linkKind(text)).resolves.toBe(kind)
  })
})

describe('"for N <weekday>" (23 follow-up)', () => {
  it.each([
    ['Book Hilton Osaka for 2 Sat', 'Hilton Osaka', false],
    ['Book hotel Osaka for 2 Fri', 'Osaka', false],
    ['Hotel Osaka for 2 Sat 12 Oct', 'Osaka', true],
  ])('books %s without the party in the name', (text, name, inCity) => {
    expect(travelIntent({ text, tags: [] })).toEqual({
      kind: 'book',
      name,
      inCity,
    })
  })
})
