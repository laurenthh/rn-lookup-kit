import { describe, expect, it } from 'vitest'
import {
  areaMatch,
  isAgodaHotel,
  isBookingHotel,
  isOfficialSite,
} from '../src/places/stayPages'
import { bookingPage } from '../src/core/link'

// First results observed on DuckDuckGo, 2026-09-28.
const MARRIOTT_W_OSAKA =
  'https://www.marriott.com/en-us/hotels/osaow-w-osaka/overview/'
const BOOKING_W_OSAKA = 'https://www.booking.com/hotel/jp/w-osaka.html'
const BOOKING_NIKKO =
  'https://www.booking.com/hotel/jp/nikko-kanazawa.en-gb.html'
const AGODA_W_OSAKA =
  'https://www.agoda.com/w-osaka-h20664132/hotel/osaka-jp.html'
const AGODA_NIKKO =
  'https://www.agoda.com/en-au/hotel-nikko-kanazawa/hotel/kanazawa-jp.html'
const BOOKING_OSAKA = 'https://www.booking.com/city/jp/osaka.html'
const BOOKING_OSAKA_INNS = 'https://www.booking.com/inns/city/jp/osaka.html'
const YOUTUBE = 'https://www.youtube.com/watch?v=1sgfODcZm6s'

describe('bookingPage', () => {
  it.each([
    [BOOKING_W_OSAKA, { site: 'booking', type: 'hotel', slug: 'w-osaka' }],
    [BOOKING_NIKKO, { site: 'booking', type: 'hotel', slug: 'nikko-kanazawa' }],
    [BOOKING_OSAKA, { site: 'booking', type: 'area', slug: 'osaka' }],
    [BOOKING_OSAKA_INNS, { site: 'booking', type: 'area', slug: 'osaka' }],
    [
      'https://www.booking.com/district/jp/tokyo/shinjuku.html',
      { site: 'booking', type: 'area', slug: 'tokyo-shinjuku' },
    ],
    [
      'https://booking.com/landmark/fr/eiffel-tower.fr.html',
      { site: 'booking', type: 'area', slug: 'eiffel-tower' },
    ],
    [
      AGODA_W_OSAKA,
      { site: 'agoda', type: 'hotel', slug: 'w-osaka-h20664132' },
    ],
    [
      AGODA_NIKKO,
      { site: 'agoda', type: 'hotel', slug: 'hotel-nikko-kanazawa' },
    ],
  ])('%s', (url, page) => {
    expect(bookingPage(url)).toEqual(page)
  })

  it.each([
    'http://www.booking.com/hotel/jp/w-osaka.html',
    'https://www.booking.com/searchresults.html?ss=Osaka',
    'https://www.booking.com/',
    'https://www.booking.com.evil.example/hotel/jp/w-osaka.html',
    'https://notbooking.com/hotel/jp/w-osaka.html',
    'https://www.agoda.com/en-au/city/osaka-jp.html',
    MARRIOTT_W_OSAKA,
    YOUTUBE,
  ])('is null for %s', (url) => {
    expect(bookingPage(url)).toBeNull()
  })
})

