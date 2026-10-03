import type { CDPSession, Page } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Sharp recordings. Playwright's built-in recordVideo is VP8 at ~0.7 Mbps and 25 fps: text goes soft,
// zooms magnify the blur, and 25 -> 30 fps in the final render repeats frames unevenly (zoom judder).
// Instead, capture Chrome's own compositor frames (CDP screencast, near-lossless JPEG) and encode them
// to a constant-30 fps, high-quality H.264 file that seeks frame-accurately.

export interface FrameLog { file: string; ms: number } // ms on the same clock as the timeline (Date.now)

export class Screencast {
  private frames: FrameLog[] = [];
  private session: CDPSession | null = null;
  private pending = 0;

  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  async start(page: Page, size: { width: number; height: number }): Promise<void> {
    fs.rmSync(this.dir, { recursive: true, force: true });
    fs.mkdirSync(this.dir, { recursive: true });
    this.session = await page.context().newCDPSession(page);
    this.session.on('Page.screencastFrame', async (f: { data: string; sessionId: number; metadata: { timestamp?: number } }) => {
      this.pending++;
      const file = path.join(this.dir, `${String(this.frames.length).padStart(6, '0')}.jpg`);
      // metadata.timestamp is seconds since the epoch (when the frame was drawn); fall back to arrival time.
      this.frames.push({ file, ms: f.metadata.timestamp ? f.metadata.timestamp * 1000 : Date.now() });
      fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
      try { await this.session!.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch { /* page closing */ }
      this.pending--;
    });
    await this.session.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: size.width, maxHeight: size.height, everyNthFrame: 1 });
  }

  async stop(): Promise<FrameLog[]> {
    if (this.session) {
      await this.session.send('Page.stopScreencast').catch(() => {});
      for (let i = 0; i < 50 && this.pending > 0; i++) await new Promise((r) => setTimeout(r, 20));
      await this.session.detach().catch(() => {});
    }
    return this.frames;
  }
}

/**
 * ffconcat list holding each frame until the next one, starting at t0Ms (the timeline's zero) and
 * ending at endMs, so video time = timeline time. Exported for tests.
 */
export function concatList(frames: FrameLog[], t0Ms: number, endMs: number): string {
  const lines = ['ffconcat version 1.0'];
  frames.forEach((f, i) => {
    const from = i === 0 ? t0Ms : f.ms;
    const to = i + 1 < frames.length ? frames[i + 1].ms : endMs;
    lines.push(`file '${f.file.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`, `duration ${(Math.max(to - from, 1) / 1000).toFixed(4)}`);
  });
  if (frames.length) lines.push(`file '${frames.at(-1)!.file.replace(/\\/g, '/')}'`); // concat demuxer quirk: repeat the last file
  return lines.join('\n') + '\n';
}

/** Encode the frames to a constant-30 fps H.264 MP4 (CRF 12, keyframe every second for exact seeking). */
export function encodeFrames(frames: FrameLog[], t0Ms: number, endMs: number, out: string, ffmpegDir = process.env.FFMPEG_DIR ?? ''): void {
  if (!frames.length) throw new Error('screencast captured no frames');
  const list = path.join(path.dirname(frames[0].file), 'frames.ffconcat');
  fs.writeFileSync(list, concatList(frames, t0Ms, endMs));
  const ffmpeg = path.join(ffmpegDir, 'ffmpeg');
  const r = spawnSync(`"${ffmpeg}"`, [
    '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', `"${list}"`,
    '-vf', '"fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2"', '-c:v', 'libx264', '-preset', 'slow', '-crf', '12',
    '-g', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `"${out}"`,
  ], { shell: true, stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg failed to encode the screencast');
}
