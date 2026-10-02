// Dynamic Scheduler: "slide your wake-up time". An illustration of the idea
// (the live bot applies the user's own early, normal or late template).
//
// Data: data/scheduler-demo.json, embedded by the build as #wake-data. Each
// block has a show range (it fades in and out inside it), a duration and a
// priority per zone (they blend across the zone edges, so blocks shrink,
// grow and change places), and optionally an anchor: not before N minutes
// after waking, or not before a clock time. The day is laid out in priority
// order from the wake time; time nothing claims becomes "Open time"; sleep
// starts 16 hours after waking.
//
// Motion is transform and opacity only: every row is absolutely placed and
// moved with translateY, bars scale on X, rows fade. Each frame writes
// inline transform / opacity on just the elements whose value changed (no
// inherited custom properties, which would re-style the whole card), so a
// drag costs almost no style or layout work. The time labels are the one
// thing that needs layout and paint, and a layout pass costs about the
// same however few labels changed, so while the slider is moving they are
// all rewritten together at most every 120 ms, and once more when it stops. Reduced motion:
// the same states, set instantly, and no opening sweep.

const dataEl = document.getElementById('wake-data');
const roots = document.querySelectorAll('[data-wake]');

if (dataEl && roots.length) {
  const D = JSON.parse(dataEl.textContent);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mins = (v) => (typeof v === 'number' ? v : Number(v.slice(0, 2)) * 60 + Number(v.slice(3)));
  const clamp = (t) => Math.min(1, Math.max(0, t));
  const smooth = (t) => { const k = clamp(t); return k * k * (3 - 2 * k); };
  const lo = mins(D.min);
  const hi = mins(D.max);
  const edges = D.zones.map((z) => mins(z.from));

  const zoneAt = (wake) => (wake >= edges[2] ? 2 : wake >= edges[1] ? 1 : 0);

  function plan(wake) {
    // Each blend runs over the last D.blend minutes before a zone edge, so a
    // zone is fully itself from its first minute (07:00 is a whole Normal day)
    const a = smooth((wake - (edges[1] - D.blend)) / D.blend);
    const b = smooth((wake - (edges[2] - D.blend)) / D.blend);
    const mix = (v) => { const [e, n, l] = v.map(mins); const x = e + (n - e) * a; return x + (l - x) * b; };
    const end = wake + D.day;
    const blocks = D.blocks.map((blk) => {
      const [s0, s1] = blk.show.map(mins);
      const weight = wake < s0 || wake > s1 ? 0
        : Math.min(s0 <= lo ? 1 : clamp((wake - s0) / D.fade), s1 >= hi ? 1 : clamp((s1 - wake) / D.fade));
      const dur = mix(blk.duration) * weight;
      let at = wake;
      if (blk.anchor?.wake) at = wake + mix(blk.anchor.wake);
      if (blk.anchor?.clock) { at = mix(blk.anchor.clock); while (at < wake) at += 1440; }
      return { id: blk.id, label: blk.label, dur, at, pri: mix(blk.priority), o: weight * clamp((dur - 6) / 12) };
    }).filter((x) => x.o > 0.02).sort((x, y) => x.pri - y.pri);

    const rows = [];
    let cursor = wake;
    const open = (until, key) => {
      const gap = until - cursor;
      if (gap >= D.gap.from) rows.push({ id: `open-${key}`, label: D.gap.label, start: cursor, dur: gap, o: clamp((gap - D.gap.from) / 30 + 0.25), kind: 'open' });
    };
    for (const blk of blocks) {
      const dur = Math.min(blk.dur, Math.max(0, end - cursor));
      const start = Math.max(cursor, Math.min(blk.at, end - dur));
      open(start, blk.id);
      rows.push({ id: blk.id, label: blk.label, start, dur, o: blk.o, kind: 'block' });
      cursor = start + dur;
    }
    open(end, 'sleep');
    rows.push({ id: 'sleep', label: D.sleep.label, start: end, dur: D.sleep.duration, o: 1, kind: 'sleep' });
    return rows;
  }

  const hhmm = (m) => {
    const t = ((Math.round(m) % 1440) + 1440) % 1440;
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  };
  const spoken = (m) => {
    const t = ((Math.round(m) % 1440) + 1440) % 1440;
    const h = Math.floor(t / 60);
    return `${h % 12 || 12}:${String(t % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  };
  const length = (m) => {
    const t = Math.round(m / 5) * 5;
    return t < 60 ? `${t}m` : `${Math.floor(t / 60)}h${t % 60 ? ` ${t % 60}m` : ''}`;
  };

  roots.forEach((root) => {
    const range = root.querySelector('[data-wake-range]');
    const timeEl = root.querySelector('[data-wake-time]');
    const zoneEl = root.querySelector('[data-wake-zone]');
    const lineEl = root.querySelector('[data-wake-line]');
    const list = root.querySelector('[data-wake-list]');
    const spokenList = root.querySelector('[data-wake-spoken]');
    const live = root.querySelector('[data-wake-live]');
    const thumb = root.querySelector('.wk__thumb');
    // The readout is an odometer: an hour reel and a minute reel, moved by
    // transform, so the number follows the thumb without any layout. The
    // same time as text (for assistive tech) is written with the labels.
    const hours = Array.from({ length: Math.floor(hi / 60) - Math.floor(lo / 60) + 1 }, (_, i) => Math.floor(lo / 60) + i);
    const minutes = Array.from({ length: 60 / D.step }, (_, i) => i * D.step);
    const reel = (values) => `<span class="wk__reel"><span>${values.map((v) => `<span>${String(v).padStart(2, '0')}</span>`).join('')}</span></span>`;
    timeEl.innerHTML = `<span class="sr-only">${timeEl.textContent}</span><span class="wk__odo" aria-hidden="true">${reel(hours)}<span class="wk__colon">:</span>${reel(minutes)}</span>`;
    const timeText = timeEl.querySelector('.sr-only').firstChild;
    const [hourReel, minuteReel] = [...timeEl.querySelectorAll('.wk__reel > span')];
    const limit = Number(list.dataset.limit) || Infinity; // the compact version shows the start of the day
    const rowEls = new Map();
    // Write only what changed: `was` remembers the last value per element
    const put = (el, key, value, write) => {
      const was = el.wk || (el.wk = {});
      if (was[key] === value) return;
      was[key] = value;
      write(value);
    };
    let zone = -1;
    let spokenTimer = 0;
    let travel = 0;      // how far the thumb can move, in px
    let shownWake = Number(range.value);
    const LABEL_EVERY = 120; // ms between label rewrites while moving
    let labelsAt = 0;
    // "Moving": renders arriving in quick succession (a drag, the sweep).
    // Bars and reels then follow each frame directly; re-starting a CSS
    // transition on every frame costs more than it smooths.
    let renderedAt = 0;
    let moving = false;
    let stillTimer = 0;
    const still = () => { moving = false; root.classList.remove('is-moving'); };
    let textTimer = 0;       // the catch-up write, once movement stops
    const label = (row) => {
      const el = rowEls.get(row.id);
      put(el, 'at', hhmm(row.start), (v) => { el.parts.at.data = v; });
      put(el, 'next', Math.round(row.start) >= 1440, (v) => { el.classList.toggle('is-next', v); });
      put(el, 'len', length(row.dur), (v) => { el.parts.len.data = v; });
    };
    const labels = (rows, wake) => {
      labelsAt = performance.now();
      rows.forEach(label);
      put(timeEl, 'text', hhmm(Math.round(wake / D.step) * D.step), (v) => { timeText.data = v; });
    };

    const rowFor = (row) => {
      let el = rowEls.get(row.id);
      if (!el) {
        el = document.createElement('li');
        el.className = `wk__row wk__row--${row.kind}`;
        el.innerHTML = '<span class="wk__at"> </span><span class="wk__label"></span><span class="wk__len"> </span><span class="wk__bar"><span></span></span>';
        el.querySelector('.wk__label').textContent = row.label;
        // Times change every step: keep the text nodes and rewrite their data
        // (a new node would be re-styled; changed data is only re-laid-out)
        el.parts = { at: el.querySelector('.wk__at').firstChild, len: el.querySelector('.wk__len').firstChild, bar: el.querySelector('.wk__bar span') };
        list.append(el);
        rowEls.set(row.id, el);
        void el.offsetWidth; // start from hidden (CSS opacity 0), so the first show fades in
      }
      return el;
    };
    const place = (el, i, o) => {
      put(el, 'i', i, (v) => { el.style.transform = `translateY(calc(${v} * var(--wk-row)))`; });
      put(el, 'o', o, (v) => { el.style.opacity = v; });
    };

    // wake may be fractional (the opening sweep); announce = a person moved it
    const render = (wake, { announce = false } = {}) => {
      const now = performance.now();
      if (now - renderedAt < 90 && !moving) { moving = true; root.classList.add('is-moving'); }
      renderedAt = now;
      clearTimeout(stillTimer);
      if (moving) stillTimer = setTimeout(still, 160);
      const rows = plan(wake);
      const seen = new Set();
      rows.forEach((row, i) => {
        const el = rowFor(row);
        seen.add(row.id);
        place(el, Math.min(i, limit), i < limit ? row.o.toFixed(2) : '0');
        put(el, 'd', clamp(row.dur / D.bar).toFixed(3), (v) => { el.parts.bar.style.transform = `scaleX(${v})`; });
        if (!el.wk.at) label(row); // a new row never shows an empty time
      });
      clearTimeout(textTimer);
      if (performance.now() - labelsAt >= LABEL_EVERY) labels(rows, wake);
      else textTimer = setTimeout(() => labels(rows, wake), LABEL_EVERY);
      rowEls.forEach((el, id) => { if (!seen.has(id)) put(el, 'o', '0', (v) => { el.style.opacity = v; }); });

      const z = zoneAt(wake);
      const stepped = Math.round(wake / D.step) * D.step;
      put(hourReel, 'n', Math.floor(stepped / 60) - hours[0], (v) => { hourReel.style.transform = `translateY(${-v}em)`; });
      put(minuteReel, 'n', (stepped % 60) / D.step, (v) => { minuteReel.style.transform = `translateY(${-v}em)`; });
      put(range, 'text', `Wake at ${spoken(stepped)}, ${D.zones[z].name.toLowerCase()}`, (v) => { range.setAttribute('aria-valuetext', v); });
      // In pixels (a container-relative unit here would re-resolve the
      // container on every frame); `travel` is measured below
      if (travel) put(thumb, 'x', ((wake - lo) / (hi - lo) * travel).toFixed(1), (v) => { thumb.style.transform = `translateX(${v}px)`; });
      shownWake = wake;
      if (z !== zone) {
        zone = z;
        root.dataset.zone = D.zones[z].id;
        zoneEl.textContent = D.zones[z].name;
        lineEl.textContent = D.zones[z].line;
        // Announced only when a person crosses into another zone
        if (announce) live.textContent = `${D.zones[z].name}. ${D.zones[z].line}`;
      }
      // The readable list for assistive tech, once the slider settles
      clearTimeout(spokenTimer);
      spokenTimer = setTimeout(() => {
        spokenList.replaceChildren(...rows.slice(0, limit).filter((r) => r.o > 0.5).map((r) => {
          const li = document.createElement('li');
          li.textContent = `${spoken(r.start)}${Math.round(r.start) >= 1440 ? ' the next day' : ''}: ${r.label}, ${length(r.dur)}`;
          return li;
        }));
      }, 250);
    };

    // --- the opening sweep: once, gently, and any touch ends it -------------
    // While it runs, only the drawn slider moves: the native input is set
    // once, when the sweep ends or is interrupted (writing its value every
    // frame makes the browser lay the page out every frame).
    let sweep = 0;
    const settle = () => {
      sweep = 0;
      root.classList.remove('is-sweeping');
      range.value = String(Math.round(shownWake / D.step) * D.step);
      render(Number(range.value));
    };
    const stop = () => {
      if (!sweep) return;
      cancelAnimationFrame(sweep);
      settle();
    };
    const run = () => {
      const path = [Number(range.value), lo, hi, Number(range.value)];
      const legs = path.slice(1).map((v, i) => Math.abs(v - path[i]));
      const total = legs.reduce((s, v) => s + v, 0);
      const t0 = performance.now();
      const dur = 4200;
      root.classList.add('is-sweeping');
      const tick = (now) => {
        const k = clamp((now - t0) / dur);
        let d = (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2) * total; // ease in-out along the whole path
        let i = 0;
        while (i < legs.length - 1 && d > legs[i]) { d -= legs[i]; i++; }
        render(path[i] + Math.sign(path[i + 1] - path[i]) * Math.min(d, legs[i]));
        if (k < 1) sweep = requestAnimationFrame(tick);
        else settle();
      };
      sweep = requestAnimationFrame(tick);
    };
    let touched = false;
    ['pointerdown', 'touchstart', 'keydown'].forEach((type) =>
      root.addEventListener(type, () => { touched = true; stop(); }, { passive: true }));

    range.addEventListener('input', () => { stop(); render(Number(range.value), { announce: true }); });
    // PageUp / PageDown move an hour (arrows, Home and End are native)
    range.addEventListener('keydown', (e) => {
      const hop = e.key === 'PageUp' ? 60 : e.key === 'PageDown' ? -60 : 0;
      if (!hop) return;
      e.preventDefault();
      range.value = String(Math.min(hi, Math.max(lo, Number(range.value) + hop)));
      render(Number(range.value), { announce: true });
    });

    render(Number(range.value));
    root.classList.add('is-ready');
    // The thumb's travel: the track's width less the thumb's own
    new ResizeObserver(([entry]) => {
      travel = entry.contentRect.width - thumb.offsetWidth;
      (thumb.wk ||= {}).x = null;
      render(shownWake);
    }).observe(root.querySelector('.wk__slider'));

    if (!reduced.matches) {
      const io = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        if (!touched && !reduced.matches) setTimeout(() => { if (!touched) run(); }, 350);
      }, { threshold: 0.45 });
      io.observe(root.querySelector('.wk__slider'));
    }
  });
}