describe('isOfficialSite', () => {
  it("accepts the hotel's own site when a name word is in the address", () => {
    expect(
      isOfficialSite({ url: MARRIOTT_W_OSAKA, name: 'W Osaka Hotel' }),
    ).toBe(true)
    expect(
      isOfficialSite({
        url: 'https://www.hyatt.com/park-hyatt/en-US/tyoph-park-hyatt-tokyo',
        name: 'Park Hyatt Tokyo',
      }),
    ).toBe(true)
  })

  it('matches names with accents against plain addresses', () => {
    expect(
      isOfficialSite({
        url: 'https://www.dorchestercollection.com/paris/hotel-plaza-athenee',
        name: 'Hôtel Plaza Athénée',
      }),
    ).toBe(true)
  })

  it.each([
    BOOKING_W_OSAKA,
    AGODA_W_OSAKA,
    'https://www.tripadvisor.co.uk/Hotel_Review-w-osaka.html',
    'https://www.expedia.co.jp/Osaka-Hotels-W-Osaka.h1.Hotel-Information',
    'https://www.hotels.com/ho1/w-osaka/',
    'https://www.trip.com/hotels/osaka-hotel-detail-1/w-osaka/',
    'https://en.wikipedia.org/wiki/W_Osaka',
    'https://m.youtube.com/watch?v=osaka',
    'https://www.google.co.jp/maps/place/W+Osaka',
    'https://www.instagram.com/wosaka/',
  ])('rejects the booking or review site %s', (url) => {
    expect(isOfficialSite({ url, name: 'W Osaka Hotel' })).toBe(false)
  })

  it('rejects a site that shares only the city with the name', () => {
    expect(
      isOfficialSite({
        url: 'https://osaka-info.jp/en/',
        name: 'W Osaka Hotel',
      }),
    ).toBe(false)
    expect(
      isOfficialSite({ url: 'https://w.example.com/', name: 'W Hotel' }),
    ).toBe(false)
  })

  it('rejects an address that shares no name word', () => {
    expect(isOfficialSite({ url: YOUTUBE, name: 'Zzqx Fakename Inn' })).toBe(
      false,
    )
    expect(
      isOfficialSite({
        url: 'https://www.example.com/hotel/inn',
        name: 'Hotel Inn',
      }),
    ).toBe(false)
  })

  it('ignores one-letter words and rejects non-https addresses', () => {
    expect(
      isOfficialSite({ url: 'https://w.example.com/', name: 'W Hotel' }),
    ).toBe(false)
    expect(
      isOfficialSite({ url: 'http://www.w-osaka.com/', name: 'W Osaka' }),
    ).toBe(false)
  })
})

describe('isOfficialSite — brand word (live check, 2026-10-03)', () => {
  it.each([
    ['https://www.sacher.com/en/vienna/', 'Hotel Sacher Wien'],
    [
      'https://www.marriott.com/en-us/hotels/nycmq-new-york-marriott-marquis/overview/',
      'Marriott Marquis Times Square',
    ],
    ['https://www.granviakyoto.com/index.html', 'Hotel Granvia Kyoto'],
    ['https://en.gracery.com/shinjuku/', 'Hotel Gracery Shinjuku Tokyo'],
    ['https://www.innatthemarket.com/', 'Inn at the Market, Seattle'],
    ['https://www.hotelcasafuster.com/en/', 'Hotel Casa Fuster'],
  ])('accepts %s for %s', (url, name) => {
    expect(isOfficialSite({ url, name })).toBe(true)
  })

  it.each([
    // A chain alone is no brand: another Hilton is another hotel.
    ['https://www.hilton.com/en/hotels/tyohitw-hilton-tokyo/', 'Hilton Osaka'],
    // The place alone is no brand.
    [
      'https://www.timeout.com/newyork/hotels/times-square',
      'Marriott Marquis Times Square',
    ],
    [
      'https://www.gotokyo.org/en/destinations/shinjuku/',
      'Hotel Gracery Shinjuku',
    ],
    // Generic and lodging words are no brand.
    ['https://www.royalpark.com/', 'Royal Park Hotel Tokyo Nihonbashi'],
    ['https://www.villas.com/tuscany/', 'Villa Cora Florence'],
    // Too short to tell.
    ['https://www.ace.com/', 'Ace Hotel Kyoto'],
    ['https://www.theinn.com/', 'The Inn, Seattle'],
    // Only in the path, not the host.
    ['https://www.example.com/innatthemarket', 'Inn at the Market, Seattle'],
  ])('rejects %s for %s', (url, name) => {
    expect(isOfficialSite({ url, name })).toBe(false)
  })

  it('leaves a CJK name to the fallback', () => {
    expect(
      isOfficialSite({
        url: 'https://hoshinoresorts.com/ja/hotels/hoshinoyakyoto/',
        name: '星のや京都',
      }),
    ).toBe(false)
  })
})

