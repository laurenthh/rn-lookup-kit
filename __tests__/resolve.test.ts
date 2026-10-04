import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

import { createResolver, PACE_GAP } from '../src/core'
import { linkPatch, worstFailure } from '../src/core/resolve'
import { resolveFirstResult, startPacing } from './helpers/registry'

const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', 'ddg', name), 'utf8')

const page = (target: string) =>
  `<html><head><meta http-equiv='refresh' content='0; url=/l/?uddg=${encodeURIComponent(target)}&rut=abc'></head></html>`

const respond = (body: string, status = 200) =>
  vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(body, { status }))

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('resolveFirstResult', () => {
  it('fetches the first-result page for the query', async () => {
    const fetchMock = respond(fixture('redirect.html'))

    await resolveFirstResult('site:booking.com W Osaka hotel')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://duckduckgo.com/?q=%5Csite%3Abooking.com%20W%20Osaka%20hotel',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('decodes the target from a saved redirect page', async () => {
    respond(fixture('redirect.html'))

    await expect(resolveFirstResult('x')).resolves.toEqual({
      url: 'https://www.booking.com/hotel/jp/w-osaka.html',
    })
  })

  it('returns whatever DuckDuckGo picked, even for gibberish', async () => {
    respond(fixture('no-result.html'))

    await expect(resolveFirstResult('x')).resolves.toEqual({
      url: 'https://www.youtube.com/watch?v=1sgfODcZm6s',
    })
  })

  it('trims whitespace around the target', async () => {
    respond(page('https://www.booking.com/hotel/jp/w-osaka.html\n\t'))

    await expect(resolveFirstResult('x')).resolves.toEqual({
      url: 'https://www.booking.com/hotel/jp/w-osaka.html',
    })
  })

  it.each([
    [
      'a target over 2048 characters',
      page(`https://example.com/${'a'.repeat(2048)}`),
    ],
    ['an http target', page('http://example.com/hotel')],
    ['a javascript target', page('javascript:alert(1)')],
    ['a malformed https target', page('https://exa mple.com')],
    ['a page without a target', '<html><body>Results</body></html>'],
    ['a badly encoded target', page('x').replace('uddg=x', 'uddg=%E0%A4%A')],
  ])('finds no target for %s', async (_case, body) => {
    respond(body)

    await expect(resolveFirstResult('x')).resolves.toEqual({
      url: null,
      reason: 'no-target',
    })
  })

  // A 202 is the bot check; other statuses say nothing about the item.
  it.each([202, 404, 500])('is blocked by a %i response', async (status) => {
    respond(fixture('redirect.html'), status)

    await expect(resolveFirstResult('x')).resolves.toEqual({
      url: null,
      reason: 'blocked',
    })
  })

  it('finds no target when the request was redirected away from DuckDuckGo', async () => {
    const response = new Response(fixture('redirect.html'))
    Object.defineProperty(response, 'url', {
      value: 'https://captive.example/login',
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response)

    await expect(resolveFirstResult('x')).resolves.toEqual({
      url: null,
      reason: 'no-target',
    })
  })

  it('accepts a response still on DuckDuckGo', async () => {
    const response = new Response(fixture('redirect.html'))
    Object.defineProperty(response, 'url', {
      value: 'https://duckduckgo.com/?q=%5Cx',
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response)

    await expect(resolveFirstResult('x')).resolves.toEqual({
      url: 'https://www.booking.com/hotel/jp/w-osaka.html',
    })
  })

  it('reports offline when the request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'))

    await expect(resolveFirstResult('x')).resolves.toEqual({
      url: null,
      reason: 'offline',
    })
  })

  it('gives up after 5 seconds', async () => {
    vi.useFakeTimers()
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('aborted')),
          )
        }),
    )

    const result = resolveFirstResult('x')
    vi.advanceTimersByTime(5_000)

    await expect(result).resolves.toEqual({ url: null, reason: 'timeout' })
  })
})

