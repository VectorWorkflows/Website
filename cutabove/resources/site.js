/* ===== app.js ===== */
/* ==========================================================================
   CUT ABOVE — CORE
   Preloader · cursor · nav · reveal · magnetics · chrome · page transitions
   Vanilla, no dependencies, runs from file://
   ========================================================================== */
(function () {
  'use strict';

  var D = document;
  var $  = function (s, c) { return (c || D).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || D).querySelectorAll(s)); };
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  window.CAUtil = { $: $, $$: $$, REDUCED: REDUCED, FINE: FINE };

  /* =================================================== 1. PRELOADER ==== */
  function preloader() {
    var el = $('.preload');
    if (!el) return;
    var bar = $('.preload__bar i', el);
    var pct = $('.preload__pct', el);
    var p = 0;
    var done = false;

    function finish() {
      if (done) return;
      done = true;
      p = 100;
      if (bar) bar.style.right = '0%';
      if (pct) pct.textContent = '100';
      setTimeout(function () {
        el.classList.add('is-done');
        D.body.classList.remove('is-locked');
        D.documentElement.classList.add('is-loaded');
        // kick the first reveals now that the veil is gone
        window.dispatchEvent(new Event('ca:ready'));
      }, 380);
    }

    D.body.classList.add('is-locked');
    var tick = setInterval(function () {
      p += Math.random() * 16 + 4;
      if (p >= 96) p = 96;
      if (bar) bar.style.right = (100 - p) + '%';
      if (pct) pct.textContent = String(Math.floor(p));
    }, 130);

    function ready() { clearInterval(tick); finish(); }
    if (D.readyState === 'complete') setTimeout(ready, 420);
    else window.addEventListener('load', function () { setTimeout(ready, 320); });
    // hard ceiling — never trap the user behind the veil
    setTimeout(ready, 3600);
  }

  /* ==================================================== 2. CURSOR ====== */
  function cursor() {
    if (!FINE || REDUCED) return;
    var dot = D.createElement('div'); dot.className = 'cursor';
    var ring = D.createElement('div'); ring.className = 'cursor-ring';
    var lab = D.createElement('span'); lab.className = 'cursor-ring__label';
    ring.appendChild(lab);
    D.body.appendChild(dot); D.body.appendChild(ring);
    // the native cursor is hidden only once ours is actually on screen, so a
    // failure here can never leave the page with no pointer at all
    D.documentElement.classList.add('has-cursor');

    var mx = window.innerWidth / 2, my = window.innerHeight / 2;
    var rx = mx, ry = my;

    D.addEventListener('mousemove', function (e) { mx = e.clientX; my = e.clientY; }, { passive: true });
    D.addEventListener('mouseleave', function () { D.body.classList.add('cur-hidden'); });
    D.addEventListener('mouseenter', function () { D.body.classList.remove('cur-hidden'); });

    (function loop() {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
      ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
      requestAnimationFrame(loop);
    })();

    function bind(root) {
      $$('a, button, .tab, .opt, input, select, textarea, [data-cursor]', root).forEach(function (el) {
        if (el.__curBound) return;
        el.__curBound = true;
        var mode = el.getAttribute('data-cursor');
        var isText = /^(INPUT|TEXTAREA)$/.test(el.tagName) &&
                     !/^(checkbox|radio|button|submit|range)$/i.test(el.type || '');
        el.addEventListener('mouseenter', function () {
          if (isText) D.body.classList.add('cur-text');
          else if (mode) { D.body.classList.add('cur-view'); lab.textContent = mode; }
          else D.body.classList.add('cur-link');
        });
        el.addEventListener('mouseleave', function () {
          D.body.classList.remove('cur-link', 'cur-view', 'cur-text');
        });
      });
    }
    bind(D);
    window.addEventListener('ca:rebind', function (e) { bind((e.detail && e.detail.root) || D); });
  }

  /* ================================================= 3. MAGNETIC ======= */
  function magnetic() {
    if (!FINE || REDUCED) return;
    $$('[data-magnet]').forEach(function (el) {
      var strength = parseFloat(el.getAttribute('data-magnet')) || 0.28;
      el.style.transition = 'transform 0.5s cubic-bezier(0.16,1,0.3,1)';
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * strength;
        var y = (e.clientY - r.top - r.height / 2) * strength;
        el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
      });
      el.addEventListener('mouseleave', function () { el.style.transform = ''; });
    });
  }

  /* ==================================================== 4. NAV ========= */
  function nav() {
    var el = $('.nav');
    var bar = $('.topbar');
    if (!el) return;
    var last = 0;

    // publish the real chrome height so the hero / page heads clear it
    function measure() {
      var h = (bar || el).getBoundingClientRect().height;
      D.documentElement.style.setProperty('--top-h', Math.round(h) + 'px');
    }
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);

    function onScroll() {
      var y = window.pageYOffset;
      var stuck = y > 24;
      el.classList.toggle('is-stuck', stuck);
      if (bar) bar.classList.toggle('is-stuck', stuck);
      var target = bar || el;
      if (y > 420 && y > last + 4) target.classList.add('is-hidden');
      else if (y < last - 4 || y < 200) target.classList.remove('is-hidden');
      last = y;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // mark current page
    var here = location.pathname.split('/').pop() || 'index.html';
    $$('.nav__link, .menu__list a').forEach(function (a) {
      var href = (a.getAttribute('href') || '').split('/').pop();
      if (href && href === here) a.classList.add('is-current');
    });
  }

  /* =================================================== 5. MENU ========= */
  function menu() {
    var btn = $('.burger');
    var panel = $('.menu');
    if (!btn || !panel) return;
    var items = $$('.menu__list a', panel);
    items.forEach(function (a, i) { a.style.setProperty('--rd', (80 + i * 70) + 'ms'); });

    function set(open) {
      btn.classList.toggle('is-open', open);
      panel.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      D.body.classList.toggle('is-locked', open);
    }
    btn.addEventListener('click', function () { set(!panel.classList.contains('is-open')); });
    panel.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
    D.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
  }

  /* ================================================== 6. REVEAL ======== */
  function reveal() {
    var targets = $$('[data-reveal], .rv-img, .rv-line');
    if (!targets.length) return;

    if (REDUCED || !('IntersectionObserver' in window)) {
      targets.forEach(function (t) { t.classList.add('is-in'); });
      return;
    }

    // stagger children of any [data-stagger] container
    $$('[data-stagger]').forEach(function (c) {
      var step = parseInt(c.getAttribute('data-stagger'), 10) || 90;
      Array.prototype.forEach.call(c.children, function (child, i) {
        child.style.setProperty('--rd', (i * step) + 'ms');
      });
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    targets.forEach(function (t) { io.observe(t); });
    window.__caReveal = io;
  }
  // let later-injected DOM opt in
  window.caObserve = function (root) {
    var io = window.__caReveal;
    var list = $$('[data-reveal], .rv-img, .rv-line', root || D);
    if (!io) { list.forEach(function (t) { t.classList.add('is-in'); }); return; }
    list.forEach(function (t) { io.observe(t); });
  };

  /* ============================================== 7. SPLIT HEADLINES === */
  /* Wraps each line of [data-split] in a masked span for the line reveal */
  function splitLines() {
    $$('[data-split]').forEach(function (el) {
      if (el.__split) return;
      el.__split = true;
      var parts = el.innerHTML.split(/<br\s*\/?>/i);
      el.innerHTML = parts.map(function (p, i) {
        return '<span class="rv-line" style="--rd:' + (i * 110) + 'ms"><span>' + p + '</span></span>';
      }).join('');
    });
  }

  /* ================================================== 8. COUNTERS ====== */
  function counters() {
    var els = $$('[data-count]');
    if (!els.length) return;
    if (REDUCED || !('IntersectionObserver' in window)) {
      els.forEach(function (e) { e.textContent = e.getAttribute('data-count'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        io.unobserve(el);
        var target = parseFloat(el.getAttribute('data-count')) || 0;
        var dur = 1500, t0 = null;
        function step(ts) {
          if (!t0) t0 = ts;
          var k = Math.min((ts - t0) / dur, 1);
          var eased = 1 - Math.pow(1 - k, 3);
          el.textContent = Math.round(target * eased).toLocaleString();
          if (k < 1) requestAnimationFrame(step);
          else el.textContent = target.toLocaleString();
        }
        requestAnimationFrame(step);
      });
    }, { threshold: 0.4 });
    els.forEach(function (e) { io.observe(e); });
  }

  /* ============================================== 9. TESTIMONIALS ====== */
  function testimonials() {
    var wrap = $('[data-testi]');
    if (!wrap || !window.CA || !CA.testimonials) return;
    var items = CA.testimonials;
    wrap.innerHTML = items.map(function (t, i) {
      return '<figure class="testi__item' + (i === 0 ? ' is-on' : '') + '">' +
        '<blockquote class="quote">“' + t.q + '”</blockquote>' +
        '<figcaption class="testi__who">' + t.n + ' — ' + t.c + '</figcaption>' +
        '</figure>';
    }).join('');

    var dots = $('[data-testi-dots]');
    if (dots) {
      dots.innerHTML = items.map(function (_, i) {
        return '<button class="testi__dot' + (i === 0 ? ' is-on' : '') + '" aria-label="Testimonial ' + (i + 1) + '"></button>';
      }).join('');
    }
    var figs = $$('.testi__item', wrap);
    var btns = dots ? $$('.testi__dot', dots) : [];
    var idx = 0, timer;

    function go(n) {
      idx = (n + figs.length) % figs.length;
      figs.forEach(function (f, i) { f.classList.toggle('is-on', i === idx); });
      btns.forEach(function (b, i) { b.classList.toggle('is-on', i === idx); });
    }
    btns.forEach(function (b, i) {
      b.addEventListener('click', function () { go(i); restart(); });
    });
    function fit() {
      var max = 0;
      figs.forEach(function (f) { max = Math.max(max, f.scrollHeight); });
      if (max) wrap.style.minHeight = max + 'px';
    }
    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('load', fit);
    if (D.fonts && D.fonts.ready && D.fonts.ready.then) D.fonts.ready.then(fit);

    function restart() { clearInterval(timer); if (!REDUCED) timer = setInterval(function () { go(idx + 1); }, 6500); }
    restart();
    window.dispatchEvent(new CustomEvent('ca:rebind', { detail: { root: wrap } }));
  }

  /* ================================================ 10. OPEN STATUS ==== */
  /* The salon is in Dubai. A viewer in London must still see Dubai's clock,
     so the current time is read in Asia/Dubai rather than the local zone.  */
  var DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  function dubaiNow() {
    try {
      var parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Dubai', weekday: 'long',
        hour: '2-digit', minute: '2-digit', hour12: false
      }).formatToParts(new Date());
      var o = {};
      parts.forEach(function (x) { o[x.type] = x.value; });
      var h = parseInt(o.hour, 10) % 24;
      return { day: o.weekday, mins: h * 60 + parseInt(o.minute, 10), exact: true };
    } catch (e) {
      var d = new Date();                       // very old browser — local time
      return { day: DAYS[d.getDay()], mins: d.getHours() * 60 + d.getMinutes(), exact: false };
    }
  }

  function toMins(hhmm) {
    var p = hhmm.split(':');
    return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  }
  function human(mins) {
    if (mins < 60) return 'in ' + mins + ' min';
    var h = Math.floor(mins / 60), m = mins % 60;
    if (h >= 24) return null;
    return 'in ' + h + (m >= 30 ? '½' : '') + (h === 1 && m < 30 ? ' hour' : ' hours');
  }

  function hours() {
    if (!window.CA || !CA.biz) return;
    var now = dubaiNow();
    var byDay = {};
    CA.biz.hours.forEach(function (h) { byDay[h.d] = h; });
    var today = byDay[now.day];

    /* opening-hours list, today highlighted --------------------------------- */
    $$('[data-hours]').forEach(function (list) {
      list.innerHTML = CA.biz.hours.map(function (h) {
        return '<div class="hours-row' + (h.d === now.day ? ' is-today' : '') + '">' +
          '<dt>' + h.d + '</dt><dd>' + h.o + ' — ' + h.c + '</dd></div>';
      }).join('');
    });

    /* open / closed, with a countdown when shut ----------------------------- */
    var isOpen = false, label;
    if (today && now.mins >= toMins(today.o) && now.mins < toMins(today.c)) {
      isOpen = true;
      var left = toMins(today.c) - now.mins;
      label = left <= 60
        ? 'Closing in ' + left + ' min'
        : 'Open now — until ' + today.c;
    } else {
      // find the next opening, scanning forward from today
      var idx = DAYS.indexOf(now.day), wait = null, when = null;
      for (var i = 0; i < 8; i++) {
        var d = byDay[DAYS[(idx + i) % 7]];
        if (!d) continue;
        var mins = i * 1440 + toMins(d.o) - now.mins;
        if (mins > 0) { wait = mins; when = d; break; }
      }
      if (wait === null) label = 'Closed';
      else {
        var h = human(wait);
        label = h ? 'Closed — opens ' + h
                  : 'Closed — opens ' + (wait < 2880 ? 'tomorrow' : DAYS[(idx + Math.ceil(wait / 1440)) % 7]) +
                    ' at ' + when.o;
      }
    }

    var addr = CA.biz.address1 + '<br>' + CA.biz.address2;
    $$('[data-open-pill]').forEach(function (p) {
      p.classList.toggle('is-open', isOpen);
      p.setAttribute('tabindex', '0');
      p.setAttribute('role', 'button');
      p.setAttribute('aria-label', label + '. Show directions.');
      p.innerHTML =
        '<i></i><span>' + label + '</span>' +
        '<span class="pill__pop" role="tooltip">' +
          '<b>' + CA.biz.full + '</b>' +
          '<span class="pill__addr">' + addr + '</span>' +
          '<span class="pill__tz">Dubai time' + (now.exact ? '' : ' (approx.)') + ' · GST</span>' +
          '<a class="pill__dir" href="' + CA.biz.mapsLink + '" target="_blank" rel="noopener">' +
            'Get directions' +
            '<svg width="12" height="12" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M1 6.5h10M7 2.5l4 4-4 4"/></svg>' +
          '</a>' +
        '</span>';
      // touch: tap toggles the popover instead of relying on hover
      p.addEventListener('click', function (e) {
        if (e.target.closest('.pill__dir')) return;
        p.classList.toggle('is-showing');
      });
      p.addEventListener('blur', function () { p.classList.remove('is-showing'); });
    });
  }

  /* ============================================ 11. PAGE TRANSITIONS === */
  function transitions() {
    if (REDUCED) return;
    var wipe = D.createElement('div');
    wipe.className = 'wipe';
    D.body.appendChild(wipe);

    // entrance
    requestAnimationFrame(function () { wipe.classList.add('is-in'); });

    D.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href || a.target === '_blank' || a.hasAttribute('download')) return;
      if (href.charAt(0) === '#' || /^(mailto:|tel:|https?:\/\/|javascript:)/i.test(href)) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;

      e.preventDefault();
      wipe.classList.remove('is-in');
      wipe.classList.add('is-out');
      setTimeout(function () { location.href = href; }, 520);
    });

    // restore on bfcache back-nav
    window.addEventListener('pageshow', function (ev) {
      if (ev.persisted) { wipe.classList.remove('is-out'); wipe.classList.add('is-in'); }
    });
  }

  /* ================================================ 12. BACK TO TOP ==== */
  function toTop() {
    var b = $('.totop');
    if (!b) return;
    window.addEventListener('scroll', function () {
      b.classList.toggle('is-on', window.pageYOffset > window.innerHeight * 0.9);
    }, { passive: true });
    b.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
    });
  }

  /* =============================================== 13. IMAGE FALLBACK == */
  /* Any <img data-ph="Label"> that fails to load is swapped for an
     art-directed placeholder rather than a broken-image icon.            */
  function imageFallback() {
    function handle(img) {
      if (img.__phDone) return;
      img.__phDone = true;
      var alt = img.getAttribute('data-ph') || img.getAttribute('alt') || 'Cut Above';
      var sub = img.getAttribute('data-ph-sub') || 'Photography to follow';
      var alt2 = img.getAttribute('data-fallback');
      if (alt2 && img.src.indexOf(alt2) === -1) { img.__phDone = false; img.src = alt2; return; }
      var ph = D.createElement('div');
      ph.className = 'ph';
      ph.innerHTML = '<div><div class="ph__mark">' + alt + '</div><div class="ph__sub">' + sub + '</div></div>';
      var host = img.parentNode;
      if (host) { host.replaceChild(ph, img); if (host.classList) host.classList.add('is-in'); }
    }
    $$('img').forEach(function (img) {
      if (img.hasAttribute('data-no-ph')) return;
      img.addEventListener('error', function () { handle(img); });
      if (img.complete && img.naturalWidth === 0) handle(img);
    });
  }
  window.caImageFallback = imageFallback;

  /* ================================================== 14. YEAR ========= */
  function chrome() {
    if (!window.CA || !CA.biz) return;
    var yrs = new Date().getFullYear() - CA.biz.founded;
    $$('[data-year]').forEach(function (e) { e.textContent = new Date().getFullYear(); });
    $$('[data-years-open]').forEach(function (e) { e.textContent = yrs; });
    $$('[data-biz-phone]').forEach(function (e) { e.textContent = CA.biz.phone; e.href = 'tel:' + CA.biz.phoneHref; });
    $$('[data-biz-wa]').forEach(function (e) {
      e.textContent = CA.biz.whatsapp;
      e.href = 'https://wa.me/' + CA.biz.whatsappHref;
    });
    $$('[data-biz-email]').forEach(function (e) { e.textContent = CA.biz.email; e.href = 'mailto:' + CA.biz.email; });
    $$('[data-biz-ig]').forEach(function (e) { e.href = CA.biz.instagram; });
    $$('[data-biz-fb]').forEach(function (e) { e.href = CA.biz.facebook; });

  }

  /* ================================================== 15. SWATCH ======= */
  /* Monochrome plates that lift to reveal the colour underneath. Hover and
     keyboard focus are handled in CSS; this adds tap for touch screens.   */
  function swatch() {
    $$('.swatch').forEach(function (el) {
      el.addEventListener('click', function () { el.classList.toggle('is-on'); });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.classList.toggle('is-on'); }
      });
      el.addEventListener('mouseleave', function () { el.classList.remove('is-on'); });
    });
  }

  /* =================================================== 16. PARALLAX ==== */
  function parallax() {
    if (REDUCED) return;
    var els = $$('[data-para]');
    if (!els.length) return;
    var ticking = false;
    function run() {
      var vh = window.innerHeight;
      els.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        var amt = parseFloat(el.getAttribute('data-para')) || 0.08;
        var mid = r.top + r.height / 2 - vh / 2;
        el.style.transform = 'translate3d(0,' + (-mid * amt).toFixed(2) + 'px,0)';
      });
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(run); }
    }, { passive: true });
    window.addEventListener('resize', run);
    run();
  }

  /* =================================================== BOOT =========== */
  function boot() {
    splitLines();
    preloader();
    cursor();
    nav();
    menu();
    reveal();
    magnetic();
    counters();
    testimonials();
    hours();
    chrome();
    toTop();
    swatch();
    parallax();
    imageFallback();
    transitions();
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot);
  else boot();
})();


