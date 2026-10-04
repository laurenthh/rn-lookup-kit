import type { LookupInput } from '../../src/core'

// A list line as a consumer hands it over (the app passes its own item type).
export const buildItem = (overrides: Partial<LookupInput>): LookupInput => ({
  text: '',
  tags: [],
  link: null,
  checked: false,
  ...overrides,
})
