export { isLookupLink, linkHref, lookupLinkKind, parseLink } from './link'
export { applyLookupPatch, lineOwner, mergeNoteLine } from './note'
export {
  applicableLookups,
  lookupLabel,
  lookupsForTags,
  runLookups,
} from './registry'
export {
  createResolver,
  PACE_GAP,
  type ResolveFirstResult,
  type Resolver,
} from './resolve'
export type {
  Lookup,
  LookupInput,
  LookupPatch,
  LookupResult,
  NoteLine,
  Resolution,
  ResolveFailure,
  ResolveReason,
} from './types'
