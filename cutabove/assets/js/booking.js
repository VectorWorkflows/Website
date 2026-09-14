/* ==========================================================================
   BOOKING — five-step request flow
   Service → Specialist → Date & time → Details → Confirm
   Ends by handing a fully-composed request straight to the salon on WhatsApp,
   or by placing a call. No back end, no third-party booking platform.
   ========================================================================== */
(function () {
  'use strict';
  if (!window.CA) return;

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

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
        '<div style="display:flex;gap:.75rem;align-items:center">',
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

  var STEPS = 5;
  var step = 0;
  var pick = { area: null, treatment: null, specialist: 'No preference', date: null, dateLabel: null, time: null, name: '', phone: '', note: '' };

  dotsEl.innerHTML = new Array(STEPS).join(',').split(',').map(function () { return '<i class="bk__dot"></i>'; }).join('');
  var dots = $$('.bk__dot', dotsEl);

  /* -------------------------------------------------------------- helpers */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function opt(label, sub, val, sel, tight) {
    return '<button class="opt' + (tight ? ' opt--tight' : '') + (sel ? ' is-sel' : '') +
      '" data-val="' + esc(val) + '"><span class="opt__t">' + esc(label) + '</span>' +
      (sub ? '<span class="opt__s">' + esc(sub) + '</span>' : '') + '</button>';
  }
  function pane(q, hint, inner) {
    return '<div class="bk__pane is-on"><h3 class="bk__q">' + q + '</h3>' +
      (hint ? '<p class="bk__hint">' + hint + '</p>' : '') + inner + '</div>';
  }

  function treatmentsFor(area) {
    var g = CA.services.filter(function (s) { return s.group === area; })[0];
    if (!g) return [];
    var out = [];
    g.cats.forEach(function (c) {
      c.items.slice(0, 60).forEach(function (it) {
        out.push({ n: it[0], p: it[1], c: c.name });
      });
    });
    return out;
  }

  function nextDays(n) {
    var names = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var out = [];
    var d = new Date();
    for (var i = 0; i < n; i++) {
      var x = new Date(d.getTime() + i * 86400000);
      var dayName = names[x.getDay()];
      var h = CA.biz.hours.filter(function (r) { return r.d === dayName; })[0];
      out.push({
        key: x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2),
        label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dayName.slice(0, 3),
        sub: x.getDate() + ' ' + mon[x.getMonth()],
        pretty: dayName.slice(0, 3) + ' ' + x.getDate() + ' ' + mon[x.getMonth()],
        open: !!h, o: h ? h.o : null, c: h ? h.c : null
      });
    }
    return out;
  }

  function slotsFor(dateKey) {
    var day = nextDays(21).filter(function (d) { return d.key === dateKey; })[0];
    if (!day || !day.open) return [];
    var o = parseInt(day.o.split(':')[0], 10);
    var c = parseInt(day.c.split(':')[0], 10);
    var now = new Date();
    var isToday = day.label === 'Today';
    var out = [];
    for (var h = o; h < c; h++) {
      ['00', '30'].forEach(function (m) {
        if (h === c - 1 && m === '30') return;
        if (isToday && (h < now.getHours() + 1)) return;
        out.push(('0' + h).slice(-2) + ':' + m);
      });
    }
    return out;
  }

  /* --------------------------------------------------------------- render */
  function render() {
    var html = '';

    if (step === 0) {
      html = pane('What are you coming in for?', 'Pick the area — treatments come next.',
        '<div class="bk__grid bk__grid--2">' + CA.disciplines.map(function (d) {
          return opt(d.title, d.lead, d.title, pick.area === d.title);
        }).join('') + '</div>');
    }

    if (step === 1) {
      var list = treatmentsFor(pick.area);
      html = pane('Which treatment?', esc(pick.area) + ' — ' + list.length + ' available. Not sure? Choose “Consultation”.',
        '<div class="bk__grid bk__grid--2">' +
          opt('Consultation', 'Let the team advise', 'Consultation', pick.treatment === 'Consultation') +
          list.map(function (t) {
            return opt(t.n, (/consultation/i.test(t.p) ? t.p : 'AED ' + t.p) + ' · ' + t.c, t.n, pick.treatment === t.n);
          }).join('') +
        '</div>');
    }

    if (step === 2) {
      var relevant = CA.team.filter(function (m) {
        if (pick.area === 'Hair')  return /hair|stylist|colorist/i.test(m.role);
        if (pick.area === 'Skin')  return /skin|therapist/i.test(m.role);
        if (pick.area === 'Nails') return /nail/i.test(m.role);
        if (pick.area === 'Body')  return /massage|therapist/i.test(m.role);
        return true;
      });
      if (!relevant.length) relevant = CA.team;
      html = pane('Anyone in particular?', 'Every specialist on the floor is certified. “No preference” gets you the soonest slot.',
        '<div class="bk__grid bk__grid--2">' +
          opt('No preference', 'Soonest available', 'No preference', pick.specialist === 'No preference') +
          relevant.map(function (m) {
            return opt(m.name, m.role + ' · ' + m.years, m.name, pick.specialist === m.name);
          }).join('') +
        '</div>');
    }

    if (step === 3) {
      var days = nextDays(14);
      var slots = pick.date ? slotsFor(pick.date) : [];
      html = pane('When suits you?', 'Requested times are confirmed by the salon — we will come back to you the same day.',
        '<div class="bk__grid bk__grid--3" data-bk-days>' + days.map(function (d) {
          return '<button class="opt opt--tight' + (pick.date === d.key ? ' is-sel' : '') + (d.open ? '' : ' ') + '"' +
            (d.open ? '' : ' disabled') + ' data-date="' + d.key + '" data-pretty="' + d.pretty + '">' +
            '<span class="opt__t">' + d.label + '</span><span class="opt__s">' + d.sub + '</span></button>';
        }).join('') + '</div>' +
        (pick.date
          ? '<p class="bk__hint" style="margin-top:1.5rem">Times on ' + esc(pick.dateLabel || pick.date) + '</p><div class="bk__grid bk__grid--times" data-bk-times>' +
            (slots.length ? slots.map(function (s) {
              return '<button class="opt opt--tight' + (pick.time === s ? ' is-sel' : '') + '" data-time="' + s + '">' + s + '</button>';
            }).join('') : '<p class="bk__hint">No slots left today — try tomorrow.</p>') + '</div>'
          : ''));
    }

    if (step === 4) {
      html = pane('Almost there.', 'We only need a name and a number.',
        '<label class="field"><span class="field__l">Name</span><input type="text" data-f="name" value="' + esc(pick.name) + '" placeholder="Your name" autocomplete="name"></label>' +
        '<label class="field"><span class="field__l">Mobile</span><input type="tel" data-f="phone" value="' + esc(pick.phone) + '" placeholder="+971 …" autocomplete="tel"></label>' +
        '<label class="field"><span class="field__l">Anything we should know?</span><input type="text" data-f="note" value="' + esc(pick.note) + '" placeholder="Optional — allergies, a photo reference, parking"></label>' +
        '<div class="bk__summary"><dl style="margin:0">' +
          row('Treatment', (pick.treatment || '—') + (pick.area ? ' · ' + pick.area : '')) +
          row('With', pick.specialist) +
          row('When', (pick.dateLabel || pick.date || '—') + (pick.time ? ' at ' + pick.time : '')) +
        '</dl></div>');
    }

    bodyEl.innerHTML = html;
    dots.forEach(function (d, i) { d.classList.toggle('is-on', i <= step); });
    stepEl.textContent = 'Step ' + (step + 1) + ' of ' + STEPS;
    backEl.style.visibility = step === 0 ? 'hidden' : 'visible';
    nextEl.textContent = step === STEPS - 1 ? 'Send request' : 'Continue';
    nextEl.disabled = !canAdvance();
    nextEl.style.opacity = canAdvance() ? '1' : '0.4';
    bodyEl.scrollTop = 0;
    window.dispatchEvent(new CustomEvent('ca:rebind', { detail: { root: bodyEl } }));
  }

  function row(k, v) {
    return '<div class="bk__srow"><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>';
  }

  function canAdvance() {
    if (step === 0) return !!pick.area;
    if (step === 1) return !!pick.treatment;
    if (step === 2) return !!pick.specialist;
    if (step === 3) return !!(pick.date && pick.time);
    if (step === 4) return pick.name.trim().length > 1 && pick.phone.trim().length > 5;
    return true;
  }

  /* ------------------------------------------------------------ handlers */
  bodyEl.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-date')) {
      pick.date = b.getAttribute('data-date');
      pick.dateLabel = b.getAttribute('data-pretty');
      pick.time = null; render(); return;
    }
    if (b.hasAttribute('data-time')) {
      pick.time = b.getAttribute('data-time'); render(); return;
    }
    if (b.hasAttribute('data-val')) {
      var v = b.getAttribute('data-val');
      if (step === 0) { if (pick.area !== v) pick.treatment = null; pick.area = v; }
      if (step === 1) pick.treatment = v;
      if (step === 2) pick.specialist = v;
      render();
    }
  });

  bodyEl.addEventListener('input', function (e) {
    var f = e.target.getAttribute && e.target.getAttribute('data-f');
    if (!f) return;
    pick[f] = e.target.value;
    nextEl.disabled = !canAdvance();
    nextEl.style.opacity = canAdvance() ? '1' : '0.4';
  });

  backEl.addEventListener('click', function () { if (step > 0) { step--; render(); } });

  nextEl.addEventListener('click', function () {
    if (!canAdvance()) return;
    if (step < STEPS - 1) { step++; render(); return; }
    submit();
  });

  function submit() {
    var msg =
      'Appointment request — ' + CA.biz.full + '\n' +
      '——————————\n' +
      'Name: ' + pick.name + '\n' +
      'Mobile: ' + pick.phone + '\n' +
      'Treatment: ' + pick.treatment + ' (' + pick.area + ')\n' +
      'Specialist: ' + pick.specialist + '\n' +
      'Preferred: ' + pick.dateLabel + ' (' + pick.date + ') at ' + pick.time + '\n' +
      (pick.note ? 'Notes: ' + pick.note + '\n' : '');

    bodyEl.innerHTML =
      '<div class="bk__pane is-on u-center" style="padding-block:2rem">' +
        '<div class="label">Request ready</div>' +
        '<h3 class="display display--2" style="margin-top:1rem">Thank you, ' + esc(pick.name.split(' ')[0]) + '.</h3>' +
        '<p class="bk__hint" style="max-width:30rem;margin:1rem auto 0">Send it straight to the salon and someone on the floor will confirm your slot. Nothing has been booked yet.</p>' +
        '<div class="bk__summary" style="text-align:left"><dl style="margin:0">' +
          row('Treatment', pick.treatment + ' · ' + pick.area) +
          row('With', pick.specialist) +
          row('When', pick.dateLabel + ' at ' + pick.time) +
          row('Contact', pick.phone) +
        '</dl></div>' +
        '<div style="display:flex;gap:.75rem;flex-wrap:wrap;justify-content:center;margin-top:1.75rem">' +
          '<a class="btn btn--solid" target="_blank" rel="noopener" href="https://wa.me/' + CA.biz.whatsappHref + '?text=' + encodeURIComponent(msg) + '">Send on WhatsApp</a>' +
          '<a class="btn" href="tel:' + CA.biz.phoneHref + '">Call the salon</a>' +
        '</div>' +
      '</div>';
    dots.forEach(function (d) { d.classList.add('is-on'); });
    stepEl.textContent = 'Complete';
    backEl.style.visibility = 'hidden';
    nextEl.style.display = 'none';
    window.dispatchEvent(new CustomEvent('ca:rebind', { detail: { root: bodyEl } }));
  }

  /* -------------------------------------------------------- open / close */
  function open() {
    step = 0; render();
    nextEl.style.display = '';
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
    open();
    if (pre && pre !== 'true') {
      var match = CA.disciplines.filter(function (d) { return d.title.toLowerCase() === pre.toLowerCase(); })[0];
      if (match) { pick.area = match.title; step = 1; render(); }
    }
  });
})();
