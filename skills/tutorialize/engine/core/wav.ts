export function wavDurationMs(buf: Uint8Array): number {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const tag = (o: number) => String.fromCharCode(buf[o], buf[o + 1], buf[o + 2], buf[o + 3]);
  if (buf.length < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('not a WAV file');
  let offset = 12;
  let byteRate = 0;
  while (offset + 8 <= buf.length) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, true);
    if (id === 'fmt ') byteRate = view.getUint32(offset + 16, true);
    if (id === 'data') {
      if (!byteRate) throw new Error('WAV data chunk before fmt chunk');
      return Math.round((size / byteRate) * 1000);
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error('WAV has no data chunk');
}
