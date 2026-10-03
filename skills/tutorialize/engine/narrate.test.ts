// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { estimateNarration, narrationLines } from './narrate.ts';
import type { Flow } from './core/types.ts';

const flow: Flow = {
  title: 'T', intro: 'one two three', outro: 'a b c d e f',
  setup: async () => {},
  steps: [{ id: 'first', caption: 'Do it', narration: 'one two three four five six seven eight nine', actions: [] }],
};

describe('narrationLines', () => {
  it('keys intro, steps in order, outro', () => {
    expect(Object.keys(narrationLines(flow))).toEqual(['intro', 'first', 'outro']);
  });
});

describe('estimateNarration', () => {
  it('is unvoiced with 3-words-per-second durations', () => {
    expect(estimateNarration(flow)).toEqual({
      voiced: false,
      durations: { intro: 1000, first: 3000, outro: 2000 },
      texts: { intro: 'one two three', first: 'one two three four five six seven eight nine', outro: 'a b c d e f' },
    });
  });
});
