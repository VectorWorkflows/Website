// Cursor ring: a decorative ring that trails the pointer slightly and grows
// over things you can press. The native cursor is never hidden, so pointing
// stays exact even when this script is busy or never runs. Mouse-like
// pointers only, and only when motion is welcome. transform-only, one
// requestAnimationFrame loop that sleeps when settled.

const fine = matchMedia('(hover: hover) and (pointer: fine)');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

if (fine.matches && !reduced.matches) {
  const html = document.documentElement;
  const ring = document.createElement('div');
  ring.className = 'cursor cursor--ring';
  ring.setAttribute('aria-hidden', 'true');
  document.body.append(ring);
  const PRESSABLE = 'a[href], button, label, summary, select, [role="button"], input[type="checkbox"], input[type="radio"], [data-video-play]';
  const TEXT = 'input:not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]), textarea, [contenteditable="true"]';
  // Time constants (ms): the ring closes the gap at the same pace on any
  // display, whatever its refresh rate
  const TAU_MOVE = 67;
  const TAU_SCALE = 75;

  let x = -100, y = -100, rx = -100, ry = -100, scale = 1, target = 1, raf = 0, last = 0;

  const frame = (now) => {
    const dt = last ? Math.min(now - last, 100) : 1000 / 60; // clamp: no jump after a stall
    last = now;
    const move = 1 - Math.exp(-dt / TAU_MOVE);
    rx += (x - rx) * move;
    ry += (y - ry) * move;
    scale += (target - scale) * (1 - Math.exp(-dt / TAU_SCALE));
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) scale(${scale})`;
    const settled = Math.abs(x - rx) < 0.1 && Math.abs(y - ry) < 0.1 && Math.abs(target - scale) < 0.01;
    if (settled) last = 0;
    raf = settled ? 0 : requestAnimationFrame(frame);
  };
  const wake = () => { if (!raf) raf = requestAnimationFrame(frame); };

  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX;
    y = e.clientY;
    if (!html.classList.contains('cursor-in')) {
      rx = x; ry = y;
      html.classList.add('cursor-in');
    }
    wake();
  }, { passive: true });

  addEventListener('pointerover', (e) => {
    const el = e.target instanceof Element ? e.target : null;
    const onText = !!el?.closest(TEXT);
    html.classList.toggle('cursor-text', onText);
    const hot = !onText && !!el?.closest(PRESSABLE);
    html.classList.toggle('cursor-hot', hot);
    target = hot ? 1.7 : 1;
    wake();
  }, { passive: true });

  document.addEventListener('pointerleave', () => html.classList.remove('cursor-in'));
  addEventListener('pointerdown', () => html.classList.add('cursor-down'), { passive: true });
  addEventListener('pointerup', () => html.classList.remove('cursor-down'), { passive: true });
}
