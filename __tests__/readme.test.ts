import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..')

describe('README', () => {
  // examples/readme.ts is type-checked (`typecheck`); this keeps the README
  // showing exactly that code.
  it('shows examples/readme.ts as its usage example', () => {
    const readme = readFileSync(join(ROOT, 'README.md'), 'utf8')
    const usage = /## Usage\n\n```ts\n([\s\S]*?)```\n/.exec(readme)?.[1]
    expect(usage).toBe(
      readFileSync(join(ROOT, 'examples', 'readme.ts'), 'utf8'),
    )
  })
})
