// Smooth scrolling (Lenis), and nothing else. No text on this site animates
// in: every word is in place and sharp at first paint, with or without this
// file. Lenis only eases the wheel, so it loads on the visitor's first
// interaction (nothing competes with first paint, and a visitor who never
// scrolls never downloads it). Reduced motion skips it entirely.

const VENDOR = {"Lenis": "/assets/js/vendor/lenis.min.53195c9797.js"};
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

const load = (src) =>
  new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.append(s);
  });

async function boot() {
  await load(VENDOR.Lenis);
  // Lenis drives the real window scroll on its own frame loop
  const lenis = new window.Lenis({ duration: 1.1, easing: (t) => 1 - Math.pow(1 - t, 4), anchors: true, autoRaf: true });
  document.addEventListener('menu:open', () => lenis.stop());
  document.addEventListener('menu:close', () => lenis.start());
}

if (!reduced.matches) {
  const events = ['scroll', 'wheel', 'touchstart', 'pointerdown', 'keydown', 'pointermove'];
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    events.forEach((type) => removeEventListener(type, start, true));
    boot().catch(() => {}); // without it the page scrolls natively
  };
  events.forEach((type) => addEventListener(type, start, { capture: true, passive: true, once: true }));
}
