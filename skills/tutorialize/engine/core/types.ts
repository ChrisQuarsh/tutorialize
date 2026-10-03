import type { Locator, Page } from '@playwright/test';

export type Locate = (page: Page) => Locator;

// Zoom is per action. `click`/`fill`/`select`/`upload` zoom on their target by default (zoom: false opts out,
// e.g. navigation links). `expect` zooms only when asked: zoom: true for toasts, or `zoomArea` to frame
// the union of several targets (the final proof).
// zoomGroup: consecutive zoomed actions in the same group keep the camera zoomed in and pan from one
// target to the next at a single zoom level (no zoom out/in between), even across steps. fill, select
// and upload default to 'form'; give a form's dropdown/checkbox clicks zoomGroup: 'form' to join them.
export type Action =
  | { kind: 'click'; target: Locate; zoom?: boolean; zoomGroup?: string }
  | { kind: 'fill'; target: Locate; text: string; zoom?: boolean; zoomGroup?: string }
  // A native <select>: picks the option by its label. (Custom dropdowns are two clicks instead.)
  | { kind: 'select'; target: Locate; option: string; zoom?: boolean; zoomGroup?: string }
  // Picks a file for a file input, as if chosen in the file dialog: `file` is a path relative to the
  // project's assets folder (config `assetsDir`, default tutorials/assets/), e.g. 'photos/cake.jpg'.
  | { kind: 'upload'; target: Locate; file: string; zoom?: boolean; zoomGroup?: string }
  | { kind: 'expect'; target: Locate; zoom?: boolean; zoomArea?: Locate[]; zoomGroup?: string };

export interface Step {
  id: string;            // kebab-case, unique within the flow
  caption: string;       // <= 6 words, imperative
  narration: string;     // <= 30 words
  actions: Action[];
  holdMs?: number;       // minimum post-step hold (default PACE.resultHoldMs); narration can extend it
}

/**
 * One tutorial video. Lives at <project>/flows/<category>/<slug>.flow.ts (default export). The slug is
 * the file name without `.flow.ts`; the category is the folder it sits in ('' at the top level).
 */
export interface Flow {
  title: string;         // title card text, e.g. "How to add a note"
  intro: string;         // narrated over the title card
  outro: string;         // narrated over the end card; names the next task only when there is one
  setup?: (page: Page) => Promise<void>;  // runs before the clip starts (not shown): sign in, open the start page
  steps: Step[];
}

/** A flow plus where it came from. */
export interface LoadedFlow extends Flow {
  slug: string;
  category: string;
  file: string;
}

/** What a mock handler sees for each xhr/fetch request the app makes. */
export interface MockRequest {
  method: string;
  url: URL;
  path: string;          // url.pathname
  query: URLSearchParams;
  body: unknown;         // parsed JSON body, or null
  raw: string | null;    // the raw body (e.g. multipart uploads)
  resourceType: string;
}

/** A mock handler's answer. Return undefined to let the default network policy decide. */
export type MockResponse =
  | { status?: number; json: unknown; headers?: Record<string, string> }
  | { status?: number; body: string; contentType?: string; headers?: Record<string, string> }
  | { status?: number; file: string; contentType?: string }   // path relative to the project's assets folder
  | { abort: true };

/**
 * The mocks module (config `mocks`, default tutorials/mocks.ts):
 *   export function createState() { return { notes: [...] }; }       // optional, fresh per recording
 *   export default function handle(req, state) { ... }               // MockResponse | undefined
 * It sees every xhr/fetch (any origin) and every request to another origin. Apply the flow's writes to
 * `state` so later reads show them.
 */
export type MockHandler<S = any> = (req: MockRequest, state: S) => MockResponse | undefined | Promise<MockResponse | undefined>;

/** tutorials/tutorialize.config.ts (default export). Relative paths resolve from the config file's folder. */
export interface TutorialConfig {
  app: {
    url: string;                     // where the running app is reached, e.g. http://localhost:3000
    command?: string;                // starts the app, e.g. 'npm run dev'; omit if you start it yourself
    cwd?: string;                    // where to run `command` (default: the folder above tutorials/)
    env?: Record<string, string>;    // extra env for `command`, e.g. API base URLs pointed at the mocks
    reuseExistingServer?: boolean;   // default false: a hand-started server may not have `env`
    startTimeoutMs?: number;         // default 60000
  };
  brand?: {
    kicker?: string;                 // small label above the title card, e.g. "Acme Notes tutorial"
    accent?: string;                 // CSS colour for the kicker, step badge and click ripple (default #DF0A0A)
  };
  viewport?: { width: number; height: number };   // default 1920x1080
  network?: {
    // 'block' (default): xhr/fetch to other origins get a 503 unless a mock answers; other requests to
    // other origins are aborted except GETs for images, fonts and stylesheets. 'allow': nothing blocked.
    external?: 'block' | 'allow';
  };
  mocks?: string;                    // default ./mocks.ts (optional file)
  flowsDir?: string;                 // default ./flows
  assetsDir?: string;                // default ./assets
  outDir?: string;                   // default ../docs/tutorials (working files and finished videos)
  browser?: { channel?: string };    // default 'chrome' (installed Google Chrome); '' = Playwright's Chromium
}

/** The config with every path made absolute and every default filled in. Passed to the recorder as JSON. */
export interface Project {
  dir: string;                       // the tutorials/ folder
  app: { url: string; command?: string; cwd: string; env: Record<string, string>; reuseExistingServer: boolean; startTimeoutMs: number };
  brand: { kicker: string; accent: string };
  viewport: { width: number; height: number };
  network: { external: 'block' | 'allow' };
  mocks: string | null;              // null when there is no mocks file
  flowsDir: string;
  assetsDir: string;
  outDir: string;
  browser: { channel: string };
}

export interface Rect { x: number; y: number; width: number; height: number }

export interface TimelineStep {
  id: string;
  caption: string;
  narration: string;
  startMs: number;       // ms since recording start
  endMs: number;
  zooms: ZoomWindow[];   // in time order
}

/** One zoom on the recording: zoom in (or pan, if chained) at fromMs, zoom out at toMs. */
export interface ZoomWindow {
  rect: Rect;            // target rect in recording pixels (clipped to the viewport)
  fromMs: number;        // ms since recording start; the rect is valid from here
  toMs: number;
  fit?: number;          // fraction of the frame the rect may fill (default 0.6; areas use more)
  group?: string;        // windows in a row with the same group pan at one zoom level (see Action.zoomGroup)
}

export interface Timeline {
  slug: string;
  title: string;
  intro: string;
  outro: string;
  clipStartMs: number;
  clipEndMs: number;
  viewport: { width: number; height: number };
  steps: TimelineStep[];
}

/** Written by narrate.ts. Durations in ms; `texts` is the cache key. */
export interface Narration {
  voiced: boolean;                     // false = durations are estimates, no WAV files exist
  durations: Record<string, number>;   // keys: 'intro', 'outro', and each step id
  texts: Record<string, string>;
}
