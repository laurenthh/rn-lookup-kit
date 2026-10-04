import type { PortionKey } from './types'
import {
  foodTokens,
  FRACTION_CHARS,
  FRACTIONS,
  singular,
} from '../core/normalize'

export type AmountWord = 'handful' | 'scoop' | 'bowl' | 'glass'

export type Unit = PortionKey | 'g' | 'kg' | 'oz' | 'lb' | 'l' | AmountWord

export type QuantitySplit = {
  amount: number | null
  unit: Unit | null
  name: string
}

const UNIT_WORDS: Record<Unit, string[]> = {
  g: ['g', 'gr', 'gram'],
  kg: ['kg', 'kilo', 'kilogram'],
  oz: ['oz', 'ounce'],
  lb: ['lb', 'lbs', 'pound'],
  ml: ['ml', 'millilitre', 'milliliter'],
  l: ['l', 'ltr', 'litre', 'liter'],
  cup: ['cup'],
  tbsp: ['tbsp', 'tbs', 'tablespoon'],
  tsp: ['tsp', 'teaspoon'],
  slice: ['slice'],
  clove: ['clove'],
  piece: ['piece', 'pc', 'pcs'],
  small: ['small'],
  medium: ['medium'],
  large: ['large'],
  handful: ['handful'],
  scoop: ['scoop'],
  bowl: ['bowl'],
  glass: ['glass'],
}

const UNIT_OF = new Map(
  Object.entries(UNIT_WORDS).flatMap(([unit, words]) =>
    words.map((word) => [word, unit as Unit] as const),
  ),
)

export const SIZES = new Set<Unit>(['small', 'medium', 'large'])

const AMOUNT_WORDS = new Set<Unit>(['handful', 'scoop', 'bowl', 'glass'])

export const isAmountWord = (unit: Unit): unit is AmountWord =>
  AMOUNT_WORDS.has(unit)

// A container count says nothing about grams, so the amount is dropped.
const PACKAGES = new Set([
  'bag',
  'pack',
  'packet',
  'bunch',
  'box',
  'bottle',
  'jar',
  'can',
  'carton',
  'tin',
  'tub',
  'punnet',
  'head',
  'loaf',
])

const WORDS: Record<string, number> = { a: 1, an: 1, half: 0.5, dozen: 12 }

const FRACTION_TOKEN = new RegExp(`[/${FRACTION_CHARS}]`)
const GLUED_FRACTION = new RegExp(`^(\\d+)([${FRACTION_CHARS}])$`)

const numberOf = (token: string | undefined): number | null => {
  if (token === undefined) return null
  if (FRACTIONS[token] !== undefined) return FRACTIONS[token]
  if (/^\d+(\.\d+)?$/.test(token)) return Number(token)
  const fraction = /^(\d)\/(\d)$/.exec(token)
  return fraction && Number(fraction[1]) < Number(fraction[2])
    ? Number(fraction[1]) / Number(fraction[2])
    : null
}

const readAmount = ({ tokens, start }: { tokens: string[]; start: number }) => {
  let next = start
  let value: number | null = null

  if (tokens[next] === 'x') {
    value = numberOf(tokens[next + 1])
    next += 2
  } else if (WORDS[tokens[next] ?? ''] !== undefined) {
    value = WORDS[tokens[next] ?? ''] ?? null
    next += 1
  } else {
    value = numberOf(tokens[next])
    if (value === null) return null
    next += 1
    const fraction = numberOf(tokens[next])
    if (fraction !== null && FRACTION_TOKEN.test(tokens[next] ?? '')) {
      value += fraction
      next += 1
    }
  }

  if (value === null) return null

  for (; next < tokens.length; next += 1) {
    const token = tokens[next] ?? ''
    if (token === 'dozen') value *= 12
    else if (!['of', 'a', 'an', 'x'].includes(token)) break
  }

  return { value, next }
}

const readQuantity = ({
  tokens,
  start,
}: {
  tokens: string[]
  start: number
}): { amount: number | null; unit: Unit | null; next: number } | null => {
  const amount = readAmount({ tokens, start })
  let next = amount ? amount.next : start
  const word = singular(tokens[next] ?? '')
  let unit = UNIT_OF.get(word) ?? null
  let value = amount?.value ?? null

  if (unit) {
    // `bowl of cereal` needs no count, but `salad bowl` is not an amount.
    const bare =
      SIZES.has(unit) || (isAmountWord(unit) && tokens[next + 1] === 'of')
    if (!amount && !bare) return null
    next += 1
  } else if (amount && PACKAGES.has(word)) {
    value = null
    next += 1
  } else if (!amount) return null

  if (tokens[next] === 'of') next += 1

  return { amount: value, unit, next }
}

const splitGlued = (token: string) =>
  token
    .replace(/^(\d+(?:\.\d+)?)(g|kg|ml|l|oz|lbs?|x)$/, '$1 $2')
    .replace(/^x(\d+)$/, 'x $1')
    .replace(GLUED_FRACTION, '$1 $2')
    .split(' ')

const tokenize = (text: string) => foodTokens(text).flatMap(splitGlued)

const leadSplit = (tokens: string[]): QuantitySplit | null => {
  const lead = readQuantity({ tokens, start: 0 })
  if (!lead) return null
  const { next, ...quantity } = lead
  return { ...quantity, name: tokens.slice(next).join(' ') }
}

export const leadQuantity = (text: string) => leadSplit(tokenize(text))

export const quantitySplits = (text: string): QuantitySplit[] => {
  const tokens = tokenize(text)
  const splits: QuantitySplit[] = []

  const lead = leadSplit(tokens)
  if (lead) splits.push(lead)

  for (let i = Math.max(1, tokens.length - 3); i < tokens.length; i += 1) {
    const tail = readQuantity({ tokens, start: i })
    if (tail && tail.next === tokens.length) {
      const { next, ...quantity } = tail
      splits.push({ ...quantity, name: tokens.slice(0, i).join(' ') })
      break
    }
  }

  return splits.filter((split) => split.name !== '')
}
