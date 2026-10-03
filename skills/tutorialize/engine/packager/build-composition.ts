import type { Narration, Rect, Timeline, ZoomWindow } from '../core/types.ts';
import { PACE } from '../core/pacing.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sec = (ms: number) => Math.round(ms / 100) / 10; // 0.1 s precision
const round1 = (n: number) => Math.round(n * 10) / 10;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface ZoomTransform { scale: number; x: number; y: number }

/**
 * Scale (capped at 1.6x) and pan the recording toward the target, clamped so the frame never shows
 * outside the video. The caption bar sits bottom-centre (conservatively x 25–75%, y below 82%); if the
 * zoomed target would land behind it, pan up, then sideways, then zoom less, until it is clear.
 */
export interface CaptionBox { x0: number; x1: number; y0: number }

/** Where the caption bar sits for a given badge + caption (bottom-centre), with a 24 px margin.
 * Width is estimated from the CSS below: badge 26 px bold, text 40 px semibold. */
export function captionBox(badge: string, caption: string, W: number, H: number): CaptionBox {
  const width = (badge.length * 15 + 36) + 16 + (caption.length * 21.5 + 56);
  return { x0: W / 2 - width / 2 - 24, x1: W / 2 + width / 2 + 24, y0: 0.82 * H };
}

export function zoomTransform(r: Rect, W: number, H: number, fit = 0.6, capBox?: CaptionBox, scaleLimit = 1.6): ZoomTransform {
  const cap = capBox ?? { x0: 0.25 * W, x1: 0.75 * W, y0: 0.82 * H }; // conservative when the caption is unknown
  const place = (scale: number, tx: number, ty: number) => ({
    scale, x: Math.round(clamp(tx, W - scale * W, 0)), y: Math.round(clamp(ty, H - scale * H, 0)),
  });
  const ok = (t: ZoomTransform) => {
    const x0 = t.scale * r.x + t.x, x1 = t.scale * (r.x + r.width) + t.x;
    const y0 = t.scale * r.y + t.y, y1 = t.scale * (r.y + r.height) + t.y;
    const inFrame = x0 >= -1 && x1 <= W + 1 && y0 >= -1 && y1 <= H + 1;
    const underCaption = y1 > cap.y0 && x1 > cap.x0 && x0 < cap.x1;
    return inFrame && !underCaption;
  };
  const maxScale = round1(Math.min(1.6, scaleLimit, Math.max(1, Math.min((fit * W) / r.width, (fit * H) / r.height))));
  const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
  let first: ZoomTransform | null = null;
  for (let scale = maxScale; scale >= 1 - 1e-9; scale = round1(scale - 0.1)) {
    const centred = place(scale, W / 2 - scale * cx, 0.45 * H - scale * cy);
    first ??= centred;
    const candidates = [
      centred,
      place(scale, centred.x, cap.y0 - scale * (r.y + r.height)),   // pan up above the caption
      place(scale, cap.x0 - scale * (r.x + r.width), centred.y),     // pan so it sits left of the caption
      place(scale, cap.x1 - scale * r.x, centred.y),                 // ... or right of it
    ];
    const hit = candidates.find(ok);
    if (hit) return hit;
  }
  return first!; // nothing clears the caption (e.g. a target spanning the bottom row): keep the centred zoom
}

/** Two windows in a row stay zoomed (pan, no zoom-out between) when they share a group, or when the
 * next starts within PACE.chainGapMs of the previous one's end. */
const chained = (a: ZoomWindow, b: ZoomWindow) => (a.group !== undefined && a.group === b.group) || b.fromMs - a.toMs < PACE.chainGapMs;

/**
 * GSAP tweens for every zoom window: zoom in at a window's start, pan between chained windows, zoom
 * out after the last window of a chain. A run of same-group windows (a form being filled) shares one
 * zoom level, the lowest any of its targets needs, so moving between fields is a pure pan.
 */
export function zoomTweens(windows: (ZoomWindow & { cap?: CaptionBox })[], at: (ms: number) => number, W: number, H: number): string[] {
  const ws = [...windows].sort((a, b) => a.fromMs - b.fromMs);
  const zoomSec = PACE.zoomTweenMs / 1000, panSec = PACE.panTweenMs / 1000;
  // Shared scale per run of same-group windows.
  const limit = ws.map(() => 1.6);
  for (let i = 0; i < ws.length; ) {
    let j = i;
    while (ws[i].group !== undefined && j + 1 < ws.length && ws[j + 1].group === ws[i].group) j++;
    const s = Math.min(...ws.slice(i, j + 1).map((w) => zoomTransform(w.rect, W, H, w.fit, w.cap).scale));
    for (let k = i; k <= j; k++) limit[k] = s;
    i = j + 1;
  }
  const out: string[] = [];
  ws.forEach((w, i) => {
    const t = zoomTransform(w.rect, W, H, w.fit, w.cap, limit[i]);
    const tin = at(w.fromMs);
    const prev = ws[i - 1];
    const pan = prev !== undefined && chained(prev, w);
    out.push(pan
      ? `tl.to("#rec", { scale: ${t.scale}, x: ${t.x}, y: ${t.y}, transformOrigin: "0px 0px", duration: ${panSec}, ease: "power1.inOut" }, ${tin});`
      : `tl.to("#rec", { scale: ${t.scale}, x: ${t.x}, y: ${t.y}, transformOrigin: "0px 0px", duration: ${zoomSec}, ease: "sine.inOut" }, ${tin});`);
    const next = ws[i + 1];
    if (next && chained(w, next)) return; // stays zoomed: the next tween pans from here
    const tweenSec = pan ? panSec : zoomSec;
    out.push(`tl.to("#rec", { scale: 1, x: 0, y: 0, duration: ${zoomSec}, ease: "sine.inOut" }, ${round1(Math.max(at(w.toMs), tin + tweenSec))});`);
  });
  return out;
}

