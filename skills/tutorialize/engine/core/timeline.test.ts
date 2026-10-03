// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { TimelineBuilder } from './timeline.ts';

const meta = { slug: 's', title: 'T', intro: 'i', outro: 'o' };

function clock(...times: number[]) {
  let i = 0;
  return () => times[Math.min(i++, times.length - 1)];
}

describe('TimelineBuilder', () => {
  it('records clip and step times relative to construction', () => {
    // construct@1000, beginClip@1500, beginStep@1600, endStep@3600, endClip@4000
    const t = new TimelineBuilder(clock(1000, 1500, 1600, 3600, 4000));
    t.beginClip();
    t.beginStep({ id: 'a', caption: 'A', narration: 'n' });
    t.endStep();
    t.endClip();
    const built = t.build(meta);
    expect(built.clipStartMs).toBe(500);
    expect(built.clipEndMs).toBe(3000);
    expect(built.steps).toEqual([
      { id: 'a', caption: 'A', narration: 'n', startMs: 600, endMs: 2600, zooms: [] },
    ]);
    expect(built.viewport).toEqual({ width: 1920, height: 1080 });
  });

  it('logs each zoom window with its start and end time', () => {
    // construct@0, beginClip@0, beginStep@100, beginZoom@200, endZoom@2100, beginZoom@2100, endZoom@4000, endStep@5000, endClip@5000
    const t = new TimelineBuilder(clock(0, 0, 100, 200, 2100, 2100, 4000, 5000, 5000));
    t.beginClip();
    t.beginStep({ id: 'a', caption: 'A', narration: 'n' });
    t.beginZoom({ x: 1, y: 2, width: 3, height: 4 });
    t.endZoom();
    t.beginZoom({ x: 5, y: 6, width: 7, height: 8 }, 0.9);
    t.endZoom();
    t.endStep();
    t.endClip();
    expect(t.build(meta).steps[0].zooms).toEqual([
      { rect: { x: 1, y: 2, width: 3, height: 4 }, fromMs: 200, toMs: 2100 },
      { rect: { x: 5, y: 6, width: 7, height: 8 }, fromMs: 2100, toMs: 4000, fit: 0.9 },
    ]);
  });

  it('refuses unbalanced zoom calls', () => {
    const t = new TimelineBuilder(clock(0));
    expect(() => t.beginZoom({ x: 0, y: 0, width: 1, height: 1 })).toThrow('beginZoom without an open step');
    t.beginClip();
    t.beginStep({ id: 'a', caption: 'A', narration: 'n' });
    expect(() => t.endZoom()).toThrow('endZoom without beginZoom');
    t.beginZoom({ x: 0, y: 0, width: 1, height: 1 });
    expect(() => t.beginZoom({ x: 0, y: 0, width: 1, height: 1 })).toThrow('beginZoom while a zoom is open');
    expect(() => t.endStep()).toThrow('endStep with an open zoom');
  });

  it('refuses endStep without beginStep', () => {
    const t = new TimelineBuilder(clock(0));
    expect(() => t.endStep()).toThrow('endStep without beginStep');
  });

  it('refuses to build with an open step or unfinished clip', () => {
    const t = new TimelineBuilder(clock(0, 1, 2));
    t.beginClip();
    t.beginStep({ id: 'a', caption: 'A', narration: 'n' });
    expect(() => t.build(meta)).toThrow('timeline incomplete');
  });
});
