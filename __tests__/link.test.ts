import { describe, expect, it } from 'vitest'
import { isLookupLink, linkHref, lookupLinkKind, parseLink } from '../src/core'

describe('linkHref', () => {
  it('keeps links that already have a scheme', () => {
    expect(linkHref('https://notion.so/a')).toBe('https://notion.so/a')
    expect(linkHref('mailto:me@example.com')).toBe('mailto:me@example.com')
  })

  it('adds https to bare hosts, ports included', () => {
    expect(linkHref('notion.so/release-2.4')).toBe(
      'https://notion.so/release-2.4',
    )
    expect(linkHref('example.com:8080/a')).toBe('https://example.com:8080/a')
  })
})

describe('parseLink', () => {
  it('treats blank input as no link', () => {
    expect(parseLink('   ')).toEqual({ valid: true, link: null })
  })

  it('trims and adds https to bare hosts', () => {
    expect(parseLink(' notion.so/release-2.4 ')).toEqual({
      valid: true,
      link: 'https://notion.so/release-2.4',
    })
    expect(parseLink('HTTP://Example.com?q=1#top')).toEqual({
      valid: true,
      link: 'HTTP://Example.com?q=1#top',
    })
  })

  it('accepts IPv4 addresses with an optional port and path', () => {
    expect(parseLink('192.168.1.10')).toEqual({
      valid: true,
      link: 'https://192.168.1.10',
    })
    expect(parseLink('http://10.0.0.1:8080/admin').valid).toBe(true)
  })

  it('rejects malformed IPv4 addresses', () => {
    for (const input of ['256.1.1.1', '1.2.3', '1.2.3.4.5', '10.0.0.01x']) {
      expect(parseLink(input).valid).toBe(false)
    }
  })

  it('accepts mailto and tel links', () => {
    expect(parseLink('mailto:me@example.com').valid).toBe(true)
    expect(parseLink('tel:+15551234').valid).toBe(true)
  })

  it('rejects obviously invalid input', () => {
    for (const input of [
      'hello',
      'localhost',
      'localhost:3000',
      'not a link',
      'example',
      'https://',
      'https://example.c',
      'me@example.com',
      'javascript:alert(1)',
      'file:///data/secret',
      'mailto:',
    ]) {
      expect(parseLink(input)).toEqual({ valid: false, link: null })
    }
  })
})

