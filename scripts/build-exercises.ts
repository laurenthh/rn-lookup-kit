import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  EXERCISE_MUSCLES,
  type ExerciseEntry,
  type ExerciseKind,
  type ExerciseMuscle,
} from '../src/exercise'
import { CURATED_EXERCISES, type CuratedExercise } from './exercises-curated'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SOURCE = join(ROOT, '.cache', 'free-exercise-db.json')
const SOURCE_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/dist/exercises.json'
const OUT = join(ROOT, 'src', 'exercise', 'exercises.json')
// 64 KB: the v1.0.0 table is 58.4 KiB, so a curated batch still fits.
const BUDGET_BYTES = 64 * 1024

const KIND_BY_CATEGORY: Record<string, ExerciseKind> = {
  strength: 'strength',
  powerlifting: 'strength',
  'olympic weightlifting': 'strength',
  strongman: 'strength',
  plyometrics: 'strength',
  stretching: 'hold',
  cardio: 'cardio',
}

type SourceExercise = {
  id: string
  category: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  images: string[]
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === 'string')

const isSourceExercise = (value: unknown): value is SourceExercise => {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['id'] === 'string' &&
    typeof v['category'] === 'string' &&
    isStringArray(v['primaryMuscles']) &&
    isStringArray(v['secondaryMuscles']) &&
    isStringArray(v['images'])
  )
}

const loadSource = async (): Promise<Map<string, SourceExercise>> => {
  if (!existsSync(SOURCE)) {
    console.log(`Downloading ${SOURCE_URL}`)
    const res = await fetch(SOURCE_URL)
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`)
    mkdirSync(join(ROOT, '.cache'), { recursive: true })
    writeFileSync(SOURCE, await res.text())
  }
  const raw: unknown = JSON.parse(readFileSync(SOURCE, 'utf8'))
  if (!Array.isArray(raw)) throw new Error('Source is not an array')
  const out = new Map<string, SourceExercise>()
  for (const item of raw) {
    if (!isSourceExercise(item)) throw new Error('Malformed source exercise')
    out.set(item.id, item)
  }
  return out
}

const MUSCLES = new Set<string>(EXERCISE_MUSCLES)

const isMuscle = (value: string): value is ExerciseMuscle => MUSCLES.has(value)

const normalizeMuscles = (args: {
  name: string
  primary: readonly string[]
  secondary: readonly string[]
}): { primary: ExerciseMuscle[]; secondary: ExerciseMuscle[] } => {
  const { name, primary, secondary } = args
  const clean = (list: readonly string[]): ExerciseMuscle[] => {
    const seen = new Set<ExerciseMuscle>()
    for (const raw of list) {
      const m = raw.trim().toLowerCase()
      if (!isMuscle(m)) throw new Error(`${name}: unknown muscle '${raw}'`)
      seen.add(m)
    }
    return [...seen]
  }
  const p = clean(primary)
  const s = clean(secondary).filter((m) => !p.includes(m))
  if (p.length === 0) throw new Error(`${name}: no primary muscle`)
  return { primary: p, secondary: s }
}

const slug = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const buildEntry = (
  ex: CuratedExercise,
  source: Map<string, SourceExercise>,
): ExerciseEntry => {
  const base = { id: slug(ex.name), name: ex.name, aliases: ex.aliases ?? [] }
  if (!('source' in ex)) {
    const muscles = normalizeMuscles({
      name: ex.name,
      primary: ex.primary,
      secondary: ex.secondary ?? [],
    })
    return { ...base, kind: ex.kind, ...muscles, photo: null }
  }
  const raw = source.get(ex.source)
  if (!raw) throw new Error(`${ex.name}: unknown source id '${ex.source}'`)
  const kind = ex.kind ?? KIND_BY_CATEGORY[raw.category]
  if (!kind) throw new Error(`${ex.name}: unknown category '${raw.category}'`)
  const muscles = normalizeMuscles({
    name: ex.name,
    primary: raw.primaryMuscles,
    secondary: raw.secondaryMuscles,
  })
  // A hold shows the held position (last frame), a movement its start.
  const photo = (kind === 'hold' ? raw.images.at(-1) : raw.images[0]) ?? null
  if (photo !== null && !/\/[01]\.jpg$/.test(photo))
    throw new Error(`${ex.name}: unexpected photo path '${photo}'`)
  return { ...base, kind, ...muscles, photo }
}

const checkTerms = (entries: readonly ExerciseEntry[]): string[] => {
  const errors: string[] = []
  const owner = new Map<string, string>()
  for (const e of entries) {
    for (const term of [e.name, ...e.aliases]) {
      if (term !== term.trim().toLowerCase() || term === '')
        errors.push(`${e.name}: term '${term}' is not lowercase and trimmed`)
      const other = owner.get(term)
      if (other !== undefined)
        errors.push(`duplicate term '${term}' in ${other} and ${e.name}`)
      else owner.set(term, e.name)
    }
  }
  return errors
}

const main = async (): Promise<void> => {
  const source = await loadSource()
  const errors: string[] = []
  const entries: ExerciseEntry[] = []
  for (const ex of CURATED_EXERCISES) {
    try {
      entries.push(buildEntry(ex, source))
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e))
    }
  }
  errors.push(...checkTerms(entries))
  if (errors.length > 0) {
    console.error(errors.join('\n'))
    process.exit(1)
  }

  entries.sort((a, b) => a.id.localeCompare(b.id))
  const json = JSON.stringify(entries)
  writeFileSync(OUT, `${json}\n`)
  const bytes = Buffer.byteLength(json, 'utf8')
  console.log(
    `${entries.length} exercises, ${(bytes / 1024).toFixed(1)} KB -> ${OUT}`,
  )
  if (bytes > BUDGET_BYTES) {
    console.error(`exercises.json exceeds the ${BUDGET_BYTES / 1024} KB budget`)
    process.exit(1)
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
})
