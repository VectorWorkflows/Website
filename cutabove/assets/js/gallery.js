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