describe('isBookingHotel', () => {
  it('accepts a Booking.com hotel page whose slug shares a name word', () => {
    expect(isBookingHotel({ url: BOOKING_W_OSAKA, name: 'W Osaka' })).toBe(true)
    expect(isBookingHotel({ url: BOOKING_NIKKO, name: 'Nikko Kanazawa' })).toBe(
      true,
    )
  })

  it('rejects another hotel that shares only the city', () => {
    expect(
      isBookingHotel({
        url: 'https://www.booking.com/hotel/jp/hotel-osaka-bay-tower.html',
        name: 'W Osaka',
      }),
    ).toBe(false)
    expect(isBookingHotel({ url: BOOKING_W_OSAKA, name: 'W' })).toBe(false)
  })

  it('rejects another hotel, a city page and an Agoda page', () => {
    expect(isBookingHotel({ url: BOOKING_NIKKO, name: 'W Osaka' })).toBe(false)
    expect(isBookingHotel({ url: BOOKING_OSAKA, name: 'Osaka' })).toBe(false)
    expect(isBookingHotel({ url: AGODA_W_OSAKA, name: 'W Osaka' })).toBe(false)
  })
})

describe('unmatched slug words (live check, 2026-10-03)', () => {
  it.each([
    [
      'https://www.booking.com/hotel/de/generator-berlin-mitte.html',
      'Generator Berlin',
    ],
    ['https://www.booking.com/hotel/it/grand-villa-cora.html', 'Villa Cora'],
    [
      'https://www.booking.com/hotel/es/hostel-one-sants.html',
      'One Sants Barcelona',
    ],
    [
      'https://www.booking.com/hotel/jp/gracery-shinjuku.html',
      'Gracery Shinjuku',
    ],
    [
      'https://www.booking.com/hotel/jp/park-hyatt-tokyo.html',
      'Park Hyatt Tokyo',
    ],
    [
      'https://www.booking.com/hotel/es/sol-pelicanos-ocas.html',
      'Sol Pelícanos',
    ],
    [
      'https://www.booking.com/hotel/fr/ha-tel-plaza-atha-c-na-c-e-paris.html',
      'Plaza Athénée Paris',
    ],
  ])('accepts the Booking.com page %s for %s', (url, name) => {
    expect(isBookingHotel({ url, name })).toBe(true)
  })

  it.each([
    [
      'https://www.agoda.com/ibis-budget-osaka-umeda/hotel/osaka-jp.html',
      'Ibis Budget Osaka Umeda',
    ],
    [
      'https://www.agoda.com/gion-hatanaka/hotel/kyoto-jp.html',
      'Gion Hatanaka',
    ],
  ])('accepts the Agoda page %s for %s', (url, name) => {
    expect(isAgodaHotel({ url, name })).toBe(true)
  })

  it('rejects another hotel of the same chain with an extra word in the middle', () => {
    const bryce =
      'https://www.agoda.com/en-au/best-western-plus-bryce-canyon-grand-hotel/hotel/bryce-canyon-ut-us.html'
    expect(
      isAgodaHotel({ url: bryce, name: 'Best Western Grand Canyon' }),
    ).toBe(false)
  })

  it('rejects an extra word when a name word is missing', () => {
    expect(
      isBookingHotel({
        url: 'https://www.booking.com/hotel/jp/grand-hyatt-tokyo.html',
        name: 'Park Hyatt Tokyo',
      }),
    ).toBe(false)
  })

  it('rejects two extra words at the ends', () => {
    expect(
      isBookingHotel({
        url: 'https://www.booking.com/hotel/de/generator-berlin-mitte-east.html',
        name: 'Generator Berlin',
      }),
    ).toBe(false)
  })
})

