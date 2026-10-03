// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PACE, actionGapMs, estimateNarrationMs, isZoomed, stepHoldMs } from './pacing.ts';

describe('stepHoldMs', () => {
  it('is zero in dry runs', () => {
    expect(stepHoldMs({ actionsElapsedMs: 0, narrationMs: 9000, dry: true })).toBe(0);
  });
  it('holds at least the result hold', () => {
    expect(stepHoldMs({ actionsElapsedMs: 5000, narrationMs: 1000, dry: false })).toBe(PACE.resultHoldMs);
  });
  it('extends the hold until narration finishes plus a breath', () => {
    expect(stepHoldMs({ actionsElapsedMs: 2000, narrationMs: 6000, dry: false }))
      .toBe(6000 + PACE.narrationTailMs - 2000);
  });
  it('respects a per-step override as the minimum', () => {
    expect(stepHoldMs({ actionsElapsedMs: 5000, narrationMs: 0, holdMs: 2500, dry: false })).toBe(2500);
  });
});

describe('estimateNarrationMs', () => {
  it('assumes 3 words per second', () => {
    expect(estimateNarrationMs('one two three four five six')).toBe(2000);
  });
});

describe('isZoomed', () => {
  const t = () => null as any;
  it('zooms clicks and fills by default, expects only when asked', () => {
    expect(isZoomed({ kind: 'click', target: t })).toBe(true);
    expect(isZoomed({ kind: 'click', target: t, zoom: false })).toBe(false);
    expect(isZoomed({ kind: 'fill', target: t, text: 'x' })).toBe(true);
    expect(isZoomed({ kind: 'expect', target: t })).toBe(false);
    expect(isZoomed({ kind: 'expect', target: t, zoom: true })).toBe(true);
    expect(isZoomed({ kind: 'expect', target: t, zoomArea: [t] })).toBe(true);
  });
});

describe('actionGapMs', () => {
  it('keeps the plain gap between unzoomed actions', () => {
    expect(actionGapMs(false, false)).toBe(PACE.betweenActionsMs);
  });
  it('counts zoom hold and lead toward the gap, so back-to-back zoomed clicks chain', () => {
    expect(actionGapMs(true, false)).toBe(PACE.betweenActionsMs - PACE.zoomHoldMs);
    expect(actionGapMs(true, true)).toBeLessThan(PACE.chainGapMs);
  });
});
