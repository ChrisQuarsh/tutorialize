---
name: tutorialize
description: "Create or re-render captioned how-to videos of any web app: a real browser clicks through the task, then the recording gets step captions, smooth zooms, a cursor and title and end cards. Use when asked to \"make a tutorial\", \"record a how-to video\", \"/tutorialize <task>\", set up tutorial videos for an app, or refresh a tutorial after a UI change."
---

# /tutorialize

Turns a written list of steps (a *flow*) into a captioned how-to video of a web app. One task per video. Demo data only.
Pipeline: **Playwright** drives the app in Chrome and records it → **Hyperframes** adds captions, zooms and cards → MP4.

Usage: `/tutorialize setup` · `/tutorialize new <one-line task>` · `/tutorialize render <slug> [--draft]` · `/tutorialize review <slug>`

## Where things live

- **Engine** (this skill): `<skill dir>/engine/`, where `<skill dir>` is the folder holding this SKILL.md (the "Base directory for this skill" shown when it loads). Run it as `node <skill dir>/engine/cli.ts <command>` **from the app's root**. Below, `tz` means that command.
- **The app's tutorials folder**: `<app>/tutorials/`, created by `tz init`:
  - `tutorialize.config.ts`: how to start the app, its URL, branding, network policy
  - `flows/<category>/<nn>-<task>.flow.ts`: one video each; the file name is the slug, the folder is the category
  - `mocks.ts`: demo responses for the app's API calls (optional)
  - `assets/`: files the flows upload or the mocks serve
  - `.env.tutorial`: `FFMPEG_DIR`, demo sign-in. Git-ignored, never committed or printed.
  - `types.ts`, `package.json`: types for editing, and `"type": "module"` for this folder only
- **Output**: `<app>/docs/tutorials/<slug>/` (working files) and `<app>/docs/tutorials/videos/<category>/<slug>.mp4` (finished videos), plus `videos/video-times.csv`. Configurable with `outDir`. Git-ignore it.

`<skill dir>/engine/README.md` is the reference for the config, the flow format and the mocks API. The example app at `examples/notes-app/` in the tutorialize repo is a complete working setup.

## setup (once per machine, then once per app)

1. **Requirements.** Check before installing anything, and **ask the user before installing**:
   - Node ≥ 22.18 (`node -v`).
   - Engine dependencies: if `<skill dir>/engine/node_modules` is missing, tell the user and run `npm install` in `<skill dir>/engine` (Playwright, Vitest and TypeScript, at pinned versions).
   - A browser: Google Chrome installed (the default `browser.channel: 'chrome'`). Without Chrome, set `browser: { channel: '' }` in the config and run `npx playwright install chromium` in the engine folder (a download, so ask first).
   - FFmpeg (`ffmpeg -version`). If it isn't on PATH, put its bin folder in `tutorials/.env.tutorial` as `FFMPEG_DIR`.
   - Hyperframes runs through `npx hyperframes@0.8.114` (fetched on first use). Rendering also loads GSAP and the Inter font from the web.
2. `tz init` in the app's root. It creates `tutorials/` and never overwrites existing files.
3. Fill in `tutorials/tutorialize.config.ts`. Read the app's `package.json` scripts and dev-server config for `app.command`, `app.url` (pin the port) and `app.cwd`. If the dev server reads its host or port from env vars, pin them in `app.env`.
4. Add `tutorials/.env.tutorial` and the output folder to the app's `.gitignore`.
5. Delete the example flow under `flows/getting-started/` once the first real flow exists.

## new

0. **Preflight: tell the user the cost before starting.** Find the page the task happens on and how its data loads:
   - Data comes from a **local** backend or the app's own demo mode, or the needed responses are already in `tutorials/mocks.ts` → "Expect ~10–15 min: ~3 min to write and test the steps, ~1 min to record, ~3–6 min to render." Proceed.
   - Data comes from an API with **no mocks yet** → "This page has no demo data, so I'll first add fake responses for its API (~10–20 min, one-time; later videos on this page reuse them). Total ~25–30 min. Go ahead?" Wait for a yes.
1. **Read the app** to find the page's component or template and its exact visible labels (buttons, field labels, headings, menu items). Work out how a new user reaches the page by clicking, starting from the app's home or dashboard.
2. **Demo data.** Never use a real account or real customer data. In order of preference:
   - a local backend seeded with demo data;
   - the app's own demo or mock mode, if it has one;
   - `tutorials/mocks.ts`: answer the app's API calls. Read the page's fetch code and shape every response exactly like the real API. Apply writes to `state` so later reads show them. Run `tz dry <slug>` with `TUTORIAL_DEBUG=1` and look for `blocked` lines to see the calls still unanswered. If the app reads its API base URL from env, point it at a fake host in `app.env` and match that host in the mocks. If you can't tell a response's shape, stop and ask.
   Never edit the app's source to make a tutorial work.