describe('areaMatch', () => {
  it('is exact when the slug is the whole name', () => {
    expect(areaMatch({ url: BOOKING_OSAKA, name: 'Osaka' })).toBe('exact')
    expect(
      areaMatch({
        url: 'https://www.booking.com/city/us/new-york.html',
        name: 'New York',
      }),
    ).toBe('exact')
  })

  it('is partial when the slug shares a name word', () => {
    expect(
      areaMatch({ url: BOOKING_OSAKA_INNS, name: 'Zzqx Fakename Osaka' }),
    ).toBe('partial')
    expect(
      areaMatch({
        url: 'https://www.booking.com/district/jp/tokyo/shinjuku.html',
        name: 'Shinjuku station',
      }),
    ).toBe('partial')
  })

  it('is partial on a loose match of a long word (live check)', () => {
    expect(
      areaMatch({
        url: 'https://www.booking.com/landmark/jp/nanba.html',
        name: 'Namba station',
      }),
    ).toBe('partial')
    expect(
      areaMatch({
        url: 'https://www.booking.com/city/jp/naha.html',
        name: 'Nara',
      }),
    ).toBeNull()
  })

  it('is partial for any area page when the name is CJK (live check)', () => {
    expect(
      areaMatch({
        url: 'https://www.booking.com/city/jp/osaka.ja.html',
        name: '大阪',
      }),
    ).toBe('partial')
    expect(areaMatch({ url: BOOKING_W_OSAKA, name: '大阪' })).toBeNull()
  })

  it('is null for an unrelated city, a hotel page or an Agoda page', () => {
    expect(areaMatch({ url: BOOKING_OSAKA, name: 'Kyoto' })).toBeNull()
    expect(areaMatch({ url: BOOKING_W_OSAKA, name: 'W Osaka' })).toBeNull()
    expect(areaMatch({ url: AGODA_W_OSAKA, name: 'W Osaka' })).toBeNull()
  })
})

describe('isAgodaHotel', () => {
  it('accepts an Agoda hotel page whose slug shares a name word', () => {
    expect(isAgodaHotel({ url: AGODA_W_OSAKA, name: 'W Osaka' })).toBe(true)
    expect(isAgodaHotel({ url: AGODA_NIKKO, name: 'Nikko Kanazawa' })).toBe(
      true,
    )
  })

  it('rejects another hotel that shares only the city', () => {
    expect(
      isAgodaHotel({
        url: 'https://www.agoda.com/imperial-hotel-osaka/hotel/osaka-jp.html',
        name: 'Zzqx Fakename Osaka',
      }),
    ).toBe(false)
  })

  it('rejects another hotel and a Booking.com page', () => {
    expect(isAgodaHotel({ url: AGODA_NIKKO, name: 'W Osaka' })).toBe(false)
    expect(isAgodaHotel({ url: BOOKING_W_OSAKA, name: 'W Osaka' })).toBe(false)
  })
})

