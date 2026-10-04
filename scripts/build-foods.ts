import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type {
  FoodClass,
  FoodEntry,
  FoodPortions,
  FoodServing,
  PortionKey,
} from '../src/food'
import {
  CURATED_FOODS,
  CURATED_GENERICS,
  type CuratedFood,
  type CuratedGeneric,
} from './foods-curated'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const CACHE = join(ROOT, '.cache', 'fdc')
const OUT = join(ROOT, 'src', 'food', 'foods.json')
const BUDGET_BYTES = 200 * 1024

const ML_PER_CUP = 236.6
const ML_PER_FL_OZ = 29.5735

const NUTRIENT = {
  kcal: '1008',
  atwaterSpecific: '2048',
  atwaterGeneral: '2047',
  protein: '1003',
  fat: '1004',
  carbs: '1005',
} as const

type Row = Record<string, string>

const parseCsv = (text: string): Row[] => {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (c !== '\r') field += c
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  const header = rows.shift() ?? []
  return rows
    .filter((r) => r.length > 1)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])))
}

const datasetDir = (prefix: string): string => {
  const parent = join(CACHE, prefix)
  const dirs = readdirSync(parent).filter((d) =>
    d.startsWith('FoodData_Central'),
  )
  const dir = dirs.sort().at(-1)
  if (!dir) throw new Error(`No FoodData Central folder under ${parent}`)
  return join(parent, dir)
}

const loadCsv = (dir: string, name: string): Row[] =>
  parseCsv(readFileSync(join(dir, `${name}.csv`), 'utf8'))

type RawPortion = {
  seq: number
  amount: number
  text: string
  grams: number
}

type RawFood = {
  description: string
  nutrients: Map<string, number>
  portions: RawPortion[]
}

const loadDataset = (
  prefix: string,
  wanted: ReadonlySet<string>,
): Map<string, RawFood> => {
  const dir = datasetDir(prefix)
  const units = new Map(
    loadCsv(dir, 'measure_unit').map((u) => [u['id'], u['name'] ?? '']),
  )
  const foods = new Map<string, RawFood>()
  for (const f of loadCsv(dir, 'food')) {
    const id = f['fdc_id'] ?? ''
    if (!wanted.has(id)) continue
    foods.set(id, {
      description: f['description'] ?? '',
      nutrients: new Map(),
      portions: [],
    })
  }
  for (const n of loadCsv(dir, 'food_nutrient')) {
    const food = foods.get(n['fdc_id'] ?? '')
    if (!food) continue
    const amount = Number(n['amount'])
    if (Number.isFinite(amount))
      food.nutrients.set(n['nutrient_id'] ?? '', amount)
  }
  for (const p of loadCsv(dir, 'food_portion')) {
    const food = foods.get(p['fdc_id'] ?? '')
    if (!food) continue
    const unit = units.get(p['measure_unit_id'] ?? '') ?? ''
    const unitText = unit === 'undetermined' ? '' : unit
    food.portions.push({
      seq: Number(p['seq_num'] || 0),
      amount: Number(p['amount']),
      text: `${unitText} ${p['portion_description']} ${p['modifier']}`,
      grams: Number(p['gram_weight']),
    })
  }
  return foods
}

// Measures that never describe one edible piece.
const SKIP_FIRST_WORDS = new Set([
  'oz',
  'lb',
  'lbs',
  'g',
  'gram',
  'grams',
  'fl',
  'ml',
  'milliliter',
  'liter',
  'pint',
  'quart',
  'gallon',
  'package',
  'pkg',
  'can',
  'container',
  'bag',
  'box',
  'bottle',
  'carton',
  'jar',
  'packet',
  'serving',
  'nlea',
  'recipe',
  'bunch',
  'pound',
  'cubic',
  'yield',
  'yields',
  'drink',
  'order',
  'pie',
  'cake',
  'loaf',
  'unit',
  'bird',
  'back',
  'skin',
  'roast',
  'tablet',
  'dash',
  'pat',
  'stick',
  'extra',
  'jumbo',
  'miniature',
  'mini',
  'individual',
  'envelope',
  'portion',
  'scoop',
  'strip',
  'strips',
  'wedge',
  'half',
  'halves',
  'head',
  'leaf',
  'block',
  'pack',
])
const SKIP_ANY_WORDS = new Set([
  'box',
  'package',
  'container',
  'jar',
  'bottle',
  'bag',
  'can',
  'mini',
  'miniature',
  'miniatures',
])
const SIZE_NOUN_STOP = new Set(['leaf', 'wedge', 'strip', 'slice', 'box'])

const isSize = (w: string): w is 'small' | 'medium' | 'large' =>
  w === 'small' || w === 'medium' || w === 'large'

