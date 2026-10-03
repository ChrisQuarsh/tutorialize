import type { Rect, Timeline, TimelineStep } from './types.ts';

export class TimelineBuilder {
  private readonly now: () => number;
  private readonly t0: number;
  private readonly steps: TimelineStep[] = [];
  private clipStartMs: number | null = null;
  private clipEndMs: number | null = null;

  constructor(now: () => number = Date.now) {
    this.now = now;
    this.t0 = now();
  }

  private elapsed(): number {
    return this.now() - this.t0;
  }

  beginClip(): void {
    this.clipStartMs = this.elapsed();
  }

  beginStep(s: { id: string; caption: string; narration: string }): void {
    this.steps.push({ id: s.id, caption: s.caption, narration: s.narration, startMs: this.elapsed(), endMs: -1, zooms: [] });
  }

  private openStep() {
    const current = this.steps.at(-1);
    return current && current.endMs === -1 ? current : null;
  }

  /** Start a zoom window on `rect` now. */
  beginZoom(rect: Rect, fit?: number, group?: string): void {
    const step = this.openStep();
    if (!step) throw new Error('beginZoom without an open step');
    if (step.zooms.some((z) => z.toMs === -1)) throw new Error('beginZoom while a zoom is open');
    step.zooms.push({ rect, fromMs: this.elapsed(), toMs: -1, ...(fit ? { fit } : {}), ...(group ? { group } : {}) });
  }

  /** End the open zoom window now. */
  endZoom(): void {
    const z = this.openStep()?.zooms.at(-1);
    if (!z || z.toMs !== -1) throw new Error('endZoom without beginZoom');
    z.toMs = this.elapsed();
  }

  endStep(): void {
    const current = this.openStep();
    if (!current) throw new Error('endStep without beginStep');
    if (current.zooms.some((z) => z.toMs === -1)) throw new Error('endStep with an open zoom');
    current.endMs = this.elapsed();
  }

  endClip(): void {
    this.clipEndMs = this.elapsed();
  }

  build(meta: Pick<Timeline, 'slug' | 'title' | 'intro' | 'outro'>, viewport = { width: 1920, height: 1080 }): Timeline {
    if (this.clipStartMs === null || this.clipEndMs === null || this.steps.some((s) => s.endMs === -1)) {
      throw new Error('timeline incomplete');
    }
    return {
      ...meta,
      clipStartMs: this.clipStartMs,
      clipEndMs: this.clipEndMs,
      viewport,
      steps: this.steps,
    };
  }
}
