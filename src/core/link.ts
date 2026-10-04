const SCHEME = /^[a-z][a-z\d+.-]*:(?!\d)/i
const REST = '(:\\d{1,5})?([/?#]\\S*)?$'
const OCTET = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)'
const WEB = new RegExp(
  `^https?://[^\\s/?#@:]+\\.[^\\s/?#@:.\\d]{2,}${REST}`,
  'i',
)
const IPV4 = new RegExp(`^https?://(${OCTET}\\.){3}${OCTET}${REST}`, 'i')
const CONTACT = /^(mailto|tel):\S+$/i

export const linkHref = (link: string) =>
  SCHEME.test(link) ? link : `https://${link}`

export const parseLink = (input: string) => {
  const trimmed = input.trim()

  if (trimmed === '') {
    return { valid: true, link: null }
  }

  const link = linkHref(trimmed)

  return WEB.test(link) || IPV4.test(link) || CONTACT.test(link)
    ? { valid: true, link }
    : { valid: false, link: null }
}

const URL_PARTS = /^https:\/\/([^/?#:@\s]+)(?::\d{1,5})?(\/[^?#\s]*)?/i
const BOOKING_HOST = /(^|\.)booking\.com$/
const AGODA_HOST = /(^|\.)agoda\.com$/
const BOOKING_HOTEL = /^\/hotel\/[a-z]{2}\/([^/.]+)(?:\.[a-z-]+)?\.html$/i
const BOOKING_AREA =
  /^\/(?:[a-z-]+\/)?(?:city|district|landmark|region)\/[a-z]{2}\/([^.?#]+)/i
const AGODA_HOTEL = /\/([^/]+)\/hotel\//i

export type BookingPage = {
  site: 'booking' | 'agoda'
  type: 'hotel' | 'area'
  slug: string
}

export const urlParts = (url: string) => {
  const [, host, path = '/'] = URL_PARTS.exec(url) ?? []
  return host === undefined ? null : { host: host.toLowerCase(), path }
}

const slugOf = ({ pattern, path }: { pattern: RegExp; path: string }) =>
  pattern.exec(path)?.[1]?.toLowerCase().replaceAll('/', '-') ?? null

export const bookingPage = (url: string): BookingPage | null => {
  const parts = urlParts(url)
  if (parts === null) {
    return null
  }

  if (BOOKING_HOST.test(parts.host)) {
    const hotel = slugOf({ pattern: BOOKING_HOTEL, path: parts.path })
    if (hotel !== null) {
      return { site: 'booking', type: 'hotel', slug: hotel }
    }
    const area = slugOf({ pattern: BOOKING_AREA, path: parts.path })
    return area === null ? null : { site: 'booking', type: 'area', slug: area }
  }

  const agoda = AGODA_HOST.test(parts.host)
    ? slugOf({ pattern: AGODA_HOTEL, path: parts.path })
    : null
  return agoda === null ? null : { site: 'agoda', type: 'hotel', slug: agoda }
}

const OPENTABLE_HOST =
  /^www\.opentable\.(?:com|co\.uk|com\.au|ca|ie|de|jp|com\.mx|nl|it|es|sg|hk|ae)$/
const OPENTABLE_PAGE = /^\/(r\/)?([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/
// Single-segment pages that aren't a restaurant.
const OPENTABLE_NOT_VENUES = new Set([
  'about',
  'blog',
  'careers',
  'dining-rewards',
  'faq',
  'food-near-me',
  'gift-cards',
  'help',
  'legal',
  'lists',
  'm',
  'my',
  'privacy',
  'promo',
  'r',
  'restaurant',
  'restaurants',
  'restaurants-near-me',
  's',
  'sitemap',
  'start',
  'user',
])

// A restaurant's page: www host, `/r/<slug>` or the legacy `/<slug>`.
export const openTableSlug = (url: string) => {
  const parts = urlParts(url)
  const page =
    parts !== null && OPENTABLE_HOST.test(parts.host)
      ? OPENTABLE_PAGE.exec(parts.path)
      : null
  const slug = page?.[2]
  if (
    slug === undefined ||
    (page?.[1] === undefined && OPENTABLE_NOT_VENUES.has(slug))
  ) {
    return null
  }
  return slug
}

export const MAPS_LOOKUP_PREFIX =
  'https://www.google.com/maps/search/?api=1&query='
// %5C ("\") is DuckDuckGo's "I'm Feeling Ducky": redirects to result #1.
export const WEBSITE_LOOKUP_PREFIX = 'https://duckduckgo.com/?q=%5C'
export const FLIGHTS_LOOKUP_PREFIX = 'https://www.google.com/travel/flights?q='
export const DIRECTIONS_LOOKUP_PREFIX =
  'https://www.google.com/maps/dir/?api=1&destination='

// Matched against the still-encoded query: decoding here would throw on a
// pasted link with malformed percent-encoding, and this runs on every render.
const FLIGHTS_QUERY = /^flights%20(?:from%20.+%20)?to%20[^&]+$/i
const DIRECTIONS_QUERY =
  /^[^&]+&travelmode=(?:transit|driving|walking|bicycling)(?:&origin=[^&]+)?$/i

// Only the exact shape the lookup builds counts as ours (a real link differs).
const isFlightsLink = (link: string) =>
  link.startsWith(FLIGHTS_LOOKUP_PREFIX) &&
  FLIGHTS_QUERY.test(link.slice(FLIGHTS_LOOKUP_PREFIX.length))

const isDirectionsLink = (link: string) =>
  link.startsWith(DIRECTIONS_LOOKUP_PREFIX) &&
  DIRECTIONS_QUERY.test(link.slice(DIRECTIONS_LOOKUP_PREFIX.length))

export const BOOKING_SEARCH_PREFIX =
  'https://www.booking.com/searchresults.html?ss='
const DAY = '\\d{4}-\\d{2}-\\d{2}'
const COUNT = '\\d{1,4}'
// The stay query the lookup appends; a pasted one carries more params.
const BOOKING_QUERY = new RegExp(
  `^checkin=${DAY}&checkout=${DAY}&group_adults=${COUNT}&no_rooms=${COUNT}&group_children=${COUNT}$`,
)
const AGODA_QUERY = new RegExp(
  `^checkIn=${DAY}&los=${COUNT}&rooms=${COUNT}&adults=${COUNT}&children=${COUNT}$`,
)
const SEARCH_QUERY = /^[^&#]+&(.*)$/

// A resolved page is bare, or carries exactly the stay query we built.
const stayPageSite = (link: string) => {
  if (link.startsWith(BOOKING_SEARCH_PREFIX)) {
    const query = SEARCH_QUERY.exec(link.slice(BOOKING_SEARCH_PREFIX.length))
    return query !== null && BOOKING_QUERY.test(query[1] ?? '')
      ? 'booking'
      : null
  }
  const at = link.indexOf('?')
  const page = at === -1 ? link : link.slice(0, at)
  const site = page.includes('#') ? null : (bookingPage(page)?.site ?? null)
  if (at === -1 || site === null) {
    return site
  }
  const query = link.slice(at + 1)
  return (site === 'booking' ? BOOKING_QUERY : AGODA_QUERY).test(query)
    ? site
    : null
}

export const lookupLinkKind = (
  link: string | null,
):
  | 'maps'
  | 'website'
  | 'booking'
  | 'agoda'
  | 'flights'
  | 'directions'
  | 'opentable'
  | null => {
  if (link === null) {
    return null
  }
  if (link.startsWith(MAPS_LOOKUP_PREFIX)) {
    return 'maps'
  }
  if (link.startsWith(WEBSITE_LOOKUP_PREFIX)) {
    return 'website'
  }
  if (isFlightsLink(link)) {
    return 'flights'
  }
  if (isDirectionsLink(link)) {
    return 'directions'
  }
  // An OpenTable page with a query was pasted by the user.
  return (
    stayPageSite(link) ??
    (/[?#]/.test(link) || openTableSlug(link) === null ? null : 'opentable')
  )
}

export const isLookupLink = (link: string | null) =>
  lookupLinkKind(link) !== null
