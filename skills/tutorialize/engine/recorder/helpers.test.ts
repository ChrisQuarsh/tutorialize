// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { clipToViewport, typeInto, unionRect } from './helpers.ts';

describe('typeInto', () => {
  it('clicks, clears the existing value, then types', async () => {
    const calls: string[] = [];
    const field = {
      click: async () => { calls.push('click'); },
      fill: async (v: string) => { calls.push(`fill(${JSON.stringify(v)})`); },
      pressSequentially: async (t: string, o?: { delay?: number }) => { calls.push(`type(${t},${o?.delay})`); },
      getAttribute: async () => 'text',
    };
    await typeInto(field, 'New name', 60);
    expect(calls).toEqual(['click', 'fill("")', 'type(New name,60)']);
  });

  it('sets a segmented time input whole instead of typing key by key', async () => {
    const calls: string[] = [];
    const field = {
      click: async () => { calls.push('click'); },
      fill: async (v: string) => { calls.push(`fill(${JSON.stringify(v)})`); },
      pressSequentially: async () => { calls.push('type'); },
      getAttribute: async (n: string) => (n === 'type' ? 'time' : null),
    };
    await typeInto(field, '11:00', 60);
    expect(calls).toEqual(['click', 'fill("11:00")']);
  });
});

describe('clipToViewport', () => {
  const vp = { width: 1920, height: 1080 };
  it('keeps a rect that is fully on screen', () => {
    expect(clipToViewport({ x: 10, y: 20, width: 100, height: 50 }, vp)).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });
  it('cuts a rect that runs past the bottom/right edge', () => {
    expect(clipToViewport({ x: 240, y: 349, width: 1680, height: 797 }, vp)).toEqual({ x: 240, y: 349, width: 1680, height: 731 });
    expect(clipToViewport({ x: -20, y: -10, width: 100, height: 100 }, vp)).toEqual({ x: 0, y: 0, width: 80, height: 90 });
  });
  it('returns null for a rect entirely off screen', () => {
    expect(clipToViewport({ x: 0, y: 1200, width: 100, height: 100 }, vp)).toBeNull();
  });
});

describe('unionRect', () => {
  it('covers every rect (the final proof frames both dishes)', () => {
    expect(unionRect([{ x: 1102, y: 510, width: 328, height: 20 }, { x: 278, y: 994, width: 328, height: 20 }]))
      .toEqual({ x: 278, y: 510, width: 1152, height: 504 });
  });
});
