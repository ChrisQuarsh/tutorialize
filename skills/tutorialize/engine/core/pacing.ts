import type { Action } from './types.ts';

export const PACE = {
  cursorMoveMs: 700,       // glide duration to each target
  betweenActionsMs: 1200,  // gap between actions within a step
  resultHoldMs: 1500,      // minimum hold after a step's last action
  narrationTailMs: 400,    // breath after narration ends before the next step
  typeDelayMs: 60,         // per-character typing delay
  zoomLeadMs: 1000,        // zoom-in (or pan) lands before the cursor moves (>= zoomTweenMs)
  zoomTweenMs: 1000,       // zoom in / zoom out: slow and gentle
  panTweenMs: 850,         // glide between targets while zoomed
  zoomHoldMs: 600,         // stay zoomed after a click so the result registers
  toastReadMs: 1500,       // zoomed time on a toast after the zoom has landed
  chainGapMs: 1000,        // ungrouped windows closer than this pan directly (>= zoomTweenMs, so tweens never overlap)
} as const;

/** The zoom group an action joins: its own zoomGroup, or 'form' for fields, selects and uploads. */
export function zoomGroupOf(a: Action): string | undefined {
  return a.zoomGroup ?? (a.kind === 'fill' || a.kind === 'select' || a.kind === 'upload' ? 'form' : undefined);
}

export function isZoomed(a: Action): boolean {
  if (a.kind === 'expect') return a.zoom ?? Boolean(a.zoomArea?.length);
  return a.zoom ?? true;
}

/** Wait between two actions in a step. Zoom lead/hold time counts toward it, so consecutive zoomed
 * clicks keep the usual rhythm and their windows touch (and chain into a pan). */
export function actionGapMs(prevZoomed: boolean, nextZoomed: boolean): number {
  return Math.max(0, PACE.betweenActionsMs - (prevZoomed ? PACE.zoomHoldMs : 0) - (nextZoomed ? PACE.zoomLeadMs : 0));
}

export function stepHoldMs(o: { actionsElapsedMs: number; narrationMs: number; holdMs?: number; dry: boolean }): number {
  if (o.dry) return 0;
  const minimum = o.holdMs ?? PACE.resultHoldMs;
  const untilNarrationEnds = o.narrationMs + PACE.narrationTailMs - o.actionsElapsedMs;
  return Math.max(minimum, untilNarrationEnds);
}

export function estimateNarrationMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round((words / 3) * 1000);
}
