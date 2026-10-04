import type { FoodClass, FoodEntry, PortionKey } from './types'
import type { FoodHit } from './format'
import { formatNutrition } from './format'
import { matchFood, wholeFood } from './match'
import type { AmountWord, QuantitySplit, Unit } from './quantity'
import { isAmountWord, leadQuantity, quantitySplits, SIZES } from './quantity'
import type { Lookup } from '../core/types'

export const FOOD_OWNS = /^~\d+ kcal\b/

const WEIGHT: Partial<Record<Unit, number>> = {
  g: 1,
  kg: 1000,
  oz: 28.35,
  lb: 453.6,
}

const VOLUME_ML: Partial<Record<Unit, number>> = {
  cup: 236.6,
  tbsp: 14.8,
  tsp: 4.93,
}

// Dense snacks pack 30 g a handful, fruit 80 g; airy foods cap at a cup.
const HANDFUL: Record<FoodClass, number> = {
  nuts: 30,
  seeds: 30,
  'dried fruit': 30,
  fruit: 80,
}

// Only a drink-sized serving takes a glass (a glass of oil is not 250 ml).
const GLASSFUL = new Set(['cup', 'can', 'bottle'])

// A bowl of almonds is a snack bowl, not 1.5 cups.
const SNACKS = new Set<FoodClass>(['nuts', 'seeds', 'dried fruit'])

// A scoop needs a scoop serving, a bowl a cup serving, a shot stays a shot.
const amountGrams = ({
  entry,
  unit,
}: {
  entry: FoodEntry
  unit: AmountWord
}) => {
  const { label, grams } = entry.serving
  if (label === unit) return grams
  const { cup, ml } = entry.portions
  switch (unit) {
    case 'handful':
      return entry.class ? HANDFUL[entry.class] : Math.min(40, cup ?? 40)
    case 'scoop':
      return null
    case 'bowl':
      return label === 'cup' && !(entry.class && SNACKS.has(entry.class))
        ? grams * 1.5
        : null
    case 'glass':
      if (label === 'shot') return grams
      return GLASSFUL.has(label) && ml !== undefined ? ml * 250 : null
    default:
      return unit satisfies never
  }
}

const isPortionKey = (unit: Unit): unit is PortionKey =>
  WEIGHT[unit] === undefined && unit !== 'l' && !isAmountWord(unit)

const unitGrams = ({ entry, unit }: { entry: FoodEntry; unit: Unit }) => {
  const weight = WEIGHT[unit]
  if (weight !== undefined) return weight
  if (isAmountWord(unit)) return amountGrams({ entry, unit })

  const { ml, cup, tbsp } = entry.portions
  if (unit === 'l') return ml === undefined ? null : ml * 1000

  const portion = isPortionKey(unit) ? entry.portions[unit] : undefined
  if (portion !== undefined) return portion

  const volume = VOLUME_ML[unit]
  if (volume === undefined) return null
  if (ml !== undefined) return volume * ml
  if (cup !== undefined) return (volume / 236.6) * cup
  if (tbsp !== undefined) return (volume / 14.8) * tbsp
  return null
}

const servingHit = (entry: FoodEntry): FoodHit => ({
  entry,
  grams: entry.serving.grams,
  per: entry.serving.label,
})

const UNIT_LABELS = new Set([
  'cup',
  'tbsp',
  'tsp',
  'slice',
  'clove',
  'ml',
  'glass',
  'square',
  'serving',
  '100g',
])

// Bare count: medium, else piece, else a countable serving.
const countHit = ({ entry, amount }: { entry: FoodEntry; amount: number }) => {
  const each =
    entry.portions.medium ??
    entry.portions.piece ??
    (UNIT_LABELS.has(entry.serving.label) ? null : entry.serving.grams)
  return each === null
    ? servingHit(entry)
    : { entry, grams: amount * each, per: null }
}

const gramsFor = ({
  entry,
  split: { amount, unit },
}: {
  entry: FoodEntry
  split: QuantitySplit
}): FoodHit | null => {
  if (unit === null) {
    return amount === null ? servingHit(entry) : countHit({ entry, amount })
  }

  const perUnit = unitGrams({ entry, unit })
  if (perUnit === null) {
    return SIZES.has(unit) && amount !== null
      ? countHit({ entry, amount })
      : null
  }

  return amount === null
    ? { entry, grams: perUnit, per: unit }
    : { entry, grams: amount * perUnit, per: null }
}

const resolveOne = (text: string): FoodHit | null => {
  const whole = wholeFood(text)
  if (whole) return servingHit(whole)

  for (const split of quantitySplits(text)) {
    const entry = matchFood(split.name)
    if (entry) return gramsFor({ entry, split })
  }
  return null
}

const SEPARATOR = /\s*(?:,|&|\+|\band\b)\s*/i

// A weight or volume measures one part; anything else carries to all.
const carries = (unit: Unit | null) =>
  unit === null || (WEIGHT[unit] === undefined && unit !== 'ml' && unit !== 'l')

// Only a line that fails whole is split, and then every part must match.
const resolveCombo = (text: string): FoodHit[] | null => {
  const parts = text.split(SEPARATOR).filter(Boolean)
  if (parts.length < 2 || parts.length > 3) return null

  const first = leadQuantity(parts[0] ?? '')
  const lead = first && carries(first.unit) ? first : null
  const hits = parts.map((part, i) => {
    if (i === 0 || !lead || quantitySplits(part).length > 0)
      return resolveOne(part)
    const entry = matchFood(part)
    return entry && gramsFor({ entry, split: { ...lead, name: part } })
  })
  return hits.every((hit): hit is FoodHit => hit !== null) ? hits : null
}

export const resolveFood = (text: string): FoodHit[] | null => {
  const one = resolveOne(text)
  return one ? [one] : resolveCombo(text)
}

export const isFood = (text: string) => resolveFood(text) !== null

export const foodLookup: Lookup = {
  id: 'food',
  tags: ['food'],
  label: () => 'Look up nutrition',
  applies: () => true,
  owns: FOOD_OWNS,
  run: async (item) => {
    const hits = resolveFood(item.text)
    return hits
      ? { noteLine: { text: formatNutrition(hits), owns: FOOD_OWNS } }
      : 'no-match'
  },
}
