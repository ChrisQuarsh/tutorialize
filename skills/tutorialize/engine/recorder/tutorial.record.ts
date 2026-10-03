import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFlow, workDir } from '../core/project.ts';
import { TimelineBuilder } from '../core/timeline.ts';
import { installNetwork } from './network.ts';
import { runFlow } from './run-flow.ts';
import { Screencast, encodeFrames } from './screencast.ts';
import type { Narration, Project } from '../core/types.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const project: Project = JSON.parse(process.env.TUTORIAL_PROJECT_JSON ?? 'null');
const slug = process.env.TUTORIAL_FLOW ?? '';
const dry = process.env.TUTORIAL_DRY === '1';

test(`tutorial ${dry ? 'dry run' : 'recording'}: ${slug}`, async ({ browser }) => {
  test.setTimeout(5 * 60_000);
  if (!project) throw new Error('Run this through cli.ts, which passes the project config');
  const flow = await loadFlow(project, slug);
  const outDir = workDir(project, slug);
  fs.mkdirSync(outDir, { recursive: true });

  const narrationPath = path.join(outDir, 'narration.json');
  if (!dry && !fs.existsSync(narrationPath)) throw new Error(`Run "node cli.ts narrate ${slug}" first`);
  const narration: Narration | null = dry ? null : JSON.parse(fs.readFileSync(narrationPath, 'utf8'));

  // Recordings render at 2x pixel density. The screencast still delivers viewport-sized frames (Chrome
  // caps them at the CSS viewport), but they are downsampled from 2x, so text edges come out smoother.
  const DPR = 2;
  const { width, height } = project.viewport;
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dry ? 1 : DPR,
    serviceWorkers: 'block', // a service worker's fetches would bypass context.route
  });
  await installNetwork(context, project);
  if (!dry) {
    await context.addInitScript(`window.__tutAccent = ${JSON.stringify(project.brand.accent)};`);
    await context.addInitScript({ path: path.join(here, 'overlay.js') });
  }

  const page = await context.newPage();
  const t0 = Date.now();
  const timeline = new TimelineBuilder(); // t0 = video time 0
  if (flow.setup) await flow.setup(page);
  else await page.goto('/');
  // Capture starts after the off-camera setup; the first frame is held back to t0 so video time = timeline time.
  // Frames go under the engine's node_modules/.cache (git-ignored, outside the app the dev server watches).
  const framesDir = path.resolve(here, '../node_modules/.cache/tutorial-frames', slug);
  const screencast = dry ? null : new Screencast(framesDir);
  await screencast?.start(page, { width, height });
  await runFlow(page, flow, timeline, { dry, narration, assetsDir: project.assetsDir });
  const frames = (await screencast?.stop()) ?? [];
  const endMs = Date.now();
  await context.close();
  if (dry) return;

  encodeFrames(frames, t0, endMs, path.join(outDir, 'raw.mp4'));
  fs.rmSync(framesDir, { recursive: true, force: true });
  const built = timeline.build({ slug: flow.slug, title: flow.title, intro: flow.intro, outro: flow.outro }, { width, height });
  fs.writeFileSync(path.join(outDir, 'timeline.json'), JSON.stringify(built, null, 2));
});
