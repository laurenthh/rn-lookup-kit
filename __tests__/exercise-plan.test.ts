import { describe, expect, it } from 'vitest'
import type { Plan, PlanSpec } from '../src/exercise/plan'
import {
  formatPlan,
  parsePlan,
  parsePlanLine,
  resolvePlan,
} from '../src/exercise/plan'

describe('parsePlan', () => {
  it.each<[string, string, PlanSpec]>([
    ['Bench 3x12', 'bench', { sets: 3, count: 12 }],
    ['bench 3 x 12', 'bench', { sets: 3, count: 12 }],
    ['bench 3×12 reps', 'bench', { sets: 3, reps: 12 }],
    ['3X12 bench', 'bench', { sets: 3, count: 12 }],
    ['bench3x12', 'bench', { sets: 3, count: 12 }],
    ['curls 3x8-12', 'curls', { sets: 3, count: 12 }],
    ['rows 3 sets of 10', 'rows', { sets: 3, count: 10 }],
    ['rows 3 sets x 10 reps', 'rows', { sets: 3, reps: 10 }],
    ['rows 4 sets', 'rows', { sets: 4 }],
    ['squat 12 reps', 'squat', { reps: 12 }],
    ['burpees x20', 'burpees', { count: 20 }],
    ['20 push ups', 'push ups', { count: 20 }],
    ['swim 40 laps', 'swim laps', { count: 40 }],
    ['plank 3 x 45s', 'plank', { sets: 3, seconds: 45 }],
    ['plank 3×1 min', 'plank', { sets: 3, seconds: 60 }],
    ['plank 45 s', 'plank', { seconds: 45 }],
    ['plank60s', 'plank', { seconds: 60 }],
    ['wall sit 60 seconds', 'wall sit', { seconds: 60 }],
    ['plank 1.5 min', 'plank', { seconds: 90 }],
    ['walk 1 hour', 'walk', { seconds: 3600 }],
    ['run 20 min', 'run', { seconds: 1200 }],
    ['run 30 minutes', 'run', { seconds: 1800 }],
    ['jog 5 km', 'jog', { distance: { value: 5, unit: 'km' } }],
    ['jog 5k', 'jog', { distance: { value: 5, unit: 'km' } }],
    ['5km run', 'run', { distance: { value: 5, unit: 'km' } }],
    ['run 2,5 km', 'run', { distance: { value: 2.5, unit: 'km' } }],
    ['run 3 miles', 'run', { distance: { value: 3, unit: 'mi' } }],
    ['row 2000m', 'row', { distance: { value: 2000, unit: 'm' } }],
    ['squat 5x5 100kg', 'squat', { sets: 5, count: 5 }],
    ['deadlift 140 lbs', 'deadlift', {}],
    ['concept 2', 'concept', { count: 2 }],
    ['t2b', 't2b', {}],
    ['squat 0x0', 'squat', {}],
    ['10 high knees', 'high knees', { count: 10 }],
    ['2 med ball slams', 'med ball slams', { count: 2 }],
    // Settings are consumed, never read as plan numbers
    ['elliptical 10 min lvl 3', 'elliptical', { seconds: 600 }],
    ['incline walk 20 min incline 8', 'incline walk', { seconds: 1200 }],
    ['bike 45 min resistance 8 cadence 90', 'bike', { seconds: 2700 }],
    ['walk 1 hr hr 140', 'walk', { seconds: 3600 }],
    ['squat 3x5 hr 140', 'squat', { sets: 3, count: 5 }],
    ['run 1 hr 30', 'run', { seconds: 5400 }],
    ['run 1 hr 30 min hr 140', 'run', { seconds: 5400 }],
    ['squat 5x5 @ 80% rest 2 min', 'squat', { sets: 5, count: 5 }],
    ['run 5k @ 5:30/km', 'run', { distance: { value: 5, unit: 'km' } }],
    ['pull ups 3 x max', 'pull ups', { sets: 3 }],
    ['bench (5x5) - felt strong', 'bench', { sets: 5, count: 5 }],
    ['bench 3x8 (new pb!)', 'bench', { sets: 3, count: 8 }],
    ['incline 2', '', {}],
    ['speed rope 5 min', 'speed rope', { seconds: 300 }],
    ['t-bar row 3x10', 't-bar row', { sets: 3, count: 10 }],
  ])('%s', (text, name, spec) => {
    const parsed = parsePlan(text)
    expect(parsed.name).toBe(name)
    expect(parsed.spec).toEqual(spec)
  })
})

