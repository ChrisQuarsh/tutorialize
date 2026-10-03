import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { workDir } from './core/project.ts';
import { estimateNarrationMs } from './core/pacing.ts';
import { wavDurationMs } from './core/wav.ts';
import type { Flow, LoadedFlow, Narration, Project } from './core/types.ts';

const VOICE = 'af_heart';
const HYPERFRAMES = 'hyperframes@0.8.114';

export function narrationLines(flow: Flow): Record<string, string> {
  const lines: Record<string, string> = { intro: flow.intro };
  for (const step of flow.steps) lines[step.id] = step.narration;
  lines.outro = flow.outro;
  return lines;
}

export function estimateNarration(flow: Flow): Narration {
  const result: Narration = { voiced: false, durations: {}, texts: {} };
  for (const [key, text] of Object.entries(narrationLines(flow))) {
    result.durations[key] = estimateNarrationMs(text);
    result.texts[key] = text;
  }
  return result;
}

// Voice is opt-in (--voice): the first run downloads the Kokoro-82M model through Hyperframes.
function voiceNarration(flow: Flow, outDir: string, previous: Narration | null): Narration {
  const audioDir = path.join(outDir, 'composition', 'assets', 'audio');
  fs.mkdirSync(audioDir, { recursive: true });
  const result: Narration = { voiced: true, durations: {}, texts: {} };
  for (const [key, text] of Object.entries(narrationLines(flow))) {
    const wav = path.join(audioDir, `${key}.wav`);
    if (!previous?.voiced || previous.texts[key] !== text || !fs.existsSync(wav)) {
      const txt = path.join(audioDir, `${key}.txt`);
      fs.writeFileSync(txt, text);
      const r = spawnSync('npx', [HYPERFRAMES, 'tts', `"${txt}"`, '--voice', VOICE, '--output', `"${wav}"`], {
        stdio: 'inherit',
        shell: true,
      });
      if (r.status !== 0) throw new Error(`TTS failed for "${key}"`);
      fs.rmSync(txt);
    }
    result.durations[key] = wavDurationMs(new Uint8Array(fs.readFileSync(wav)));
    result.texts[key] = text;
  }
  return result;
}

export function writeNarration(project: Project, flow: LoadedFlow, opts: { voice: boolean }): Narration {
  const outDir = workDir(project, flow.slug);
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'narration.json');
  const previous: Narration | null = fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, 'utf8')) : null;
  const result = opts.voice ? voiceNarration(flow, outDir, previous) : estimateNarration(flow);
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
  return result;
}