// Stage 2 (review): wrong first results DuckDuckGo could return.
describe('isOfficialSite — wrong first results (review)', () => {
  it.each([
    // The brand alone must keep the name's known city.
    ['https://jrwest-hotels.jp/en/granvia-kyoto/', 'Hotel Granvia Osaka'],
    ['https://www.granviakyoto.com/index.html', 'Hotel Granvia Osaka'],
    ['https://www.hotelnikkonarita.com/', 'Hotel Nikko Osaka'],
    ['https://www.goindigo.in/', 'Hotel Indigo Bali'],
    ['https://www.standard.co.uk/', 'The Standard London'],
    ['https://www.arts.gov/', 'Hotel Arts Barcelona'],
    ['https://www.animalshelter.org/', 'Mama Shelter Paris'],
    ['https://www.metropole.co.uk/', 'Hotel Metropole Hanoi'],
    ['https://www.timeout.com/newyork/hotels', 'Conrad New York Downtown'],
    // Another city in the address.
    [
      'https://www.hyatt.com/hyatt-regency/en-US/osarh-hyatt-regency-osaka',
      'Hyatt Regency Tokyo',
    ],
    [
      'https://www.hyatt.com/grand-hyatt/en-US/sinrh-grand-hyatt-singapore',
      'Grand Hyatt Tokyo',
    ],
    [
      'https://www.mandarinoriental.com/en/bangkok/chao-phraya-river',
      'Mandarin Oriental Tokyo',
    ],
    ['https://www.fourseasons.com/tokyo/', 'Four Seasons Kyoto'],
    ['https://www.aman.com/hotels/aman-kyoto', 'Aman Tokyo'],
    ['https://www.sacher.com/en/vienna/', 'Hotel Sacher Salzburg'],
    ['https://hoshinoresorts.com/en/hotels/hoshinoyatokyo/', 'Hoshinoya Kyoto'],
    ['https://www.hotelmonterey.co.jp/osaka/', 'Hotel Monterey Kyoto'],
    // A chain and a city alone are another property.
    [
      'https://www.hilton.com/en/hotels/osahitw-hilton-osaka/',
      'Hilton Garden Inn Osaka',
    ],
    [
      'https://www.citizenm.com/hotels/europe/london/london-shoreditch-hotel',
      'citizenM Tower of London',
    ],
    // The city's own site.
    ['https://www.barcelona.cat/en/arts', 'Hotel Arts Barcelona'],
    ['https://www.barcelona.com/', 'W Barcelona'],
    ['https://osaka-info.jp/en/umeda/', 'Ibis Budget Osaka Umeda'],
    // A neighbourhood is no brand.
    [
      'https://www.visitlondon.com/things-to-do/london-areas/shoreditch',
      'The Hoxton Shoreditch',
    ],
    ['https://www.example.com/en/umeda/', 'Ibis Budget Osaka Umeda'],
    ['https://www.example.com/en/honmachi/', 'Moxy Osaka Honmachi'],
    // The brand is a whole word of the path.
    ['https://www.example.com/graceryland/', 'Hotel Gracery Shinjuku'],
    // The run-together name is a whole host label of 3+ words.
    ['https://www.grandhotelstockholm.se/', 'Grand Hotel Oslo'],
    ['https://www.grandhotel.com/', 'Grand Hotel Oslo'],
    ['https://www.hotelnewotani.co.jp/', 'Hotel New Tokyo'],
    ['https://www.parkhotel.nl/', 'Park Hotel Tokyo'],
    ['https://www.parkhotelgroup.com/', 'Park Hotel Tokyo'],
    ['https://www.hotelgranvia.com/en', 'Hotel Granvia Osaka'],
    ['https://www.innatthemarketplace.com/', 'Inn at the Market, Seattle'],
    // Aggregators that put the hotel's name in the path.
    [
      'https://www.mrandmrssmith.com/luxury-hotels/the-hoxton-shoreditch',
      'The Hoxton Shoreditch',
    ],
    [
      'https://www.tablethotels.com/en/kyoto-hotels/ace-hotel-kyoto',
      'Ace Hotel Kyoto',
    ],
    ['https://www.designhotels.com/hotels/casa-fuster', 'Hotel Casa Fuster'],
    ['https://www.hotelscombined.com/hotel/sacher-wien', 'Hotel Sacher Wien'],
  ])('rejects %s for %s', (url, name) => {
    expect(isOfficialSite({ url, name })).toBe(false)
  })

  it.each([
    ['https://www.sacher.com/en/vienna/', 'Hotel Sacher Wien'],
    ['https://www.sacher.com/en/vienna/', 'Hotel Sacher Vienna'],
    [
      'https://www.marriott.com/en-us/hotels/nycmq-new-york-marriott-marquis/overview/',
      'Marriott Marquis Times Square',
    ],
    ['https://www.granviakyoto.com/index.html', 'Hotel Granvia Kyoto'],
    ['https://www.hotelcasafuster.com/en/', 'Hotel Casa Fuster'],
    [
      'https://www.melia.com/en/hotels/spain/benidorm/sol-pelicanos-ocas',
      'Hotel Sol Pelícanos',
    ],
    [
      'https://www.hyatt.com/park-hyatt/en-US/tyoph-park-hyatt-tokyo',
      'Park Hyatt Tokyo',
    ],
    [
      'https://www.hyatt.com/park-hyatt/en-US/nycph-park-hyatt-new-york',
      'Park Hyatt New York',
    ],
    ['https://en.gracery.com/shinjuku/', 'Hotel Gracery Shinjuku'],
    ['https://thehoxton.com/london/shoreditch/', 'The Hoxton Shoreditch'],
    ['https://www.innatthemarket.com/', 'Inn at the Market, Seattle'],
    ['https://www.villacora.it/en/', 'Villa Cora'],
    ['https://ninehours.co.jp/en', 'Nine Hours Shinjuku'],
    ['https://acehotel.com/kyoto/', 'Ace Hotel Kyoto'],
    [
      'https://www.hyatt.com/hyatt-regency/en-US/miarm-hyatt-regency-miami',
      'Hyatt Regency Miami',
    ],
  ])('still accepts %s for %s', (url, name) => {
    expect(isOfficialSite({ url, name })).toBe(true)
  })
})

