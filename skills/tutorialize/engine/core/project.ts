import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Flow, LoadedFlow, Project, TutorialConfig } from './types.ts';

export const CONFIG_FILE = 'tutorialize.config.ts';

/** Fill in defaults and make every path absolute (relative paths resolve from the tutorials folder). */
export function resolveProject(dir: string, c: TutorialConfig): Project {
  if (!c?.app?.url) throw new Error(`${CONFIG_FILE}: app.url is required`);
  const abs = (p: string) => path.resolve(dir, p);
  const mocks = abs(c.mocks ?? './mocks.ts');
  const external = c.network?.external ?? 'block';
  if (external !== 'block' && external !== 'allow') throw new Error(`${CONFIG_FILE}: network.external must be 'block' or 'allow'`);
  return {
    dir,
    app: {
      url: c.app.url.replace(/\/$/, ''),
      command: c.app.command,
      cwd: abs(c.app.cwd ?? '..'),
      env: c.app.env ?? {},
      reuseExistingServer: c.app.reuseExistingServer ?? false,
      startTimeoutMs: c.app.startTimeoutMs ?? 60_000,
    },
    brand: { kicker: c.brand?.kicker ?? 'Tutorial', accent: c.brand?.accent ?? '#DF0A0A' },
    viewport: c.viewport ?? { width: 1920, height: 1080 },
    network: { external },
    mocks: fs.existsSync(mocks) ? mocks : null,
    flowsDir: abs(c.flowsDir ?? './flows'),
    assetsDir: abs(c.assetsDir ?? './assets'),
    outDir: abs(c.outDir ?? '../docs/tutorials'),
    browser: { channel: c.browser?.channel ?? 'chrome' },
  };
}

/** Load <dir>/tutorialize.config.ts. */
export async function loadProject(dir: string): Promise<Project> {
  const abs = path.resolve(dir);
  const file = path.join(abs, CONFIG_FILE);
  if (!fs.existsSync(file)) throw new Error(`No ${CONFIG_FILE} in ${abs}. Run "node cli.ts init <app folder>" to create one.`);
  const mod = await import(pathToFileURL(file).href);
  return resolveProject(abs, mod.default);
}

/** Every *.flow.ts under flowsDir, keyed by slug: { slug, category, file }. */
export function listFlows(flowsDir: string): { slug: string; category: string; file: string }[] {
  if (!fs.existsSync(flowsDir)) return [];
  const out: { slug: string; category: string; file: string }[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.flow.ts')) {
        const rel = path.relative(flowsDir, path.dirname(p));
        out.push({ slug: e.name.slice(0, -'.flow.ts'.length), category: rel.split(path.sep).join('/'), file: p });
      }
    }
  };
  walk(flowsDir);
  const seen = new Set<string>();
  for (const f of out) {
    if (seen.has(f.slug)) throw new Error(`Two flows share the slug "${f.slug}" (slugs must be unique across categories)`);
    seen.add(f.slug);
  }
  return out.sort((a, b) => a.category.localeCompare(b.category) || a.slug.localeCompare(b.slug));
}

export async function loadFlow(project: Project, slug: string): Promise<LoadedFlow> {
  const all = listFlows(project.flowsDir);
  const entry = all.find((f) => f.slug === slug);
  if (!entry) throw new Error(`Unknown flow "${slug}". Known: ${all.map((f) => f.slug).join(', ') || '(none yet)'}`);
  const mod = await import(pathToFileURL(entry.file).href);
  const flow: Flow | undefined = mod.default;
  if (!flow?.steps) throw new Error(`${entry.file} must default-export a flow ({ title, intro, outro, steps })`);
  return { ...flow, ...entry };
}

/** Working files for one tutorial: <outDir>/<slug>/. Finished videos: <outDir>/videos/<category>/<slug>.mp4. */
export const workDir = (p: Project, slug: string) => path.join(p.outDir, slug);
export const videoPath = (p: Project, f: { slug: string; category: string }) => path.join(p.outDir, 'videos', f.category, `${f.slug}.mp4`);
