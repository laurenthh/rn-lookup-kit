import { isStayName, tokenize } from './stays'

// Packing and admin lines: a link can't help with any of these.
const ADMIN = [
  'passport',
  'passports',
  'visa',
  'visas',
  'esta',
  'insurance',
  'adapter',
  'adapters',
  'adaptor',
  'charger',
  'chargers',
  'power bank',
  'sun cream',
  'suncream',
  'sunscreen',
  'boarding pass',
  'boarding passes',
  'luggage',
  'suitcase',
  'padlock',
  'receipt',
  'receipts',
  'voucher',
  'vouchers',
  'documents',
  'medication',
  'toiletries',
  'swimsuit',
  'swimsuits',
  'packing',
  'offline maps',
  'priority pass',
  'suica',
  'pasmo',
  'confirmation',
  'rsvp',
  'embarkation',
  'out of office',
  'sunglasses',
  'refund',
  'badge pickup',
  'upgrade request',
]

// Household shopping in a travel list: nothing to find on a map.
const GROCERY = [
  'toilet paper',
  'toilet roll',
  'toilet rolls',
  'kitchen roll',
  'paper towels',
  'batteries',
  'dish soap',
  'washing up liquid',
  'detergent',
  'bin bags',
  'bin liners',
  'trash bags',
  'cling film',
  'tin foil',
  'light bulbs',
  'toothpaste',
]

// Toiletries and pharmacy buys, same shape.
const TOILETRIES = [
  'shower gel',
  'body wash',
  'band aids',
  'band aid',
  'paracetamol',
  'ibuprofen',
  'painkillers',
  'deodorant',
  'nappies',
  'diapers',
]

// As the head noun: "Camera battery", "Hand soap", not "Battery Park" or
// "Soap Museum".
const GROCERY_HEADS = [
  'battery',
  'soap',
  'shampoo',
  'conditioner',
  'tissues',
  'plasters',
  'razors',
]

// Admin only as the head noun: "Roadside assistance number", not
// "Number 1 bus" or "Docs Burgers".
const HEAD_NOUNS = [
  'hat',
  'hats',
  'number',
  'badge',
  'upgrade',
  'msg',
  'message',
  'tablets',
  'docs',
  'reference',
  'email',
]

const DETERMINERS = ['the', 'my', 'our', 'your', 'a']

// "Water" opens a chore or packing line ("Water the plants", "Water bottle",
// "Water + snacks") only with one of these; a place or mode word after it
// ("Water taxi", "Water Park") is the thing to find.
const WATER_REST = [
  'plant',
  'plants',
  'flowers',
  'lawn',
  'herbs',
  'seedlings',
  'tomatoes',
  'trees',
  'bottle',
  'bottles',
  'filter',
  'purifier',
  'flask',
  'jug',
  'bladder',
  'shoes',
]
const WATER_LIST = /\bwater\s*(?:\+|&|and\b)/i

// A chore verb that is also a noun is a place when a plain compound follows
// ("Print shop", "Charge station", "Phone repair"), even with an area after
// it, not when an object does ("Call the shop", "Charge phone").
const COMPOUND_HEADS = [
  'shop',
  'shops',
  'store',
  'stores',
  'centre',
  'center',
  'repair',
  'repairs',
  'station',
  'stations',
  'booth',
  'kiosk',
  'point',
  'points',
  'box',
]
const OBJECT_MARKERS = [
  ...DETERMINERS,
  'at',
  'to',
  'for',
  'in',
  'on',
  'with',
  'before',
  'from',
  'near',
  'by',
  'of',
]

const CHORE_VERBS = [
  'print',
  'call',
  'phone',
  'email',
  'text',
  'pay',
  'cancel',
  'confirm',
  'download',
  'pack',
  'renew',
  'apply',
  'send',
  'ask',
  'charge',
  'sign',
  'fill',
  'upload',
  'scan',
  'tell',
  'remind',
  'feed',
]

// With a stay in the line, these are about the stay, not finding it.
const STAY_ADMIN = [
  'print',
  'password',
  'wifi',
  'address',
  'call',
  'cancel',
  'confirm',
  'pay',
  'balance',
  'deposit',
  'included',
  'pickup',
  'pick up',
  'phone number',
  'number for',
  'ref',
  'check',
  'parking',
  'review',
  'phone',
  'arrival',
  'checkout',
  'check out',
  'check in',
]

// Only after the stay: "Hotel breakfast" is admin, "Dinner at Hotel Okura"
// is a place.
const MEALS = ['dinner', 'breakfast', 'lunch', 'brunch']