3. **Write the flow** at `tutorials/flows/<category>/<nn>-<task>.flow.ts`, copying the shape of the example flow: `title` ("How to …"), `intro`, `outro`, an off-camera `setup` (sign in, open the start page), and `steps`. Each step has a kebab-case `id`, a `caption` of 6 words or fewer in the imperative mood ("Click Save note"), `narration` of 30 words or fewer that adds to what's on screen rather than reading it out, and `actions`:
   - `{ kind: 'click', target }` · `{ kind: 'fill', target, text }` · `{ kind: 'select', target, option }` (native `<select>`) · `{ kind: 'upload', target, file }` (from `tutorials/assets/`) · `{ kind: 'expect', target, zoom?, zoomArea? }`
   - `target` is a Playwright locator function, e.g. `(p) => p.getByRole('button', { name: 'Save' })`. Prefer roles and labels. Use the app's real labels.
   - `fill` clicks the field, clears it and types, so edit forms end with exactly the typed text.
   - Use the user's own wording when they gave you a document or script, keeping the app's real button labels where the two differ.
4. **Zoom only on what the viewer must focus on:**
   - **No zoom** (`zoom: false`) on navigation: menu and sidebar links, tabs, search boxes.
   - **Zoom** on the main buttons that open or commit something, on toasts (`zoom: true`, or `zoomArea: [toastCard]`), and on the final proof (`zoomArea`, held to the end).
   - **Forms stay zoomed.** `fill`, `select` and `upload` share the `'form'` zoom group, so the camera stays in and glides from field to field. Give a custom dropdown's clicks `zoomGroup: 'form'` to join it. The submit button has no group, so the camera zooms out after the last field and back in on the button.
   - **End on proof:** the last step must `expect` the visible result with a zoom.
5. `tz lint <slug>`: fix captions and narration until it passes. **Never relax the lint**; shorten the text instead.
6. `tz dry <slug>` until it passes. Fix the flow or the mocks, never the app.

## render

`tz render <slug>` runs lint → dry run → narration timings → recording → packaging. Add `--draft` while iterating; use the default quality for the deliverable. Report the MP4 path and duration. Re-run it after any UI change: recording happens every render, by design.
Captions only by default. `--voice` adds Kokoro text-to-speech through Hyperframes. Its first run downloads the model, so ask the user first.
Other commands: `tz list`, `tz narrate <slug>`, `tz record <slug>`, `tz package <slug>` (restyle without re-recording).

## review

Extract frames from `docs/tutorials/<slug>/<slug>.mp4` with FFmpeg at: the title card, each zoom window's midpoint (`steps[].zooms` in `timeline.json`), each step's midpoint (video time = title card `data-duration` in `composition/index.html` + (step mid ms − `clipStartMs`) / 1000), and the end card. Look at them, then delete the frames. Check:
- 60–120 s, 180 s at most, one task only. Captions-only videos with short flows can land under 60 s; note it.
- Every step has a caption of 6 words or fewer, a "Step n of N" badge, and holds until its narration would end.
- The cursor glides, there's a ripple on every click, no error toasts appear, and zooms and pans are smooth (check a one-second run of consecutive frames around a pan for repeated frames).
- Forms stay zoomed between fields, navigation clicks aren't zoomed, and the zoom target is never hidden behind the caption bar.
- The video ends zoomed on proof. The end card recaps the result and names a next task only when there is one.
Fix failures at the source: flow text, the mocks, or (for engine bugs, with a test) the engine. Then re-render.

## Rules

- Never edit the app's source to make a tutorial work.
- Demo data only. Never sign in as a real user. Never print or copy the demo password from `.env.tutorial`.
- With `network.external: 'block'` (the default), nothing the app sends reaches another origin unless a mock answers it: API calls get a 503, other requests are aborted (read-only image, font and stylesheet GETs still load), WebSockets to other origins are closed, and service workers are blocked. Don't switch to `'allow'` to make a flow work; add a mock.
- Playwright traces are off. `TUTORIAL_TRACE=1` turns them on for debugging, but a trace records every typed value, including passwords. Delete `<skill dir>/engine/test-results/` when done, and never share a trace.
- Ask before installing tools, downloading browsers, or downloading voice models.