describe('worstFailure and linkPatch', () => {
  it('ranks blocked over offline over timeout, and ignores no-target', () => {
    expect(worstFailure('timeout', 'blocked', 'offline')).toBe('blocked')
    expect(worstFailure('timeout', 'offline')).toBe('offline')
    expect(worstFailure(undefined, 'timeout')).toBe('timeout')
    expect(worstFailure('no-target', null)).toBeNull()
  })

  it('adds the failure only to a fallback link', () => {
    expect(linkPatch('https://a.example', 'no-target')).toEqual({
      link: 'https://a.example',
    })
    expect(linkPatch('https://a.example', 'no-target', 'timeout')).toEqual({
      link: 'https://a.example',
      failure: 'timeout',
    })
  })
})

describe('pacing', () => {
  const started: number[] = []
  const fetchAfter = (latency: number) =>
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      started.push(Date.now())
      return new Promise((resolve) =>
        setTimeout(
          () => resolve(new Response(fixture('redirect.html'))),
          latency,
        ),
      )
    })

  beforeEach(() => {
    started.length = 0
    vi.useFakeTimers()
  })

  let release = () => {}

  afterEach(() => release())

  it('runs one request at a time, PACE_GAP after the previous one ended', async () => {
    fetchAfter(600)
    release = startPacing()

    const results = Promise.all(['a', 'b', 'c'].map(resolveFirstResult))
    await vi.advanceTimersByTimeAsync(30_000)
    await results

    const [first = 0, second = 0, third = 0] = started
    expect(started).toHaveLength(3)
    expect(second - first).toBeGreaterThanOrEqual(600 + PACE_GAP)
    expect(third - second).toBeGreaterThanOrEqual(600 + PACE_GAP)
  })

  it('stays on until every pacer has released', async () => {
    fetchAfter(600)
    const first = startPacing()
    release = startPacing()
    first()
    first()

    const results = Promise.all(['a', 'b'].map(resolveFirstResult))
    await vi.advanceTimersByTimeAsync(30_000)
    await results

    const [a = 0, b = 0] = started
    expect(b - a).toBeGreaterThanOrEqual(600 + PACE_GAP)
  })

  it('leaves requests unpaced when off', async () => {
    fetchAfter(600)

    const results = Promise.all(['a', 'b'].map(resolveFirstResult))
    await vi.advanceTimersByTimeAsync(1_000)
    await results

    expect(started).toHaveLength(2)
    expect(started[1]).toBe(started[0])
  })
})

describe('createResolver', () => {
  it('serves identical reads in flight with one request', async () => {
    const send = vi.fn(async () => new Response(fixture('redirect.html')))
    const { resolveFirstResult: read } = createResolver({ fetch: send })

    const [first, second] = await Promise.all([read('x'), read('x')])
    await read('x')

    expect(second).toBe(first)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('reads through an injected fetch, not the global one', async () => {
    const globalFetch = vi.spyOn(globalThis, 'fetch')
    const send = vi.fn(async () => new Response(fixture('redirect.html')))
    const resolver = createResolver({ fetch: send })

    await expect(resolver.resolveFirstResult('x')).resolves.toEqual({
      url: 'https://www.booking.com/hotel/jp/w-osaka.html',
    })
    expect(send).toHaveBeenCalledTimes(1)
    expect(globalFetch).not.toHaveBeenCalled()
  })

  it('paces only its own reads', async () => {
    vi.useFakeTimers()
    const send = vi.fn(async () => new Response(fixture('redirect.html')))
    const paced = createResolver({ fetch: send })
    const other = createResolver({ fetch: send })
    const release = paced.startPacing()

    const results = Promise.all([
      paced.resolveFirstResult('a'),
      paced.resolveFirstResult('b'),
      other.resolveFirstResult('c'),
    ])
    await vi.advanceTimersByTimeAsync(0)
    expect(send).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(PACE_GAP)
    await results
    release()

    expect(send).toHaveBeenCalledTimes(3)
  })

  it('measures the gap on its injected clock', async () => {
    vi.useFakeTimers()
    const send = vi.fn(async () => new Response(fixture('redirect.html')))
    // The first read is asked and ends at 0; the second is asked at PACE_GAP.
    const ticks = [0, 0, PACE_GAP]
    const resolver = createResolver({
      fetch: send,
      now: () => ticks.shift() ?? PACE_GAP,
    })
    const release = resolver.startPacing()

    const results = Promise.all(['a', 'b'].map(resolver.resolveFirstResult))
    await vi.advanceTimersByTimeAsync(0)
    expect(send).toHaveBeenCalledTimes(2)
    await results
    release()
  })
})
