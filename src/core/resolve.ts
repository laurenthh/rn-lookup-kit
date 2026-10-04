import type {
  LookupPatch,
  Resolution,
  ResolveFailure,
  ResolveReason,
} from './types'
import { parseLink, WEBSITE_LOOKUP_PREFIX } from './link'
import { createQueue } from './queue'

const RESOLVE_TIMEOUT = 5_000
const MAX_TARGET_LENGTH = 2048
const DDG_ORIGIN = 'https://duckduckgo.com/'
const TARGET = /[?&]uddg=([^&'"\s]+)/
export const PACE_GAP = 1_500

const SEVERITY: ResolveFailure[] = ['blocked', 'offline', 'timeout']

export const worstFailure = (
  ...reasons: (ResolveReason | null | undefined)[]
): ResolveFailure | null =>
  SEVERITY.find((failure) => reasons.includes(failure)) ?? null

// A resolved or fallback link; a fallback says why the network failed.
export const linkPatch = (
  link: string,
  ...reasons: (ResolveReason | null | undefined)[]
): LookupPatch => {
  const failure = worstFailure(...reasons)
  return failure === null ? { link } : { link, failure }
}

export type ResolveFirstResult = (query: string) => Promise<Resolution>

export type Resolver = {
  // The target of DuckDuckGo's "first result" page, or why there is none.
  resolveFirstResult: ResolveFirstResult
  // Until released (look up all), reads run one at a time, PACE_GAP apart.
  startPacing: () => () => void
}

const noTarget: Resolution = { url: null, reason: 'no-target' }

const request = async ({
  query,
  send,
}: {
  query: string
  send: typeof fetch
}): Promise<Resolution> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT)
  try {
    const response = await send(
      `${WEBSITE_LOOKUP_PREFIX}${encodeURIComponent(query)}`,
      { signal: controller.signal },
    )
    // A 202 is DuckDuckGo's bot check.
    if (response.status !== 200) return { url: null, reason: 'blocked' }
    if (response.url && !response.url.startsWith(DDG_ORIGIN)) return noTarget

    const encoded = TARGET.exec(await response.text())?.[1]
    if (encoded === undefined) return noTarget

    const target = decodeURIComponent(encoded).trim()
    if (target.length > MAX_TARGET_LENGTH) return noTarget
    const link = /^https:\/\//i.test(target) ? parseLink(target).link : null
    return link === null ? noTarget : { url: link }
  } catch (error) {
    if (controller.signal.aborted) return { url: null, reason: 'timeout' }
    return error instanceof URIError
      ? noTarget
      : { url: null, reason: 'offline' }
  } finally {
    clearTimeout(timer)
  }
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

// One per app: the pacing gate must see every DuckDuckGo read. `fetch` is
// looked up per call, so a later polyfill or test spy is still used.
export const createResolver = ({
  fetch: send,
  now = () => Date.now(),
}: {
  fetch?: typeof fetch
  now?: () => number
} = {}): Resolver => {
  let pacers = 0
  let lastDone = -Infinity
  const gate = createQueue()

  // Travel and dining on one tap ask the same query: one read serves both.
  const inFlight = new Map<string, Promise<Resolution>>()

  const timed = async (query: string) => {
    try {
      return await request({ query, send: send ?? globalThis.fetch })
    } finally {
      lastDone = now()
    }
  }

  const read = (query: string) =>
    pacers > 0
      ? gate(async () => {
          const wait = lastDone + PACE_GAP - now()
          if (wait > 0) await sleep(wait)
          return timed(query)
        })
      : timed(query)

  return {
    resolveFirstResult: (query) => {
      const pending = inFlight.get(query)
      if (pending !== undefined) {
        return pending
      }
      const resolution = read(query).finally(() => inFlight.delete(query))
      inFlight.set(query, resolution)
      return resolution
    },
    startPacing: () => {
      pacers += 1
      let released = false
      return () => {
        if (!released) {
          released = true
          pacers -= 1
        }
      }
    },
  }
}
