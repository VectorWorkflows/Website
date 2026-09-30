// Dynamic Scheduler case study: the wake-time slider. Drag the wake-up time
// and the day follows it. Inside a zone every block keeps its offset from
// waking, so the plan slides along the day axis; cross into the next zone and
// that zone's template takes over, and the blocks reorganise (shared tasks
// glide to their new slots, the rest fade in and out).
//
// The templates below are an example set, as the page says; the real bot
// uses the three the user builds. Reduced motion: same states, no movement.

const root = document.querySelector('[data-wake]');

// Minutes after midnight. Each block: [key, label, minutes after waking, length]
const ZONES = [
  {
    id: 'early', name: 'Early', from: 180, to: 480,
    blocks: [
      ['workout', 'Workout', 15, 60],
      ['bath', 'Bath', 80, 30],
      ['meal1', 'Breakfast', 115, 30],
      ['work1', 'Deep work', 150, 180],
      ['lunch', 'Lunch', 340, 45],
      ['work2', 'Work block', 395, 150],
      ['walk', 'Walk & errands', 560, 60],
    ],
  },
  {
    id: 'normal', name: 'Normal', from: 480, to: 840,
    blocks: [
      ['bath', 'Bath', 10, 30],
      ['meal1', 'Breakfast', 45, 30],
      ['work1', 'Deep work', 85, 180],
      ['lunch', 'Lunch', 270, 45],
      ['work2', 'Work block', 325, 120],
      ['workout', 'Workout', 455, 60],
      ['dinner', 'Dinner', 525, 45],
    ],
  },
  {
    id: 'late', name: 'Late', from: 840, to: 1081,
    blocks: [
      ['bath', 'Bath', 10, 25],
      ['meal1', 'First meal', 40, 30],
      ['errands', 'Errands & calls', 80, 80],
      ['work1', 'Deep work', 170, 160],
      ['dinner', 'Dinner', 340, 40],
      ['workout', 'Light workout', 390, 40],
      ['work2', 'Night work block', 440, 100],
    ],
  },
];
const AXIS_FROM = 180; // the axis runs 03:00 → 03:00 next day
const DAY = 1440;

const hhmm = (m) => {
  const t = ((Math.round(m) % DAY) + DAY) % DAY;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
const zoneFor = (wake) => ZONES.find((z) => wake >= z.from && wake < z.to) || ZONES.at(-1);

if (root) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const range = root.querySelector('[data-wake-range]');
  const timeEl = root.querySelector('[data-wake-time]');
  const tplEl = root.querySelector('[data-wake-tpl]');
  const list = root.querySelector('[data-wake-list]');
  const zonesEl = root.querySelector('[data-wake-zones]');
  const axis = root.querySelector('[data-wake-axis]');
  const min = Number(range.min);
  const max = Number(range.max);
  const ease = getComputedStyle(document.documentElement).getPropertyValue('--ease-out').trim() || 'ease';

  // Zone bands under the slider, and hour ticks over the day axis
  zonesEl.innerHTML = ZONES.map((z) => {
    const a = (z.from - min) / (max - min);
    const b = (Math.min(z.to, max) - min) / (max - min);
    return `<li data-zone="${z.id}" style="--a:${a};--b:${b}"><span>${z.name}</span><span class="wake__span">${hhmm(z.from)}–${hhmm(Math.min(z.to, max))}</span></li>`;
  }).join('');
  const ticks = Array.from({ length: 9 }, (_, i) => `<span style="--p:${i / 8}">${hhmm(AXIS_FROM + i * 180)}</span>`).join('');
  axis.innerHTML = `<span></span><span></span><span class="wake__ticks">${ticks}</span>`;

  const rows = new Map(); // key → <li>
  let zone = null;

  const place = (li, wake, [, label, off, len]) => {
    const start = wake + off;
    li.querySelector('.wake__at').textContent = hhmm(start);
    li.querySelector('.wake__label').textContent = label;
    li.style.setProperty('--s', String((start - AXIS_FROM) / DAY));
    li.style.setProperty('--w', String(len / DAY));
  };

  const make = (key) => {
    const li = document.createElement('li');
    li.className = 'wake__block';
    li.dataset.key = key;
    li.innerHTML = '<span class="wake__at"></span><span class="wake__label"></span><span class="wake__track" aria-hidden="true"><span class="wake__bar"></span></span>';
    return li;
  };

  const render = (wake) => {
    const next = zoneFor(wake);
    timeEl.textContent = hhmm(wake);
    range.setAttribute('aria-valuetext', `${hhmm(wake)}, ${next.name.toLowerCase()} template`);
    root.dataset.zone = next.id;

    if (next === zone) {
      next.blocks.forEach((b) => place(rows.get(b[0]), wake, b));
      return;
    }

    // A new template: FLIP the tasks both templates share into their new
    // order, fade in the new ones, fade out the ones that aren't in this day
    const animate = zone && !reduced.matches;
    const first = new Map([...rows].map(([k, li]) => [k, li.getBoundingClientRect().top]));
    const keep = new Set(next.blocks.map((b) => b[0]));
    rows.forEach((li, k) => {
      if (keep.has(k)) return;
      rows.delete(k);
      if (!animate) { li.remove(); return; }
      // Out of the flow where it stands, so the new day lays out around it
      li.style.top = `${li.offsetTop}px`;
      li.classList.add('is-leaving');
      li.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateX(-0.75rem)' }], { duration: 260, easing: ease })
        .onfinish = () => li.remove();
    });
    next.blocks.forEach((b) => {
      const li = rows.get(b[0]) || make(b[0]);
      rows.set(b[0], li);
      list.append(li); // re-append in the new template's order
      place(li, wake, b);
    });
    list.querySelectorAll('.is-leaving').forEach((li) => list.append(li));

    tplEl.textContent = `${next.name} template`;
    if (animate) {
      rows.forEach((li, k) => {
        const was = first.get(k);
        if (was === undefined) {
          li.animate([{ opacity: 0, transform: 'translateX(0.75rem)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 120, easing: ease, fill: 'backwards' });
          return;
        }
        const dy = was - li.getBoundingClientRect().top;
        if (dy) li.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 560, easing: ease });
      });
      tplEl.animate([{ opacity: 0.2, transform: 'scale(0.92)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: ease });
    }
    zone = next;
  };

  range.addEventListener('input', () => render(Number(range.value)));
  render(Number(range.value));
  root.classList.add('is-ready');
}
