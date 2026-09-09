# Agents

This repo's guide for any coding agent is `CLAUDE.md`. Read it first. It
routes every change to the one document that governs it. The index of
everything under `docs/` is `docs/README.md`.

Build: `npm run build`. Tests: `npm test`, then `npm run typecheck`. Build
first: four bundle-boundary tests skip when `dist/` is absent. There is no
deploy. The deliverable is the npm package, published by a tag.

Two rules an agent breaks most easily: never import `src/ephemeris/moshier.ts`
or the `ephemeris` package from anything `src/index.ts` reaches (the exports
map is the licensing boundary), and never state an accuracy figure that
`npm run validate` has not produced.