describe('slug words — Agoda takes no extras (review)', () => {
  it('accepts one end word on Booking.com but not on Agoda', () => {
    expect(
      isBookingHotel({
        url: 'https://www.booking.com/hotel/jp/hilton-tokyo-bay.html',
        name: 'Hilton Tokyo',
      }),
    ).toBe(true)
    expect(
      isAgodaHotel({
        url: 'https://www.agoda.com/hilton-tokyo-bay/hotel/tokyo-jp.html',
        name: 'Hilton Tokyo',
      }),
    ).toBe(false)
  })

  it.each([
    [
      'https://www.agoda.com/gion-hatanaka/hotel/kyoto-jp.html',
      'Gion Hatanaka',
    ],
    [
      'https://www.agoda.com/ibis-budget-osaka-umeda/hotel/osaka-jp.html',
      'Ibis Budget Osaka Umeda',
    ],
    [
      'https://www.agoda.com/gora-kadan-h10565065/hotel/hakone-jp.html',
      'Gora Kadan',
    ],
  ])('keeps the live Agoda page %s for %s', (url, name) => {
    expect(isAgodaHotel({ url, name })).toBe(true)
  })

  it('rejects a chain and a city without the name of its own', () => {
    expect(
      isBookingHotel({
        url: 'https://www.booking.com/hotel/jp/hilton-osaka.html',
        name: 'Hilton Garden Osaka',
      }),
    ).toBe(false)
  })
})

describe('areaMatch — known cities match exactly (review)', () => {
  it.each([
    ['https://www.booking.com/city/it/genova.html', 'Geneva'],
    ['https://www.booking.com/city/es/grenada.html', 'Granada'],
    ['https://www.booking.com/city/us/cordova.html', 'Cordoba'],
    ['https://www.booking.com/city/nl/assen.html', 'Essen'],
    ['https://www.booking.com/landmark/gr/delphi.html', 'Delhi'],
    ['https://www.booking.com/city/es/palma.html', 'Parma'],
  ])('is null for %s and %s', (url, name) => {
    expect(areaMatch({ url, name })).toBeNull()
  })

  it('still matches a romanisation and an exonym', () => {
    expect(
      areaMatch({
        url: 'https://www.booking.com/landmark/jp/nanba.html',
        name: 'Namba station',
      }),
    ).toBe('partial')
    expect(
      areaMatch({
        url: 'https://www.booking.com/city/pt/lisboa.html',
        name: 'Lisbon',
      }),
    ).toBe('partial')
  })

  it('takes a Hangul name as CJK', () => {
    expect(
      areaMatch({
        url: 'https://www.booking.com/city/kr/seoul.html',
        name: '서울',
      }),
    ).toBe('partial')
  })
})

