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
