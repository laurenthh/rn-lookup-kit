import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { FOODS } from '../src/food/foods'
import type { FoodEntry } from '../src/food/types'

import { CURATED_GENERICS } from '../scripts/foods-curated'

const byName = (name: string): FoodEntry => {
  const entry = FOODS.find((f) => f.name === name)
  if (!entry) throw new Error(`no food named ${name}`)
  return entry
}

const byId = (id: string): FoodEntry => {
  const entry = FOODS.find((f) => f.id === id)
  if (!entry) throw new Error(`no food with id ${id}`)
  return entry
}

// Energy from ethanol is not in the macros, so 4/4/9 undercounts these.
const ALCOHOL_IDS = new Set([
  'beer',
  'light-beer',
  'red-wine',
  'white-wine',
  'dessert-wine',
  'vodka',
  'whiskey',
  'rum',
  'gin',
  'coffee-liqueur',
  'vanilla-extract',
])

describe('foods dataset', () => {
  it('has 800 to 1200 entries', () => {
    expect(FOODS.length).toBeGreaterThanOrEqual(800)
    expect(FOODS.length).toBeLessThanOrEqual(1200)
  })

  it('stays within the 200 KB budget', () => {
    const file = join(__dirname, '..', 'src', 'food', 'foods.json')
    const bytes = Buffer.byteLength(readFileSync(file, 'utf8'), 'utf8')
    expect(bytes).toBeLessThanOrEqual(200 * 1024)
  })

  it('has non-negative macros and positive portion grams', () => {
    for (const f of FOODS) {
      expect(f.kcal).toBeGreaterThanOrEqual(0)
      expect(f.carbs).toBeGreaterThanOrEqual(0)
      expect(f.fat).toBeGreaterThanOrEqual(0)
      expect(f.protein).toBeGreaterThanOrEqual(0)
      for (const grams of Object.values(f.portions)) {
        expect(grams).toBeGreaterThan(0)
      }
      expect(f.serving.grams).toBeGreaterThan(0)
      expect(f.serving.label.length).toBeGreaterThan(0)
    }
  })

  it('has lowercase, trimmed names and aliases', () => {
    for (const f of FOODS) {
      for (const text of [f.name, ...f.aliases]) {
        expect(text).toBe(text.trim().toLowerCase())
        expect(text.length).toBeGreaterThan(0)
      }
    }
  })

  it('has unique ids, and no name or alias collides with another entry', () => {
    const ids = new Set<string>()
    const terms = new Map<string, string>()
    for (const f of FOODS) {
      expect(ids.has(f.id)).toBe(false)
      ids.add(f.id)
      for (const text of [f.name, ...f.aliases]) {
        const owner = terms.get(text)
        expect(owner === undefined ? undefined : `${text} -> ${owner}`).toBe(
          undefined,
        )
        terms.set(text, f.id)
      }
    }
  })

  it('has kcal roughly consistent with 4/4/9 macros', () => {
    for (const f of FOODS) {
      const estimate = 4 * f.carbs + 4 * f.protein + 9 * f.fat
      if (ALCOHOL_IDS.has(f.id)) {
        expect(f.kcal).toBeGreaterThanOrEqual(estimate - 5)
        expect(f.kcal).toBeLessThanOrEqual(900)
        continue
      }
      const pair = `${f.id}: ${f.kcal} kcal vs ${estimate.toFixed(0)}`
      expect(estimate <= 1.9 * f.kcal + 30 ? null : pair).toBeNull()
      expect(f.kcal <= 1.3 * estimate + 25 ? null : pair).toBeNull()
    }
  })

  it('matches known portions', () => {
    const apple = byName('apple')
    expect(apple.portions.medium).toBeCloseTo(182, 0)
    expect(apple.serving).toEqual({ label: 'medium', grams: 182 })
    expect((apple.kcal * 182) / 100).toBeCloseTo(95, -1)

    const egg = byName('egg')
    expect(egg.portions.large).toBe(50)
    expect(egg.serving).toEqual({ label: 'large', grams: 50 })

    const oil = byName('olive oil')
    expect(oil.portions.tbsp).toBe(13.5)
    expect(oil.serving).toEqual({ label: 'tbsp', grams: 13.5 })
    expect(oil.portions.ml).toBeCloseTo(0.913, 2)

    const whey = byName('whey protein')
    expect(whey.aliases).toEqual(
      expect.arrayContaining(['protein shake', 'protein drink', 'whey shake']),
    )
    expect(whey.serving).toEqual({ label: 'scoop', grams: 30 })
    expect(whey.portions.piece).toBe(30)
  })

  it('gives liquids a density and solids none', () => {
    expect(byName('milk').portions.ml).toBeCloseTo(1.03, 1)
    expect(byName('water').portions.ml).toBeCloseTo(1, 1)
    expect(byName('bread').portions.ml).toBeUndefined()
    expect(byName('butter').portions.ml).toBeUndefined()
  })
})

describe('generic foods', () => {
  const MACROS = ['kcal', 'carbs', 'fat', 'protein'] as const

  it('has 15 to 25 generics with at least 2 members each', () => {
    expect(CURATED_GENERICS.length).toBeGreaterThanOrEqual(15)
    expect(CURATED_GENERICS.length).toBeLessThanOrEqual(25)
    for (const generic of CURATED_GENERICS) {
      expect(generic.members.length).toBeGreaterThanOrEqual(2)
      expect(new Set(generic.members).size).toBe(generic.members.length)
    }
  })

  it('averages the macros of members that exist', () => {
    for (const generic of CURATED_GENERICS) {
      const entry = byName(generic.name)
      const members = generic.members.map(byId)
      expect(members.map((m) => m.id)).not.toContain(entry.id)
      for (const key of MACROS) {
        const mean =
          members.reduce((sum, m) => sum + m[key], 0) / members.length
        expect(entry[key]).toBe(Math.round(mean * 10) / 10)
      }
    }
  })

  it('carries the curated serving, aliases and class', () => {
    for (const generic of CURATED_GENERICS) {
      const entry = byName(generic.name)
      expect(entry.serving).toEqual(generic.serving)
      expect(entry.aliases).toEqual(generic.aliases ?? [])
      expect(entry.class).toBe(generic.class)
    }
  })

  it('passes its class and reference serving down to every member', () => {
    for (const generic of CURATED_GENERICS) {
      if (!generic.class) continue
      for (const id of generic.members) {
        const member = byId(id)
        expect(member.class).toBe(generic.class)
        if (generic.class !== 'fruit')
          expect(member.serving).toEqual({
            label: 'serving',
            grams: generic.class === 'dried fruit' ? 40 : 30,
          })
      }
    }
  })

  it('keeps the alias decisions: nuts is a generic, cheese stays cheddar', () => {
    expect(byName('mixed nuts').aliases).not.toContain('nuts')
    expect(byName('cheddar').aliases).toContain('cheese')
  })
})