/* ===== hero.js ===== */
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


/* ===== pricing.js ===== */
/* ==========================================================================
   PRICE LIST — tabbed groups, live search, deep-linkable (#hair, #skin…)
   ========================================================================== */
(function () {
  'use strict';
  var root = document.querySelector('[data-price-root]');
  if (!root || !window.CA || !CA.services) return;

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var tabsEl   = $('[data-price-tabs]');
  var searchEl = $('[data-price-search]');
  var countEl  = $('[data-price-count]');
  var groups   = CA.services;
  var active   = 0;
  var query    = '';

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function mark(text, q) {
    if (!q) return esc(text);
    var t = esc(text);
    var re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
    return t.replace(re, '<mark>$1</mark>');
  }

  /* ---------------------------------------------------------------- tabs */
  function buildTabs() {
    if (!tabsEl) return;
    tabsEl.innerHTML = groups.map(function (g, i) {
      return '<button class="tab' + (i === 0 ? ' is-on' : '') + '" data-tab="' + i + '">' + esc(g.group) + '</button>';
    }).join('');
    tabsEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tab]');
      if (!b) return;
      active = parseInt(b.getAttribute('data-tab'), 10);
      history.replaceState(null, '', '#' + groups[active].group.toLowerCase());
      render();
      var top = root.getBoundingClientRect().top + window.pageYOffset - 190;
      window.scrollTo({ top: top, behavior: CAUtil.REDUCED ? 'auto' : 'smooth' });
    });
  }

  /* -------------------------------------------------------------- render */
  function render() {
    var q = query.trim().toLowerCase();
    var shown = 0;
    var html = '';
    // when searching, look across every group; otherwise show the active tab
    var scope = q ? groups : [groups[active]];

    scope.forEach(function (g) {
      g.cats.forEach(function (cat) {
        var items = cat.items.filter(function (it) {
          if (!q) return true;
          return (it[0] + ' ' + (it[2] || '') + ' ' + cat.name + ' ' + g.group).toLowerCase().indexOf(q) > -1;
        });
        if (!items.length) return;
        shown += items.length;

        html += '<section class="pcat" data-reveal="fade">' +
          '<div class="pcat__head">' +
            '<h3 class="pcat__t">' + esc(cat.name) + '</h3>' +
            '<p class="pcat__note">' + (q ? esc(g.group) + (cat.note ? ' — ' + esc(cat.note) : '') : esc(cat.note || '')) + '</p>' +
          '</div>';

        items.forEach(function (it) {
          var isWord = /consultation/i.test(it[1]);
          html += '<div class="pitem">' +
            '<div><div class="pitem__n">' + mark(it[0], q) + '</div>' +
            (it[2] ? '<div class="pitem__note">' + esc(it[2]) + '</div>' : '') + '</div>' +
            '<div class="pitem__p">' + (isWord ? '' : '<small>AED</small>') + esc(it[1]) + '</div>' +
          '</div>';
        });
        html += '</section>';
      });
    });

    if (!shown) {
      html = '<p class="pempty">Nothing matches “' + esc(query) + '”. Try “balayage”, “facial”, “pedicure” or “massage”.</p>';
    }

    root.innerHTML = html;
    if (countEl) countEl.textContent = shown + (shown === 1 ? ' treatment' : ' treatments');
    $$('.tab', tabsEl).forEach(function (b, i) { b.classList.toggle('is-on', !q && i === active); });
    if (window.caObserve) window.caObserve(root);
    window.dispatchEvent(new CustomEvent('ca:rebind', { detail: { root: root } }));
  }

  /* -------------------------------------------------------------- search */
  if (searchEl) {
    var dt;
    searchEl.addEventListener('input', function () {
      clearTimeout(dt);
      dt = setTimeout(function () { query = searchEl.value; render(); }, 120);
    });
    searchEl.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { searchEl.value = ''; query = ''; render(); }
    });
  }

  /* ---------------------------------------------------------------- init */
  var hash = (location.hash || '').replace('#', '').toLowerCase();
  if (hash) {
    groups.forEach(function (g, i) { if (g.group.toLowerCase() === hash) active = i; });
  }
  buildTabs();
  render();
})();


