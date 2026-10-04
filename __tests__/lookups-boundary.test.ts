import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { dirname, join, relative, resolve, sep } from 'path'
import { preProcessFile } from 'typescript'

const ROOT = join(__dirname, '..')
const SRC = join(ROOT, 'src')
const ENTRIES = ['travel', 'dining', 'food', 'exercise']
// What each folder may import; travel uses dining, both share places.
const ALLOWED: Record<string, string[]> = {
  core: ['core'],
  places: ['core', 'places'],
  dining: ['core', 'places', 'dining'],
  travel: ['core', 'places', 'dining', 'travel'],
  food: ['core', 'food'],
  exercise: ['core', 'exercise'],
}
// The kit's one runtime dependency.
const PACKAGES = ['chrono-node/en']

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sources(join(dir, entry.name))
      : /\.tsx?$/.test(entry.name)
        ? [join(dir, entry.name)]
        : [],
  )

const specifiers = (file: string) =>
  preProcessFile(readFileSync(file, 'utf8'), true, true).importedFiles.map(
    ({ fileName }) => fileName,
  )

const folderOf = (file: string) => relative(SRC, file).split(sep)[0] ?? ''

const readJson = (file: string) =>
  JSON.parse(readFileSync(join(ROOT, file), 'utf8')) as Record<string, unknown>

describe('src', () => {
  it('has only the kit folders and the root entry', () => {
    expect(readdirSync(SRC).sort()).toEqual(
      [...Object.keys(ALLOWED), 'index.ts'].sort(),
    )
  })

  it.each(
    sources(SRC)
      .filter((file) => folderOf(file) !== 'index.ts')
      .map((file) => relative(ROOT, file)),
  )('%s imports only its allowed folders and packages', (path) => {
    const file = join(ROOT, path)
    const outside = specifiers(file).filter((spec) => {
      if (!spec.startsWith('.')) {
        return !PACKAGES.includes(spec)
      }
      const target = resolve(dirname(file), spec)
      return (
        relative(SRC, target).startsWith('..') ||
        !ALLOWED[folderOf(file)]?.includes(folderOf(target))
      )
    })
    expect(outside).toEqual([])
  })

  it('exports only the core from the root entry (no data)', () => {
    expect(specifiers(join(SRC, 'index.ts'))).toEqual(['./core'])
  })
})

describe('entry points', () => {
  const pkg = readJson('package.json')
  const exportsMap = pkg.exports as Record<string, unknown>

  it('are the root plus one subpath per domain', () => {
    expect(Object.keys(exportsMap).sort()).toEqual(
      ['.', './package.json', ...ENTRIES.map((entry) => `./${entry}`)].sort(),
    )
  })

  // For resolvers that ignore `exports`, a stub package.json per entry
  // makes `rn-lookup-kit/travel` resolve too.
  it.each(ENTRIES)('%s has a stub dir matching its exports entry', (entry) => {
    expect(readJson(`${entry}/package.json`)).toEqual({
      main: `../dist/${entry}/index.js`,
      types: `../dist/${entry}/index.d.ts`,
    })
    expect(exportsMap[`./${entry}`]).toEqual({
      types: `./dist/${entry}/index.d.ts`,
      default: `./dist/${entry}/index.js`,
    })
    expect(pkg.files).toContain(entry)
  })

  it('carry chrono-node as the only runtime dependency', () => {
    expect(Object.keys(pkg.dependencies as object)).toEqual(['chrono-node'])
  })
})
