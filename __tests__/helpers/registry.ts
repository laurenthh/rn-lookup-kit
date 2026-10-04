import { createResolver, lookupsForTags } from '../../src/core'
import type { Lookup } from '../../src/core'
import { createDiningLookup } from '../../src/dining'
import { exerciseLookup } from '../../src/exercise'
import { foodLookup, isFood } from '../../src/food'
import { createTravelLookup } from '../../src/travel'

// Wired the way checklist-copilot wires the kit: one resolver (its pacing
// gate covers every DuckDuckGo read), the food matcher tells grocery lines
// apart, and dining runs after travel so its link wins in a list with both.
export const resolver = createResolver()

export const { resolveFirstResult, startPacing } = resolver

export const travelLookup = createTravelLookup({
  resolver,
  isGrocery: isFood,
})

export const diningLookup = createDiningLookup({ resolver })

export const LOOKUPS: Lookup[] = [
  travelLookup,
  foodLookup,
  exerciseLookup,
  diningLookup,
]

export const activeLookups = (listTags: string[]) =>
  lookupsForTags({ lookups: LOOKUPS, listTags })
