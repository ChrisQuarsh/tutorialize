import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { buildComposition } from './build-composition.ts';
import { fileURLToPath } from 'node:url';
import { videoPath, workDir } from '../core/project.ts';
import type { LoadedFlow, Narration, Project, Timeline } from '../core/types.ts';

const HYPERFRAMES = 'hyperframes@0.8.114';

function hf(cwd: string, args: string[]): void {
  const ffmpegDir = process.env.FFMPEG_DIR;
  const env = { ...process.env, ...(ffmpegDir ? { PATH: `${ffmpegDir}${path.delimiter}${process.env.PATH ?? ''}` } : {}) };
  const r = spawnSync('npx', [HYPERFRAMES, ...args], { cwd, stdio: 'inherit', shell: true, env });
  if (r.status !== 0) throw new Error(`hyperframes ${args[0]} failed`);
}

export function packageTutorial(project: Project, flow: LoadedFlow, quality: 'draft' | 'standard' = 'standard'): string {
  const slug = flow.slug;
  const outDir = workDir(project, slug);
  const compDir = path.join(outDir, 'composition');
  const timeline: Timeline = JSON.parse(fs.readFileSync(path.join(outDir, 'timeline.json'), 'utf8'));
  const narration: Narration = JSON.parse(fs.readFileSync(path.join(outDir, 'narration.json'), 'utf8'));

  const template = fileURLToPath(new URL('./template', import.meta.url));
  if (fs.existsSync(template)) fs.cpSync(template, compDir, { recursive: true });
  // meta.json id/name is per-slug, so it's written here rather than baked into the shared template.
  fs.writeFileSync(
    path.join(compDir, 'meta.json'),
    JSON.stringify({ id: slug, name: slug, createdAt: new Date().toISOString() }, null, 2),
  );
  fs.mkdirSync(path.join(compDir, 'assets'), { recursive: true });
  fs.rmSync(path.join(compDir, 'assets', 'raw.webm'), { force: true }); // older recordings
  fs.copyFileSync(path.join(outDir, 'raw.mp4'), path.join(compDir, 'assets', 'raw.mp4'));

  const { html, durationSec } = buildComposition(timeline, narration, { brand: project.brand });
  fs.writeFileSync(path.join(compDir, 'index.html'), html);

  const transcript = [timeline.intro, ...timeline.steps.map((s, i) => `Step ${i + 1}: ${s.caption}. ${s.narration}`), timeline.outro];
  fs.writeFileSync(path.join(outDir, 'transcript.txt'), transcript.join('\n\n') + '\n');

  hf(compDir, ['check']);
  const mp4 = path.join(outDir, `${slug}.mp4`);
  hf(compDir, [
    'render',
    '--quality', quality === 'draft' ? 'draft' : 'high',
    '--video-frame-format', 'png',
    '--output', `"${mp4}"`,
  ]);
  // The deliverable: every finished video in one folder, grouped by category.
  const filed = videoPath(project, flow);
  fs.mkdirSync(path.dirname(filed), { recursive: true });
  fs.copyFileSync(mp4, filed);
  console.log(`Rendered ${filed} (${durationSec}s)`);
  return filed;
}
