import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG_FILE, listFlows, loadFlow, loadProject } from './core/project.ts';
import { lintFlow, estimateFlowMs } from './core/lint.ts';
import { writeNarration } from './narrate.ts';
import { packageTutorial } from './packager/package.ts';
import type { LoadedFlow, Project } from './core/types.ts';

const ENGINE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES = path.resolve(ENGINE, '../templates');

const usage = `usage: node cli.ts <command> [slug] [--project <tutorials folder>] [--draft] [--voice]

  init [app folder]   create <app folder>/tutorials/ with a config, an example flow and mocks
  list                every flow, with its estimated length and lint status
  lint [slug]         check flows against the house style (all flows when no slug)
  dry <slug>          rehearse in the browser, no video (~10 s); checks every target still exists
  narrate <slug>      step timings (estimated, or voiced with --voice)
  record <slug>       record the screen
  package <slug>      captions, zooms and title/end cards over the recording -> MP4
  render <slug>       lint -> dry -> narrate -> record -> package

--project defaults to ./tutorials (or the current folder if it holds ${CONFIG_FILE}).`;

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => { const i = args.indexOf(name); return i === -1 ? undefined : args[i + 1]; };
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1] === '--project'));
const [command, slug] = positional;

function projectDir(): string {
  const given = option('--project');
  if (given) return path.resolve(given);
  if (fs.existsSync(path.join(process.cwd(), CONFIG_FILE))) return process.cwd();
  return path.resolve('tutorials');
}

function loadEnv(dir: string): void {
  const envFile = path.join(dir, '.env.tutorial');
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
}

