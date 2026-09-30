// Custom cursor: a small dot plus a ring that trails slightly and grows over
// things you can press. Mouse-like pointers only, and only when motion is
// welcome. It turns itself on by adding html.has-cursor, so if this script
// never runs the normal cursor stays. Text fields keep the native I-beam.
// transform-only, one requestAnimationFrame loop that sleeps when settled.

const fine = matchMedia('(hover: hover) and (pointer: fine)');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

if (fine.matches && !reduced.matches) {
  const html = document.documentElement;
  const make = (cls) => {
    const el = document.createElement('div');
    el.className = cls;
    el.setAttribute('aria-hidden', 'true');
    document.body.append(el);
    return el;
  };
  const dot = make('cursor cursor--dot');
  const ring = make('cursor cursor--ring');
  const PRESSABLE = 'a[href], button, label, summary, select, [role="button"], input[type="checkbox"], input[type="radio"], [data-video-play]';
  const TEXT = 'input:not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]), textarea, [contenteditable="true"]';

  let x = -100, y = -100, rx = -100, ry = -100, scale = 1, target = 1, raf = 0;

  const frame = () => {
    rx += (x - rx) * 0.22;
    ry += (y - ry) * 0.22;
    scale += (target - scale) * 0.2;
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) scale(${scale})`;
    const settled = Math.abs(x - rx) < 0.1 && Math.abs(y - ry) < 0.1 && Math.abs(target - scale) < 0.01;
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

  html.classList.add('has-cursor');
}
