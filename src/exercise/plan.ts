import type { ExerciseKind } from './types'

export type DistanceUnit = 'km' | 'mi' | 'm'

export type CardioTarget =
  | { type: 'distance'; value: number; unit: DistanceUnit }
  | { type: 'time'; seconds: number }

export type Plan =
  | { kind: 'strength'; sets: number; reps: number }
  | { kind: 'hold'; sets: number; seconds: number }
  | { kind: 'cardio'; target: CardioTarget | null }

// What the item text says; `count` is a number without a unit.
export type PlanSpec = {
  sets?: number
  reps?: number
  count?: number
  seconds?: number
  distance?: { value: number; unit: DistanceUnit }
}

const UNIT_SECONDS = { s: 1, min: 60, h: 3600 }

type UnitTag = 'reps' | keyof typeof UNIT_SECONDS | DistanceUnit | 'weight'

const UNIT_WORDS: Record<UnitTag, string[]> = {
  reps: ['rep', 'reps'],
  s: ['s', 'sec', 'secs', 'second', 'seconds'],
  min: ['min', 'mins', 'minute', 'minutes'],
  h: ['h', 'hr', 'hrs', 'hour', 'hours'],
  km: ['k', 'km', 'kms', 'kilometer', 'kilometers', 'kilometre', 'kilometres'],
  mi: ['mi', 'mile', 'miles'],
  m: ['m', 'meter', 'meters', 'metre', 'metres'],
  weight: ['kg', 'kgs', 'lb', 'lbs', 'pound', 'pounds'],
}

const words = (...tags: UnitTag[]) =>
  tags.flatMap((tag) => UNIT_WORDS[tag]).join('|')

const UNIT_TAGS = new Map(
  Object.entries(UNIT_WORDS).flatMap(([tag, words]) =>
    words.map((word) => [word, tag as UnitTag] as const),
  ),
)

const isDistanceUnit = (unit: string): unit is DistanceUnit =>
  unit === 'km' || unit === 'mi' || unit === 'm'

const UNIT_ALT = [...UNIT_TAGS.keys()].join('|')
const UNIT = String.raw`(?<unit>${UNIT_ALT})(?![a-z])`

// A range like 8-12 keeps its upper bound.
const VALUE = String.raw`(?:\d+\s*[-–]\s*)?(?<value>\d+(?:[.,]\d+)?)`

// Machine settings; a word counts only with its value, so bare "incline" stays.
const SETTING_WORDS =
  'lvl|level|lv|resistance|res|incline|inc|speed|spd|zone|rpe|cadence|gear|grade|setting|pace|power|effort|intensity'
const SETTING_UNITS =
  'km/h|kmh|kph|mph|bpm|rpm|spm|watts?|w|rpe|deg|degrees?|°|%'
const SETTING_VALUE = String.raw`\d+(?::\d\d)?(?:[.,]\d+)?`
const DURATION_WORDS = words('s', 'min', 'h')
// Not before a plan unit: "incline 2 min" keeps its minutes.
const NOT_PLAN = String.raw`(?!\s*(?:${UNIT_ALT})(?![a-z]))`

const SETTINGS = [
  // hr 140 first: a heart rate is 60–220, so "1 hr 30" stays a duration.
  String.raw`\bhr\s*(?:[6-9]\d|1\d\d|2[01]\d|220)(?:\s*bpm)?(?![\d.a-z])${NOT_PLAN}`,
  String.raw`\b(?:${SETTING_WORDS})\s*${SETTING_VALUE}\s*(?:${SETTING_UNITS})?(?![a-z])${NOT_PLAN}`,
  // 140 bpm, 200w, 12 km/h, 5%
  String.raw`(?<![a-z\d.])${SETTING_VALUE}\s*(?:${SETTING_UNITS})(?![a-z])`,
  // 5:30/km, 2:00 /500m
  String.raw`\d+:\d\d\s*(?:min)?\s*/\s*(?:km|mi|mile|\d*m)(?![a-z])`,
  // @ 60kg, @ 80%, @8
  String.raw`@\s*(?:${SETTING_VALUE}\s*(?:${words('weight')})?(?![a-z]))?`,
  String.raw`\btempo\s*\d(?:\s*-\s*\d)+(?![\d.])`,
  // rest 90s, 2 min rest
  String.raw`\brest\s*\d+\s*(?:${DURATION_WORDS})?(?![a-z])`,
  String.raw`(?<![\d.])\d+\s*(?:${DURATION_WORDS})\s+rest\b`,
  // " - felt strong" (spaces on both sides, so t-bar row survives)
  String.raw`\s[-–—]\s+(?=[a-z]).*$`,
].map((source) => new RegExp(source, 'g'))