/* ===== gallery.js ===== */
/* ==========================================================================
   GALLERY — self-healing masonry + lightbox
   ---------------------------------------------------------------------------
   Reads CA.galleryConfig. Probes assets/img/gallery/01.jpg … NN.jpg.
   Any file that isn't there removes its own tile, so the COUNT can be a
   generous over-estimate and the grid still comes out clean.
   If nothing loads at all, an art-directed placeholder set is shown instead
   together with the drop-in instructions.
   ========================================================================== */
(function () {
  'use strict';

  var grid = document.querySelector('[data-gallery]');
  if (!grid || !window.CA || !CA.galleryConfig) return;

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var cfg      = CA.galleryConfig;
  var meta     = CA.galleryMeta || {};
  var cats     = CA.galleryDefaults || [];
  var filterEl = $('[data-gallery-filters]');
  var emptyEl  = $('[data-gallery-empty]');
  var countEl  = $('[data-gallery-count]');

  var live = [];        // tiles whose image actually loaded
  var pending = cfg.COUNT;
  var settled = false;

  function pad(n) { return String(n).padStart(cfg.PAD || 2, '0'); }

  /* ---------------------------------------------------------- build grid */
  var frag = document.createDocumentFragment();
  for (var i = 1; i <= cfg.COUNT; i++) {
    var m = meta[i] || {};
    var cat = m.cat || cats[(i - 1) % cats.length] || 'Salon';
    var cap = m.cap || '';
    var a = document.createElement('button');
    a.className = 'gal__item';
    a.type = 'button';
    a.setAttribute('data-cat', cat);
    a.setAttribute('data-cap', cap);
    a.setAttribute('data-i', i);
    if (m.big) a.className += ' gal__item--big';
    if (m.w && m.h) { a.setAttribute('data-w', m.w); a.setAttribute('data-h', m.h); }
    a.setAttribute('data-cursor', 'View');
    a.setAttribute('aria-label', 'Open image ' + i + (cap ? ' — ' + cap : ''));
    a.innerHTML =
      '<img src="' + cfg.PATH + pad(i) + '.' + cfg.EXT + '" alt="' + (cap || 'Cut Above, Dubai') + '" loading="lazy" decoding="async" data-no-ph>' +
      '<span class="gal__cap"><b>' + cat + '</b>' + (cap || 'Cut Above · Jumeirah') + '</span>';
    frag.appendChild(a);
  }
  grid.appendChild(frag);

  /* -------------------------------------------------- prune what's absent */
  function settle() {
    if (settled) return;
    settled = true;
    live = $$('.gal__item', grid);
    if (!live.length) {
      grid.classList.add('u-hide');
      if (emptyEl) emptyEl.classList.remove('u-hide');
      if (filterEl) filterEl.classList.add('u-hide');
      buildPlaceholders();
      return;
    }
    if (emptyEl) emptyEl.classList.add('u-hide');
    buildFilters();
    updateCount(live.length);
    layout();
    if (window.caObserve) window.caObserve(grid);
    window.dispatchEvent(new CustomEvent('ca:rebind', { detail: { root: grid } }));
  }

  function done() { if (--pending <= 0) settle(); }

  /* A tile is removed only when its image genuinely fails. An image that has
     simply not been requested yet (lazy, far below the fold) must never be
     pruned — that was silently deleting most of the grid.                   */
  var described = $$('.gal__item', grid).filter(function (t) {
    return t.hasAttribute('data-w') && t.hasAttribute('data-h');
  }).length;

  $$('.gal__item img', grid).forEach(function (img) {
    img.addEventListener('error', function () {
      var t = img.closest('.gal__item');
      if (t) { t.remove(); live = $$('.gal__item', grid); layout(); updateCount(live.length); }
    });
  });

  if (described === cfg.COUNT && cfg.COUNT > 0) {
    // every tile's size is known up front — no probing, no waiting
    settle();
  } else {
    // unknown sizes: probe with detached images, which are never lazy
    $$('.gal__item img', grid).forEach(function (img) {
      var probe = new Image();
      probe.onload = function () {
        var t = img.closest('.gal__item');
        if (t) { t.setAttribute('data-w', probe.naturalWidth); t.setAttribute('data-h', probe.naturalHeight); }
        done();
      };
      probe.onerror = function () {
        var t = img.closest('.gal__item');
        if (t) t.remove();
        done();
      };
      probe.src = img.getAttribute('src');
    });
    setTimeout(settle, 9000);
    if (cfg.COUNT === 0) settle();
  }

  /* ---------------------------------------------- placeholder fallback */
  function buildPlaceholders() {
    var host = $('[data-gallery-ph]');
    if (!host) return;
    var ratios = [1.25, 0.8, 1, 1.4, 0.75, 1.1, 0.9, 1.3, 1, 0.85, 1.2, 1];
    host.innerHTML = ratios.map(function (r, i) {
      return '<div class="gal__item" style="aspect-ratio:1/' + r + '">' +
        '<div class="ph"><div><div class="ph__mark">' + (cats[i % cats.length]) + '</div>' +
        '<div class="ph__sub">Image ' + pad(i + 1) + '.' + cfg.EXT + '</div></div></div></div>';
    }).join('');
    host.classList.remove('u-hide');
  }

  /* ------------------------------------------------------------ filters */
  function buildFilters() {
    if (!filterEl) return;
    var present = {};
    live.forEach(function (t) { present[t.getAttribute('data-cat')] = true; });
    var list = ['All'].concat(Object.keys(present));
    if (list.length <= 2) { filterEl.classList.add('u-hide'); return; }

    filterEl.innerHTML = list.map(function (c, i) {
      return '<button class="tab' + (i === 0 ? ' is-on' : '') + '" data-f="' + c + '">' + c + '</button>';
    }).join('');

    filterEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-f]');
      if (!b) return;
      var f = b.getAttribute('data-f');
      $$('.tab', filterEl).forEach(function (x) { x.classList.toggle('is-on', x === b); });
      var n = 0;
      live.forEach(function (t) {
        var on = f === 'All' || t.getAttribute('data-cat') === f;
        t.style.display = on ? '' : 'none';
        if (on) n++;
      });
      updateCount(n);
      layout();
    });
    window.dispatchEvent(new CustomEvent('ca:rebind', { detail: { root: filterEl } }));
  }

  /* ------------------------------------------------------------- layout */
  /* CSS grid can't do masonry on its own, so each tile is given a row span
     computed from its image's natural aspect ratio and its own column width.
     Recomputed on resize and whenever a filter changes what's showing.     */
  function layout() {
    if (!live.length) return;
    var cs = window.getComputedStyle(grid);
    var rowH = parseFloat(cs.gridAutoRows) || 8;
    var gap = parseFloat(cs.rowGap || cs.gap) || 0;
    var cols = (cs.gridTemplateColumns || '').split(' ').filter(Boolean).length || 1;
    var gridW = grid.clientWidth;
    var colW = (gridW - gap * (cols - 1)) / cols;

    live.forEach(function (t) {
      if (t.style.display === 'none') return;
      var img = $('img', t);
      var nw = parseFloat(t.getAttribute('data-w')) || img.naturalWidth || 4;
      var nh = parseFloat(t.getAttribute('data-h')) || img.naturalHeight || 5;
      var span = (cols > 1 && t.classList.contains('gal__item--big')) ? 2 : 1;
      var w = colW * span + gap * (span - 1);
      var h = w * (nh / nw);
      // keep very tall portraits from dominating a column
      h = Math.min(h, w * 1.5);
      t.style.gridRowEnd = 'span ' + Math.max(1, Math.round((h + gap) / (rowH + gap)));
    });
  }
  window.caGalleryLayout = layout;

  var rz;
  window.addEventListener('resize', function () {
    clearTimeout(rz); rz = setTimeout(layout, 140);
  });

  function updateCount(n) {
    if (countEl) countEl.textContent = n + (n === 1 ? ' image' : ' images');
  }

  /* ----------------------------------------------------------- lightbox */
  var lb = $('.lb');
  if (!lb) return;
  var lbImg   = $('.lb__img', lb);
  var lbCap   = $('.lb__foot', lb);
  var lbIndex = $('[data-lb-index]', lb);
  var idx = 0;

  function visible() { return live.filter(function (t) { return t.style.display !== 'none'; }); }

  function open(tile) {
    var v = visible();
    idx = v.indexOf(tile);
    if (idx < 0) idx = 0;
    show();
    lb.classList.add('is-open');
    document.body.classList.add('is-locked');
    var c = $('.lb__close', lb);
    if (c) c.focus();
  }
  function close() {
    lb.classList.remove('is-open');
    document.body.classList.remove('is-locked');
  }
  function show() {
    var v = visible();
    if (!v.length) return;
    idx = (idx + v.length) % v.length;
    var tile = v[idx];
    var src = $('img', tile).getAttribute('src');
    var cap = tile.getAttribute('data-cap');
    var tcat = tile.getAttribute('data-cat');
    lbImg.classList.remove('is-ready');
    var pre = new Image();
    pre.onload = function () {
      lbImg.src = src;
      lbImg.alt = $('img', tile).alt || '';
      requestAnimationFrame(function () { lbImg.classList.add('is-ready'); });
    };
    pre.src = src;
    if (lbCap) lbCap.textContent = cap ? tcat + ' — ' + cap : tcat;
    if (lbIndex) lbIndex.textContent = (idx + 1) + ' / ' + v.length;
  }
  function step(d) { idx += d; show(); }

  grid.addEventListener('click', function (e) {
    var t = e.target.closest('.gal__item');
    if (t) open(t);
  });

  var closeBtn = $('.lb__close', lb);
  if (closeBtn) closeBtn.addEventListener('click', close);
  var prev = $('.lb__nav--prev', lb); if (prev) prev.addEventListener('click', function () { step(-1); });
  var next = $('.lb__nav--next', lb); if (next) next.addEventListener('click', function () { step(1); });
  lb.addEventListener('click', function (e) {
    if (e.target === lb || e.target.classList.contains('lb__stage')) close();
  });

  document.addEventListener('keydown', function (e) {
    if (!lb.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  });

  // swipe
  var sx = 0, sy = 0;
  lb.addEventListener('touchstart', function (e) {
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
  }, { passive: true });
  lb.addEventListener('touchend', function (e) {
    var dx = e.changedTouches[0].clientX - sx;
    var dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
  }, { passive: true });
})();


