import { afterEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { diningIntent, type DiningIntent } from '../src/dining'
import { diningBookLink } from '../src/dining/dining'
import { diningPage, isGenericName } from '../src/dining/diningPages'
import { diningLookup, travelLookup } from './helpers/registry'
import { resolver } from './helpers/registry'
import RESULTS from './fixtures/ddg/dining-first-results.json'
import { buildItem } from './helpers/items'
import { travelIntent } from './helpers/travel'

const DDG = 'https://duckduckgo.com/?q=%5C'
const MAPS = 'https://www.google.com/maps/search/?api=1&query='

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

const bookLink = (name: string) =>
  diningBookLink(name, resolver).then((patch) => patch.link)

const queried = (fetchMock: MockInstance) =>
  fetchMock.mock.calls.map(([input]) =>
    decodeURIComponent(String(input).slice(DDG.length)),
  )

const maps = (query: string) => `${MAPS}${encodeURIComponent(query)}`

afterEach(() => {
  vi.restoreAllMocks()
})

const book = (name: string): DiningIntent => ({ kind: 'book', name })
const venue = (query: string): DiningIntent => ({ kind: 'venue', query })
const NONE: DiningIntent = { kind: 'none' }

describe('diningIntent', () => {
  it.each<[string, DiningIntent]>([
    ['Book Hawksmoor Spitalfields Sat 8pm x4', book('Hawksmoor Spitalfields')],
    ['Table for 4 at Hyoki Sat 19:30', book('Hyoki')],
    ['Dinner Fri 7:30 — Le Bernardin', book('Le Bernardin')],
    ['Lunch w/ Priya — Dishoom Kensington 1pm', book('Dishoom Kensington')],
    ['Rezdora 2pax 19:00', book('Rezdora')],
    ['Burnt Ends — book 30 days out', book('Burnt Ends')],
    ['Eleven Madison Park (tasting menu $$$)', book('Eleven Madison Park')],
    ['Rsv Ultraviolet Shanghai', book('Ultraviolet Shanghai')],
    ['Book Brasserie Zédel 6pax Thu', book('Brasserie Zédel')],
    ['book carbone for 2 sat', book('carbone')],
    ['Attica — reso for our anniversary', book('Attica')],
    // A hotel's restaurant, said so: a table, not the stay.
    ['Dinner at the Ritz 8pm', book('the Ritz')],
    ['Book dinner at Hotel Okura', book('Hotel Okura')],
    // The person a table is for isn't the venue (Ponytail).
    ["Reserve table for Priya at Lyle's", book("Lyle's")],
    ['Table for Sam at Brat 8pm', book('Brat')],
    ['Dinner for Mum at The Ivy 7pm', book('The Ivy')],
    ['Lunch for Priya and Sam at Dishoom 1pm', book('Dishoom')],
    // A day or a meal word inside a name stays in it.
    ['Book Sat Bains for 2', book('Sat Bains')],
    ['Mar y Sol 8pm for 2', book('Mar y Sol')],
    ['Brunch at Sunday in Brooklyn 11am', book('Sunday in Brooklyn')],
    ['Book Dinner by Heston for 2', book('Dinner by Heston')],
    // Party sizes in Japanese and French
    ['鮨さいとう 2名', book('鮨さいとう')],
    ['Ichiran 2人', book('Ichiran')],
    ['Septime pour 4', book('Septime')],
    // The venue word after a first-word name is part of it (Gardener, stage 4).
    ['Temple Bar dinner 8pm', book('Temple Bar')],
    ['Opera Bar 7pm for 4', book('Opera Bar')],
    ['Connaught Bar 8pm for 2', book('Connaught Bar')],
    ['Tower Bar dinner 8pm', book('Tower Bar')],
    ['Opera Tavern 7pm for 4', book('Opera Tavern')],
    ['Park Bistro 7pm for 4', book('Park Bistro')],
    ['Palace Café dinner 8pm', book('Palace Café')],
    ['Temple Kitchen dinner 8pm', book('Temple Kitchen')],
    // "for Brat" before a time isn't a person; "Reserveat" never happens.
    ['Reserve for Brat 8pm', book('Brat')],
    // A party size books even a possessive name.
    ["Afternoon tea at Claridge's 3pm for 2", book("Claridge's")],
    ["Dinner at Claridge's 8pm for 2", book("Claridge's")],
  ])('books %s', (text, want) => {
    expect(diningIntent(text)).toEqual(want)
  })

  it.each<[string, DiningIntent]>([
    ['Coffee at Blue Bottle Kiyosumi', venue('Blue Bottle Kiyosumi')],
    ['Dinner at La Cava, Benidorm', venue('La Cava Benidorm')],
    ['Try takoyaki Dotonbori', venue('takoyaki Dotonbori')],
    ['Brunch next day Russ & Daughters Cafe', venue('Russ & Daughters Cafe')],
    ['Something new — Thai Diner?', venue('Thai Diner')],
    ['Itsu sushi', venue('Itsu sushi')],
    ['Leon', venue('Leon')],
    ['鳥貴族 新宿', venue('鳥貴族 新宿')],
    [
      'Starbucks Reserve Roastery Tokyo',
      venue('Starbucks Reserve Roastery Tokyo'),
    ],
    // "no bookings", "walk-in", "queue": the venue, never a booking page
    ['Reserve Via Carota (walk-in only!!)', venue('Via Carota')],
    ['Sushi Dai 5am queue', venue('Sushi Dai')],
    ['Rising Sun pub Sat 7pm', venue('Rising Sun pub')],
    ["June's All Day", venue("June's All Day")],
    ['Breakfast Club Soho', venue('Breakfast Club Soho')],
    ['Brunch & Co', venue('Brunch & Co')],
    ['Supper Club at Carousel', venue('Carousel')],
    // A friend's place, a meeting, a meal after a show: no booking
    ["Dinner at Sam's 7pm", venue("Sam's")],
    ['Monmouth Coffee 9am meet Sam', venue('Monmouth Coffee')],
    ['Theatre 7:30 then supper at J Sheekey', venue('J Sheekey')],
    // A cuisine before an area is somewhere to eat, not a venue to book.
    ['Kaiseki dinner Gion (reserve!)', venue('Kaiseki dinner Gion')],
  ])('finds %s on a map', (text, want) => {
    expect(diningIntent(text)).toEqual(want)
  })

  it.each([
    'Lunch',
    'Brunch?',
    'Bakery run',
    'Call Carbone re: group of 10',
    'Confirm reservation Cosme',
    'Order Deliveroo for team',
    'Uber Eats tonight',
    'Check Lilia can do 14 people',
    'Italian somewhere in West Village',
    'Book a table for 6 Friday',
    'Prosecco x6',
    'Hotel breakfast 7-10am',
    'Train to Osaka then ramen',
    'Movie 7pm then dinner',
    // The travel lookup's hotel (stage 2: a list tagged both kept the table)
    'Book Hilton Osaka Sat',
    'Book Park Hyatt Tokyo 2 nights',
    'Transfer £50 to Sam',
    '',
  ])('has nothing to find for %s', (text) => {
    expect(diningIntent(text)).toEqual(NONE)
  })

  it('classifies only the start of a pasted wall of text', () => {
    expect(diningIntent(`Book Zuma for 2 ${'x '.repeat(500)}`).kind).toBe(
      'book',
    )
  })
})

// The plain reads stand in for "<name> restaurant", the query the site step
// sends for a name without a venue word (Osteria Francescana has one).
const siteQuery = (query: string) =>
  /osteria/i.test(query) ? query : `${query} restaurant`

const FIRST_RESULTS = Object.fromEntries(
  RESULTS.flatMap(({ shape, query, target }) =>
    target === null
      ? []
      : [[shape === 'plain' ? siteQuery(query) : query, target]],
  ),
)

describe('diningBookLink', () => {
  // The live reads (2026-10-04) for "<name> <city>": OpenTable when its page
  // is this venue, the venue's own site next, Maps otherwise — never a wrong
  // branch (Dishoom Kensington), another venue (Osteria Ruggera), a metro or
  // region page, OpenTable's back office, a guide or a football club.
  it.each([
    ['Carbone New York', 'https://www.opentable.com/r/carbone'],
    ['Alinea Chicago', 'https://www.opentable.com/r/alinea'],
    ['Le Bernardin New York', 'https://www.opentable.com/r/le-bernardin'],
    [
      'Hawksmoor Spitalfields London',
      'https://www.opentable.com/hawksmoor-spitalfields',
    ],
    ['Dishoom Covent Garden London', 'https://www.dishoom.com/covent-garden/'],
    ['Osteria Francescana Modena', 'https://osteriafrancescana.it/'],
    ['The French Laundry Yountville', maps('The French Laundry Yountville')],
    ['Septime Paris', maps('Septime Paris')],
    ['Noma Copenhagen', maps('Noma Copenhagen')],
    ['Kikunoi Kyoto', maps('Kikunoi Kyoto')],
    ['Narisawa Tokyo', maps('Narisawa Tokyo')],
    ['Ichiran Shibuya', maps('Ichiran Shibuya')],
    ['Quay Sydney', maps('Quay Sydney')],
    ['Attica Melbourne', maps('Attica Melbourne')],
  ])('%s → %s', async (name, want) => {
    serve(FIRST_RESULTS)
    await expect(bookLink(name)).resolves.toBe(want)
  })

  it('asks OpenTable first, then the name as a restaurant', async () => {
    const fetchMock = serve({})
    await expect(bookLink('Zuma')).resolves.toBe(maps('Zuma'))
    await expect(bookLink('Brasserie Zédel')).resolves.toBe(
      maps('Brasserie Zédel'),
    )
    expect(queried(fetchMock)).toEqual([
      'site:opentable.com Zuma',
      'Zuma restaurant',
      'site:opentable.com Brasserie Zédel',
      'Brasserie Zédel',
    ])
  })

  it('drops the query from an OpenTable page', async () => {
    serve({
      'site:opentable.com Brasserie Zédel':
        'https://www.opentable.com/brasserie-zedel?lang=es',
    })
    await expect(bookLink('Brasserie Zédel')).resolves.toBe(
      'https://www.opentable.com/brasserie-zedel',
    )
  })

  // Live re-check (2026-10-04): the plain name found a drawing app (no
  // longer asked) and a sunglasses brand (not a restaurant's host).
  it('never asks the plain one-word name', async () => {
    serve({ Sketch: 'https://sketch.io/sketchpad/' })
    await expect(bookLink('Sketch')).resolves.toBe(maps('Sketch'))
  })

  it('rejects a brand host with another word after the name', async () => {
    serve({ 'Quay restaurant': 'https://www.quayaustralia.com.au/' })
    await expect(bookLink('Quay')).resolves.toBe(maps('Quay'))
  })

  // Emulator, 2026-10-04 (opentravelguide.com): a guide with the name only
  // in its path, here one the deny list doesn't name.
  it('never stores a guide page', async () => {
    serve({
      'Sushi Saito restaurant':
        'https://www.tokyofoodblog.com/reviews/sushi-saito',
    })
    await expect(bookLink('Sushi Saito')).resolves.toBe(maps('Sushi Saito'))
  })

  it.each([
    ['Septime', 'https://septime-charonne.fr/en/'],
    ['Noma', 'https://noma.dk/'],
    ['Kikunoi', 'https://kikunoi.jp/en/'],
    ['Attica', 'https://www.attica.com.au/'],
  ])('finds %s on its own site without a city', async (name, site) => {
    serve({ [`${name} restaurant`]: site })
    await expect(bookLink(name)).resolves.toBe(site)
  })
})

describe('diningPage', () => {
  it.each([
    ['https://www.opentable.com/r/carbone', 'Carbone'],
    [
      'https://www.opentable.com/r/dishoom-kensington-london',
      'Dishoom Kensington',
    ],
    ['https://www.opentable.com/r/carbone-new-york', 'Carbone'],
    ['https://www.opentable.com/r/kikunoi-restaurant', 'Kikunoi'],
    ['https://www.opentable.com/r/lyles-london', "Lyle's"],
  ])('accepts %s for %s', (url, name) => {
    expect(diningPage({ url, name })).toBe('opentable')
  })

  it.each([
    // Another branch, another venue, an unknown extra word
    [
      'https://www.opentable.com/r/dishoom-kensington-london',
      'Dishoom Covent Garden',
    ],
    [
      'https://www.opentable.com/r/osteria-ruggera-modena',
      'Osteria Francescana',
    ],
    ['https://www.opentable.com/r/nobu-malibu', 'Nobu Downtown'],
    ['https://www.opentable.com/r/attica-ripponlea', 'Attica'],
    // Not a restaurant page
    ['https://www.opentable.com/metro/kyoto-restaurants', 'Kikunoi'],
    ['https://www.opentable.com/region/denmark/copenhagen', 'Noma Copenhagen'],
    [
      'https://guestcenter.opentable.com/restaurant/1508053/inventory',
      'Narisawa',
    ],
    ['https://opentable.com/r/carbone', 'Carbone'],
    // Guides, reviews and other booking sites
    [
      'https://guide.michelin.com/en/tokyo-region/tokyo/restaurant/narisawa',
      'Narisawa',
    ],
    [
      'https://www.tripadvisor.com/Restaurant_Review-g1-d1-Reviews-Ichiran.html',
      'Ichiran',
    ],
    ['https://www.theinfatuation.com/new-york/reviews/carbone', 'Carbone'],
    ['https://ny.eater.com/venue/carbone', 'Carbone'],
    ['https://www.yelp.com/biz/carbone-new-york', 'Carbone'],
    ['https://www.thefork.com/restaurant/septime-r1', 'Septime'],
    // Live re-check (2026-10-04)
    [
      'https://www.opentable.com/r/chateaubriand-36-ashland',
      'Le Chateaubriand',
    ],
    ['https://www.opentable.com/r/scala-osteria-napa', 'Osteria Francescana'],
    ['https://www.opentable.com/r/rockpool-pavilion-townsville', 'Rockpool'],
    ['https://www.opentable.com/yakitori-tori-shin-west', 'Yakitori Torishiki'],
    ['https://www.opentable.com/r/sketch-gallery', 'Sketch'],
    [
      'https://www.opentable.com/landmark/restaurants-near-circular-quay',
      'Quay',
    ],
    ['https://secure.opentable.com/', 'Disfrutar'],
    ['https://www.opentable.com/', 'Kikunoi'],
    [
      'https://hunterstreethospitality.com.au/venues/rockpool/sydney/',
      'Rockpool',
    ],
    ['https://www.tableall.com/restaurant/339', 'Yakitori Torishiki'],
    ['https://en.wikipedia.org/wiki/Le_Chateaubriand', 'Le Chateaubriand'],
    // Delivery, guides and listings for a multi-word name (Ponytail)
    ['https://www.just-eat.co.uk/restaurants-burnt-ends', 'Burnt Ends'],
    ['https://wolt.com/en/sgp/singapore/restaurant/burnt-ends', 'Burnt Ends'],
    [
      'https://www.theworlds50best.com/asia/en/the-list/burnt-ends.html',
      'Burnt Ends',
    ],
    [
      'https://www.designmynight.com/singapore/restaurants/burnt-ends',
      'Burnt Ends',
    ],
    [
      'https://www.broadsheet.com.au/singapore/food-and-drink/burnt-ends',
      'Burnt Ends',
    ],
    ['https://www.goodfood.com.au/eat-out/burnt-ends', 'Burnt Ends'],
    ['https://www.hot-dinners.com/burnt-ends', 'Burnt Ends'],
    ['https://foursquare.com/v/burnt-ends/4f1', 'Burnt Ends'],
    ['https://www.pinterest.com/pin/burnt-ends', 'Burnt Ends'],
    ['https://medium.com/@eats/burnt-ends-singapore', 'Burnt Ends'],
    ['https://www.linkedin.com/company/burnt-ends', 'Burnt Ends'],
    // The name only in a guide's path (emulator and live, 2026-10-04)
    [
      'https://opentravelguide.com/japan/tokyo/restaurants/sushi-saito',
      'Sushi Saito',
    ],
    [
      'https://opentravelguide.com/japan/tokyo/restaurants/sukiyabashi-jiro',
      'Sukiyabashi Jiro',
    ],
    ['https://www.japan-guide.com/e/e3000-sushi-saito.html', 'Sushi Saito'],
    ['https://www.tokyofoodblog.com/reviews/sushi-saito', 'Sushi Saito'],
    ['https://www.tableall.com/restaurant/49/', 'Sushi Saito'],
    // A group's site with the venue only in its path: Maps instead (live)
    ['https://alajmo.it/en/pages/homepage-le-calandre', 'Le Calandre'],
    // One word, and not the site's own name
    ['https://finkgroup.com.au/a-farewell-to-quay/', 'Quay'],
    ['https://www.fcbarcelona.com/en/tickets/football', 'Tickets Barcelona'],
  ])('rejects %s for %s', (url, name) => {
    expect(diningPage({ url, name })).toBe(null)
  })

  it.each([
    ['https://sketch.london/', 'Sketch'],
    ['https://www.burntends.com.sg/', 'Burnt Ends'],
    ['https://www.lyles.co.uk/', "Lyle's"],
    ['https://www.lilianewyork.com/', 'Lilia'],
    ['https://www.disfrutarbarcelona.com/?lang=en', 'Disfrutar'],
    ['https://www.steirereck.at/steirereck.en.html', 'Steirereck'],
    ['https://thehawksmoor.com/locations/spitalfields/', 'Hawksmoor'],
    ['https://www.dishoom.com/covent-garden/', 'Dishoom Covent Garden'],
    ['https://www.le-bernardin.com/', 'Le Bernardin'],
    // Live, 2026-10-04: a name word in the host, past the dish
    ['https://www.asadoretxebarri.com/', 'Asador Etxebarri'],
    ['https://tempura-kondo.com/en/', 'Tempura Kondo'],
    // Short words: the name run together is the host (Ponytail)
    ['https://www.timhowan.com/', 'Tim Ho Wan'],
    ['https://www.yatlok.com.hk/', 'Yat Lok'],
    ['https://sushi-dai.com/', 'Sushi Dai'],
    ['https://sushi-dai.com/', 'Sushi Dai Tokyo'],
  ])('accepts the venue site %s for %s', (url, name) => {
    expect(diningPage({ url, name })).toBe('site')
  })

  // Stage 4: a venue word in the name must be the page's too.
  it.each([
    ['https://www.opentable.com/r/the-opera-kitchen-sydney', 'Opera Bar'],
    ['https://www.operarestaurant.com/', 'Opera Bar'],
    ['https://www.thetemplebar.com/', 'Temple Kitchen'],
  ])('rejects %s for %s', (url, name) => {
    expect(diningPage({ url, name })).toBe(null)
  })

  it.each([
    ['https://www.opentable.com/r/opera-bar-sydney', 'Opera Bar'],
    ['https://www.operabar.com.au/', 'Opera Bar'],
    ['https://www.thetemplebar.com/', 'Temple Bar'],
  ])('accepts %s for %s', (url, name) => {
    expect(diningPage({ url, name })).not.toBe(null)
  })

  it('knows a one-word generic name', () => {
    expect(isGenericName('Tickets')).toBe(true)
    expect(isGenericName('Tickets Barcelona')).toBe(true)
    expect(isGenericName('Bar')).toBe(true)
    expect(isGenericName('Zuma')).toBe(false)
    expect(isGenericName('Burnt Ends')).toBe(false)
  })
})

describe('diningLookup', () => {
  it('labels each kind and hides the icon when nothing applies', () => {
    const label = (text: string) => diningLookup.label(buildItem({ text }))
    expect(label('Book Carbone for 2, Sat')).toBe('Book a table')
    expect(label('Monmouth Coffee')).toBe('Find on map')
    expect(diningLookup.applies(buildItem({ text: 'Lunch' }))).toBe(false)
  })

  it('leaves a user link alone but re-runs over its own links', () => {
    const text = 'Monmouth Coffee'
    expect(
      diningLookup.applies(buildItem({ text, link: 'https://shop.example' })),
    ).toBe(false)
    expect(
      diningLookup.applies(
        buildItem({ text, link: 'https://www.opentable.com/r/carbone' }),
      ),
    ).toBe(true)
  })

  it('opens a venue on Maps without a request', async () => {
    const fetchMock = serve({})
    const item = buildItem({ text: 'Lunch w/ Priya — Padella Shoreditch' })
    await expect(diningLookup.run(item)).resolves.toEqual({
      link: maps('Padella Shoreditch'),
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('books through OpenTable', async () => {
    serve({
      'site:opentable.com Carbone': 'https://www.opentable.com/r/carbone',
    })
    const item = buildItem({ text: 'Book Carbone for 2, Sat' })
    await expect(diningLookup.run(item)).resolves.toEqual({
      link: 'https://www.opentable.com/r/carbone',
    })
  })

  it('has no match for a chore', async () => {
    const item = buildItem({ text: 'Pay deposit Balthazar' })
    await expect(diningLookup.run(item)).resolves.toBe('no-match')
  })
})

describe('travel lists', () => {
  it('book a named restaurant through the dining path', async () => {
    const item = buildItem({ text: 'Book table at Narisawa', tags: [] })
    expect(travelIntent(item)).toEqual({ kind: 'dine', name: 'Narisawa' })
    expect(travelLookup.label(item)).toBe('Book a table')
    const fetchMock = serve({})
    await expect(travelLookup.run(item)).resolves.toEqual({
      link: maps('Narisawa'),
      failure: 'offline',
    })
    expect(queried(fetchMock)).toEqual([
      'site:opentable.com Narisawa',
      'Narisawa restaurant',
    ])
  })

  it.each([
    ["Reserve table for Priya at Lyle's", "Lyle's"],
    ['Book dinner for Mum at The Ivy 7pm', 'The Ivy'],
    ['Book lunch for Priya and Sam at Dishoom 1pm', 'Dishoom'],
  ])('book the venue, not the person, in %s', (text, name) => {
    expect(travelIntent({ text, tags: [] })).toEqual({ kind: 'dine', name })
  })

  // User decision (22 stage 2): a party size or a time alone isn't a
  // dining word in a travel list ("Book Hamilton for 2" is a show).
  it.each(['Book Narisawa for 2 Fri', 'Book Hamilton for 2'])(
    'need a dining word: %s',
    (text) => {
      expect(travelIntent({ text, tags: [] })).toEqual({ kind: 'none' })
      expect(diningIntent(text).kind).toBe('book')
    },
  )

  it('keep other dining lines a Maps search', () => {
    expect(travelIntent({ text: 'Dinner at Kikunoi 7pm', tags: [] })).toEqual({
      kind: 'place',
    })
    expect(
      travelIntent({ text: 'Book Ghibli Museum tickets', tags: [] }),
    ).toEqual({ kind: 'place' })
  })
})
