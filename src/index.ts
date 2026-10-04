// The root entry is the core: types, the resolver, link builders and
// recognisers, note merging and the registry helpers. It never carries data —
// Metro does not tree-shake, so each domain is its own entry point.
export * from './core'
