// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { wavDurationMs } from './wav.ts';

function makeWav(sampleRate: number, channels: number, samples: number): Uint8Array {
  const bytesPerSample = 2;
  const dataSize = samples * channels * bytesPerSample;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);
  const tag = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  tag(0, 'RIFF'); v.setUint32(4, 36 + dataSize, true); tag(8, 'WAVE');
  tag(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, channels, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * channels * bytesPerSample, true);
  v.setUint16(32, channels * bytesPerSample, true); v.setUint16(34, 16, true);
  tag(36, 'data'); v.setUint32(40, dataSize, true);
  return new Uint8Array(buf);
}

describe('wavDurationMs', () => {
  it('computes duration from byte rate and data size', () => {
    expect(wavDurationMs(makeWav(24000, 1, 36000))).toBe(1500);
  });
  it('handles stereo', () => {
    expect(wavDurationMs(makeWav(48000, 2, 96000))).toBe(2000);
  });
  it('rejects non-WAV input', () => {
    expect(() => wavDurationMs(new Uint8Array(64))).toThrow('not a WAV file');
  });
});