describe('lookupLinkKind', () => {
  it('recognizes a maps lookup link', () => {
    expect(
      lookupLinkKind(
        'https://www.google.com/maps/search/?api=1&query=Eiffel%20Tower',
      ),
    ).toBe('maps')
  })

  it('recognizes a website lookup link', () => {
    expect(lookupLinkKind('https://duckduckgo.com/?q=%5CHotel')).toBe('website')
  })

  it.each([
    'https://www.booking.com/hotel/jp/w-osaka.html',
    'https://www.booking.com/hotel/jp/nikko-kanazawa.en-gb.html',
    'https://www.booking.com/city/jp/osaka.html',
    'https://www.booking.com/inns/city/jp/osaka.html',
  ])('recognizes the resolved Booking.com page %s', (link) => {
    expect(lookupLinkKind(link)).toBe('booking')
  })

  it.each([
    'https://www.agoda.com/w-osaka-h20664132/hotel/osaka-jp.html',
    'https://www.agoda.com/en-au/hotel-nikko-kanazawa/hotel/kanazawa-jp.html',
  ])('recognizes the resolved Agoda page %s', (link) => {
    expect(lookupLinkKind(link)).toBe('agoda')
  })

  it('is not another Booking.com or Agoda page, or an official site', () => {
    expect(lookupLinkKind('https://www.booking.com/')).toBe(null)
    expect(
      lookupLinkKind('https://www.booking.com/searchresults.html?ss=Osaka'),
    ).toBe(null)
    expect(
      lookupLinkKind('https://www.agoda.com/en-au/city/osaka-jp.html'),
    ).toBe(null)
    expect(
      lookupLinkKind(
        'https://www.marriott.com/en-us/hotels/osaow-w-osaka/overview/',
      ),
    ).toBe(null)
  })

  it.each([
    'https://www.booking.com/hotel/jp/w-osaka.en-gb.html?aid=304142&label=x&sid=y&checkin=2026-10-01',
    'https://www.booking.com/city/jp/osaka.html#map',
    'https://www.agoda.com/w-osaka-h20664132/hotel/osaka-jp.html?cid=1844104&checkIn=2026-10-01',
  ])('is a user link when a booking page carries a query: %s', (link) => {
    expect(lookupLinkKind(link)).toBe(null)
  })

  it.each([
    [
      'https://www.booking.com/hotel/jp/w-osaka.html?checkin=2026-10-20&checkout=2026-10-25&group_adults=2&no_rooms=1&group_children=0',
      'booking',
    ],
    [
      'https://www.booking.com/city/jp/osaka.html?checkin=2026-10-20&checkout=2026-10-25&group_adults=3&no_rooms=2&group_children=1',
      'booking',
    ],
    [
      'https://www.booking.com/searchresults.html?ss=Hilton%20Osaka&checkin=2026-10-20&checkout=2026-10-25&group_adults=2&no_rooms=1&group_children=0',
      'booking',
    ],
    [
      'https://www.agoda.com/en-au/hotel-nikko-kanazawa/hotel/kanazawa-jp.html?checkIn=2026-10-12&los=3&rooms=1&adults=2&children=0',
      'agoda',
    ],
  ])('recognizes a built stay query (23): %s', (link, kind) => {
    expect(lookupLinkKind(link)).toBe(kind)
  })

  const STAY =
    'checkin=2026-10-20&checkout=2026-10-25&group_adults=2&no_rooms=1&group_children=0'

  it.each([
    // Booking.com's own share links carry tracking params.
    `https://www.booking.com/hotel/jp/w-osaka.html?label=gen173nr&${STAY}`,
    `https://www.booking.com/hotel/jp/w-osaka.html?aid=304142&${STAY}`,
    `https://www.booking.com/hotel/jp/w-osaka.html?${STAY}&sid=7be7835f`,
    `https://www.booking.com/city/jp/osaka.html?${STAY}#map`,
    `https://www.booking.com/city/jp/osaka.html#map?${STAY}`,
    `https://www.booking.com/searchresults.html?ss=Osaka&label=x&${STAY}`,
    `https://www.booking.com/searchresults.html?ss=Osaka`,
    `https://www.booking.com/searchresults.html?${STAY}`,
    `https://www.booking.com/searchresults.en-gb.html?ss=Osaka&${STAY}`,
    // Reordered or reshaped params.
    'https://www.booking.com/city/jp/osaka.html?checkout=2026-10-25&checkin=2026-10-20&group_adults=2&no_rooms=1&group_children=0',
    'https://www.booking.com/city/jp/osaka.html?checkin=2026-1-5&checkout=2026-1-8&group_adults=2&no_rooms=1&group_children=0',
    'https://www.booking.com/city/jp/osaka.html?checkin=2026-10-20&checkout=2026-10-25&group_adults=2&no_rooms=1',
    // The other site's query on this site's page.
    'https://www.booking.com/city/jp/osaka.html?checkIn=2026-10-12&los=3&rooms=1&adults=2&children=0',
    `https://www.agoda.com/w-osaka/hotel/osaka-jp.html?${STAY}`,
    'https://www.agoda.com/w-osaka/hotel/osaka-jp.html?cid=1844104&checkIn=2026-10-12&los=3&rooms=1&adults=2&children=0',
    'https://www.agoda.com/w-osaka/hotel/osaka-jp.html?checkIn=2026-10-12&los=3&rooms=1&adults=2&children=0#reviews',
    // A page that isn't a hotel or area page.
    `https://www.booking.com/index.html?${STAY}`,
    `https://booking.example/hotel/jp/w-osaka.html?${STAY}`,
  ])('is a user link when the stay query differs (23): %s', (link) => {
    expect(lookupLinkKind(link)).toBe(null)
  })

  it('is not a plain DuckDuckGo search the user pasted in', () => {
    expect(lookupLinkKind('https://duckduckgo.com/?q=paris+hotels')).toBe(null)
  })

  it.each([
    'https://www.google.com/travel/flights?q=flights%20to%20Osaka',
    'https://www.google.com/travel/flights?q=flights%20from%20Tokyo%20to%20Osaka',
  ])('recognizes a built flights link %s', (link) => {
    expect(lookupLinkKind(link)).toBe('flights')
  })

  it.each([
    'https://www.google.com/maps/dir/?api=1&destination=Osaka&travelmode=transit',
    'https://www.google.com/maps/dir/?api=1&destination=Osaka&travelmode=driving&origin=Tokyo',
    'https://www.google.com/maps/dir/?api=1&destination=Meiji%20Shrine&travelmode=walking',
    'https://www.google.com/maps/dir/?api=1&destination=Arashiyama&travelmode=bicycling&origin=Kyoto',
  ])('recognizes a built directions link %s', (link) => {
    expect(lookupLinkKind(link)).toBe('directions')
  })

  it('is not a flights or directions link the user pasted with a different shape', () => {
    // A real Flights URL isn't the simple "q=" search form.
    expect(
      lookupLinkKind('https://www.google.com/travel/flights/search?tfs=xyz'),
    ).toBe(null)
    // Extra params (a real share link, or the field order changed).
    expect(
      lookupLinkKind(
        'https://www.google.com/travel/flights?q=flights%20to%20Osaka&curr=USD',
      ),
    ).toBe(null)
    expect(
      lookupLinkKind(
        'https://www.google.com/maps/dir/?api=1&origin=Tokyo&destination=Osaka&travelmode=transit',
      ),
    ).toBe(null)
    expect(
      lookupLinkKind(
        'https://www.google.com/maps/dir/?api=1&destination=Osaka&travelmode=transit&dir_action=navigate',
      ),
    ).toBe(null)
  })

  it('recognises a query-less OpenTable restaurant page', () => {
    for (const link of [
      'https://www.opentable.com/r/carbone',
      'https://www.opentable.com/r/dishoom-kensington-london',
      'https://www.opentable.com/hawksmoor-spitalfields',
      'https://www.opentable.co.uk/r/the-wolseley',
    ]) {
      expect(lookupLinkKind(link)).toBe('opentable')
    }
  })

  it('rejects other OpenTable pages, hosts and pasted links', () => {
    for (const link of [
      'https://www.opentable.com/metro/fr/paris-restaurants',
      'https://www.opentable.com/region/denmark/copenhagen',
      'https://www.opentable.com/neighborhood/n/sydney-nsw/circular-quay-restaurants',
      'https://guestcenter.opentable.com/restaurant/1508053/inventory',
      'https://opentable.com/r/carbone',
      'https://www.opentable.com/r/carbone?covers=2&dateTime=2026-10-10T19%3A00',
      'https://www.opentable.com/s?term=Carbone',
      'https://www.opentable.com/about',
      'https://www.opentable.com/',
    ]) {
      expect(lookupLinkKind(link)).toBe(null)
    }
  })

  it('returns null for a user-added link or no link', () => {
    expect(lookupLinkKind('https://booking.example')).toBe(null)
    expect(lookupLinkKind(null)).toBe(null)
  })

  it('does not throw on malformed percent-encoding in a flights query', () => {
    for (const link of [
      'https://www.google.com/travel/flights?q=100%',
      'https://www.google.com/travel/flights?q=%E0%A4%A',
    ]) {
      expect(() => lookupLinkKind(link)).not.toThrow()
      expect(lookupLinkKind(link)).toBe(null)
    }
  })
})

describe('isLookupLink', () => {
  it('is true for any lookup link shape and false otherwise', () => {
    expect(
      isLookupLink('https://www.google.com/maps/search/?api=1&query=x'),
    ).toBe(true)
    expect(isLookupLink('https://www.booking.com/city/jp/osaka.html')).toBe(
      true,
    )
    expect(isLookupLink('https://booking.example')).toBe(false)
  })
})