/* ===== booking.js ===== */
/* ==========================================================================
   BOOKING — appointment request
   ---------------------------------------------------------------------------
   Three steps, then a hand-off:

     1. What you're booking   — any number of treatments, across any areas
     2. Who with              — optional, any number of specialists
     3. When                  — preferred day and time

   Then the send screen. Contact details are NOT asked for up front: most
   people leave on WhatsApp, where the salon already has their name and
   number. Typing them first is friction for no gain, so the fields are
   optional and only offered to people who want to be called back instead.

   No back end. Nothing is stored or transmitted by this file — it composes a
   message and hands it to WhatsApp or the phone dialler.
   ========================================================================== */
(function () {
  'use strict';
  if (!window.CA) return;

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var STEPS = 3;
  var step = 0;
  var sent = false;

  var pick = {
    services: [],        // [{ n, p, area, cat }]
    specialists: [],     // [name]
    date: null, dateLabel: null, time: null,
    name: '', phone: '', note: ''
  };

  var uiArea = 'Hair';   // which tab is open on step 1
  var uiQuery = '';

  /* ------------------------------------------------------------- markup */
  var modal = document.createElement('div');
  modal.className = 'bk';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Request an appointment');
  modal.innerHTML = [
    '<div class="bk__scrim" data-bk-close></div>',
    '<div class="bk__panel">',
      '<header class="bk__head">',
        '<div class="bk__steps" data-bk-dots></div>',
        '<button class="lb__close" data-bk-close aria-label="Close">',
          '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M1 1l12 12M13 1L1 13"/></svg>',
        '</button>',
      '</header>',
      '<div class="bk__body" data-bk-body></div>',
      '<footer class="bk__foot">',
        '<button class="btn btn--ghost btn--sm" data-bk-back>Back</button>',
        '<div class="bk__footRight">',
          '<span class="label label--dim" data-bk-step></span>',
          '<button class="btn btn--solid btn--sm" data-bk-next>Continue</button>',
        '</div>',
      '</footer>',
    '</div>'
  ].join('');
  document.body.appendChild(modal);

  var bodyEl = $('[data-bk-body]', modal);
  var dotsEl = $('[data-bk-dots]', modal);
  var backEl = $('[data-bk-back]', modal);
  var nextEl = $('[data-bk-next]', modal);
  var stepEl = $('[data-bk-step]', modal);

  dotsEl.innerHTML = new Array(STEPS + 1).join('<i class="bk__dot"></i>');
  var dots = $$('.bk__dot', dotsEl);

  /* ------------------------------------------------------------- helpers */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function pane(q, hint, inner) {
    return '<div class="bk__pane is-on"><h3 class="bk__q">' + q + '</h3>' +
      (hint ? '<p class="bk__hint">' + hint + '</p>' : '') + inner + '</div>';
  }
  function row(k, v) {
    return '<div class="bk__srow"><dt>' + esc(k) + '</dt><dd>' + v + '</dd></div>';
  }

  /* every treatment in the price list, flattened once */
  var ALL = (function () {
    var out = [];
    CA.services.forEach(function (g) {
      g.cats.forEach(function (c) {
        c.items.forEach(function (it) {
          out.push({ n: it[0], p: it[1], note: it[2] || '', area: g.group, cat: c.name });
        });
      });
    });
    return out;
  })();

  var AREAS = CA.services.map(function (g) { return g.group; });

  function key(s) { return s.area + '|' + s.cat + '|' + s.n; }
  function chosen(s) {
    return pick.services.some(function (x) { return key(x) === key(s); });
  }
  function toggleService(s) {
    var i = -1;
    pick.services.forEach(function (x, n) { if (key(x) === key(s)) i = n; });
    if (i > -1) pick.services.splice(i, 1);
    else pick.services.push(s);
  }

  /* first number in a price string — "from 900" -> 900, "240 / 300" -> 240 */
  function priceMin(p) {
    var m = String(p).replace(/,/g, '').match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  }
  function estimate() {
    var sum = 0, soft = false, quoted = 0;
    pick.services.forEach(function (s) {
      var v = priceMin(s.p);
      if (v === null) { soft = true; return; }
      if (/from|starting|–|-|\//i.test(String(s.p))) soft = true;
      sum += v; quoted++;
    });
    return { sum: sum, soft: soft, quoted: quoted, unpriced: pick.services.length - quoted };
  }

  function areasChosen() {
    var seen = {};
    pick.services.forEach(function (s) { seen[s.area] = true; });
    return Object.keys(seen);
  }

  function specialistsFor(areas) {
    if (!areas.length) return CA.team;
    return CA.team.filter(function (m) {
      return areas.some(function (a) {
        if (a === 'Hair')  return /hair|stylist|colorist/i.test(m.role);
        if (a === 'Skin')  return /skin|therapist/i.test(m.role);
        if (a === 'Nails') return /nail/i.test(m.role);
        if (a === 'Body')  return /massage|therapist/i.test(m.role);
        return true;
      });
    });
  }

  var AV = CA.availability || {};

  /* a whole-salon closure covering this date, or null */
  function closureOn(k) {
    var list = AV.closures || [];
    for (var i = 0; i < list.length; i++) {
      if (k >= list[i].from && k <= list[i].to) return list[i];
    }
    return null;
  }

  /* which of the chosen specialists can work this date */
  function staffOn(k, weekday) {
    if (!pick.specialists.length) return null;          // no preference — any
    return pick.specialists.filter(function (name) {
      var r = (AV.staff || {})[name];
      if (!r) return true;
      if ((r.off || []).indexOf(k) > -1) return false;
      return (r.days || []).indexOf(weekday) > -1;
    });
  }

  function onBreak(name, hhmm) {
    var r = (AV.staff || {})[name];
    if (!r) return false;
    return (r.breaks || []).some(function (b) { return hhmm >= b[0] && hhmm < b[1]; });
  }

  var DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  /* Build the next n days, each already knowing its own open slots. Slots are
     computed here rather than on demand so a day with nothing left can be
     greyed out up front — clicking into an empty list is a dead end.        */
  function nextDays(n) {
    var out = [], d = new Date();
    var lead = AV.leadHours == null ? 1 : AV.leadHours;
    var now = new Date();

    for (var i = 0; i < n; i++) {
      var x = new Date(d.getTime() + i * 86400000);
      var dayName = DAYS[x.getDay()];
      var h = CA.biz.hours.filter(function (r) { return r.d === dayName; })[0];
      var k = x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2);
      var shut = closureOn(k);
      var free = staffOn(k, x.getDay());

      var why = null;
      if (!h) why = 'Closed';
      else if (shut) why = shut.why;
      else if (free && !free.length) why = pick.specialists.length === 1 ? 'Day off' : 'All off';

      var slots = [];
      if (!why) {
        var o = parseInt(h.o.split(':')[0], 10);
        var c = parseInt(h.c.split(':')[0], 10);
        for (var hh = o; hh < c; hh++) {
          for (var mi = 0; mi < 2; mi++) {
            var m = mi ? '30' : '00';
            if (hh === c - 1 && m === '30') continue;
            if (i === 0 && hh < now.getHours() + lead) continue;
            var t = ('0' + hh).slice(-2) + ':' + m;
            if (free && !free.some(function (nm) { return !onBreak(nm, t); })) continue;
            slots.push(t);
          }
        }
        if (!slots.length) why = i === 0 ? 'Too late today' : 'No slots';
      }

      out.push({
        key: k,
        label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dayName.slice(0, 3),
        sub: x.getDate() + ' ' + MON[x.getMonth()],
        pretty: dayName.slice(0, 3) + ' ' + x.getDate() + ' ' + MON[x.getMonth()],
        open: !why, why: why, weekday: x.getDay(), slots: slots
      });
    }
    return out;
  }

  function slotsFor(dateKey) {
    var day = nextDays(21).filter(function (d) { return d.key === dateKey; })[0];
    return day ? day.slots : [];
  }

  /* --------------------------------------------------------------- panes */
  function paneServices() {
    var q = uiQuery.trim().toLowerCase();
    var list = ALL.filter(function (s) {
      if (q) return (s.n + ' ' + s.cat + ' ' + s.area).toLowerCase().indexOf(q) > -1;
      return s.area === uiArea;
    });

    var tabs = '<div class="bk__tabs">' + AREAS.map(function (a) {
      var n = pick.services.filter(function (s) { return s.area === a; }).length;
      return '<button class="tab' + (!q && a === uiArea ? ' is-on' : '') + '" data-area="' + esc(a) + '">' +
        esc(a) + (n ? ' <b>' + n + '</b>' : '') + '</button>';
    }).join('') + '</div>';

    var search = '<label class="search bk__search">' +
      '<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><circle cx="6.5" cy="6.5" r="4.8"/><path d="M10.2 10.2L14 14"/></svg>' +
      '<input type="search" placeholder="Search every treatment…" data-bk-search value="' + esc(uiQuery) + '" aria-label="Search treatments">' +
      '</label>';

    var rows = list.length
      ? '<div class="bk__list">' + list.map(function (s) {
          var on = chosen(s);
          var price = /consultation/i.test(s.p) ? s.p : 'AED ' + s.p;
          return '<button class="pick' + (on ? ' is-sel' : '') + '" data-svc="' + esc(key(s)) + '" aria-pressed="' + on + '">' +
            '<span class="pick__box" aria-hidden="true"></span>' +
            '<span class="pick__t">' + esc(s.n) +
              (s.note ? '<span class="pick__s">' + esc(s.note) + '</span>' : '') +
              (q ? '<span class="pick__s">' + esc(s.area) + ' · ' + esc(s.cat) + '</span>'
                 : '<span class="pick__s">' + esc(s.cat) + '</span>') +
            '</span>' +
            '<span class="pick__p">' + esc(price) + '</span>' +
          '</button>';
        }).join('') + '</div>'
      : '<p class="bk__hint" style="padding:2rem 0">Nothing matches “' + esc(uiQuery) + '”.</p>';

    return pane('What are you booking?',
      'Pick as many as you like. Plenty of people do hair and nails in one sitting.',
      tabs + search + rows);
  }

  function paneTeam() {
    var areas = areasChosen();
    var team = specialistsFor(areas);
    var none = pick.specialists.length === 0;
    return pane('Anyone in particular?',
      'Optional. ' + (areas.length > 1
        ? 'You have picked ' + areas.length + ' areas, so this could be more than one person.'
        : 'Skip it and you get whoever is free soonest.'),
      '<div class="bk__list">' +
        '<button class="pick' + (none ? ' is-sel' : '') + '" data-spec="__none" aria-pressed="' + none + '">' +
          '<span class="pick__box" aria-hidden="true"></span>' +
          '<span class="pick__t">No preference<span class="pick__s">Soonest available</span></span>' +
        '</button>' +
        team.map(function (m) {
          var on = pick.specialists.indexOf(m.name) > -1;
          return '<button class="pick' + (on ? ' is-sel' : '') + '" data-spec="' + esc(m.name) + '" aria-pressed="' + on + '">' +
            '<span class="pick__box" aria-hidden="true"></span>' +
            '<span class="pick__t">' + esc(m.name) + '<span class="pick__s">' + esc(m.role) + ' · ' + esc(m.years) + '</span></span>' +
          '</button>';
        }).join('') +
      '</div>');
  }

  function paneWhen() {
    var days = nextDays(14);
    var slots = pick.date ? slotsFor(pick.date) : [];
    return pane('When suits you?',
      'Closed days and anyone’s day off are greyed out already. It is still a request, not a confirmed slot — the salon replies the same day.',
      '<div class="bk__grid bk__grid--3" data-bk-days>' + days.map(function (d) {
        return '<button class="opt opt--tight' + (pick.date === d.key ? ' is-sel' : '') + '"' +
          (d.open ? '' : ' disabled') + ' data-date="' + d.key + '" data-pretty="' + d.pretty + '"' +
          (d.why ? ' title="' + esc(d.why) + '"' : '') + '>' +
          '<span class="opt__t">' + d.label + '</span>' +
          '<span class="opt__s">' + (d.why ? esc(d.why) : d.sub) + '</span></button>';
      }).join('') + '</div>' +
      (pick.date
        ? '<p class="bk__hint" style="margin-top:1.5rem">Times on ' + esc(pick.dateLabel || pick.date) + '</p>' +
          '<div class="bk__grid bk__grid--times" data-bk-times>' +
          slots.map(function (s) {
            return '<button class="opt opt--tight' + (pick.time === s ? ' is-sel' : '') + '" data-time="' + s + '">' + s + '</button>';
          }).join('') + '</div>'
        : ''));
  }

  function summaryHTML() {
    var e = estimate();
    var svc = pick.services.map(function (s) {
      return '<li><span class="bk__svcN">' + esc(s.n) + '</span>' +
        '<span class="bk__svcA">' + esc(s.area) + '</span>' +
        '<button class="bk__drop" data-drop="' + esc(key(s)) + '" ' +
          'aria-label="Remove ' + esc(s.n) + '" title="Remove">&times;</button></li>';
    }).join('');
    var who = pick.specialists.length ? pick.specialists.map(esc).join(', ') : 'No preference';
    var total = e.quoted
      ? (e.soft ? 'from ' : '') + 'AED ' + e.sum.toLocaleString() +
        (e.unpriced ? ' <span class="bk__soft">+ ' + e.unpriced + ' on consultation</span>' : '')
      : 'On consultation';
    return '<div class="bk__summary">' +
      '<ul class="bk__svc">' + svc + '</ul>' +
      '<div class="bk__edit">' +
        '<button class="bk__editBtn" data-goto="0">Add another treatment</button>' +
        '<button class="bk__editBtn" data-goto="1">Change specialist</button>' +
        '<button class="bk__editBtn" data-goto="2">Change day or time</button>' +
      '</div>' +
      '<dl style="margin:0">' +
        row('With', esc(who)) +
        row('When', esc((pick.dateLabel || '—') + (pick.time ? ' at ' + pick.time : ''))) +
        row('Indicative', total) +
      '</dl>' +
      '<p class="bk__fine">Prices are indicative and confirmed at consultation. Nothing is booked until the salon replies.</p>' +
    '</div>';
  }

  function paneSend() {
    var msg = composeMessage();
    return '<div class="bk__pane is-on">' +
      '<p class="label">Ready to send</p>' +
      '<h3 class="bk__q" style="margin-top:.75rem">That’s everything.</h3>' +
      '<p class="bk__hint" style="max-width:34rem">Send it on WhatsApp and the salon already has your name and number — nothing else to type. If you would rather they called you, add your number below.</p>' +
      summaryHTML() +
      '<div class="bk__send">' +
        '<a class="btn btn--solid btn--lg" target="_blank" rel="noopener" data-bk-wa ' +
          'href="https://wa.me/' + CA.biz.whatsappHref + '?text=' + encodeURIComponent(msg) + '">' +
          'Send on WhatsApp</a>' +
        '<a class="btn btn--lg" href="tel:' + CA.biz.phoneHref + '">Call the salon</a>' +
      '</div>' +
      '<details class="bk__more">' +
        '<summary>Prefer a call back? Add your number</summary>' +
        '<label class="field"><span class="field__l">Name</span>' +
          '<input type="text" data-f="name" value="' + esc(pick.name) + '" placeholder="Your name" autocomplete="name"></label>' +
        '<label class="field"><span class="field__l">Mobile</span>' +
          '<input type="tel" data-f="phone" value="' + esc(pick.phone) + '" placeholder="+971 …" autocomplete="tel"></label>' +
        '<label class="field"><span class="field__l">Anything we should know?</span>' +
          '<input type="text" data-f="note" value="' + esc(pick.note) + '" placeholder="Allergies, a photo reference, parking"></label>' +
        '<p class="bk__hint" style="margin-top:1rem">These go into the message. Nothing is sent anywhere on its own.</p>' +
      '</details>' +
    '</div>';
  }

  function composeMessage() {
    var e = estimate();
    var lines = [
      'Appointment request — ' + CA.biz.full,
      '——————————',
      'Treatments:'
    ];
    pick.services.forEach(function (s) {
      lines.push('  • ' + s.n + ' (' + s.area + ')');
    });
    lines.push('With: ' + (pick.specialists.length ? pick.specialists.join(', ') : 'No preference'));
    lines.push('Preferred: ' + (pick.dateLabel || '') + (pick.date ? ' (' + pick.date + ')' : '') + (pick.time ? ' at ' + pick.time : ''));
    if (e.quoted) lines.push('Indicative: ' + (e.soft ? 'from ' : '') + 'AED ' + e.sum.toLocaleString());
    if (pick.name) lines.push('Name: ' + pick.name);
    if (pick.phone) lines.push('Mobile: ' + pick.phone);
    if (pick.note) lines.push('Notes: ' + pick.note);
    return lines.join('\n');
  }

  /* --------------------------------------------------------------- render */
  function render() {
    if (sent) {
      bodyEl.innerHTML = paneSend();
    } else if (step === 0) {
      bodyEl.innerHTML = paneServices();
    } else if (step === 1) {
      bodyEl.innerHTML = paneTeam();
    } else {
      bodyEl.innerHTML = paneWhen();
    }

    // the selection tray rides along under the footer on step 1
    var tray = $('.bk__tray', modal);
    if (tray) tray.parentNode.removeChild(tray);
    if (!sent && step === 0 && pick.services.length) {
      var e = estimate();
      var t = document.createElement('div');
      t.className = 'bk__tray';
      t.innerHTML =
        '<div class="bk__chips">' + pick.services.map(function (s) {
          return '<button class="chip" data-drop="' + esc(key(s)) + '" aria-label="Remove ' + esc(s.n) + '">' +
            esc(s.n) + '<span aria-hidden="true">×</span></button>';
        }).join('') + '</div>' +
        '<div class="bk__trayFoot"><span>' + pick.services.length + ' selected</span>' +
        (e.quoted ? '<span>' + (e.soft ? 'from ' : '') + 'AED ' + e.sum.toLocaleString() + '</span>' : '') +
        '</div>';
      bodyEl.parentNode.insertBefore(t, bodyEl.nextSibling);
    }

    dots.forEach(function (d, i) {
      d.classList.toggle('is-on', sent ? true : i <= step);
    });
    stepEl.textContent = sent ? 'Complete' : 'Step ' + (step + 1) + ' of ' + STEPS;
    backEl.style.visibility = (step === 0 && !sent) ? 'hidden' : 'visible';
    nextEl.style.display = sent ? 'none' : '';
    nextEl.textContent = step === STEPS - 1 ? 'Review' : 'Continue';
    nextEl.disabled = !canAdvance();
    nextEl.style.opacity = canAdvance() ? '1' : '0.4';
    bodyEl.scrollTop = 0;
    window.dispatchEvent(new CustomEvent('ca:rebind', { detail: { root: modal } }));
  }

  function canAdvance() {
    if (step === 0) return pick.services.length > 0;
    if (step === 1) return true;                       // specialists are optional
    if (step === 2) return !!(pick.date && pick.time);
    return true;
  }

  /* ------------------------------------------------------------ handlers */
  modal.addEventListener('click', function (e) {
    var b = e.target.closest('button, a');
    if (!b) return;

    if (b.hasAttribute('data-goto')) {
      sent = false;
      step = parseInt(b.getAttribute('data-goto'), 10) || 0;
      render(); return;
    }

    if (b.hasAttribute('data-area')) { uiArea = b.getAttribute('data-area'); uiQuery = ''; render(); return; }

    if (b.hasAttribute('data-svc') || b.hasAttribute('data-drop')) {
      var k = b.getAttribute('data-svc') || b.getAttribute('data-drop');
      var s = ALL.filter(function (x) { return key(x) === k; })[0];
      if (s) {
        toggleService(s);
        // nothing left to send — drop back and pick something
        if (sent && !pick.services.length) { sent = false; step = 0; }
        render();
      }
      return;
    }

    if (b.hasAttribute('data-spec')) {
      var name = b.getAttribute('data-spec');
      if (name === '__none') pick.specialists = [];
      else {
        var i = pick.specialists.indexOf(name);
        if (i > -1) pick.specialists.splice(i, 1); else pick.specialists.push(name);
      }
      render();
      return;
    }

    if (b.hasAttribute('data-date')) {
      pick.date = b.getAttribute('data-date');
      pick.dateLabel = b.getAttribute('data-pretty');
      pick.time = null; render(); return;
    }
    if (b.hasAttribute('data-time')) { pick.time = b.getAttribute('data-time'); render(); return; }
  });

  bodyEl.addEventListener('input', function (e) {
    var el = e.target;
    if (el.hasAttribute && el.hasAttribute('data-bk-search')) {
      uiQuery = el.value;
      var pos = el.selectionStart;
      render();
      var again = $('[data-bk-search]', bodyEl);
      if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (x) {} }
      return;
    }
    var f = el.getAttribute && el.getAttribute('data-f');
    if (!f) return;
    pick[f] = el.value;
    // the WhatsApp link has to stay in step with the fields
    var wa = $('[data-bk-wa]', modal);
    if (wa) wa.href = 'https://wa.me/' + CA.biz.whatsappHref + '?text=' + encodeURIComponent(composeMessage());
  });

  backEl.addEventListener('click', function () {
    if (sent) { sent = false; step = STEPS - 1; render(); return; }
    if (step > 0) { step--; render(); }
  });

  nextEl.addEventListener('click', function () {
    if (!canAdvance()) return;
    if (step < STEPS - 1) { step++; render(); return; }
    sent = true; render();
  });

  /* -------------------------------------------------------- open / close */
  function open(preArea) {
    step = 0; sent = false;
    pick.services = []; pick.specialists = [];
    pick.date = pick.dateLabel = pick.time = null;
    uiQuery = '';
    uiArea = preArea && AREAS.indexOf(preArea) > -1 ? preArea : AREAS[0];
    render();
    modal.classList.add('is-open');
    document.body.classList.add('is-locked');
  }
  function close() {
    modal.classList.remove('is-open');
    document.body.classList.remove('is-locked');
  }
  $$('[data-bk-close]', modal).forEach(function (b) { b.addEventListener('click', close); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) close();
  });
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-book]');
    if (!t) return;
    e.preventDefault();
    var pre = t.getAttribute('data-book');
    open(pre && pre !== 'true' ? pre : null);
  });
})();
