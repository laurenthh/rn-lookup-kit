import type { Lookup, LookupInput, LookupPatch, LookupResult } from './types'
import { worstFailure } from './resolve'

export const lookupsForTags = ({
  lookups,
  listTags,
}: {
  lookups: Lookup[]
  listTags: readonly string[]
}) => {
  const normalized = listTags.map((tag) => tag.toLocaleLowerCase())
  return lookups.filter((lookup) =>
    lookup.tags.some((tag) => normalized.includes(tag)),
  )
}

export const applicableLookups = ({
  lookups,
  item,
}: {
  lookups: Lookup[]
  item: LookupInput
}) => (item.checked ? [] : lookups.filter((lookup) => lookup.applies(item)))

// Pass `applicable` when already computed: travel classifies on each call.
export const lookupLabel = ({
  lookups,
  item,
  applicable = applicableLookups({ lookups, item }),
}: {
  lookups: Lookup[]
  item: LookupInput
  applicable?: Lookup[]
}) => {
  const only = applicable.length === 1 ? applicable[0] : undefined
  return only ? only.label(item) : 'Look up details'
}

export const runLookups = async ({
  lookups,
  item,
}: {
  lookups: Lookup[]
  item: LookupInput
}): Promise<LookupResult> => {
  const results = await Promise.all(
    applicableLookups({ lookups, item }).map((lookup) => lookup.run(item)),
  )
  const hits = results.filter(
    (result): result is LookupPatch => result !== 'no-match',
  )

  if (!hits.length) {
    return 'no-match'
  }
  const merged = hits.reduce<LookupPatch>(
    (all, hit) => ({ ...all, ...hit }),
    {},
  )
  // Worst, not last: a later hit's own failure must not mask an earlier one.
  const failure = worstFailure(...hits.map((hit) => hit.failure))
  return failure === null ? merged : { ...merged, failure }
}
