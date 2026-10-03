# tutorialize: Notes for Claude

## Decision logging rule (always follow this)

Whenever a product, scope, or technical decision gets finalized, in chat or here in Claude Code, distill it into `SPEC.md` at the repo root. Don't let decisions live only in conversation history.

- Update the relevant section of `SPEC.md` in place rather than letting it go stale.
- Add a one-line dated entry to the Decision Log at the bottom of `SPEC.md`.
- If a decision resolves an item in Open Questions, remove it from that list.
- Read `SPEC.md` before assuming scope, stack, or architecture.

## Project rules

- Keep the engine app-agnostic. Nothing specific to one app goes in `skills/tutorialize/`. App-specific examples belong in `examples/`.
- Engine changes come with Vitest tests. Run `npm test` and `npm run typecheck` in `skills/tutorialize/engine/` before calling anything done. For changes to recording or packaging, also render the example (`examples/notes-app/README.md`) and look at frames.
- Engine code must stay strippable by Node (no enums, namespaces or parameter properties); the CLI runs it without a build.
- Never commit rendered videos, `.env.tutorial`, traces or `test-results/`.

## Reference docs

- `SPEC.md`: current decisions, scope, open questions.
- `skills/tutorialize/SKILL.md`: what Claude does when the skill runs.
- `skills/tutorialize/engine/README.md`: config, flow and mocks reference.
- `docs/house-style.md`: the video style and its rationale.
- Session handoff: `NEXT_STEPS.md`.
