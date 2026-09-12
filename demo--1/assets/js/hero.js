/* ==========================================================================
   HERO — the photographic plate
   ---------------------------------------------------------------------------
   A full-height column of the salon's own work, sitting behind the headline.
   No generative background: the photographs are the asset, so they carry it.

     · the plate rises on load, the image settling out of a slow push-in
     · each image drifts continuously, so it is never a static crop
     · plates cross-dissolve every few seconds, the incoming one already moving
     · scrolling pulls the plate at a different rate to the type, and deepens
       the scrim over it

   Everything is transform and opacity, so it stays on the compositor. Under
   prefers-reduced-motion it settles to a single still frame and stops.
   ========================================================================== */
(function () {
  'use strict';

  var stage = document.querySelector('.hero__stage');
  if (!stage) return;

  var hero = document.querySelector('.hero');
  var slides = Array.prototype.slice.call(stage.querySelectorAll('.hero__slide'));
  if (!slides.length) return;

  var idxEl = document.querySelector('[data-hero-index]');
  var barEl = document.querySelector('[data-hero-bar]');
  var capEl = document.querySelector('[data-hero-cap]');

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var HOLD = 6500;              // default ms a plate is held
  var holdNow = HOLD;           // the current plate's own hold
  var current = 0;
  var timer = null;
  var startedAt = 0;
  var rafId = null;

  /* --------------------------------------------------------------- advance */
  function paint(i) {
    slides.forEach(function (s, n) {
      s.classList.toggle('is-on', n === i);
      // the outgoing plate keeps drifting, so the change never reads as a cut
      s.classList.toggle('is-out', n === current && n !== i);
    });
    if (idxEl) idxEl.textContent = ('0' + (i + 1)).slice(-2);
    if (capEl) capEl.textContent = slides[i].getAttribute('data-cap') || '';
    current = i;
    // a plate can ask to be held longer than the rest — some photographs
    // simply earn more time on screen than others
    holdNow = parseInt(slides[i].getAttribute('data-hold'), 10) || HOLD;
    startedAt = performance.now();
  }

  function next() { paint((current + 1) % slides.length); }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(function () { next(); schedule(); }, holdNow);
  }

  function play() {
    if (REDUCED || slides.length < 2) return;
    stop();
    startedAt = performance.now();
    schedule();
    if (barEl && rafId === null) rafId = requestAnimationFrame(tickBar);
  }
  function stop() {
    if (timer) { clearTimeout(timer); timer = null; }
  }

  function tickBar(now) {
    if (barEl) {
      var k = timer ? Math.min((now - startedAt) / holdNow, 1) : 0;
      barEl.style.transform = 'scaleX(' + k.toFixed(4) + ')';
    }
    rafId = requestAnimationFrame(tickBar);
  }

  /* --------------------------------------------------------------- parallax */
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      if (!hero) return;
      var y = window.pageYOffset;
      var h = hero.offsetHeight || 1;
      if (y > h * 1.2) return;                  // stop working once it's gone
      var k = Math.min(y / h, 1);
      // the plate lags the page, and the scrim deepens over it
      stage.style.transform = 'translate3d(0,' + (y * 0.16).toFixed(1) + 'px,0) scale(' + (1 + k * 0.06).toFixed(4) + ')';
      stage.style.setProperty('--scrim', (k * 0.55).toFixed(3));
    });
  }

  /* ------------------------------------------------------------------- init */
  function init() {
    // decode the first plate before revealing, so it never flashes in empty
    var first = slides[0].querySelector('img');
    function reveal() {
      stage.classList.add('is-ready');
      paint(0);
      if (!REDUCED) play();
    }
    if (first && first.decode) first.decode().then(reveal).catch(reveal);
    else if (first && first.complete) reveal();
    else if (first) { first.addEventListener('load', reveal); first.addEventListener('error', reveal); }
    else reveal();

    // bring the rest in quietly once the page is settled
    window.addEventListener('load', function () {
      slides.slice(1).forEach(function (s) {
        var im = s.querySelector('img');
        if (im && im.getAttribute('loading') === 'lazy') im.setAttribute('loading', 'eager');
      });
    });

    if (!REDUCED) {
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
  }

  /* pause when it isn't being looked at */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else if (!REDUCED) play();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      if (en[0].isIntersecting) { if (!REDUCED) play(); } else stop();
    }, { threshold: 0.05 }).observe(stage);
  }

  /* let people step through them */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-hero-next]');
    if (!b) return;
    next();
    if (!REDUCED) play();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
