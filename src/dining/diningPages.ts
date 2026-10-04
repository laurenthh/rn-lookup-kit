import { airportCities } from '../places/airports'
import { isDiningWord, VENUE_TYPES } from './diningWords'
import { isOfficialSite } from '../places/stayPages'
import { tokenize } from '../places/stays'
import { openTableSlug, urlParts } from '../core/link'

const FILLER = new Set(['the', 'a', 'an', 'and', '&', 'at', 'of', 'by'])

// "Lyle's" is lyles-london in a slug and lyles.co.uk in a host.
const foldPossessive = (name: string) => name.replace(/['’]s\b/g, 's')
const nameTokens = (name: string) => tokenize(foldPossessive(name))

// Guides, reviews, delivery and other booking sites: never the venue's own.
const DENIED_SITES = [
  'bookatable',
  'broadsheet',
  'cntraveller',
  'concreteplayground',
  'culturetrip',
  'deliveroo',
  'designmynight',
  'doordash',
  'eater',
  'exploretock',
  'foodora',
  'foursquare',
  'glovo',
  'goodfood',
  'gourmettraveller',
  'grubhub',
  'hardens',
  'hot-dinners',
  'infatuation',
  'just-eat',
  'justeat',
  'lafourchette',
  'linkedin',
  'medium',
  'menulog',
  'michelin',
  'opentable',
  'opentravelguide',
  'pinterest',
  'quandoo',
  'resdiary',
  'resy',
  'sevenrooms',
  'squaremeal',
  'tabelog',
  'tablecheck',
  'thefork',
  'theinfatuation',
  'theworlds50best',
  'thrillist',
  'timeout',
  'tripadvisor',
  'ubereats',
  'urbanlist',
  'wolt',
  'yelp',
  'zomato',
]
const DENIED_HOST = new RegExp(
  `(^|\\.)(${DENIED_SITES.join('|')})(\\.[a-z]{2,3}){1,2}$`,
)

// A one-word name that is also a common word: "Tickets" finds FC Barcelona.
const GENERIC_NAMES = new Set([
  ...VENUE_TYPES,
  'bar',
  'catch',
  'central',
  'club',
  'corner',
  'garden',
  'home',
  'house',
  'local',
  'room',
  'social',
  'station',
  'table',
  'tickets',
  'union',
])
const BRAND_MIN_LENGTH = 4

let cityKeys: Set<string> | null = null
const cities = () => {
  cityKeys ??= new Set(
    [...airportCities()].flatMap((city) => {
      const words = tokenize(city)
      return [words.join('-'), words.join('')]
    }),
  )
  return cityKeys
}
const isCity = (words: string[]) => cities().has(words.join('-'))
const CITY_MAX_WORDS = 3

const significant = (words: string[]) =>
  words.filter((word) => !FILLER.has(word) && !VENUE_TYPES.has(word))

// The words that name the venue, past its city ("New York") and its kind.
const ownWords = (name: string) => {
  const words = significant(nameTokens(name))
  const own: string[] = []
  for (let index = 0; index < words.length; index += 1) {
    const city = [CITY_MAX_WORDS, 2, 1].find(
      (length) =>
        index + length <= words.length &&
        isCity(words.slice(index, index + length)),
    )
    if (city === undefined) {
      own.push(words[index] ?? '')
    } else {
      index += city - 1
    }
  }
  return own
}

export const isGenericName = (name: string) => {
  const own = ownWords(name)
  return (
    own.length === 0 || (own.length === 1 && GENERIC_NAMES.has(own[0] ?? ''))
  )
}

// Unmatched slug words may only be a city at the end ("dishoom-kensington-
// london"); every name word but its city must be in the slug.
const slugFits = ({ slug, name }: { slug: string; name: string }) => {
  const slugWords = significant(slug.split('-')).filter(
    (word) => !/^\d+$/.test(word),
  )
  const nameWords = significant(nameTokens(name))
  const own = ownWords(name)
  const slugAll = slug.split('-')
  if (
    own.length === 0 ||
    !own.every((word) => slugWords.includes(word)) ||
    !venueWords(name).every((word) => slugAll.includes(word))
  ) {
    return false
  }
  const unmatched = slugWords.filter((word) => !nameWords.includes(word))
  if (unmatched.length === 0) {
    return true
  }
  const tail = slugWords.slice(slugWords.length - unmatched.length)
  return tail.every((word, index) => word === unmatched[index]) && isCity(tail)
}

// What may follow a one-word name in its host: carbonenewyork.com,
// zumarestaurant.com — but not quayaustralia.com.au (sunglasses).
const BRAND_SUFFIXES = new Set(['dining', 'group', 'nyc', 'eats'])

// The venue words a name carries: "Opera Bar" is never the-opera-kitchen.
const venueWords = (name: string) =>
  nameTokens(name).filter((word) => VENUE_TYPES.has(word))

const isBrandLabel = ({
  label,
  word,
  kinds,
}: {
  label: string
  word: string
  kinds: string[]
}) => {
  const rest = label.startsWith(`the${word}`)
    ? label.slice(word.length + 3)
    : label.startsWith(word)
      ? label.slice(word.length)
      : null
  return (
    rest !== null &&
    (rest === '' ||
      rest.startsWith('-') ||
      (kinds.length === 0 ? VENUE_TYPES.has(rest) : kinds.includes(rest)) ||
      BRAND_SUFFIXES.has(rest) ||
      cities().has(rest))
  )
}

// A one-word name must be the site's own name: noma.dk, carbonenewyork.com.
// A longer one needs it run together, or a word past dishes, in the host.
const brandInHost = ({ host, name }: { host: string; name: string }) => {
  const own = ownWords(name)
  const kinds = venueWords(name)
  const labels = host.split('.')
  if (own.length > 1) {
    const spelled = own.join('')
    const named = own.filter((ownWord) => !isDiningWord(ownWord))
    return (
      labels.some((label) =>
        isBrandLabel({ label: label.replace(/-/g, ''), word: spelled, kinds }),
      ) ||
      (named.length > 0 ? named : own).some(
        (ownWord) =>
          ownWord.length >= BRAND_MIN_LENGTH &&
          labels.some((label) => label.includes(ownWord)),
      )
    )
  }
  const [word = ''] = own
  return (
    word.length >= BRAND_MIN_LENGTH &&
    labels.some((label) => isBrandLabel({ label, word, kinds }))
  )
}

export const diningPage = ({
  url,
  name,
}: {
  url: string
  name: string
}): 'opentable' | 'site' | null => {
  if (isGenericName(name)) {
    return null
  }
  const slug = openTableSlug(url)
  if (slug !== null) {
    return slugFits({ slug, name }) ? 'opentable' : null
  }
  const host = urlParts(url)?.host ?? ''
  return !DENIED_HOST.test(host) &&
    isOfficialSite({ url, name: foldPossessive(name) }) &&
    brandInHost({ host, name })
    ? 'site'
    : null
}
