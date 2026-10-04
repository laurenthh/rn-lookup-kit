# rn-lookup-kit

Deterministic item lookups for the copilot apps. A free-text list line goes
in; a small patch comes out — a link, a note line, a photo URL — ready for the
app to merge into its own item.

```
"Flight SYD to KIX"         → link: Google Flights · note: "Sydney → Osaka"
"Check in to W Osaka Hotel" → link: the hotel's own Booking.com / chain page
"Book Narisawa for 2, Sat"  → link: OpenTable page | official site | Maps
"2 bananas"                 → note: "~210 kcal · 54g carbs · 0.7g fat · 2.6g protein"
"Bench press 3x8 @ 60kg"    → note: "Targets chest, shoulders, triceps · 3 × 8" + photo URL
```

No LLM, no API key, no React Native imports. The only network call is
DuckDuckGo's `\` "first result" page, read through an injected resolver. The
only runtime dependency is [`chrono-node`](https://github.com/wanasit/chrono)
(date spans in booking lines).

## Entry points

Metro does not tree-shake, so each domain is its own entry point and the root
carries no data.

| Import | What | Data |
|---|---|---|
| `rn-lookup-kit` | types, `createResolver`, registry helpers (`lookupsForTags`, `applicableLookups`, `lookupLabel`, `runLookups`), note merging (`applyLookupPatch`, `mergeNoteLine`, `lineOwner`), link recognisers (`lookupLinkKind`, `isLookupLink`, `linkHref`, `parseLink`), `PACE_GAP` | none |
| `rn-lookup-kit/travel` | `createTravelLookup`, `travelIntent` — places, stays, check-in/booking pages, flights, transport | airports (57 KB) + chrono-node |
| `rn-lookup-kit/dining` | `createDiningLookup`, `diningIntent` — "book a table" → OpenTable / official site / Maps | airports + chrono-node (shared `places/`) |
| `rn-lookup-kit/food` | `foodLookup`, `isFood`, `resolveFood` — calories and macros for a food line | USDA foods (168 KB) |
| `rn-lookup-kit/exercise` | `exerciseLookup`, `exerciseFor`, `parsePlanLine`, `formatPlan` — muscles and the plan line | free-exercise-db (60 KB) |

Everything else is internal; the tests reach it through deep paths, apps must
not.

## Usage

```ts
import {
  applyLookupPatch,
  createResolver,
  lookupsForTags,
  runLookups,
  type Lookup,
} from 'rn-lookup-kit'
import { createDiningLookup } from 'rn-lookup-kit/dining'
import { exerciseLookup } from 'rn-lookup-kit/exercise'
import { foodLookup, isFood } from 'rn-lookup-kit/food'
import { createTravelLookup } from 'rn-lookup-kit/travel'

// One resolver per app: its pacing gate must see every DuckDuckGo read.
export const resolver = createResolver()

const LOOKUPS: Lookup[] = [
  // isGrocery is required: "2 bananas" on a travel list is shopping, not a
  // Maps search. Without food data, pass `() => false` on purpose.
  createTravelLookup({ resolver, isGrocery: isFood }),
  foodLookup,
  exerciseLookup,
  createDiningLookup({ resolver }), // after travel: its link wins
]

// Lookups are keyed by the *list's* tags (travel, food, gym, restaurants…).
const lookups = lookupsForTags({ lookups: LOOKUPS, listTags: ['travel'] })
const result = await runLookups({ lookups, item }) // item: { text, tags, link, checked? }
if (result !== 'no-match') {
  const { note, link } = applyLookupPatch({ item, patch: result })
  // write note/link (and download result.image) the app's own way
}
```

`applyLookupPatch` never replaces user text or a user link; a note line the
lookup owns (`Lookup.owns`) is replaced in place on a re-run.

### The resolver contract

`createResolver({ fetch?, now? })` returns `{ resolveFirstResult, startPacing }`.

- `resolveFirstResult(query)` → `{ url }` or `{ url: null, reason }` with
  `reason` one of `blocked` (any non-200 — a 202 is DuckDuckGo's bot check),
  `offline`, `timeout` (5 s), `no-target`. The target must stay on
  duckduckgo.com, be `https`, trimmed, ≤ 2048 characters.
- DuckDuckGo **always** returns a target (gibberish gets a YouTube video), so
  the lookups check it: most name words must appear in the slug or host.
- `fetch` falls back to `globalThis.fetch` per call (a later polyfill or test
  spy is still used); `now` to `Date.now()` per call.
- `startPacing()` → `release`: until released, reads run one at a time,
  `PACE_GAP` (1.5 s) after the previous one ended. Release it in `finally` —
  a leaked handle paces every tap until the process dies.
- Identical queries in flight share one read (travel and dining on one tap).
- A lookup whose read failed keeps its fallback link and sets
  `patch.failure`; whether to write a fallback is the app's call.

## Consumer setup (Expo / Bun / Jest)

```jsonc
// package.json
"dependencies": { "rn-lookup-kit": "github:laurenthh/rn-lookup-kit#v1.0.0" },
// `prepare` builds dist/ on install; Bun runs it only for trusted packages.
"trustedDependencies": ["rn-lookup-kit"]
```

```js
// jest.config.js
transformIgnorePatterns: [
  // jest-expo's default list, plus the kit's built CJS (already plain JS)
  'node_modules/(?!(...|rn-lookup-kit))',
  'rn-lookup-kit/dist/',
],
moduleNameMapper: {
  // Jest's resolver here skips package `exports` subpaths; Metro reads them.
  // Needed by /travel and /dining.
  '^chrono-node/en$': '<rootDir>/node_modules/chrono-node/dist/cjs/locales/en',
},
```

- Subpaths resolve through `exports` (Metro, TypeScript `bundler`/`node16`)
  **and** through stub folders (`travel/package.json`…) for jest-expo, which
  ignores `exports`. No mapper is needed for the kit itself.
- A tag bump needs `bun install` in each consumer; on the branch you ship
  from, `bun install --frozen-lockfile` before any `eas update` (a stale
  `node_modules` fails the export with "Unable to resolve module").
- JS only, no native module: adopting or bumping the kit is OTA-safe.

## Hermes / React Native rules (why the code looks the way it does)

- **Never `decodeURIComponent` on a render path.** `lookupLinkKind` runs while
  rendering a list row; a malformed `%` would throw and brick the list. Link
  kinds match the **encoded** built shape.
- **No `new URL(...)` getters.** React Native's URL polyfill doesn't implement
  them reliably; links are taken apart with plain string code.
- Lookup-link kinds `booking` / `agoda` / `opentable` are **query-less** URLs
  only: a pasted link carries tracking parameters and must stay a user link.
- Clocks are injected (`now`), never read inside a pure function, and the
  date-sensitive suites also run in UTC+8 and UTC+14 (`test:tz`).

## Development

```sh
bun install
bun run typecheck   # src (Node16/CJS) + tests and scripts
bun run test        # Vitest, pinned to UTC
bun run test:tz     # booking details + travel in Perth and Kiritimati
bun run build       # tsc → dist/ (CJS + .d.ts + the JSON tables)
bun run format:check
```

The corpora under `__tests__/fixtures/` are the contract: travel 537 lines
(9 known gaps), dining 305 lines (never wrong, never over-claims), food 259
lines (≥ 85 % matched), exercise 329 lines, booking details at two reference
dates. See `CLAUDE.md` before changing behaviour.

Data tables are rebuilt with `bun run build:foods | build:airports |
build:exercises` (sources cached in the git-ignored `.cache/`); the committed
JSON is the artefact. Licences: `DATA-LICENSES.md`.

Releases are git tags (`v1.0.0`, …) cut on `main` after CI is green. A tag is
never moved.

## License

MIT (code). Bundled data: see `DATA-LICENSES.md`.
