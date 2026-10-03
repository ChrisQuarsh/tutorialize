import { expect, type Locator, type Page } from '@playwright/test';
import type { Action, Flow, Narration, Rect } from '../core/types.ts';
import type { TimelineBuilder } from '../core/timeline.ts';
import { PACE, actionGapMs, isZoomed, stepHoldMs, zoomGroupOf } from '../core/pacing.ts';
import { clipToViewport, typeInto, unionRect } from './helpers.ts';
import fs from 'node:fs';
import path from 'node:path';

/** A file in the project's assets folder, for an upload action. */
export function assetFile(assetsDir: string, file: string): string {
  const p = path.resolve(assetsDir, file);
  if (!fs.existsSync(p)) throw new Error(`Upload file not found: ${p} (put it in the project's assets folder)`);
  return p;
}

async function centerOf(target: Locator): Promise<{ x: number; y: number }> {
  const box = await target.boundingBox();
  if (!box) throw new Error(`Target has no bounding box: ${target}`);
  return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
}

/** On-screen rect of a visible target, clipped to the viewport; null if it is not on screen now. */
async function onScreenRect(page: Page, target: Locator): Promise<Rect | null> {
  if (!(await target.isVisible())) return null;
  const box = await target.boundingBox();
  const vp = page.viewportSize();
  if (!box || !vp) return null;
  const r = clipToViewport({ x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) }, vp);
  // Mostly off screen counts as not there yet: a crop aimed at it would show the wrong pixels.
  return r && r.width * r.height >= 0.5 * box.width * box.height ? r : null;
}

async function glideTo(page: Page, target: Locator): Promise<{ x: number; y: number }> {
  const { x, y } = await centerOf(target);
  await page.evaluate(([px, py, ms]) => (window as any).__tut.moveTo(px, py, ms), [x, y, PACE.cursorMoveMs] as const);
  await page.mouse.move(x, y);
  return { x, y };
}

async function zoomRect(page: Page, action: Action): Promise<Rect> {
  const targets = action.kind === 'expect' && action.zoomArea?.length ? action.zoomArea.map((l) => l(page)) : [action.target(page)];
  const rects: Rect[] = [];
  for (const t of targets) {
    await expect(t).toBeVisible();
    // A target cut by the viewport edge, or sitting in the caption band (bottom 18%), would be framed
    // badly: centre it first (scrolls every scrollable ancestor as far as it can; no-op for fixed toasts).
    const box = await t.boundingBox();
    const vp = page.viewportSize();
    if (box && vp && (box.y < 0 || box.x < 0 || box.y + box.height > 0.82 * vp.height || box.x + box.width > vp.width)) {
      await t.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
      await page.waitForTimeout(300);
    }
    const r = await onScreenRect(page, t);
    if (!r) throw new Error(`Zoom target is not on screen: ${t}`);
    rects.push(r);
  }
  return unionRect(rects);
}

/**
 * One action. A zoomed action opens a zoom window on its target (or zoomArea) before acting:
 * click/fill: rect -> zoom lead (zoom-in lands) -> glide + ripple + click -> short hold -> window ends.
 * expect: rect -> zoom lead -> reading time -> window ends; for the flow's final proof the window is
 * left open and closed at the end of the step, so the video ends zoomed on the proof.
 */
async function perform(page: Page, timeline: TimelineBuilder, action: Action, o: { dry: boolean; finalProof: boolean; assetsDir: string }): Promise<void> {
  const wait = (ms: number) => (o.dry ? Promise.resolve() : page.waitForTimeout(ms));
  const target = action.target(page);
  const zoomed = isZoomed(action);
  await expect(target).toBeVisible();
  await target.scrollIntoViewIfNeeded();
  if (zoomed) {
    const fit = action.kind === 'expect' && action.zoomArea?.length ? 0.9 : undefined;
    timeline.beginZoom(await zoomRect(page, action), fit, zoomGroupOf(action));
    await wait(PACE.zoomLeadMs);
  }
  if (action.kind === 'expect') {
    if (zoomed && !o.finalProof) {
      await wait(PACE.toastReadMs);
      timeline.endZoom();
    }
    return;
  }
  if (!o.dry) {
    const { x, y } = await glideTo(page, target);
    await page.evaluate(([px, py]) => (window as any).__tut.ripple(px, py), [x, y] as const);
  }
  if (action.kind === 'fill') await typeInto(target, action.text, o.dry ? 0 : PACE.typeDelayMs);
  else if (action.kind === 'select') await target.selectOption({ label: action.option });
  else if (action.kind === 'upload') await target.setInputFiles(assetFile(o.assetsDir, action.file));
  else await target.click();
  if (zoomed) {
    await wait(PACE.zoomHoldMs);
    timeline.endZoom();
  }
}

export async function runFlow(
  page: Page,
  flow: Flow,
  timeline: TimelineBuilder,
  opts: { dry: boolean; narration: Narration | null; assetsDir: string },
): Promise<void> {
  timeline.beginClip();
  for (const [si, step] of flow.steps.entries()) {
    timeline.beginStep(step);
    const started = Date.now();
    let finalOpen = false;
    for (const [i, action] of step.actions.entries()) {
      if (i > 0 && !opts.dry) await page.waitForTimeout(actionGapMs(isZoomed(step.actions[i - 1]), isZoomed(action)));
      const finalProof = si === flow.steps.length - 1 && i === step.actions.length - 1 && action.kind === 'expect' && isZoomed(action);
      await perform(page, timeline, action, { dry: opts.dry, finalProof, assetsDir: opts.assetsDir });
      finalOpen ||= finalProof;
    }
    const hold = stepHoldMs({
      actionsElapsedMs: Date.now() - started,
      narrationMs: opts.narration?.durations[step.id] ?? 0,
      holdMs: step.holdMs,
      dry: opts.dry,
    });
    if (hold > 0) await page.waitForTimeout(hold);
    if (finalOpen) timeline.endZoom();
    timeline.endStep();
  }
  timeline.endClip();
}