describe('resolvePlan', () => {
  it.each<[string, Parameters<typeof resolvePlan>[0], Plan]>([
    [
      'strength without numbers is 3 × 10',
      { kind: 'strength', spec: {} },
      { kind: 'strength', sets: 3, reps: 10 },
    ],
    [
      'hold without numbers is 3 × 30 s',
      { kind: 'hold', spec: {} },
      { kind: 'hold', sets: 3, seconds: 30 },
    ],
    [
      'cardio without numbers is an open stopwatch',
      { kind: 'cardio', spec: {} },
      { kind: 'cardio', target: null },
    ],
    [
      'numbers without sets are one set',
      { kind: 'strength', spec: { count: 20 } },
      { kind: 'strength', sets: 1, reps: 20 },
    ],
    [
      'sets without reps keep the default reps',
      { kind: 'strength', spec: { sets: 4 } },
      { kind: 'strength', sets: 4, reps: 10 },
    ],
    [
      'a duration turns a strength move into timed sets',
      { kind: 'strength', spec: { sets: 3, seconds: 30 } },
      { kind: 'hold', sets: 3, seconds: 30 },
    ],
    [
      'with a duration, a loose number is the sets',
      { kind: 'hold', spec: { seconds: 60, count: 5 } },
      { kind: 'hold', sets: 5, seconds: 60 },
    ],
    [
      'a hold reads a unitless value after sets as seconds',
      { kind: 'hold', spec: { sets: 3, count: 60 } },
      { kind: 'hold', sets: 3, seconds: 60 },
    ],
    [
      'a hold ignores a bare count without sets',
      { kind: 'hold', spec: { count: 2 } },
      { kind: 'hold', sets: 3, seconds: 30 },
    ],
    [
      'explicit reps turn a hold into sets of reps',
      { kind: 'hold', spec: { sets: 3, reps: 10 } },
      { kind: 'strength', sets: 3, reps: 10 },
    ],
    [
      'cardio keeps a distance',
      { kind: 'cardio', spec: { distance: { value: 5, unit: 'km' } } },
      { kind: 'cardio', target: { type: 'distance', value: 5, unit: 'km' } },
    ],
    [
      'cardio drops metres under 100 (likely minutes)',
      { kind: 'cardio', spec: { distance: { value: 20, unit: 'm' } } },
      { kind: 'cardio', target: null },
    ],
    [
      'cardio with sets of a distance is a plain stopwatch',
      {
        kind: 'cardio',
        spec: { sets: 10, distance: { value: 100, unit: 'm' } },
      },
      { kind: 'cardio', target: null },
    ],
    [
      'a distance on a strength move is a plain stopwatch',
      {
        kind: 'strength',
        spec: { sets: 4, distance: { value: 20, unit: 'm' } },
      },
      { kind: 'cardio', target: null },
    ],
    [
      'a distance on a hold is a plain stopwatch',
      { kind: 'hold', spec: { sets: 3, distance: { value: 40, unit: 'm' } } },
      { kind: 'cardio', target: null },
    ],
    [
      'cardio keeps a duration',
      { kind: 'cardio', spec: { seconds: 1200 } },
      { kind: 'cardio', target: { type: 'time', seconds: 1200 } },
    ],
    [
      'cardio intervals become timed sets',
      { kind: 'cardio', spec: { sets: 8, seconds: 30 } },
      { kind: 'hold', sets: 8, seconds: 30 },
    ],
    [
      'cardio with reps becomes sets of reps',
      { kind: 'cardio', spec: { reps: 100 } },
      { kind: 'strength', sets: 1, reps: 100 },
    ],
    [
      'cardio ignores a unitless count',
      { kind: 'cardio', spec: { sets: 3, count: 100 } },
      { kind: 'cardio', target: null },
    ],
  ])('%s', (_rule, input, plan) => {
    expect(resolvePlan(input)).toEqual(plan)
  })
})

