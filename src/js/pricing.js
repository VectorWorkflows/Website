// Quote a selection of services from the pricing the build embeds in the page
// (data/pricing.json → <script type="application/json" id="pricing-data">).
// Shared by /start and the services page, so a total is worked out one way
// everywhere and always matches the prices printed on the page.
//
// Rules (all values come from the data):
// · Two or more services that count toward the bundle: each at its bundle rate.
// · Setup services are free alongside a website and never count toward it.
// · The saving is measured against standard prices.

const el = document.getElementById('pricing-data');
const data = el ? JSON.parse(el.textContent) : null;
const inr = new Intl.NumberFormat('en-IN');

const money = (n) => `₹${inr.format(n)}`;

function quote(slugs) {
  const picked = slugs.filter((s) => data.services[s]);
  const tier = (s) => data.tiers[data.services[s].tier];
  const counted = picked.filter((s) => tier(s).counts).length;
  const bundle = counted >= data.bundleMin;
  const lines = picked.map((slug) => {
    const t = tier(slug);
    let price = t.now;
    let note = '';
    if (t.freeWith && picked.includes(t.freeWith)) {
      price = 0;
      note = `free with ${data.services[t.freeWith].name.toLowerCase()}`;
    } else if (bundle && t.counts) {
      price = t.bundle;
      note = 'bundle price';
    }
    return { slug, name: data.services[slug].name, price, standard: t.standard, note };
  });
  const total = lines.reduce((sum, l) => sum + l.price, 0);
  const standard = lines.reduce((sum, l) => sum + l.standard, 0);
  return { count: lines.length, total, saving: standard - total, lines, bundle, launch: data.launch };
}

// e.g. "3 services · ₹… at launch pricing (you save ₹…)"
function describe(q) {
  if (!q.count) return '';
  const what = `${q.count} service${q.count === 1 ? '' : 's'}`;
  const when = q.launch ? ' at launch pricing' : '';
  const save = q.saving > 0 ? ` (you save ${money(q.saving)})` : '';
  return `${what} · ${money(q.total)}${when}${save}`;
}

// Count a number up (or down) to its new value. Reduced motion: set it.
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
function countTo(node, to) {
  const from = Number(node.dataset.value || 0);
  node.dataset.value = String(to);
  cancelAnimationFrame(node._raf);
  if (reduced.matches || from === to) {
    node.textContent = money(to);
    return;
  }
  const start = performance.now();
  const dur = 520;
  const step = (now) => {
    const k = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - k, 4);
    node.textContent = money(Math.round(from + (to - from) * eased));
    if (k < 1) node._raf = requestAnimationFrame(step);
  };
  node._raf = requestAnimationFrame(step);
}

if (data) window.vwPricing = { data, quote, describe, money, countTo };