export function buildComposition(
  t: Timeline,
  n: Narration,
  o: { introMinSec?: number; outroMinSec?: number; brand?: { kicker: string; accent: string } } = {},
): { html: string; durationSec: number } {
  const { width: W, height: H } = t.viewport;
  const brand = o.brand ?? { kicker: 'Tutorial', accent: '#DF0A0A' };
  const accent = /^[#\w(),.%\s-]+$/.test(brand.accent) ? brand.accent : '#DF0A0A'; // goes into CSS: keep it a plain colour
  const intro = round1(Math.max(o.introMinSec ?? 3.5, sec(n.durations.intro ?? 0) + 1.0));
  const clip = sec(t.clipEndMs - t.clipStartMs);
  const outro = round1(Math.max(o.outroMinSec ?? 4, sec(n.durations.outro ?? 0) + 1.5));
  const total = round1(intro + clip + outro);
  const outroStart = round1(intro + clip);
  const at = (ms: number) => round1(intro + sec(ms - t.clipStartMs));

  const captions: string[] = [];
  const audio: string[] = !n.voiced ? [] : [
    `<audio id="vo-intro" src="assets/audio/intro.wav" data-start="0.3" data-track-index="3" data-volume="1"></audio>`,
    `<audio id="vo-outro" src="assets/audio/outro.wav" data-start="${round1(outroStart + 0.3)}" data-track-index="3" data-volume="1"></audio>`,
  ];

  t.steps.forEach((s, i) => {
    // Start and end both come from rounded absolute times so neighbouring captions tile exactly.
    const start = at(s.startMs);
    const end = at(s.endMs);
    const dur = round1(end - start);
    captions.push(
      `<div id="cap-${s.id}" class="clip caption" data-start="${start}" data-duration="${dur}" data-track-index="2">` +
        `<span class="badge">Step ${i + 1} of ${t.steps.length}</span><span class="text">${esc(s.caption)}</span></div>`,
    );
    if (n.voiced) audio.push(
      `<audio id="vo-${s.id}" src="assets/audio/${s.id}.wav" data-start="${start}" data-track-index="3" data-volume="1"></audio>`,
    );
  });

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${W}, height=${H}" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
  body { margin: 0; background: #111; font-family: Inter, "Segoe UI", system-ui, sans-serif; }
  #root { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; background: #111; }
  .clip { position: absolute; inset: 0; }
  .card { display: grid; place-content: center; justify-items: center; text-align: center; background: #fff; color: #111; }
  .card .kicker { color: ${accent}; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; font-size: 28px; }
  .card h1 { font-size: 84px; margin: 16px auto 0; max-width: ${Math.round(W * 0.73)}px; line-height: 1.1; }
  .card p { font-size: 36px; color: #444; margin: 28px auto 0; max-width: ${Math.round(W * 0.73)}px; }
  #rec { width: ${W}px; height: ${H}px; object-fit: cover; }
  .caption { inset: auto 0 64px 0; display: flex; justify-content: center; gap: 16px; align-items: center; }
  .caption .badge { background: ${accent}; color: #fff; font-weight: 700; font-size: 26px; padding: 10px 18px; border-radius: 999px; }
  .caption .text { background: rgba(17,17,17,.88); color: #fff; font-size: 40px; font-weight: 600; padding: 14px 28px; border-radius: 14px; }
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="${W}" data-height="${H}">
  <section id="title-card" class="clip card" data-start="0" data-duration="${intro}" data-track-index="1">
    <div class="kicker">${esc(brand.kicker)}</div>
    <h1 id="title">${esc(t.title)}</h1>
  </section>
  <video id="rec" src="assets/raw.mp4" muted data-start="${intro}" data-duration="${clip}" data-media-start="${sec(t.clipStartMs)}" data-track-index="0"></video>
  ${captions.join('\n  ')}
  <section id="end-card" class="clip card" data-start="${outroStart}" data-duration="${outro}" data-track-index="1">
    <div class="kicker">Done ✓</div>
    <h1>${esc(t.title.replace(/^How to /i, '').replace(/^./, (c) => c.toUpperCase()))}</h1>
    <p>${esc(t.outro)}</p>
  </section>
  ${audio.join('\n  ')}
</div>
<script>
  window.__timelines = window.__timelines || {};
  const tl = gsap.timeline({ paused: true });
  tl.fromTo("#title", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, 0.2);
  ${zoomTweens(t.steps.flatMap((s, i) => (s.zooms ?? []).map((z) => ({ ...z, cap: captionBox(`Step ${i + 1} of ${t.steps.length}`, s.caption, W, H) }))), at, W, H).join('\n  ')}
  window.__timelines.main = tl;
</script>
</body>
</html>
`;
  return { html, durationSec: total };
}
