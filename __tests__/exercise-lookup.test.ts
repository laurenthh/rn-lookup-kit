import { describe, expect, it } from 'vitest'
import { exerciseLookup } from '../src/exercise'
import { EXERCISES } from '../src/exercise/exercises'
import { exerciseKey, matchExercise } from '../src/exercise/match'
import { buildItem } from './helpers/items'

const run = (text: string) => exerciseLookup.run(buildItem({ text }))

const PHOTOS =
  'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/'

describe('exerciseLookup', () => {
  it('writes the muscles and the plan, with the start photo', async () => {
    const result = await run('Chest press 3x12')

    expect(result).toEqual({
      noteLine: {
        text: 'Targets chest, shoulders, triceps · 3 × 12',
        owns: /^Targets\b/,
      },
      image: `${PHOTOS}Leverage_Chest_Press/0.jpg`,
    })
  })

  it('caps the muscles at four, primary first', async () => {
    const result = await run('Deadlift')

    expect(result).toMatchObject({
      noteLine: {
        text: 'Targets lower back, calves, forearms, glutes · 3 × 10',
      },
    })
  })

  it('omits the plan for cardio without a target', async () => {
    const result = await run('Jogging')

    expect(result).toMatchObject({
      noteLine: { text: 'Targets quadriceps, glutes, hamstrings' },
    })
  })

  it('has no photo for a hand-written exercise', async () => {
    const result = await run('Wall sit')

    expect(result).toEqual({
      noteLine: {
        text: 'Targets quadriceps, glutes, calves · 3 × 30 s',
        owns: /^Targets\b/,
      },
    })
  })

  it('misses unknown lines', async () => {
    await expect(run('gym bag')).resolves.toBe('no-match')
    await expect(run('')).resolves.toBe('no-match')
  })

  it('owns only its own line', async () => {
    const result = await run('Plank')
    const owns =
      result === 'no-match' ? undefined : (result.noteLine?.owns as RegExp)

    expect(owns?.test('Targets abdominals · 3 × 30 s')).toBe(true)
    expect(owns?.test('My targets for today')).toBe(false)
  })
})

describe('matchExercise', () => {
  it('has no exact key shared by two exercises', () => {
    const owners = new Map<string, string>()
    for (const entry of EXERCISES) {
      for (const term of [entry.name, ...entry.aliases]) {
        const owner = owners.get(exerciseKey(term)) ?? entry.id
        expect(`${term}: ${owner}`).toBe(`${term}: ${entry.id}`)
        owners.set(exerciseKey(term), entry.id)
      }
    }
  })

  it('treats a reordered key shared by two exercises as ambiguous', () => {
    expect(matchExercise('arms overhead stretch')?.id).toBe('overhead-stretch')
    expect(matchExercise('overhead arm stretch')?.id).toBe('triceps-stretch')
    expect(matchExercise('stretch overhead arms')).toBeNull()
  })

  it('never matches a subset of the words', () => {
    expect(matchExercise('banded bench press')).toBeNull()
    expect(matchExercise('press')).toBeNull()
  })

  it('drops a bare effort word only when the rest is an exercise', () => {
    expect(matchExercise('heavy bench press')?.id).toBe('bench-press')
    expect(matchExercise('light run')?.id).toBe('jogging')
    expect(matchExercise('arm circles warm up')?.id).toBe('arm-circles')
    expect(matchExercise('light bulbs')).toBeNull()
    expect(matchExercise('warm up')).toBeNull()
  })
})