const padded = (text: string) => ` ${tokenize(text).join(' ')} `
const phrases = (list: string[]) => list.map((phrase) => padded(phrase))

const ADMIN_PHRASES = phrases(ADMIN)
const GROCERY_PHRASES = phrases([...GROCERY, ...TOILETRIES])
const STAY_ADMIN_PHRASES = phrases(STAY_ADMIN)
const CHECK_IN = /\bcheck[\s-]?in\b/i
const CHECK_OUT = /\bcheck[\s-]?out\b\s*(?:$|by\b|at\b|\d|time\b)/i
const MONEY =
  /^(?:transfer|send|pay|exchange)\s+~?(?:[$€£¥]\s?\d|\d[\d,.]*\s*(?:eur|euros?|usd|dollars?|gbp|pounds?|jpy|yen)\b)/i
const STAY_WORD =
  '(?:hotel|hostel|motel|inn|ryokan|apartment|villa|guesthouse|airbnb|b&b|bnb|resort|lodge)'
// "Back to hotel", "Pharmacy near hotel": the user's own stay, not a search.
const STAY_REFERENCE = new RegExp(
  `\\b(to|from|at|near|by)\\s+(?:the\\s+|my\\s+|our\\s+)?${STAY_WORD}$`,
  'i',
)
const ERRAND_VERBS = /^(?:leave|drop|store|meet|pick|collect|return|back)\b/i

const headNoun = (haystack: string) =>
  haystack
    .trim()
    .split(' ')
    .reverse()
    .find((word) => !/\d/.test(word)) ?? ''

const isWaterChore = (text: string) => {
  const words = padded(text).trim().split(' ')
  const at = words.findIndex((word) => !/\d/.test(word))
  const rest = words.slice(at + 1)
  return (
    words[at] === 'water' &&
    (rest.length === 0 ||
      WATER_LIST.test(text) ||
      rest[0] === 'for' ||
      DETERMINERS.includes(rest[0] ?? '') ||
      rest.some((word) => WATER_REST.includes(word)))
  )
}

const isVerbNoun = (words: string[]) => {
  const rest = words.slice(1, 4)
  const head = rest.findIndex((word) => COMPOUND_HEADS.includes(word))
  return (
    words.join(' ') === 'pay phone' ||
    (head >= 0 && !rest.slice(0, head).some((w) => OBJECT_MARKERS.includes(w)))
  )
}

export const isAdmin = (text: string) => {
  const haystack = padded(text)
  return (
    ADMIN_PHRASES.some((phrase) => haystack.includes(phrase)) ||
    HEAD_NOUNS.includes(headNoun(haystack))
  )
}

const isGrocery = (text: string) => {
  const haystack = padded(text)
  return (
    GROCERY_PHRASES.some((phrase) => haystack.includes(phrase)) ||
    GROCERY_HEADS.includes(headNoun(haystack))
  )
}

export const isMoneyTransfer = (text: string) => MONEY.test(text.trim())

export const stayReference = (text: string): 'none' | 'place' | null => {
  const found = STAY_REFERENCE.exec(text.trim())
  if (!found || /^\p{Lu}/u.test(found[0].split(/\s+/).pop() ?? '')) {
    return null
  }
  const preposition = (found[1] ?? '').toLowerCase()
  if (preposition === 'near' || preposition === 'by') {
    return 'place'
  }
  return preposition === 'at' && !ERRAND_VERBS.test(text.trim())
    ? 'place'
    : 'none'
}

const mealAfterStay = (words: string[]) => {
  const meal = words.findIndex((word) => MEALS.includes(word))
  return meal > 0 && isStayName(words.slice(0, meal).join(' '))
}

export const isOffTopic = (text: string) => {
  const haystack = padded(text)
  const words = haystack.trim().split(' ')
  if (
    CHECK_IN.test(text) ||
    CHECK_OUT.test(text) ||
    (CHORE_VERBS.includes(words[0] ?? '') && !isVerbNoun(words)) ||
    isWaterChore(text) ||
    isAdmin(text) ||
    isGrocery(text)
  ) {
    return true
  }
  const stayless = haystack.replace(' bed and breakfast ', ' ')
  // "Paid parking near hotel" is about a place near the user's stay.
  return (
    stayReference(text) === null &&
    isStayName(text) &&
    (STAY_ADMIN_PHRASES.some((phrase) => stayless.includes(phrase)) ||
      mealAfterStay(stayless.trim().split(' ')))
  )
}
