import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applicableLookups,
  createResolver,
  lookupLabel,
  runLookups,
} from '../src/core'
import { createDiningLookup } from '../src/dining'
import { exerciseLookup } from '../src/exercise'
import { foodLookup } from '../src/food'
import { createTravelLookup } from '../src/travel'
import {
  activeLookups,
  diningLookup,
  LOOKUPS,
  travelLookup,
} from './helpers/registry'
import type { Lookup } from '../src/core'
import { buildItem } from './helpers/items'

const stub = ({
  id,
  applies,
  run,
}: {
  id: Lookup['id']
  applies?: Lookup['applies']
  run: Lookup['run']
}): Lookup => ({
  id,
  tags: [id],
  label: () => 'x',
  applies: applies ?? (() => true),
  run,
})

describe('activeLookups', () => {
  it('matches list tags to lookup tags case-insensitively and exactly', () => {
    expect(activeLookups(['Travel'])).toEqual([travelLookup])
    expect(activeLookups(['TRAVEL'])).toEqual([travelLookup])
    expect(activeLookups(['travelling'])).toEqual([])
    expect(activeLookups(['Food'])).toEqual([foodLookup])
    expect(activeLookups(['food', 'travel'])).toEqual([
      travelLookup,
      foodLookup,
    ])
    expect(activeLookups(['Gym'])).toEqual([exerciseLookup])
    expect(activeLookups(['stretching', 'fitness'])).toEqual([exerciseLookup])
    expect(activeLookups([])).toEqual([])
  })

  it('runs dining for its tags, never for food', () => {
    for (const tag of ['Restaurants', 'dining', 'eat', 'cafes', 'bars']) {
      expect(activeLookups([tag])).toEqual([diningLookup])
    }
    expect(activeLookups(['food'])).toEqual([foodLookup])
    expect(activeLookups(['food', 'dining'])).toEqual([
      foodLookup,
      diningLookup,
    ])
  })
})

describe('applicableLookups', () => {
  it('returns none for a checked item even if a lookup applies', () => {
    const item = buildItem({ checked: true, link: null })
    expect(applicableLookups({ lookups: LOOKUPS, item })).toEqual([])
  })

  it("filters by each lookup's applies", () => {
    const item = buildItem({ link: 'https://booking.example' })
    expect(applicableLookups({ lookups: LOOKUPS, item })).toEqual([
      foodLookup,
      exerciseLookup,
    ])
  })
})

describe('lookupLabel', () => {
  it("uses the single applicable lookup's own label", () => {
    const item = buildItem({ text: 'Eiffel Tower' })
    expect(lookupLabel({ lookups: [travelLookup], item })).toBe('Find on map')
  })

  it('names the dining lookup alone, and both with food', () => {
    const book = buildItem({ text: 'Book Carbone for 2, Sat' })
    const venue = buildItem({ text: 'Banana bread from Tartine' })
    expect(lookupLabel({ lookups: [diningLookup], item: book })).toBe(
      'Book a table',
    )
    expect(lookupLabel({ lookups: [diningLookup], item: venue })).toBe(
      'Find on map',
    )
    expect(
      lookupLabel({ lookups: [foodLookup, diningLookup], item: venue }),
    ).toBe('Look up details')
  })

  it('falls back to "Look up details" when several lookups apply', () => {
    const item = buildItem({ text: '1 apple' })
    expect(lookupLabel({ lookups: LOOKUPS, item })).toBe('Look up details')
  })

  it('names the food lookup when a link rules travel out', () => {
    const item = buildItem({
      text: 'Eiffel Tower',
      link: 'https://shop.example',
    })
    const lookups = [travelLookup, foodLookup]
    expect(lookupLabel({ lookups, item })).toBe('Look up nutrition')
  })

  it('uses the applicable lookups it is given', () => {
    const item = buildItem({ text: 'Eiffel Tower' })
    expect(lookupLabel({ lookups: LOOKUPS, item, applicable: [] })).toBe(
      'Look up details',
    )
    expect(
      lookupLabel({ lookups: LOOKUPS, item, applicable: [travelLookup] }),
    ).toBe('Find on map')
  })

  it('falls back to "Look up details" when none apply', () => {
    const item = buildItem({ checked: true })
    expect(lookupLabel({ lookups: LOOKUPS, item })).toBe('Look up details')
  })
})

