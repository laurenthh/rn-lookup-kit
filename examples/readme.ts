import {
  applyLookupPatch,
  createResolver,
  lookupsForTags,
  runLookups,
  type Lookup,
  type LookupInput,
} from 'rn-lookup-kit'
import { createDiningLookup } from 'rn-lookup-kit/dining'
import { exerciseLookup } from 'rn-lookup-kit/exercise'
import { foodLookup, isFood } from 'rn-lookup-kit/food'
import { createTravelLookup } from 'rn-lookup-kit/travel'

// One resolver per app: its pacing gate must see every DuckDuckGo read.
export const resolver = createResolver()

const LOOKUPS: Lookup[] = [
  // isGrocery is required: "2 bananas" on a travel list is shopping, not a
  // Maps search. Without food data, pass `() => false` on purpose.
  createTravelLookup({ resolver, isGrocery: isFood }),
  foodLookup,
  exerciseLookup,
  createDiningLookup({ resolver }), // after travel: its link wins
]

// Your list item: what a lookup reads, plus the note it may extend.
type Item = LookupInput & { note: string | null }

// Lookups are keyed by the *list's* tags (travel, food, gym, restaurants…).
export const lookUp = async (item: Item, listTags: string[]) => {
  const lookups = lookupsForTags({ lookups: LOOKUPS, listTags })
  const result = await runLookups({ lookups, item })
  if (result === 'no-match') return null
  // Write note/link (and download result.image) the app's own way.
  return applyLookupPatch({ item, patch: result })
}
