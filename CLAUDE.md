# Agent Memory

Before planning or making changes in this repo, read the shared cross-project memory vault at `../Memory` (an Obsidian vault also used by GitHub Copilot):

1. `../Memory/AI/Agent Instructions.md` — standing protocol, vault conventions, session log format. Read this first, every session.
2. `../Memory/Cross-Repo/Decisions.md` — **ADR-025** (this kit: entry points, chrono-node exception, corpora as contract) and **ADR-012** (shared-package rules: CommonJS, structural types, no native modules, consumer gotchas).
3. The first consumer's notes: `../Memory/Projects/checklist-copilot/checklist-copilot Context.md` (lookup bullets) and its `roadmap/26-lookup-kit.md`.
4. The 2–3 most recent files in `../Memory/AI/sessions/`.

At the end of the session, write a log to `../Memory/AI/sessions/YYYY-MM-DD-claude[-N]-<slug>.md` per the template in `Agent Instructions.md`.

## Repo-specific constraints

- **The corpora are the contract.** `__tests__/fixtures/*-lines.ts` hold real
  list lines with the outcome a user wants. A behaviour change lands as a
  fixture first: add the failing real line, then the smallest fix. `KNOWN_GAPS`
  only shrinks — never add a line to it to make a change pass, and never relax
  a corpus threshold (travel 0 correct → wrong, dining 0 wrong / 0 over-claim,
  food ≥ 85 %) without the user saying so.
- **Deterministic, no LLM.** Same line → same patch. The only network read is
  DuckDuckGo's first-result page through the injected `Resolver`; everything
  else is local code and the bundled tables.
- **Never decode on a render path.** `lookupLinkKind` / `isLookupLink` run
  while a list row renders: no `decodeURIComponent`, nothing that can throw;
  match the encoded built shape.
- **No `new URL(...)` getters** (React Native's polyfill) — plain string code.
- **Structural types only** in the public API (`LookupInput`, `LookupPatch`,
  `Resolution`, …). Never export a chrono-node type (ADR-012 gotcha 1).
- **One runtime dependency: `chrono-node`**, imported as `chrono-node/en`. No
  React Native or Expo imports. A new dependency needs an ADR.
- **Inject, don't read:** `fetch` falls back to `globalThis.fetch` per call,
  clocks come in as `now`. Keep pacing inside the resolver instance.
- **Entry points are the bundle boundary** (Metro doesn't tree-shake): the
  root exports no data; each `index.ts` names its exports (no `export *`
  except the root re-exporting core). Folder DAG `core ← places ← dining ←
  travel`, `food`/`exercise` use `core` only — `lookups-boundary.test.ts`
  enforces it. A new entry needs the `exports` map, a stub dir
  (`<entry>/package.json`, for jest-expo) and `files`.
- Build is `tsc` (Node16 → CommonJS); the JSON tables ride into `dist/`
  through `resolveJsonModule`. `dist/` is not committed — `prepare` builds it
  on install.

## Workflow

Gates before any tag (CI runs them on every push and PR):
`bun run typecheck && bun run test && bun run test:tz && bun run build && bun run format:check`.
Consumers pin by tag (`github:laurenthh/rn-lookup-kit#v1.0.0`), so a tag is a
release — never move one. Minor tags for new entry points or behaviour, patch
tags for corpus fixes. Feature branches + PRs.