describe('runLookups', () => {
  const noteLine = { text: '~1 kcal', owns: /^~\d+ kcal\b/ }

  it('merges the patches from every matching lookup', async () => {
    const lookups = [
      stub({ id: 'food', run: async () => ({ noteLine }) }),
      stub({
        id: 'travel',
        run: async () => ({ link: 'https://maps.example' }),
      }),
    ]

    const result = await runLookups({
      lookups,
      item: buildItem({}),
    })

    expect(result).toEqual({ noteLine, link: 'https://maps.example' })
  })

  it('returns no-match only when every lookup misses', async () => {
    const missing = [
      stub({ id: 'food', run: async () => 'no-match' }),
      stub({ id: 'travel', run: async () => 'no-match' }),
    ]
    const oneHit = [
      stub({ id: 'food', run: async () => 'no-match' }),
      stub({
        id: 'travel',
        run: async () => ({ link: 'https://maps.example' }),
      }),
    ]

    await expect(
      runLookups({ lookups: missing, item: buildItem({}) }),
    ).resolves.toBe('no-match')

    await expect(
      runLookups({ lookups: oneHit, item: buildItem({}) }),
    ).resolves.toEqual({ link: 'https://maps.example' })
  })

  it('keeps the worst network failure of any hit', async () => {
    const lookups = [
      stub({
        id: 'travel',
        run: async () => ({ link: 'https://a.example', failure: 'timeout' }),
      }),
      stub({
        id: 'dining',
        run: async () => ({ link: 'https://b.example' }),
      }),
    ]

    await expect(runLookups({ lookups, item: buildItem({}) })).resolves.toEqual(
      { link: 'https://b.example', failure: 'timeout' },
    )
  })

  it('skips lookups that do not apply, so their hits never mask a miss', async () => {
    const missingFood = stub({
      id: 'food',
      run: () => Promise.resolve('no-match'),
    })
    const item = buildItem({ link: 'https://example.com/tickets' })

    expect(
      await runLookups({ lookups: [missingFood, travelLookup], item }),
    ).toBe('no-match')
  })
})

describe('a list tagged travel and dining', () => {
  const DDG = 'https://duckduckgo.com/?q=%5C'
  const HOTELS: Record<string, string> = {
    'Hilton Osaka': 'https://www.booking.com/hotel/jp/hilton-osaka.html',
    'Park Hyatt Tokyo':
      'https://www.booking.com/hotel/jp/park-hyatt-tokyo.html',
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // The Gardener's probe: dining's OpenTable page used to replace the hotel.
  it.each(['Book Hilton Osaka Sat', 'Book Park Hyatt Tokyo 2 nights'])(
    'keeps the hotel for %s',
    async (text) => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const query = decodeURIComponent(String(input).slice(DDG.length))
        const hotel = Object.entries(HOTELS).find(([name]) =>
          query.startsWith(`site:booking.com ${name}`),
        )?.[1]
        const target = query.startsWith('site:opentable.com')
          ? 'https://www.opentable.com/r/hilton-osaka-restaurant'
          : hotel
        if (target === undefined) {
          throw new TypeError('offline')
        }
        return new Response(`<a href='/l/?uddg=${encodeURIComponent(target)}'>`)
      })
      const item = buildItem({ text })
      expect(diningLookup.applies(item)).toBe(false)
      const travelOnly = await runLookups({ lookups: [travelLookup], item })
      const both = await runLookups({
        lookups: [travelLookup, diningLookup],
        item,
      })
      expect(travelOnly).toEqual(both)
      expect(both).toEqual({
        link: expect.stringContaining('https://www.booking.com/hotel/jp/'),
      })
    },
  )
})

describe('one booking tap in a list tagged travel and dining', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('searches once, not once per lookup', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new TypeError('offline')
    })
    const item = buildItem({ text: 'Book table at Narisawa' })
    await expect(
      runLookups({ lookups: [travelLookup, diningLookup], item }),
    ).resolves.toEqual({
      link: 'https://www.google.com/maps/search/?api=1&query=Narisawa',
      failure: 'offline',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('searches once when dining gets a wrapped resolver', async () => {
    const send = vi.fn(async () => {
      throw new TypeError('offline')
    })
    const resolver = createResolver({ fetch: send })
    const wrapped = {
      ...resolver,
      resolveFirstResult: (query: string) => resolver.resolveFirstResult(query),
    }
    const lookups = [
      createTravelLookup({ resolver, isGrocery: () => false }),
      createDiningLookup({ resolver: wrapped }),
    ]
    const item = buildItem({ text: 'Book table at Narisawa' })

    await expect(runLookups({ lookups, item })).resolves.toEqual({
      link: 'https://www.google.com/maps/search/?api=1&query=Narisawa',
      failure: 'offline',
    })
    expect(send).toHaveBeenCalledTimes(2)
  })
})
