import type { ExerciseEntry } from './types'

import exercises from './exercises.json'

// The JSON import widens kind and muscles to string; the data test checks them.
export const EXERCISES = exercises as readonly ExerciseEntry[]
