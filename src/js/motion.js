// Site motion: Lenis smooth scroll + GSAP ScrollTrigger reveals + SplitText
// display reveals + the systems-index preview.
//
// Nothing here is needed to read the site. The libraries load on demand
// (after first paint), only when motion is welcome. Reduced motion skips
// the lot: no Lenis, no hidden states, everything already in place.

const VENDOR = __VENDOR_MAP__;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

const load = (src) =>
  new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false; // keep execution order: gsap before its plugins
    s.onload = resolve;
    s.onerror = reject;
    document.head.append(s);
  });

async function boot() {
  await Promise.all([load(VENDOR.gsap), load(VENDOR.ScrollTrigger), load(VENDOR.SplitText), load(VENDOR.Lenis)]);
  const { gsap, ScrollTrigger, SplitText, Lenis } = window;
  gsap.registerPlugin(ScrollTrigger, SplitText);

  // Lenis drives the real window scroll, so ScrollTrigger needs no
  // scrollerProxy: we feed it Lenis's scroll events and run Lenis from
  // GSAP's ticker, keeping one clock for both (pins never desync).
  const lenis = new Lenis({ duration: 1.1, easing: (t) => 1 - Math.pow(1 - t, 4), anchors: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  document.addEventListener('menu:open', () => lenis.stop());
  document.addEventListener('menu:close', () => lenis.start());

  // Motion boots on first interaction, so anything already on screen by then
  // has been seen: leave it alone rather than hide and re-reveal it.
  const unseen = (el) => el.getBoundingClientRect().top > innerHeight * 0.92;

  // Section reveals: a heavy fade-up, once
  gsap.utils.toArray('[data-reveal]').filter(unseen).forEach((el) => {
    gsap.from(el, {
      y: 48,
      opacity: 0,
      duration: 1.1,
      ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });
  gsap.utils.toArray('[data-reveal-group]').filter(unseen).forEach((group) => {
    gsap.from(group.children, {
      y: 40,
      opacity: 0,
      duration: 1,
      ease: 'expo.out',
      stagger: 0.08,
      scrollTrigger: { trigger: group, start: 'top 85%', once: true },
    });
  });

  // Display headings: masked line reveal. autoSplit re-splits when fonts
  // land or the width changes, so lines stay true to the real typeface.
  gsap.utils.toArray('[data-split]').filter(unseen).forEach((el) => {
    SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.lines, {
          yPercent: 110,
          duration: 1.15,
          ease: 'expo.out',
          stagger: 0.09,
          scrollTrigger: { trigger: el, start: 'top 86%', once: true },
        }),
    });
  });

  // Systems index: a preview card that trails the pointer (desktop only)
  document.querySelectorAll('[data-preview-list]').forEach((list) => {
    const card = list.parentElement.querySelector('[data-preview]');
    if (!card || !finePointer.matches) return;
    const x = gsap.quickTo(card, 'x', { duration: 0.6, ease: 'power3.out' });
    const y = gsap.quickTo(card, 'y', { duration: 0.6, ease: 'power3.out' });
    const body = card.querySelector('[data-preview-body]');
    list.addEventListener('pointermove', (e) => {
      const r = list.getBoundingClientRect();
      x(e.clientX - r.left);
      y(e.clientY - r.top);
    });
    list.querySelectorAll('[data-preview-text]').forEach((row) => {
      row.addEventListener('pointerenter', () => {
        body.textContent = row.dataset.previewText;
        card.classList.add('is-on');
      });
    });
    list.addEventListener('pointerleave', () => card.classList.remove('is-on'));
  });

  // Re-measure once web fonts settle so trigger positions are exact
  document.fonts?.ready.then(() => ScrollTrigger.refresh());

  // Sections use content-visibility: auto and render at their true height as
  // they approach; refresh trigger positions when any of them resizes.
  let refreshTimer = 0;
  const ro = new ResizeObserver(() => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 120);
  });
  document.querySelectorAll('main > section').forEach((s) => ro.observe(s));
}

if (!reduced.matches) {
  // Every effect here is scroll- or pointer-driven, so the libraries load on
  // the visitor's first interaction: zero motion JS competes with first
  // paint, and a visitor who never scrolls never downloads it.
  const events = ['scroll', 'wheel', 'touchstart', 'pointerdown', 'keydown', 'pointermove'];
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    events.forEach((type) => removeEventListener(type, start, true));
    boot().catch(() => document.documentElement.classList.add('no-motion'));
  };
  events.forEach((type) => addEventListener(type, start, { capture: true, passive: true, once: true }));
}
