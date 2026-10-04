export const EXERCISE_KINDS = ['strength', 'hold', 'cardio'] as const

export type ExerciseKind = (typeof EXERCISE_KINDS)[number]

export const EXERCISE_MUSCLES = [
  'abdominals',
  'abductors',
  'adductors',
  'biceps',
  'calves',
  'chest',
  'forearms',
  'glutes',
  'hamstrings',
  'lats',
  'lower back',
  'middle back',
  'neck',
  'quadriceps',
  'shoulders',
  'traps',
  'triceps',
] as const

export type ExerciseMuscle = (typeof EXERCISE_MUSCLES)[number]

export type ExerciseEntry = {
  id: string
  name: string
  aliases: readonly string[]
  kind: ExerciseKind
  primary: readonly ExerciseMuscle[]
  secondary: readonly ExerciseMuscle[]
  photo: string | null
}