describe('formatPlan and parsePlanLine', () => {
  it.each<[Plan, string]>([
    [{ kind: 'strength', sets: 3, reps: 12 }, '3 × 12'],
    [{ kind: 'hold', sets: 3, seconds: 45 }, '3 × 45 s'],
    [{ kind: 'hold', sets: 3, seconds: 90 }, '3 × 90 s'],
    [{ kind: 'hold', sets: 2, seconds: 120 }, '2 × 2 min'],
    [
      { kind: 'cardio', target: { type: 'distance', value: 5, unit: 'km' } },
      '5 km',
    ],
    [
      { kind: 'cardio', target: { type: 'distance', value: 2.5, unit: 'mi' } },
      '2.5 mi',
    ],
    [
      { kind: 'cardio', target: { type: 'distance', value: 2000, unit: 'm' } },
      '2000 m',
    ],
    [{ kind: 'cardio', target: { type: 'time', seconds: 1200 } }, '20 min'],
    [{ kind: 'cardio', target: { type: 'time', seconds: 45 } }, '45 s'],
  ])('round-trips %j as %s', (plan, text) => {
    expect(formatPlan(plan)).toBe(text)
    const note = `Leg day\nTargets quadriceps · ${text}\nFelt good`
    expect(parsePlanLine(note)).toEqual(plan)
  })

  it('formats a stopwatch without a plan part', () => {
    expect(formatPlan({ kind: 'cardio', target: null })).toBeNull()
  })

  // Notes edited by hand, or written on another device.
  it.each<[string, Plan | null]>([
    ['Targets chest · 3x12', { kind: 'strength', sets: 3, reps: 12 }],
    ['Targets chest · 5 x 5', { kind: 'strength', sets: 5, reps: 5 }],
    ['Targets chest ·3 × 12', { kind: 'strength', sets: 3, reps: 12 }],
    ['Targets chest· 3 × 12\r', { kind: 'strength', sets: 3, reps: 12 }],
    ['Targets chest · 3 × 12 reps', { kind: 'strength', sets: 3, reps: 12 }],
    ['Targets chest · 3 × 12  ', { kind: 'strength', sets: 3, reps: 12 }],
    ['Targets abs · 3 x 45s', { kind: 'hold', sets: 3, seconds: 45 }],
    ['Targets abs · 4×1min', { kind: 'hold', sets: 4, seconds: 60 }],
    ['Targets abs · 3 × 30 sec', { kind: 'hold', sets: 3, seconds: 30 }],
    [
      'Targets legs · 5km',
      { kind: 'cardio', target: { type: 'distance', value: 5, unit: 'km' } },
    ],
    [
      'Targets legs · 0.5 km',
      { kind: 'cardio', target: { type: 'distance', value: 0.5, unit: 'km' } },
    ],
    [
      'Targets legs · 30 minutes',
      { kind: 'cardio', target: { type: 'time', seconds: 1800 } },
    ],
    ['Targets chest · 0 × 12', null],
    ['Targets chest · 3 × 0', null],
    ['Targets abs · 3 × 0 s', null],
    ['Targets legs · 0 km', null],
    ['Targets quadriceps, glutes, hamstrings', null],
    ['Targets chest · three sets', null],
    ['Targets chest · 3 × 12 · 2 × 8', { kind: 'strength', sets: 2, reps: 8 }],
    ['Targets chest ·', null],
    ['My targets · 3 × 12', null],
    ['Go early', null],
  ])('%j', (note, plan) => {
    expect(parsePlanLine(note)).toEqual(plan)
  })

  it('reads the first Targets line and tolerates a missing note', () => {
    expect(parsePlanLine(null)).toBeNull()
    expect(
      parsePlanLine('Targets chest · 3 × 12\nTargets back · 2 × 8'),
    ).toEqual({ kind: 'strength', sets: 3, reps: 12 })
  })
})
