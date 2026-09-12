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
