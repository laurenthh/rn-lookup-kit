import type { LookupInput } from '../core/types'
import { normalize } from '../core/normalize'

const ACCOMMODATION_KEYWORDS = [
  'hotel',
  'hostel',
  'motel',
  'inn',
  'ryokan',
  'minshuku',
  'resort',
  'lodge',
  'guesthouse',
  'guest house',
  'b&b',
  'b & b',
  'bnb',
  'bed and breakfast',
  'pension',
  'riad',
  'suites',
]

// Detection only: the result checker in stayPages keeps these as name words.
const LODGING_KEYWORDS = [
  'villa',
  'apartment',
  'aparthotel',
  'agriturismo',
  'shukubo',
  'glamping',
  'accommodation',
  'homestay',
  'place to stay',
  'where to stay',
  'somewhere to stay',
  'hotels',
  'hostels',
  'motels',
  'resorts',
  'apartments',
  'villas',
]

// Excluded (name collisions): taj, aman, peninsula, capsule. Use the hotel tag.
// Also the result checker's chain words: never a brand, never enough alone.
const CHAIN_NAMES = [
  'hyatt',
  'hilton',
  'marriott',
  'sheraton',
  'westin',
  'ibis',
  'novotel',
  'mercure',
  'sofitel',
  'radisson',
  'ritz carlton',
  'kempinski',
  'hoxton',
  'fairmont',
  'conrad',
  'intercontinental',
  'doubletree',
  'oberoi',
  'langham',
  'rosewood',
  'andaz',
  'mandarin oriental',
  'shangri-la',
  'best western',
  'four seasons',
  'waldorf astoria',
  'crowne plaza',
  'banyan tree',
  'six senses',
  'st regis',
  'travelodge',
  'citizenm',
  'yotel',
  'moxy',
  'premier inn',
  'hampton by hilton',
]

const TOKEN_SPLIT = /[^\p{L}\p{N}&]+/u

export const tokenize = (text: string) =>
  normalize(text)
    .split(TOKEN_SPLIT)
    .filter((token) => token !== '')

const padded = (tokens: string[]) => ` ${tokens.join(' ')} `

export const ACCOMMODATION_PHRASES = ACCOMMODATION_KEYWORDS.map(tokenize)

export const LODGING_PHRASES = LODGING_KEYWORDS.map(tokenize)

export const CHAIN_PHRASES = CHAIN_NAMES.map(tokenize)

const STAY_PHRASES = [
  ...ACCOMMODATION_KEYWORDS,
  ...LODGING_KEYWORDS,
  ...CHAIN_NAMES,
].map((phrase) => padded(tokenize(phrase)))

// "Generator Paris" is the hostel chain, "Generator rental" is not; the one
// letter "W" only counts as "W Barcelona".
const W_CHAIN = /(?:^|\s)W\s+\p{Lu}/u
const GENERATOR =
  /(?:^|\s)[Gg]enerator\s+(?:\p{Lu}|[Hh]ostels?\b|[Hh]otels?\b)/u

export const isStayName = (text: string) => {
  const haystack = padded(tokenize(text))
  return (
    STAY_PHRASES.some((phrase) => haystack.includes(phrase)) ||
    W_CHAIN.test(text) ||
    GENERATOR.test(text)
  )
}

// Airbnb listings have no site of their own: a Maps search (14 decision).
export const isAirbnb = (text: string) => /\bairbnb\b/i.test(text)

export const hasHotelTag = (item: Pick<LookupInput, 'tags'>) =>
  item.tags.some((tag) => tag.toLocaleLowerCase() === 'hotel')