const PARENS = /\([^)]*\)/g

export const stripSettings = (text: string) =>
  SETTINGS.reduce((rest, pattern) => rest.replace(pattern, ' '), text)

const PATTERNS = [
  // 3x12, 3 × 45s, 3 sets of 12 reps
  String.raw`(?<![\d.])(?<sets>\d+)\s*(?:sets?\s*(?:of|x|×)?|[x×*])\s*${VALUE}\s*(?:${UNIT})?`,
  String.raw`(?<![\d.])(?<sets>\d+)\s*sets?(?![a-z])`,
  // 3 x max, 3 x amrap: sets only
  String.raw`(?<![\d.])(?<sets>\d+)\s*[x×*]\s*(?:max|amrap|failure)(?![a-z])`,
  // x12
  String.raw`(?<![a-z\d])[x×*]\s*${VALUE}\s*(?:${UNIT})?`,
  // 1 hr 30, 1 h 30 min
  String.raw`(?<![\d.])(?<value>\d+)\s*(?<unit>${words('h')})\s*(?<minutes>[0-5]?\d)(?:\s*(?:${words('min')}))?(?![\d.a-z])${NOT_PLAN}`,
  // 12 reps, 45s, 5 km, 100 kg
  String.raw`(?<![\d.])${VALUE}\s*${UNIT}`,
].map((source) => new RegExp(source))

// Only when nothing else matched: "20 push ups", "swim 40 laps".
const BARE_COUNT = /(?<!\S)(?<value>\d+)(?!\S)/

const addAmount = ({
  spec,
  value,
  unit,
}: {
  spec: PlanSpec
  value: number
  unit: string | undefined
}) => {
  const tag = unit === undefined ? undefined : UNIT_TAGS.get(unit)
  if (tag === undefined) {
    spec.count ??= value
  } else if (tag === 'reps') {
    spec.reps ??= value
  } else if (isDistanceUnit(tag)) {
    spec.distance ??= { value, unit: tag }
  } else if (tag !== 'weight') {
    const seconds = Math.round(value * UNIT_SECONDS[tag])
    if (seconds > 0) spec.seconds ??= seconds
  }
}

// Pulls settings and the plan numbers out; the rest is the name.
export const parsePlan = (text: string): { name: string; spec: PlanSpec } => {
  const spec: PlanSpec = {}
  let name = stripSettings(text.toLowerCase())
  const take = (pattern: RegExp) => {
    for (let match = pattern.exec(name); match; match = pattern.exec(name)) {
      const { sets = '', value = '', unit, minutes = '0' } = match.groups ?? {}
      if (Number(sets) > 0) spec.sets ??= Number(sets)
      // "1 hr 30": the minutes ride along as a fraction of the hour.
      const amount = Number(value.replace(',', '.')) + Number(minutes) / 60
      if (amount > 0) addAmount({ spec, value: amount, unit })
      name = `${name.slice(0, match.index)} ${name.slice(match.index + match[0].length)}`
    }
  }

  PATTERNS.forEach(take)
  name = name.replace(PARENS, ' ')
  if (Object.keys(spec).length === 0) take(BARE_COUNT)
  return { name: name.replace(/\s+/g, ' ').trim(), spec }
}

const STOPWATCH: Plan = { kind: 'cardio', target: null }

