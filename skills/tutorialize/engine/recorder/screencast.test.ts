// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { concatList } from './screencast.ts';

describe('concatList', () => {
  it('holds each frame until the next, backdates the first to t0 and runs the last to the end', () => {
    const list = concatList([{ file: 'C:/f/000000.jpg', ms: 1500 }, { file: 'C:/f/000001.jpg', ms: 1600 }], 1000, 2600);
    expect(list.split('\n').filter(Boolean)).toEqual([
      'ffconcat version 1.0',
      "file 'C:/f/000000.jpg'", 'duration 0.6000', // t0 (1000) .. next frame (1600)
      "file 'C:/f/000001.jpg'", 'duration 1.0000', // 1600 .. end (2600)
      "file 'C:/f/000001.jpg'",
    ]);
  });
});
