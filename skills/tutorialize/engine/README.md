# tutorialize engine: reference

Run every command from the app's root: `node <skill dir>/engine/cli.ts <command> [slug] [--project <folder>]`.
`--project` defaults to `./tutorials` (or the current folder, if it holds `tutorialize.config.ts`).

| Command | What it does |
|---|---|
| `init [app folder]` | Creates `<app>/tutorials/` from the templates; never overwrites a file |
| `list` | Every flow, with its category, estimated length and lint status |
| `lint [slug]` | House-style check (every flow when no slug) |
| `dry <slug>` | Rehearsal in the browser, no video (~10 s). Fails if a label or button is missing |
| `narrate <slug> [--voice]` | Step timings: estimated at 3 words/s, or Kokoro TTS with `--voice` |
| `record <slug>` | Records the screen (needs `narrate` first) |
| `package <slug> [--draft]` | Captions, zooms, title and end cards → MP4, without re-recording |
| `render <slug> [--draft] [--voice]` | lint → dry → narrate → record → package; logs the time to `videos/video-times.csv` |

Environment: `TUTORIAL_DEBUG=1` logs every mocked, blocked or aborted request. `TUTORIAL_TRACE=1` keeps a Playwright trace of a failing run. Traces record typed passwords, so delete `engine/test-results/` afterwards.

## `tutorials/tutorialize.config.ts`

```ts
import type { TutorialConfig } from './types.ts';

const config: TutorialConfig = {
  app: {
    url: 'http://localhost:5173',          // required
    command: 'npm run dev',                // omit to start the app yourself
    cwd: '..',                             // default: the folder above tutorials/
    env: { VITE_API_URL: 'https://api.demo.example' }, // extra env for `command`
    reuseExistingServer: false,            // default; a hand-started server may lack `env`
    startTimeoutMs: 60_000,
  },
  brand: { kicker: 'Acme tutorial', accent: '#2357d9' },
  viewport: { width: 1920, height: 1080 }, // default
  network: { external: 'block' },          // default; 'allow' lets requests to other origins through
  mocks: './mocks.ts',                     // default; optional file
  flowsDir: './flows', assetsDir: './assets', outDir: '../docs/tutorials', // defaults
  browser: { channel: 'chrome' },          // default; '' = Playwright's own Chromium
};
export default config;
```

## Flows

`tutorials/flows/<category>/<nn>-<task>.flow.ts`, default export:

```ts
import type { Flow } from '../../types.ts';

const flow: Flow = {
  title: 'How to add a note',
  intro: "In this video you'll add a note and choose its colour.",
  outro: 'Your note is saved.',
  setup: async (page) => { await page.goto('/'); },  // off camera
  steps: [
    { id: 'open-form', caption: 'Click New note', narration: 'Click New note. A form opens.',
      actions: [{ kind: 'click', target: (p) => p.getByRole('button', { name: 'New note' }) }] },
    // ...
    { id: 'verify', caption: 'Find your new note', narration: 'Your note now sits with the others.', holdMs: 2500,
      actions: [{ kind: 'expect', target: (p) => p.getByText('Book the venue'), zoom: true }] },
  ],
};
export default flow;
```

Actions: `click`, `fill` (`text`), `select` (`option`, a native `<select>`), `upload` (`file`, relative to `assets/`), `expect` (`zoom`, `zoomArea`). Each one takes `zoom?: boolean` and `zoomGroup?: string`.

Lint rules: unique kebab-case step ids (`intro` and `outro` are reserved); captions of 6 words or fewer, starting with a capital and with no closing `.` or `!`; narration of 30 words or fewer per step; every step has an action; the last step ends on a zoomed `expect`; estimated length 180 s or less.

Flows run in two places: Node (`list`, `lint`, `narrate`, `package`) and Playwright (`dry`, `record`). Keep them plain TypeScript that Node can strip: no enums, namespaces or constructor parameter properties. Import only types from `@playwright/test`.

## Mocks

`tutorials/mocks.ts`:

```ts
import type { MockHandler } from './types.ts';

export function createState() { return { notes: [] as { title: string }[] }; } // fresh per recording

const handle: MockHandler<ReturnType<typeof createState>> = (req, state) => {
  if (req.url.hostname !== 'api.demo.example') return undefined;
  if (req.path === '/notes' && req.method === 'GET') return { json: state.notes };
  if (req.path === '/notes' && req.method === 'POST') { state.notes.push(req.body as never); return { status: 201, json: req.body }; }
  return undefined;
};
export default handle;
```

The handler sees every xhr/fetch request (any origin) and every request to another origin. Requests for the app's own pages and scripts from the dev server never reach it. `req` has `method`, `url` (a `URL`), `path`, `query`, `body` (parsed JSON or `null`), `raw` and `resourceType`. Return one of:
`{ json, status?, headers? }` · `{ body, contentType?, status? }` · `{ file, contentType?, status? }` (relative to `assets/`) · `{ abort: true }` · `undefined` (falls through to the network policy).

Network policy for unanswered requests: local requests pass through. Other origins (with `external: 'block'`): API calls get a 503, GETs for images, fonts and stylesheets load, everything else is aborted, WebSockets are closed. Service workers are always blocked.

**Pointing an app at the mocks.** Same-origin APIs (`/api/...`) need nothing: answer them in the handler. An app that reads its API base URL from env can get a fake host through `app.env`, e.g. `{ VITE_API_URL: 'https://api.demo.example' }`, matched in the handler by `req.url.hostname`.

## Gotchas

- Node ≥ 22.18 (type stripping is on by default). `tutorials/package.json` sets `"type": "module"` so flows are ES modules whatever the app uses.
- If env vars move the dev server to another host or port, pin them in `app.env`.
- `toBeVisible()` passes for off-screen elements; the recorder scrolls zoom targets into view before measuring them.
- A Hyperframes composition with no tweens fails `check`; the packager always adds the title fade-in.
- FFmpeg may be installed but missing from PATH in an open terminal: set `FFMPEG_DIR`.
- Recordings use the CDP screencast (sharp 30 fps H.264), not Playwright's `recordVideo` (soft VP8 at 25 fps).

## Developing the engine

`npm test` (Vitest) and `npm run typecheck` in this folder. The type check includes `examples/*/tutorials`.