// Numbers without sets mean one set; a line without numbers gets 3.
export const resolvePlan = ({
  kind,
  spec,
}: {
  kind: ExerciseKind
  spec: PlanSpec
}): Plan => {
  const { reps, count, seconds, distance } = spec
  // "Plank 60s x 5": with a duration, the loose number is the sets.
  const sets =
    spec.sets ??
    (seconds ? count : undefined) ??
    (Object.keys(spec).length > 0 ? 1 : 3)

  // Distances only fit a single cardio target; "4 x 20m" has no honest plan.
  if (distance) {
    const plain = kind === 'cardio' && spec.sets === undefined && !count
    const likelyMinutes = distance.unit === 'm' && distance.value < 100
    return plain && !likelyMinutes
      ? { kind: 'cardio', target: { type: 'distance', ...distance } }
      : STOPWATCH
  }
  if (seconds) {
    return kind === 'cardio' && spec.sets === undefined && !count
      ? { kind: 'cardio', target: { type: 'time', seconds } }
      : { kind: 'hold', sets, seconds }
  }
  if (reps) return { kind: 'strength', sets, reps }
  if (kind === 'strength') return { kind, sets, reps: count ?? 10 }
  // A loose number is seconds only after sets: "3x30", not "2 planks".
  if (kind === 'hold') {
    return spec.sets
      ? { kind, sets, seconds: count ?? 30 }
      : { kind, sets: 3, seconds: 30 }
  }
  return STOPWATCH
}

const formatNumber = (value: number) => String(Math.round(value * 100) / 100)

const formatDuration = (seconds: number) =>
  seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} s`

export const formatPlan = (plan: Plan) => {
  if (plan.kind === 'strength') return `${plan.sets} × ${plan.reps}`
  if (plan.kind === 'hold') {
    return `${plan.sets} × ${formatDuration(plan.seconds)}`
  }
  const { target } = plan
  if (target === null) return null
  return target.type === 'distance'
    ? `${formatNumber(target.value)} ${target.unit}`
    : formatDuration(target.seconds)
}

export const PLAN_OWNS = /^Targets\b/

const POSITIVE = String.raw`0*[1-9]\d*`
const DECIMAL = String.raw`(?:${POSITIVE}(?:\.\d+)?|0?\.\d*[1-9]\d*)`
const TIMES = String.raw`\s*[x×]\s*`
const DURATION = String.raw`(?<value>${POSITIVE})\s*(?<unit>${words('s', 'min')})`
const PLAN_FORMS = [
  String.raw`(?<sets>${POSITIVE})${TIMES}(?<reps>${POSITIVE})(?:\s*reps?)?`,
  String.raw`(?<sets>${POSITIVE})${TIMES}${DURATION}`,
  String.raw`(?<distance>${DECIMAL})\s*(?<unit>${words('km', 'mi', 'm')})`,
  DURATION,
].map((source) => new RegExp(`^${source}$`))

// The plan after the last ·; null → use exerciseFor(item.text).
export const parsePlanLine = (note: string | null): Plan | null => {
  const line = note?.split('\n').find((text) => PLAN_OWNS.test(text))
  const [, ...parts] = line?.split(/\s*·\s*/) ?? []
  const text = parts.at(-1)?.trim().toLowerCase() ?? ''

  for (const form of PLAN_FORMS) {
    const groups = form.exec(text)?.groups
    if (groups === undefined) continue

    const { sets, reps, value, unit = '', distance } = groups
    const tag = UNIT_TAGS.get(unit)
    if (sets && reps) {
      return { kind: 'strength', sets: Number(sets), reps: Number(reps) }
    }
    if (distance && tag && isDistanceUnit(tag)) {
      return {
        kind: 'cardio',
        target: { type: 'distance', value: Number(distance), unit: tag },
      }
    }
    const seconds = Number(value) * (tag === 'min' ? 60 : 1)
    return sets
      ? { kind: 'hold', sets: Number(sets), seconds }
      : { kind: 'cardio', target: { type: 'time', seconds } }
  }
  return null
}