function run(cmd: string, cmdArgs: string[], env: Record<string, string>, cwd = ENGINE): void {
  const result = spawnSync(cmd, cmdArgs, { stdio: 'inherit', shell: true, cwd, env: { ...process.env, ...env } });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function playwright(project: Project, flow: LoadedFlow, dry: boolean): void {
  run('npx', ['playwright', 'test', '-c', 'playwright.tutorial.config.ts'], {
    TUTORIAL_PROJECT_JSON: JSON.stringify(project),
    TUTORIAL_FLOW: flow.slug,
    TUTORIAL_DRY: dry ? '1' : '0',
  });
}

function lintOrExit(flow: LoadedFlow): void {
  const problems = lintFlow(flow);
  if (!problems.length) return;
  console.error(`${flow.slug} does not follow the house style:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}

/** One row per render in <outDir>/videos/video-times.csv: video length and how long each stage took. */
function logVideoTime(project: Project, r: { flow: LoadedFlow; mp4: string; dryMs: number; recordMs: number; packageMs: number; draft: boolean }): void {
  const csv = path.join(project.outDir, 'videos', 'video-times.csv');
  const ffprobe = path.join(process.env.FFMPEG_DIR ?? '', 'ffprobe');
  const probe = spawnSync(`"${ffprobe}"`, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', `"${r.mp4}"`], { shell: true, encoding: 'utf8' });
  const lengthS = Number.parseFloat(probe.stdout) || 0;
  const s = (ms: number) => (ms / 1000).toFixed(0);
  const header = 'rendered_at,category,slug,quality,video_length_s,rehearsal_s,record_s,package_s,total_s\n';
  const row = [new Date().toISOString(), r.flow.category, r.flow.slug, r.draft ? 'draft' : 'standard', lengthS.toFixed(1),
    s(r.dryMs), s(r.recordMs), s(r.packageMs), s(r.dryMs + r.recordMs + r.packageMs)].join(',') + '\n';
  // The CSV may be open in a spreadsheet app (Windows locks it): retry briefly, then warn instead of failing the render.
  for (let attempt = 0; ; attempt++) {
    try {
      fs.mkdirSync(path.dirname(csv), { recursive: true });
      if (!fs.existsSync(csv)) fs.writeFileSync(csv, header);
      fs.appendFileSync(csv, row);
      break;
    } catch (e) {
      if (attempt >= 5) { console.warn(`Could not log the time to ${csv} (${(e as Error).message}). Row: ${row.trim()}`); return; }
      spawnSync('node', ['-e', 'setTimeout(()=>{},2000)']);
    }
  }
  console.log(`Video ${lengthS.toFixed(1)}s; made in ${s(r.dryMs + r.recordMs + r.packageMs)}s (rehearsal ${s(r.dryMs)}s, record ${s(r.recordMs)}s, package ${s(r.packageMs)}s). Logged to ${csv}`);
}

/** Copy the templates into <app>/tutorials/, never overwriting a file that is already there. */
function init(appDir: string): void {
  const target = path.join(path.resolve(appDir), 'tutorials');
  const copied: string[] = [];
  const copy = (from: string, to: string) => {
    for (const e of fs.readdirSync(from, { withFileTypes: true })) {
      const src = path.join(from, e.name);
      const dst = path.join(to, e.name);
      if (e.isDirectory()) { copy(src, dst); continue; }
      if (fs.existsSync(dst)) continue;
      fs.mkdirSync(to, { recursive: true });
      fs.copyFileSync(src, dst);
      copied.push(path.relative(target, dst));
    }
  };
  copy(TEMPLATES, target);
  // Flows import their types from here: a copy, so the app needs nothing from the engine at edit time.
  const types = path.join(target, 'types.ts');
  if (!fs.existsSync(types)) {
    fs.writeFileSync(types, '// Copied from the tutorialize engine by `init` (types only). Delete it and re-run init after upgrading to refresh it.\n' + fs.readFileSync(path.join(ENGINE, 'core', 'types.ts'), 'utf8'));
    copied.push('types.ts');
  }
  console.log(copied.length ? `Created in ${target}:\n${copied.map((f) => `  ${f}`).join('\n')}` : `Nothing to do: ${target} already has every template file.`);
  console.log('\nNext: edit tutorialize.config.ts (app.url, app.command), copy .env.tutorial.example to .env.tutorial,\nand git-ignore tutorials/.env.tutorial and the output folder (docs/tutorials/ by default).');
}

async function main(): Promise<void> {
  if (!command) { console.log(usage); process.exit(2); }
  if (command === 'init') { init(slug ?? '.'); return; }

  const dir = projectDir();
  loadEnv(dir);
  const project = await loadProject(dir);

  if (command === 'list' || (command === 'lint' && !slug)) {
    const all = listFlows(project.flowsDir);
    if (!all.length) { console.log(`No flows yet in ${project.flowsDir}`); return; }
    let failed = false;
    for (const entry of all) {
      const flow = await loadFlow(project, entry.slug);
      const problems = lintFlow(flow);
      failed ||= problems.length > 0;
      console.log(`${(entry.category || '-').padEnd(12)} ${entry.slug.padEnd(32)} ~${Math.round(estimateFlowMs(flow) / 1000)}s  ${problems.length ? `${problems.length} problem(s)` : 'ok'}`);
      if (command === 'lint') for (const p of problems) console.log(`    - ${p}`);
    }
    if (command === 'lint' && failed) process.exit(1);
    return;
  }

  if (!slug) { console.error(usage); process.exit(2); }
  const flow = await loadFlow(project, slug);
  const draft = flag('--draft');
  const voice = flag('--voice');
  const quality = draft ? 'draft' : 'standard';

  switch (command) {
    case 'lint': lintOrExit(flow); console.log(`${slug}: ok (~${Math.round(estimateFlowMs(flow) / 1000)}s)`); break;
    case 'dry': lintOrExit(flow); playwright(project, flow, true); break;
    case 'record': playwright(project, flow, false); break;
    case 'narrate': {
      const n = writeNarration(project, flow, { voice });
      console.log(n.voiced ? 'voiced' : 'estimated (no voice)');
      for (const [k, ms] of Object.entries(n.durations)) console.log(`${k.padEnd(18)} ${(ms / 1000).toFixed(1)}s`);
      break;
    }
    case 'package': packageTutorial(project, flow, quality); break;
    case 'render': {
      lintOrExit(flow);
      const t = (fn: () => unknown) => { const s = Date.now(); fn(); return Date.now() - s; };
      const dryMs = t(() => playwright(project, flow, true));      // fail fast before spending time on TTS/recording
      t(() => writeNarration(project, flow, { voice }));
      const recordMs = t(() => playwright(project, flow, false));
      let mp4 = '';
      const packageMs = t(() => { mp4 = packageTutorial(project, flow, quality); });
      logVideoTime(project, { flow, mp4, dryMs, recordMs, packageMs, draft });
      break;
    }
    default: console.error(usage); process.exit(2);
  }
}

main().catch((e) => { console.error((e as Error).message); process.exit(1); });
