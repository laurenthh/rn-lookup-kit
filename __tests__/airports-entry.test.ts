import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { dirname, join, relative, resolve } from 'path'
import { airportCity as airportCityAirports, airportFor } from '../src/airports'
import * as travelEntry from '../src/travel'
import * as airportsEntry from '../src/airports'

const ROOT = join(__dirname, '..')

// Every file reachable from `entry` through relative imports/requires, and
// every bare package specifier met on the way.
const graph = (
  entry: string,
  specifiers: (source: string) => string[],
  candidates: (target: string) => string[],
) => {
  const files = new Set<string>()
  const packages = new Set<string>()
  const visit = (file: string) => {
    if (files.has(file)) {
      return
    }
    files.add(file)
    if (/\.json$/.test(file)) {
      return
    }
    for (const spec of specifiers(readFileSync(file, 'utf8'))) {
      if (!spec.startsWith('.')) {
        packages.add(spec)
        continue
      }
      const target = candidates(resolve(dirname(file), spec)).find(existsSync)
      if (target === undefined) {
        throw new Error(`${file}: cannot resolve ${spec}`)
      }
      visit(target)
    }
  }
  visit(entry)
  return {
    files: [...files].map((file) => relative(ROOT, file)).sort(),
    packages: [...packages],
  }
}

const srcGraph = () =>
  graph(
    join(ROOT, 'src/airports/index.ts'),
    (source) =>
      [...source.matchAll(/(?:from|import)\s+'([^']+)'/g)].map((m) => m[1]!),
    (target) => [`${target}.ts`, join(target, 'index.ts'), target],
  )

const distGraph = () =>
  graph(
    join(ROOT, 'dist/airports/index.js'),
    (source) => [...source.matchAll(/require\("([^"]+)"\)/g)].map((m) => m[1]!),
    (target) => [`${target}.js`, join(target, 'index.js'), target],
  )

const FORBIDDEN = /chrono|\/(dining|travel)\//

describe('the airports entry', () => {
  it('reaches only the table and the date words (source)', () => {
    const { files, packages } = srcGraph()
    expect(packages).toEqual([])
    expect(files).toEqual([
      'src/airports/index.ts',
      'src/places/airports.json',
      'src/places/airports.ts',
      'src/places/dateWords.ts',
    ])
  })

  // `build` runs before `test` in CI; locally the check waits for a build.
  it.skipIf(!existsSync(join(ROOT, 'dist/airports/index.js')))(
    'has no chrono-node, dining or travel module in its built require graph',
    () => {
      const { files, packages } = distGraph()
      expect(packages).toEqual([])
      expect(files.filter((file) => FORBIDDEN.test(file))).toEqual([])
      expect(files).toContain('dist/places/airports.json')
    },
  )

  it('exports exactly airportFor and airportCity', () => {
    expect(Object.keys(airportsEntry).sort()).toEqual([
      'airportCity',
      'airportFor',
    ])
  })

  it('is the same pair /travel re-exports', () => {
    expect(travelEntry.airportCity).toBe(airportCityAirports)
    expect(travelEntry.airportFor).toBe(airportFor)
    expect(travelEntry.airportCity('KIX, 12 Oct')).toBe('Osaka')
  })

  it('keeps airportCity behaviour from this entry', () => {
    expect(airportCityAirports('KIX')).toBe('Osaka')
    expect(airportCityAirports('NYC!')).not.toBeNull()
    expect(airportCityAirports('SFO-Oakland')).not.toBeNull()
    expect(airportCityAirports('LHR Sun 20:10')).toBe('London')
    for (const field of ['BAR mitzvah', 'NYC Marathon', 'THE Hague', 'USA']) {
      expect(airportCityAirports(field)).toBeNull()
    }
  })
})
