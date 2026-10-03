# Next steps

*Updated 2026-10-03*

## Done
- Public repo github.com/ChrisQuarsh/tutorialize (MIT).
- Standalone, app-agnostic repo extracted from VendorOS's tutorial pipeline; plugin + marketplace manifests; generic SKILL.md; engine reference; house-style doc; example notes app.

## Verified
- `npm test` (65 tests) and `npm run typecheck` pass in `skills/tutorialize/engine/`.
- `init` scaffolds an app; the example's `lint`, `dry` and `render --draft` produced a 42 s video with brand kicker/accent, zoomed form, mocked API and end card (frames checked).

## Next
- Try a plugin install from GitHub in a fresh session (`/plugin marketplace add ChrisQuarsh/tutorialize`) and run `/tutorialize setup` on a second app.
- Move the VendorOS flows and fixtures into `vendor-os-ui/tutorials/` as a tutorialize project (config, flows, mocks), so its 7 videos re-render with this engine.

## Blockers
- None.
