// What a lookup reads from an item; a checklist item satisfies it.
export type LookupInput = {
  text: string
  tags: readonly string[]
  link: string | null
  checked?: boolean
}

// A failure that says nothing about the item: the network or DuckDuckGo.
export type ResolveFailure = 'blocked' | 'offline' | 'timeout'

export type ResolveReason = ResolveFailure | 'no-target'

export type Resolution =
  { url: string; reason?: never } | { url: null; reason: ResolveReason }

// A predicate is for an owner that a regex alone can't express — e.g. the
// airport note line, which also checks both sides against the airport
// table (21c stage 2).
export type NoteLine = {
  text: string
  owns: RegExp | ((line: string) => boolean)
}

// `image` is a photo URL, downloaded only for an item without a photo.
// `failure`: the link is a fallback because the network failed.
export type LookupPatch = {
  noteLine?: NoteLine
  link?: string
  image?: string
  failure?: ResolveFailure
}

export type LookupResult = LookupPatch | 'no-match'

export type Lookup = {
  id: string
  tags: string[]
  label: (item: LookupInput) => string
  applies: (item: LookupInput) => boolean
  // The note line this lookup writes, when it writes one.
  owns?: NoteLine['owns']
  run: (item: LookupInput, now?: Date) => Promise<LookupResult>
}
