import { describe, expect, it } from 'vitest';
import { lintFlow } from './lint.ts';
import type { Flow } from './types.ts';

const target = () => ({}) as never;
const good: Flow = {
  title: 'How to add a note', intro: 'Add a note.', outro: 'Your note is saved.',
  steps: [
    { id: 'open-form', caption: 'Click New note', narration: 'Click New note.', actions: [{ kind: 'click', target }] },
    { id: 'verify', caption: 'Find your note', narration: 'Your note is listed.', actions: [{ kind: 'expect', target, zoomArea: [target] }] },
  ],
};

describe('lintFlow', () => {
  it('passes a flow in the house style', () => {
    expect(lintFlow(good)).toEqual([]);
  });

  it('flags long captions, bad ids, reserved ids and punctuation', () => {
    const bad: Flow = { ...good, steps: [
      { id: 'Open_Form', caption: 'click the very big shiny new button.', narration: 'x', actions: [{ kind: 'click', target }] },
      { id: 'intro', caption: 'Find it', narration: 'x', actions: [{ kind: 'expect', target, zoom: true }] },
    ] };
    const problems = lintFlow(bad).join('\n');
    expect(problems).toMatch(/not kebab-case/);
    expect(problems).toMatch(/reserved/);
    expect(problems).toMatch(/caption has 7 words/);
    expect(problems).toMatch(/capital letter/);
    expect(problems).toMatch(/punctuation/);
  });

  it('requires the video to end on a zoomed proof', () => {
    const noProof: Flow = { ...good, steps: [good.steps[0]] };
    expect(lintFlow(noProof).join('\n')).toMatch(/end on proof/);
  });

  it('enforces the 180 s ceiling', () => {
    const long = 'word '.repeat(30).trim();
    const steps = Array.from({ length: 20 }, (_, i) => ({ id: `s${i}`, caption: 'Do it', narration: long, actions: [{ kind: 'expect' as const, target, zoom: true }] }));
    expect(lintFlow({ ...good, steps }).join('\n')).toMatch(/ceiling/);
  });
});
