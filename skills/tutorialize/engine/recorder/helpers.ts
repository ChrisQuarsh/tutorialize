import type { Rect } from '../core/types.ts';

/** The subset of Playwright's Locator that typing needs (kept structural so it can be unit-tested). */
export interface Typeable {
  click(): Promise<unknown>;
  fill(value: string): Promise<unknown>;
  pressSequentially(text: string, options?: { delay?: number }): Promise<unknown>;
  getAttribute(name: string): Promise<string | null>;
}

/** Click the field, clear whatever it holds, then type visibly — so edit forms show the new value, not old+new. */
export async function typeInto(field: Typeable, text: string, delayMs: number): Promise<void> {
  await field.click();
  // Time/date inputs are segmented (hh:mm AM): a click focuses whichever segment is under the
  // cursor, so typing key by key lands in the wrong place. Set them whole ("11:00").
  if (['time', 'date'].includes((await field.getAttribute('type')) ?? '')) {
    await field.fill(text);
    return;
  }
  await field.fill('');
  await field.pressSequentially(text, { delay: delayMs });
}

/** Intersect a rect with the viewport; null when nothing of it is on screen. */
export function clipToViewport(r: Rect, vp: { width: number; height: number }): Rect | null {
  const x0 = Math.max(0, r.x);
  const y0 = Math.max(0, r.y);
  const x1 = Math.min(vp.width, r.x + r.width);
  const y1 = Math.min(vp.height, r.y + r.height);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** Smallest rect containing all of them. */
export function unionRect(rects: Rect[]): Rect {
  if (!rects.length) throw new Error('unionRect of nothing');
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.width));
  const y1 = Math.max(...rects.map((r) => r.y + r.height));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}
