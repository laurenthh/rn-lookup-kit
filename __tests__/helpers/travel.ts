import type { LookupInput } from '../../src/core'
import { isFood } from '../../src/food'
import { travelIntent as intentOf } from '../../src/travel'

// As the app wires it: the food matcher tells grocery lines apart.
export const travelIntent = (item: Pick<LookupInput, 'text' | 'tags'>) =>
  intentOf(item, { isGrocery: isFood })
