// Calculators on the solutions and guide pages. The page arrives with the
// starting numbers already worked out (build.py, the same formulas); this
// recalculates as the sliders move. Native range inputs, so every key a
// slider takes works (arrows, Page Up/Down, Home, End). Results change in
// place with no animation, so reduced motion needs nothing different, and
// screen readers hear one summary once the slider rests, not every step.

const MONTH = 52 / 12;
const KINDS = {
  // missed calls (or enquiries) a week, value of one, share who'd book
  recover: (v, c) => {
    const won = v.n * MONTH * v.r / 100;
    return { won: [won, 'count'], monthly: [won * v.v, 'money'], payback: [Math.max(1, Math.ceil(c.price / v.v)), 'count'] };
  },
  // bookings a month through an app, average ticket, the app's share
  commission: (v, c) => {
    const monthly = v.n * v.v * v.r / 100;
    return { monthly: [monthly, 'money'], yearly: [monthly * 12, 'money'], months: [monthly ? c.price / monthly : 0, 'months'] };
  },
  // messages a week, minutes each, share that are repeats
  hours: (v) => ({ hours: [v.n * MONTH * v.t * v.r / 100 / 60, 'hours'] }),
  // builder plan and paid add-ons a month, over a number of years
  tco: (v, c) => ({
    builder: [(v.p + v.a) * 12 * v.y, 'money'],
    ours: [c.price, 'money'],
    ours_care: [c.price + c.care * 12 * Math.max(0, v.y - 1), 'money'],
  }),
};

document.querySelectorAll('[data-calc]').forEach((box) => {
  const cfg = JSON.parse(box.querySelector('[data-calc-cfg]').textContent);
  const { symbol, thousands } = cfg.money;
  const group = (n) => Math.round(n).toLocaleString('en-US').replace(/,/g, thousands);
  const fmt = {
    money: (n) => symbol + group(n),
    count: group,
    hours: group,
    months: (n) => String(Math.round(n * 10) / 10),
    percent: (n) => `${n}%`,
  };
  const inputs = [...box.querySelectorAll('[data-calc-in]')];
  const live = box.querySelector('[data-calc-live]');
  const big = box.querySelector('[data-calc-big]');
  let rest = 0;

  const update = () => {
    const v = {};
    for (const input of inputs) {
      const n = Number(input.value);
      v[input.dataset.calcIn] = n;
      const shown = fmt[input.dataset.unit](n);
      box.querySelector(`[data-calc-out="${input.dataset.calcIn}"]`).textContent = shown;
      input.setAttribute('aria-valuetext', shown);
    }
    for (const [key, [n, unit]] of Object.entries(KINDS[cfg.kind](v, cfg))) {
      const el = box.querySelector(`[data-calc-res="${key}"]`);
      if (el) el.textContent = fmt[unit](n);
    }
    clearTimeout(rest);
    rest = setTimeout(() => { live.textContent = big.textContent.replace(/\s+/g, ' ').trim(); }, 700);
  };
  inputs.forEach((input) => input.addEventListener('input', update));
  box.classList.add('is-live');
});
