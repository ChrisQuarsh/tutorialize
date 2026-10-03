// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildComposition, captionBox, zoomTransform, zoomTweens } from './build-composition.ts';
import type { Narration, Timeline } from '../core/types.ts';

const timeline: Timeline = {
  slug: 'demo', title: 'How to <test>', intro: 'Intro line.', outro: 'Outro line.',
  clipStartMs: 2000, clipEndMs: 12000, viewport: { width: 1920, height: 1080 },
  steps: [
    { id: 'one', caption: 'Open the page', narration: 'n1', startMs: 2000, endMs: 6000,
      zooms: [{ rect: { x: 100, y: 100, width: 200, height: 50 }, fromMs: 2300, toMs: 4300 }] },
    { id: 'two', caption: 'Do & check', narration: 'n2', startMs: 6000, endMs: 12000, zooms: [] },
  ],
};
const narration: Narration = {
  voiced: true,
  durations: { intro: 2000, one: 3000, two: 3000, outro: 3000 },
  texts: {},
};

describe('buildComposition', () => {
  const { html, durationSec } = buildComposition(timeline, narration);

  it('totals intro + clip + outro', () => {
    // intro = max(3.5, 2.0 + 1.0) = 3.5; clip = 10; outro = max(4, 3 + 1.5) = 4.5
    expect(durationSec).toBe(18);
    expect(html).toContain('data-composition-id="main"');
    expect(html).toContain('data-duration="18"');
  });

  it('trims the recording to the clip', () => {
    expect(html).toMatch(/<video id="rec"[^>]*data-start="3.5"[^>]*data-duration="10"[^>]*data-media-start="2"/);
    expect(html).toMatch(/<video id="rec"[^>]*muted/);
  });

  it('places one caption and one narration clip per step at the step start', () => {
    expect(html).toMatch(/id="cap-one"[^>]*data-start="3.5"[^>]*data-duration="4"/);
    expect(html).toMatch(/id="cap-two"[^>]*data-start="7.5"[^>]*data-duration="6"/);
    expect(html).toMatch(/<audio id="vo-one"[^>]*src="assets\/audio\/one.wav"[^>]*data-start="3.5"/);
    expect(html).toMatch(/<audio id="vo-intro"[^>]*data-start="0.3"/);
    expect(html).toMatch(/<audio id="vo-outro"[^>]*data-start="13.8"/);
  });

  it('labels steps "Step n of N"', () => {
    expect(html).toContain('Step 1 of 2');
    expect(html).toContain('Step 2 of 2');
  });

  it('zooms in at a window start and out at its end, scaling and panning toward the target', () => {
    // rect {x:100,y:100,width:200,height:50}: s = clamp(min(0.6*1920/200, 0.6*1080/50), 1, 1.6) = 1.6
    // cx=200, cy=125; tx = clamp(960 - 320, [-1152,0]) = 0; ty = clamp(486 - 200, [-648,0]) = 0
    // window 2300..4300 ms -> video 3.5 + 0.3 = 3.8 .. 5.8
    expect(html).toContain('{ scale: 1.6, x: 0, y: 0, transformOrigin: "0px 0px", duration: 1, ease: "sine.inOut" }, 3.8);');
    expect(html).toContain('{ scale: 1, x: 0, y: 0, duration: 1, ease: "sine.inOut" }, 5.8);');
    expect(html.match(/transformOrigin: "0px 0px"/g)).toHaveLength(1);
  });

  it('clamps the pan so a target near the edge never reveals outside the video', () => {
    // s = 1.6; cx=1790, cy=250; tx = clamp(960 - 2864, [-1152,0]) = -1152; ty = clamp(486 - 400, ..) = 0
    expect(zoomTransform({ x: 1700, y: 230, width: 180, height: 40 }, 1920, 1080)).toEqual({ scale: 1.6, x: -1152, y: 0 });
  });

  it('chains windows that are close together into a direct pan (no zoom-out between them)', () => {
    const at = (ms: number) => ms / 1000;
    const a = { rect: { x: 100, y: 100, width: 200, height: 50 }, fromMs: 1000, toMs: 3000 };
    const b = { rect: { x: 300, y: 300, width: 200, height: 50 }, fromMs: 3200, toMs: 5000 };  // 200 ms later: chain (pan)
    const c = { rect: { x: 500, y: 200, width: 200, height: 50 }, fromMs: 8000, toMs: 10000 }; // 3 s later: separate
    const tw = zoomTweens([a, b, c], at, 1920, 1080);
    expect(tw).toHaveLength(5); // in a, pan to b, out, in c, out
    expect(tw[0]).toMatch(/scale: 1.6.*\}, 1\);$/);
    expect(tw[1]).toMatch(/scale: 1.6.*ease: "power1.inOut" \}, 3.2\);$/);
    expect(tw[2]).toMatch(/\{ scale: 1, x: 0, y: 0.*\}, 5\);$/);
    expect(tw[3]).toMatch(/scale: 1.6.*\}, 8\);$/);
    expect(tw[4]).toMatch(/\{ scale: 1, x: 0, y: 0.*\}, 10\);$/);
  });

  it('never zooms out before the zoom-in tween has finished', () => {
    const tw = zoomTweens([{ rect: { x: 100, y: 100, width: 200, height: 50 }, fromMs: 1000, toMs: 1200 }], (ms) => ms / 1000, 1920, 1080);
    expect(tw[1]).toMatch(/\}, 2\);$/); // zoom-in takes 1 s
  });

  it('keeps a form zoomed between its fields: same-group windows pan, however far apart in time', () => {
    const at = (ms: number) => ms / 1000;
    const field = (y: number, fromMs: number, toMs: number) => ({ rect: { x: 700, y, width: 500, height: 40 }, fromMs, toMs, group: 'form' });
    const save = { rect: { x: 1100, y: 800, width: 120, height: 40 }, fromMs: 20000, toMs: 21000 };
    // three fields, 4-6 s apart (narration pauses), then the Save button with no group
    const tw = zoomTweens([field(200, 1000, 2000), field(300, 6000, 7000), field(400, 12000, 13000), save], at, 1920, 1080);
    expect(tw).toHaveLength(6); // in, pan, pan, out, in (save), out
    expect(tw[1]).toMatch(/ease: "power1.inOut" \}, 6\);$/);
    expect(tw[2]).toMatch(/ease: "power1.inOut" \}, 12\);$/);
    expect(tw[3]).toMatch(/\{ scale: 1, x: 0, y: 0.*\}, 13\);$/);
    expect(tw[4]).toMatch(/\}, 20\);$/);
    // one zoom level across the form's fields: only the pan changes
    const scales = tw.slice(0, 3).map((l) => l.match(/scale: ([\d.]+)/)![1]);
    expect(new Set(scales).size).toBe(1);
  });

  it('a form run takes the lowest zoom any of its fields needs, so a wide field still fits', () => {
    const at = (ms: number) => ms / 1000;
    const narrow = { rect: { x: 700, y: 200, width: 200, height: 40 }, fromMs: 1000, toMs: 2000, group: 'form' };
    const wide = { rect: { x: 400, y: 400, width: 1100, height: 200 }, fromMs: 3000, toMs: 4000, group: 'form' };
    const tw = zoomTweens([narrow, wide], at, 1920, 1080);
    const s = (l: string) => Number(l.match(/scale: ([\d.]+)/)![1]);
    expect(s(tw[0])).toBe(s(tw[1]));
    expect(s(tw[1])).toBe(zoomTransform(wide.rect, 1920, 1080).scale);
  });

  it('keeps a toast clear of the caption bar: a bottom-centre toast pans up above it', () => {
    const W = 1920, H = 1080, r = { x: 820, y: 900, width: 280, height: 40 };
    const t = zoomTransform(r, W, H);
    const bottom = t.scale * (r.y + r.height) + t.y;
    expect(t.scale).toBeGreaterThan(1);
    expect(bottom).toBeLessThanOrEqual(0.82 * H);
    expect(t.scale * r.y + t.y).toBeGreaterThanOrEqual(0);
  });

  it('keeps a bottom-right toast clear of the caption bar by zooming less if panning cannot', () => {
    const W = 1920, H = 1080, r = { x: 1560, y: 1000, width: 330, height: 50 };
    const t = zoomTransform(r, W, H);
    const x0 = t.scale * r.x + t.x, x1 = t.scale * (r.x + r.width) + t.x;
    expect(x0).toBeGreaterThanOrEqual(0.75 * W); // right of the caption bar
    expect(x1).toBeLessThanOrEqual(W);           // fully in frame
    expect(t.scale).toBeGreaterThan(1);
  });

  it('estimates the caption bar box from its text, so a short caption leaves more room', () => {
    const box = captionBox('Step 7 of 9', 'Save the dishes', 1920, 1080);
    // rendered bar for this caption measured at x 686..1234 in the pilot frame
    expect(box.x0).toBeLessThanOrEqual(686);
    expect(box.x1).toBeGreaterThanOrEqual(1234);
    expect(box.x1 - box.x0).toBeLessThan(0.5 * 1920 + 100);
    // a whole bottom-right toast stays at full 1.6x beside a short caption ...
    const r = { x: 1541, y: 1000, width: 354, height: 56 };
    const t = zoomTransform(r, 1920, 1080, 0.9, box);
    expect(t.scale).toBe(1.6);
    expect(t.scale * r.x + t.x).toBeGreaterThanOrEqual(box.x1);
    expect(t.scale * (r.x + r.width) + t.x).toBeLessThanOrEqual(1920);
  });

  it('frames an area window with a larger fit (final proof of two dishes)', () => {
    const t = zoomTransform({ x: 278, y: 510, width: 1152, height: 504 }, 1920, 1080, 0.9);
    expect(t.scale).toBe(1.5);
  });

  it('tiles captions: each caption ends exactly where the next begins, even when ms boundaries round differently', () => {
    // Boundaries at 50 / 2140 / 4250 / 6390 ms round up or down independently; starts and ends
    // must come from the same rounded absolute times.
    const tl: Timeline = {
      ...timeline, clipStartMs: 0, clipEndMs: 6390,
      steps: [
        { id: 'a', caption: 'A', narration: 'n', startMs: 50, endMs: 2140, zooms: [] },
        { id: 'b', caption: 'B', narration: 'n', startMs: 2140, endMs: 4250, zooms: [] },
        { id: 'c', caption: 'C', narration: 'n', startMs: 4250, endMs: 6390, zooms: [] },
      ],
    };
    const { html: h } = buildComposition(tl, { ...narration, voiced: false });
    const caps = [...h.matchAll(/class="clip caption" data-start="([\d.]+)" data-duration="([\d.]+)"/g)]
      .map((m) => ({ start: Number(m[1]), dur: Number(m[2]) }));
    expect(caps).toHaveLength(3);
    for (let i = 0; i + 1 < caps.length; i++) {
      expect(Math.round((caps[i].start + caps[i].dur) * 10) / 10).toBe(caps[i + 1].start);
    }
    // the last caption ends where the recording ends (end card starts)
    const last = caps.at(-1)!;
    expect(Math.round((last.start + last.dur) * 10) / 10).toBe(Number(h.match(/id="end-card"[^>]*data-start="([\d.]+)"/)![1]));
  });

  it('escapes text', () => {
    expect(html).toContain('How to &lt;test&gt;');
    expect(html).toContain('Do &amp; check');
  });

  it('omits all audio when narration is unvoiced, keeping the same timing', () => {
    const silent = buildComposition(timeline, { ...narration, voiced: false });
    expect(silent.html).not.toContain('<audio');
    expect(silent.durationSec).toBe(18);
    expect(silent.html).toMatch(/id="cap-two"[^>]*data-start="7.5"/);
  });
});
