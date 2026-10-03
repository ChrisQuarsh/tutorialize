(() => {
  if (window.__tut) return;
  const state = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const SIZE = 44; // rendered cursor size in px (was 30)
  // Arrow tip is at (4, 2) in the 24-unit viewBox; scale it to the rendered size so the tip,
  // not the box corner, sits on the click point (and on the ripple centre).
  const TIP = { x: (4 * SIZE) / 24, y: (2 * SIZE) / 24 };

  function cursor() {
    let el = document.getElementById('__tut-cursor');
    if (!el) {
      el = document.createElement('div');
      el.id = '__tut-cursor';
      el.innerHTML =
        `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24"><path d="M4 2l16 9-7 2-3 7z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
      Object.assign(el.style, { position: 'fixed', left: '0', top: '0', zIndex: '2147483647', pointerEvents: 'none' });
      document.documentElement.appendChild(el);
    }
    el.style.transform = `translate(${state.x - TIP.x}px, ${state.y - TIP.y}px)`;
    return el;
  }

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  window.__tut = {
    moveTo(x, y, ms) {
      const el = cursor();
      const sx = state.x, sy = state.y, dx = x - sx, dy = y - sy;
      const cx = sx + dx / 2 - dy * 0.15, cy = sy + dy / 2 + dx * 0.15; // gentle arc
      return new Promise((resolve) => {
        const t0 = performance.now();
        const frame = (now) => {
          const t = Math.min(1, (now - t0) / ms), e = ease(t), u = 1 - e;
          const px = u * u * sx + 2 * u * e * cx + e * e * x;
          const py = u * u * sy + 2 * u * e * cy + e * e * y;
          el.style.transform = `translate(${px - TIP.x}px, ${py - TIP.y}px)`;
          if (t < 1) requestAnimationFrame(frame);
          else { state.x = x; state.y = y; resolve(); }
        };
        requestAnimationFrame(frame);
      });
    },
    ripple(x, y) {
      const r = document.createElement('div');
      Object.assign(r.style, {
        position: 'fixed', left: `${x - 20}px`, top: `${y - 20}px`, width: '40px', height: '40px',
        borderRadius: '50%', border: `3px solid ${window.__tutAccent || '#DF0A0A'}`, zIndex: '2147483646', pointerEvents: 'none',
        opacity: '0.9', transition: 'transform .5s ease-out, opacity .5s ease-out',
      });
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => { r.style.transform = 'scale(1.8)'; r.style.opacity = '0'; });
      setTimeout(() => r.remove(), 600);
    },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cursor);
  else cursor();
})();