describe('isOfficialSite — stage 3 (review)', () => {
  it.each([
    // The name's own city is in the address: other city words are room names.
    [
      'https://www.hotelokura.com/tokyo/rooms/imperial-suite',
      'Hotel Okura Tokyo',
    ],
    ['https://www.hotelokura.com/tokyo/page/rooms', 'Hotel Okura Tokyo'],
    ['https://www.hotelokura.com/tokyo/mobile/', 'Hotel Okura Tokyo'],
    ['https://www.hotelokura.com/tokyo/windsor-suite', 'Hotel Okura Tokyo'],
    // A city TLD or subdomain is no portal.
    ['https://hotelokura.tokyo/', 'Hotel Okura Tokyo'],
    ['https://hotelokura.kyoto/', 'Hotel Okura Kyoto'],
    ['https://hotelokura.osaka/', 'Hotel Okura Osaka'],
    ['https://tokyo.park.hyatt.com/', 'Park Hyatt Tokyo'],
  ])('accepts %s for %s', (url, name) => {
    expect(isOfficialSite({ url, name })).toBe(true)
  })

  it.each([
    ['https://www.barcelona.cat/en/arts', 'Hotel Arts Barcelona'],
    ['https://www.barcelona.com/arts-hotel', 'Hotel Arts Barcelona'],
    ['https://osaka-info.jp/en/okura/', 'Hotel Okura Osaka'],
    ['https://www.visitlondon.com/the-hoxton', 'The Hoxton London'],
    [
      'https://www.cntraveler.com/hotels/vienna/hotel-sacher-wien',
      'Hotel Sacher Wien',
    ],
    [
      'https://www.lonelyplanet.com/austria/vienna/hotel-sacher-wien',
      'Hotel Sacher Wien',
    ],
    [
      'https://www.telegraph.co.uk/travel/hotel-sacher-wien',
      'Hotel Sacher Wien',
    ],
    [
      'https://www.timeout.com/tokyo/hotels/park-hyatt-tokyo',
      'Park Hyatt Tokyo',
    ],
    [
      'https://www.travelandleisure.com/hotels/park-hyatt-tokyo',
      'Park Hyatt Tokyo',
    ],
  ])('rejects %s for %s', (url, name) => {
    expect(isOfficialSite({ url, name })).toBe(false)
  })
})

describe('isOfficialSite — guide hosts (2026-10-04)', () => {
  it.each([
    [
      'https://opentravelguide.com/japan/tokyo/hotels/park-hyatt-tokyo',
      'Park Hyatt Tokyo',
    ],
    [
      'https://opentravelguide.com/austria/vienna/hotels/hotel-sacher-wien',
      'Hotel Sacher Wien',
    ],
    ['https://www.japan-guide.com/hotels/aman-tokyo', 'Aman Tokyo'],
    // A chain word in a guide's host is not the hotel's own (Ponytail).
    ['https://www.hiltontravelguide.com/tokyo', 'Hilton Tokyo'],
    [
      'https://www.viennatravel.com/hotels/hotel-sacher-wien',
      'Hotel Sacher Wien',
    ],
    // Live (22): the stay path once took it for "Narisawa Tokyo".
    [
      'https://guide.michelin.com/en/tokyo-region/tokyo/restaurant/narisawa',
      'Narisawa Tokyo',
    ],
  ])('rejects %s for %s', (url, name) => {
    expect(isOfficialSite({ url, name })).toBe(false)
  })

  it.each([
    [
      'https://www.travelodge.co.uk/hotels/123/london-kings-cross',
      'Travelodge London Kings Cross',
    ],
    ['https://www.sacher.com/en/vienna/', 'Hotel Sacher Wien'],
  ])('still accepts %s for %s', (url, name) => {
    expect(isOfficialSite({ url, name })).toBe(true)
  })
})
