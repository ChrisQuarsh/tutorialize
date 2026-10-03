# tutorialize

A Claude Code skill that makes captioned how-to videos of **any web app**. You (or Claude) describe a task as a list of steps; a real browser clicks through it, and the recording gets step captions, smooth zooms on what matters, a gliding cursor with click ripples, and title and end cards. Re-render any time the UI changes.

- **Recorder:** Playwright drives Chrome and records the screen.
- **Packager:** [Hyperframes](https://hyperframes.heygen.com) composes captions, zooms and cards into an MP4.
- **Safe demo data:** your app's API calls can be answered by mocks, and nothing it sends reaches another server unless you allow it.

See [examples/notes-app](examples/notes-app) for a complete working setup.

## Install

As a Claude Code plugin:

```
/plugin marketplace add ChrisQuarsh/tutorialize
/plugin install tutorialize@tutorialize
```

Or as a plain skill: copy `skills/tutorialize/` into `~/.claude/skills/` (every project) or `<your app>/.claude/skills/` (one project).

Requirements: Node ≥ 22.18, Google Chrome (or Playwright's Chromium), FFmpeg. The first time, the skill runs `npm install` in its `engine/` folder.

## Use

In Claude Code, from your app's repo:

```
/tutorialize setup
/tutorialize new add a team member and give them the Editor role
/tutorialize render 01-add-a-team-member
```

`setup` creates `tutorials/` in your app: a config (how to start the app, its URL, your brand colour), an example flow and a mocks file. Each video is one flow file you can read and edit:

```ts
{ id: 'save', caption: 'Click Save note', narration: 'Click Save note. A message confirms it.',
  actions: [{ kind: 'click', target: (p) => p.getByRole('button', { name: 'Save note' }) }] }
```

Finished videos go to `docs/tutorials/videos/<category>/<slug>.mp4` in your app.

Without Claude, run the engine directly from your app's root:

```bash
node <path to>/skills/tutorialize/engine/cli.ts render 01-add-a-note --draft
```

Reference: [skills/tutorialize/engine/README.md](skills/tutorialize/engine/README.md). House style and the reasons behind it: [docs/house-style.md](docs/house-style.md).

## House style, in one paragraph

One task per video, 60–120 s (180 s at most). Reach pages by clicking, as a user would. Calm pace. One short imperative caption per step. Zoom only on what matters (main buttons, toasts, the final result), and keep forms zoomed while the cursor moves from field to field. End on visible proof, then an end card. The lint enforces the measurable parts.

## Developing

```bash
cd skills/tutorialize/engine
npm install
npm test
npm run typecheck
```

See [SPEC.md](SPEC.md) for scope and decisions.
