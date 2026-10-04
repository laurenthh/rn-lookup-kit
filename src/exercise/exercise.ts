import { matchExercise } from './match'
import { formatPlan, parsePlan, PLAN_OWNS, resolvePlan } from './plan'
import type { Lookup } from '../core/types'
import type { ExerciseEntry } from './types'

const PHOTO_BASE =
  'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/'

const MAX_MUSCLES = 4

// The exercise and its plan for an item text (16c reads a missing plan here).
export const exerciseFor = (text: string) => {
  const whole = matchExercise(text)
  const { name, spec } = whole ? { name: text, spec: {} } : parsePlan(text)
  const entry = whole ?? matchExercise(name)
  return entry && { entry, plan: resolvePlan({ kind: entry.kind, spec }) }
}

const musclesOf = (entry: ExerciseEntry) =>
  [...new Set([...entry.primary, ...entry.secondary])]
    .slice(0, MAX_MUSCLES)
    .join(', ')

export const exerciseLookup: Lookup = {
  id: 'exercise',
  tags: [
    'exercise',
    'exercises',
    'workout',
    'gym',
    'training',
    'fitness',
    'stretch',
    'stretches',
    'stretching',
  ],
  label: () => 'Look up exercise',
  applies: () => true,
  owns: PLAN_OWNS,
  run: async (item) => {
    const hit = exerciseFor(item.text)
    if (hit === null) return 'no-match'

    const plan = formatPlan(hit.plan)
    const muscles = `Targets ${musclesOf(hit.entry)}`
    return {
      noteLine: {
        text: plan === null ? muscles : `${muscles} · ${plan}`,
        owns: PLAN_OWNS,
      },
      ...(hit.entry.photo !== null && {
        image: `${PHOTO_BASE}${hit.entry.photo}`,
      }),
    }
  },
}
