# tutorialize: Spec (Source of Truth)

*Last updated: 2026-10-03*

This file tracks finalized decisions for this project. It supersedes any other doc wherever they conflict. Update it whenever a decision is made, in chat or in Claude Code.

## Product summary
A Claude Code skill (also installable as a plugin) that makes captioned how-to videos of any web app. A flow file lists the steps; Playwright clicks through them in Chrome and records the screen; Hyperframes adds step captions, zooms, cursor and title/end cards and renders an MP4. Anyone can install it and point it at their own app.

## Tech stack (decided)
- Node ≥ 22.18, TypeScript run by Node's type stripping (no build step). ES modules.
- Playwright 1.62.1 (`@playwright/test`, pinned) for driving and recording. Default browser: installed Chrome (`channel: 'chrome'`).
- Recording: CDP screencast frames encoded by FFmpeg to constant-30 fps H.264 (not Playwright `recordVideo`).
- Packaging: Hyperframes CLI `hyperframes@0.8.114` via npx (pinned), GSAP tweens for zooms.
- Voice (optional, `--voice`): Kokoro-82M through `hyperframes tts`. Unverified so far.
- Tests: Vitest 4.1.10; type check with TypeScript ~5.9.3 (`tsconfig.check.json`, includes the example app).

## Scope (decided)
- Repo layout: `skills/tutorialize/SKILL.md` (the skill), `skills/tutorialize/engine/` (CLI, recorder, packager), `skills/tutorialize/templates/` (copied into an app by `init`), `examples/notes-app/` (working example), `.claude-plugin/` (plugin + marketplace manifests).
- Per app, everything lives in `<app>/tutorials/`: `tutorialize.config.ts`, `flows/<category>/<nn>-<task>.flow.ts` (slug = file name, category = folder), optional `mocks.ts`, `assets/`, `.env.tutorial` (git-ignored), and a copied `types.ts`. Output goes to `<app>/docs/tutorials/` by default.
- Commands: `init`, `list`, `lint`, `dry`, `narrate`, `record`, `package`, `render`.
- Actions: `click`, `fill`, `select`, `upload`, `expect`, with per-action zoom and zoom groups.
- Network: mocks see every xhr/fetch and every request to another origin; unanswered requests to other origins are blocked by default (`network.external: 'block'`).
- House style enforced by `lint`: caption of 6 words or fewer, narration of 30 or fewer, kebab-case unique ids, ends on a zoomed proof, 180 s ceiling.
- Rendered videos are never committed.

## Open questions
- Licence for public distribution (MIT is the usual choice for a skill like this).
- Should the engine also be published to npm (`npx tutorialize`) so it can run without Claude Code?
- Voice narration (`--voice`) is untested: needs a Kokoro model download to verify.
- Non-Chrome browsers and non-1080p viewports are supported in config but untested beyond unit tests.

## Decision log
- 2026-10-03: Extracted from the VendorOS repo's `tutorials/` pipeline into this standalone repo; every VendorOS-specific part removed (flows, fixtures, VITE_* endpoint rewriting, CDN image mapping, branding).
- 2026-10-03: Made it app-agnostic: per-app `tutorialize.config.ts`, flows found by file path, a generic mock handler in place of hard-coded demo-backend rules, configurable brand kicker/accent, viewport, output folder and browser channel.
- 2026-10-03: Distributed as a Claude Code plugin + marketplace from this repo; the engine lives inside the skill folder so a plain copy of `skills/tutorialize/` also works.
- 2026-10-03: `init` writes `tutorials/package.json` with `"type": "module"` so flows are ES modules whatever the host app uses, and copies `types.ts` so the app needs no engine import at edit time.
- 2026-10-03: Added a `select` action for native `<select>` elements.
- 2026-10-03: The type check lives in `tsconfig.check.json` because Playwright applies `tsconfig.json` "paths" at runtime.
