import { PACE, estimateNarrationMs, isZoomed } from './pacing.ts';
import type { Flow } from './types.ts';

// The house style, as checks. Fix a failure by changing the flow's text, never by relaxing a rule.
export const LIMITS = { captionWords: 6, narrationWords: 30, ceilingMs: 180_000 } as const;

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** Rough length of the finished video, from the narration estimate and the pacing constants. */
export function estimateFlowMs(flow: Flow): number {
  const stepMs = flow.steps.map((s) => Math.max(
    estimateNarrationMs(s.narration) + PACE.narrationTailMs,
    s.actions.length * (PACE.cursorMoveMs + PACE.betweenActionsMs) + PACE.resultHoldMs,
  ));
  return estimateNarrationMs(flow.intro) + 1500 + stepMs.reduce((a, b) => a + b, 0) + estimateNarrationMs(flow.outro) + 1500;
}

/** Every house-style problem in a flow; empty when it passes. */
export function lintFlow(flow: Flow): string[] {
  const problems: string[] = [];
  for (const key of ['title', 'intro', 'outro'] as const) if (!flow[key]?.trim()) problems.push(`${key} is empty`);
  if (!flow.steps?.length) return [...problems, 'has no steps'];

  const ids = flow.steps.map((s) => s.id);
  for (const id of ids) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) problems.push(`step id "${id}" is not kebab-case`);
    if (id === 'intro' || id === 'outro') problems.push(`step id "${id}" is reserved`);
  }
  if (new Set(ids).size !== ids.length) problems.push('step ids are not unique');

  for (const s of flow.steps) {
    if (words(s.caption) > LIMITS.captionWords) problems.push(`${s.id}: caption has ${words(s.caption)} words (max ${LIMITS.captionWords})`);
    if (!/^[A-Z]/.test(s.caption)) problems.push(`${s.id}: caption should start with a capital letter`);
    if (/[.!]$/.test(s.caption)) problems.push(`${s.id}: caption should not end with punctuation`);
    if (words(s.narration) > LIMITS.narrationWords) problems.push(`${s.id}: narration has ${words(s.narration)} words (max ${LIMITS.narrationWords})`);
    if (!s.actions.length) problems.push(`${s.id}: has no actions`);
  }

  const last = flow.steps.at(-1)!;
  if (!last.actions.some((a) => a.kind === 'expect' && isZoomed(a))) problems.push('the last step must end on proof: an expect with zoom or zoomArea');

  const ms = estimateFlowMs(flow);
  if (ms > LIMITS.ceilingMs) problems.push(`estimated ${Math.round(ms / 1000)} s is over the ${LIMITS.ceilingMs / 1000} s ceiling: split the task or shorten the narration`);
  return problems;
}
