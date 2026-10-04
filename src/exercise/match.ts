import { EXERCISES } from './exercises'
import { foodTokens, singular } from '../core/normalize'
import type { ExerciseEntry } from './types'

// `singular` gives "calve" and "to", and skips short words like "ups".
const IRREGULAR: Record<string, string> = {
  calves: 'calf',
  toes: 'toe',
  abs: 'ab',
  ups: 'up',
}

export const exerciseKey = (text: string) =>
  foodTokens(text)
    .map((token) => IRREGULAR[token] ?? singular(token))
    .join(' ')

const FILLERS = /\b((each|per|both) (side|leg|arm|way)|the|some|my|a)\b/g

const stripFillers = (key: string) =>
  key.replace(FILLERS, ' ').split(/\s+/).filter(Boolean).join(' ')

// Effort words, dropped only once the whole key has missed ("light run" stays).
const EFFORT =
  /\b(easy|light|moderate|medium|steady|hard|heavy|fast|slow|quick|brisk|gentle|strict|max|intense|tempo|rest|all out|to failure|amrap|warm ?up|cool ?down)\b/g

const stripEffort = (key: string) =>
  key.replace(EFFORT, ' ').split(/\s+/).filter(Boolean).join(' ')

const anyOrder = (key: string) => key.split(' ').sort().join(' ')

// null marks a key two exercises share: ambiguous, so no match.
type Keys = Map<string, ExerciseEntry | null>

let index: { exact: Keys; sorted: Keys } | undefined

const claim = ({
  keys,
  key,
  entry,
}: {
  keys: Keys
  key: string
  entry: ExerciseEntry
}) => {
  const existing = keys.has(key) ? keys.get(key) : entry
  keys.set(key, existing === entry ? entry : null)
}

const buildIndex = () => {
  const exact: Keys = new Map()
  const sorted: Keys = new Map()
  for (const entry of EXERCISES) {
    for (const term of [entry.name, ...entry.aliases]) {
      const key = exerciseKey(term)
      claim({ keys: exact, key, entry })
      claim({ keys: sorted, key: anyOrder(key), entry })
    }
  }
  return { exact, sorted }
}

const lookup = (key: string) => {
  const { exact, sorted } = (index ??= buildIndex())
  const bare = stripFillers(key)
  return exact.get(key) ?? exact.get(bare) ?? sorted.get(anyOrder(bare)) ?? null
}

export const matchExercise = (name: string): ExerciseEntry | null => {
  const key = exerciseKey(name)
  const plain = stripEffort(key)
  return lookup(key) ?? (plain === key ? null : lookup(plain))
}
