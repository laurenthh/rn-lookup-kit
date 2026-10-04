import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { EXERCISES } from '../src/exercise/exercises'
import {
  EXERCISE_KINDS,
  EXERCISE_MUSCLES,
  type ExerciseEntry,
} from '../src/exercise/types'

const byName = (name: string): ExerciseEntry => {
  const entry = EXERCISES.find((e) => e.name === name)
  if (!entry) throw new Error(`no exercise named ${name}`)
  return entry
}

const KINDS = new Set<string>(EXERCISE_KINDS)
const MUSCLES = new Set<string>(EXERCISE_MUSCLES)

describe('exercises dataset', () => {
  it('has 150 to 250 entries', () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(150)
    expect(EXERCISES.length).toBeLessThanOrEqual(250)
  })

  it('stays within the 64 KB budget', () => {
    const file = join(__dirname, '..', 'src', 'exercise', 'exercises.json')
    const bytes = Buffer.byteLength(readFileSync(file, 'utf8'), 'utf8')
    expect(bytes).toBeLessThanOrEqual(64 * 1024)
  })

  it('has lowercase, trimmed names and aliases', () => {
    for (const e of EXERCISES) {
      for (const text of [e.name, ...e.aliases]) {
        expect(text).toBe(text.trim().toLowerCase())
        expect(text.length).toBeGreaterThan(0)
      }
    }
  })

  it('has unique ids, and no name or alias collides with another entry', () => {
    const ids = new Set<string>()
    const terms = new Map<string, string>()
    for (const e of EXERCISES) {
      expect(ids.has(e.id)).toBe(false)
      ids.add(e.id)
      for (const text of [e.name, ...e.aliases]) {
        const owner = terms.get(text)
        expect(owner === undefined ? undefined : `${text} -> ${owner}`).toBe(
          undefined,
        )
        terms.set(text, e.id)
      }
    }
  })

  it('has a valid kind and known muscles, primary first without repeats', () => {
    for (const e of EXERCISES) {
      expect(KINDS.has(e.kind)).toBe(true)
      expect(e.primary.length).toBeGreaterThanOrEqual(1)
      const all = [...e.primary, ...e.secondary]
      expect(new Set(all).size).toBe(all.length)
      for (const m of all) expect(MUSCLES.has(m)).toBe(true)
    }
  })

  it('has photo paths shaped like <dir>/0.jpg or <dir>/1.jpg, or null', () => {
    for (const e of EXERCISES) {
      if (e.photo === null) continue
      expect(e.photo).toMatch(/^[A-Za-z0-9_-]+\/[01]\.jpg$/)
    }
  })

  it('classifies known exercises', () => {
    const bench = byName('bench press')
    expect(bench.kind).toBe('strength')
    expect(bench.primary).toEqual(['chest'])
    expect(bench.photo).toBe('Barbell_Bench_Press_-_Medium_Grip/0.jpg')

    const plank = byName('plank')
    expect(plank.kind).toBe('hold')
    expect(plank.primary).toEqual(['abdominals'])

    expect(byName('hamstring stretch').kind).toBe('hold')
    expect(byName('jogging').kind).toBe('cardio')
    expect(byName('push-up').aliases).toContain('pushup')

    const wallSit = byName('wall sit')
    expect(wallSit.kind).toBe('hold')
    expect(wallSit.primary).toEqual(['quadriceps'])
    expect(wallSit.photo).toBeNull()
  })
})