const portionKey = (
  rawText: string,
): { key: PortionKey; exact: boolean } | null => {
  const text = rawText
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[,;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const words = text.split(' ')
  const first = words[0] ?? ''
  if (first === '') return null
  if (words.some((w) => SKIP_ANY_WORDS.has(w))) return null
  if (first === 'fl' && words[1] === 'oz') return { key: 'ml', exact: true }
  if (/^cups?$/.test(first)) return { key: 'cup', exact: words.length === 1 }
  if (/^(tbsp|tablespoons?)$/.test(first))
    return { key: 'tbsp', exact: words.length === 1 }
  if (/^(tsp|teaspoons?)$/.test(first))
    return { key: 'tsp', exact: words.length === 1 }
  if (/^slices?$/.test(first))
    return { key: 'slice', exact: words.length === 1 }
  if (/^cloves?$/.test(first))
    return { key: 'clove', exact: words.length === 1 }
  if (/^pieces?$/.test(first))
    return { key: 'piece', exact: words.length === 1 }
  if (isSize(first)) return { key: first, exact: words.length === 1 }
  const second = words[1] ?? ''
  if (
    isSize(second) &&
    !SIZE_NOUN_STOP.has(first) &&
    !SKIP_FIRST_WORDS.has(first)
  )
    return { key: second, exact: false }
  if (SKIP_FIRST_WORDS.has(first)) return null
  return { key: 'piece', exact: false }
}

const round = (n: number, digits: number): number => {
  const f = 10 ** digits
  return Math.round(n * f) / f
}

const usdaPortions = (raw: RawFood): FoodPortions => {
  const picked = new Map<PortionKey, { exact: boolean; grams: number }>()
  const sorted = [...raw.portions].sort((a, b) => a.seq - b.seq)
  for (const p of sorted) {
    if (!(p.amount > 0) || !(p.grams > 0)) continue
    const match = portionKey(p.text)
    if (!match) continue
    const perUnit = p.grams / p.amount
    const grams = match.key === 'ml' ? perUnit / ML_PER_FL_OZ : perUnit
    const current = picked.get(match.key)
    if (!current || (match.exact && !current.exact))
      picked.set(match.key, { exact: match.exact, grams })
  }
  const out: FoodPortions = {}
  for (const [key, { grams }] of picked) out[key] = grams
  return out
}

const withLiquidDensity = (portions: FoodPortions): FoodPortions => {
  const out = { ...portions }
  if (out.ml === undefined && out.cup !== undefined)
    out.ml = out.cup / ML_PER_CUP
  if (out.ml !== undefined && out.cup === undefined)
    out.cup = out.ml * ML_PER_CUP
  return out
}

const roundPortions = (portions: FoodPortions): FoodPortions => {
  const out: FoodPortions = {}
  for (const [key, grams] of Object.entries(portions) as [
    PortionKey,
    number,
  ][]) {
    out[key] = round(grams, key === 'ml' ? 3 : grams < 10 ? 2 : 1)
  }
  return out
}

const AUTO_SERVING_ORDER: readonly PortionKey[] = [
  'medium',
  'slice',
  'piece',
  'large',
  'small',
]
const VOLUMETRIC: readonly PortionKey[] = ['cup', 'tbsp', 'tsp']

const pickServing = (
  food: CuratedFood,
  portions: FoodPortions,
): { label: string; grams: number } => {
  const label = (key: PortionKey): string => food.servingLabel ?? key
  if (food.serving) {
    const grams = portions[food.serving]
    if (grams === undefined)
      throw new Error(`${food.name}: serving '${food.serving}' has no portion`)
    return { label: label(food.serving), grams }
  }
  for (const key of AUTO_SERVING_ORDER) {
    const grams = portions[key]
    if (grams !== undefined) return { label: label(key), grams }
  }
  const volumetric = VOLUMETRIC.filter((k) => portions[k] !== undefined)
  if (volumetric.length === 1) {
    const key = volumetric[0] as PortionKey
    return { label: label(key), grams: portions[key] as number }
  }
  if (volumetric.length > 1)
    throw new Error(`${food.name}: ambiguous serving, add a serving hint`)
  return { label: '100g', grams: 100 }
}

const energy = (nutrients: Map<string, number>): number => {
  const kcal =
    nutrients.get(NUTRIENT.kcal) ??
    nutrients.get(NUTRIENT.atwaterSpecific) ??
    nutrients.get(NUTRIENT.atwaterGeneral)
  if (kcal === undefined) throw new Error('no energy value')
  return kcal
}

const slug = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

// FDA reference servings: a cup of almonds is not what anyone eats.
const CLASS_SERVING: Partial<Record<FoodClass, FoodServing>> = {
  nuts: { label: 'serving', grams: 30 },
  seeds: { label: 'serving', grams: 30 },
  'dried fruit': { label: 'serving', grams: 40 },
}

const buildEntry = ({
  food,
  raw,
  memberClass,
}: {
  food: CuratedFood
  raw: RawFood
  memberClass: FoodClass | undefined
}): FoodEntry => {
  const foodClass = food.class ?? memberClass
  const nutrient = (id: string): number => {
    const value = raw.nutrients.get(id)
    if (value === undefined)
      throw new Error(`${food.name}: missing nutrient ${id}`)
    return value
  }
  let portions: FoodPortions =
    food.usdaPortions === false ? {} : usdaPortions(raw)
  portions = { ...portions, ...food.portions }
  if (food.liquid) portions = withLiquidDensity(portions)
  else delete portions.ml
  portions = roundPortions(portions)
  const serving =
    (food.serving ? undefined : foodClass && CLASS_SERVING[foodClass]) ??
    pickServing(food, portions)
  return {
    id: slug(food.name),
    name: food.name,
    aliases: food.aliases ?? [],
    kcal: round(energy(raw.nutrients), 1),
    carbs: round(nutrient(NUTRIENT.carbs), 1),
    fat: round(nutrient(NUTRIENT.fat), 1),
    protein: round(nutrient(NUTRIENT.protein), 1),
    portions,
    serving: { label: serving.label, grams: round(serving.grams, 1) },
    ...(foodClass ? { class: foodClass } : {}),
  }
}

type Macro = 'kcal' | 'carbs' | 'fat' | 'protein'

const buildGeneric = ({
  generic,
  byId,
}: {
  generic: CuratedGeneric
  byId: Map<string, FoodEntry>
}): FoodEntry => {
  const id = slug(generic.name)
  if (byId.has(id))
    throw new Error(`${generic.name}: id '${id}' already exists`)
  if (generic.members.length < 2)
    throw new Error(`${generic.name}: a generic needs at least 2 members`)
  const members = generic.members.map((memberId) => {
    const member = byId.get(memberId)
    if (!member)
      throw new Error(`${generic.name}: unknown member '${memberId}'`)
    return member
  })
  const mean = (key: Macro): number =>
    round(members.reduce((sum, m) => sum + m[key], 0) / members.length, 1)
  if (generic.class) {
    for (const member of members) {
      if (member.class && member.class !== generic.class)
        throw new Error(
          `${generic.name}: member '${member.id}' is already class '${member.class}'`,
        )
      member.class = generic.class
    }
  }
  return {
    id,
    name: generic.name,
    aliases: generic.aliases ?? [],
    kcal: mean('kcal'),
    carbs: mean('carbs'),
    fat: mean('fat'),
    protein: mean('protein'),
    portions: roundPortions(generic.portions ?? {}),
    serving: generic.serving,
    ...(generic.class ? { class: generic.class } : {}),
  }
}

const main = (): void => {
  const wanted = new Set(CURATED_FOODS.map((f) => String(f.fdc)))
  const foods = new Map<string, RawFood>()
  for (const prefix of ['sr_legacy', 'foundation']) {
    for (const [id, raw] of loadDataset(prefix, wanted)) foods.set(id, raw)
  }

  const errors: string[] = []
  const entries: FoodEntry[] = []
  const classOf = new Map(
    CURATED_GENERICS.flatMap((g) =>
      g.class ? g.members.map((id) => [id, g.class] as const) : [],
    ),
  )
  for (const food of CURATED_FOODS) {
    const raw = foods.get(String(food.fdc))
    if (!raw) {
      errors.push(
        `${food.name}: FDC id ${food.fdc} not found in the cached CSVs`,
      )
      continue
    }
    try {
      const memberClass = classOf.get(slug(food.name))
      entries.push(buildEntry({ food, raw, memberClass }))
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e))
    }
  }
  const byId = new Map(entries.map((e) => [e.id, e]))
  for (const generic of CURATED_GENERICS) {
    try {
      const entry = buildGeneric({ generic, byId })
      entries.push(entry)
      byId.set(entry.id, entry)
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e))
    }
  }
  if (errors.length > 0) {
    console.error(errors.join('\n'))
    process.exit(1)
  }

  entries.sort((a, b) => a.id.localeCompare(b.id))
  const json = JSON.stringify(entries)
  writeFileSync(OUT, `${json}\n`)
  const bytes = Buffer.byteLength(json, 'utf8')
  console.log(
    `${entries.length} foods, ${(bytes / 1024).toFixed(1)} KB -> ${OUT}`,
  )
  if (bytes > BUDGET_BYTES) {
    console.error(`foods.json exceeds the ${BUDGET_BYTES / 1024} KB budget`)
    process.exit(1)
  }
}

main()
