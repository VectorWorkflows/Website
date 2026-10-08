// Quote a selection of services from the pricing the build embeds in the page
// (data/pricing.json → <script type="application/json" id="pricing-data">).
// Shared by /start and the services page, and the same rules as build.py's
// Quoter, so a total is worked out one way everywhere and always matches the
// prices printed on the page.
//
// Rules (all values come from the data):
// · The first system is at its own price; each further one at its bundle rate.
// · A service related to a system being paid for rides on it at the add-on
//   rate (never on another add-on, a setup, or a cheaper system).
// · The cheapest valid arrangement wins. Savings are against standard prices.
// · From three services up (data.customFrom) the price is custom: the total
//   is shown as "Your price will be under …", never as a total.

const el = document.getElementById('pricing-data');
const data = el ? JSON.parse(el.textContent) : null;
// Amounts print as the data says (symbol, thousands separator, decimals),
// the same as build.py's money_format
const fmt = data ? data.money : null;

const money = (n) => {
  const [whole, frac] = n.toFixed(fmt.decimals).split('.');
  return `${fmt.symbol}${whole.replace(/\B(?=(\d{3})+$)/g, fmt.thousands)}${frac ? `.${frac}` : ''}`;
};

let related = {};
if (data) {
  related = Object.fromEntries(data.order.map((s) => [s, new Set()]));
  data.related.forEach(([a, b]) => { related[a].add(b); related[b].add(a); });
}
const svc = (s) => data.services[s];
const hosts = (slug) => (svc(slug).neverAddon ? [] : data.order.filter((s) =>
  related[slug].has(s) && svc(s).kind === 'system' && svc(s).standard >= svc(slug).standard));

function quote(slugs) {
  const picked = data.order.filter((s) => slugs.includes(s));
  let best = null;
  for (let mask = 1; mask < 1 << picked.length; mask++) {
    const paid = picked.filter((_, i) => mask >> i & 1);
    const systems = paid.filter((s) => svc(s).kind === 'system');
    const anchor = systems.reduce((a, s) => (a === null || svc(s).now - svc(s).bundle < svc(a).now - svc(a).bundle ? s : a), null);
    const lines = [];
    let ok = true;
    for (const s of picked) {
      if (paid.includes(s)) {
        const full = svc(s).kind === 'setup' || s === anchor;
        lines.push({ slug: s, price: full ? svc(s).now : svc(s).bundle, basis: full ? 'own' : 'bundle', via: '' });
        continue;
      }
      const via = hosts(s).find((h) => paid.includes(h));
      if (!via) { ok = false; break; }
      lines.push({ slug: s, price: data.addon[svc(s).kind], basis: 'addon', via });
    }
    if (!ok) continue;
    const total = lines.reduce((sum, l) => sum + l.price, 0);
    if (!best || total < best.total) best = { total, lines };
  }
  const lines = (best?.lines || []).map((l) => ({
    ...l,
    name: svc(l.slug).name,
    standard: svc(l.slug).standard,
    note: l.basis === 'addon' ? `with the ${svc(l.via).short}` : l.basis === 'bundle' ? 'bundle rate' : '',
  }));
  const total = best?.total || 0;
  const standard = lines.reduce((sum, l) => sum + l.standard, 0);
  const own = lines.reduce((sum, l) => sum + svc(l.slug).now, 0);
  const pack = data.packs.find((p) => p.services.length === picked.length && p.services.every((s) => picked.includes(s))) || null;
  return {
    count: lines.length,
    total,
    own,
    saving: standard - total,
    lines,
    pack,
    // From data.customFrom services up (unless it's exactly a named pack) the
    // price is custom: the total is a ceiling, and the real price is set on a call
    custom: lines.length >= data.customFrom && !pack,
    launch: data.launch,
  };
}

// The best next step from the current selection: a pack it's part of, or one
// related service, whichever takes the most off buying the extra on its own.
// Packs are preferred when they tie. Returns null when nothing pairs.
function suggest(slugs) {
  const picked = data.order.filter((s) => slugs.includes(s));
  if (!picked.length) return null;
  const now = quote(picked).total;
  const candidates = [];
  const consider = (add, pack) => {
    const next = quote([...picked, ...add]);
    const own = add.reduce((sum, s) => sum + svc(s).now, 0);
    const extra = next.total - now;
    if (extra < own) candidates.push({ add, pack, extra, own, off: own - extra, total: next.total, saving: next.saving });
  };
  data.packs.forEach((p) => {
    const missing = p.services.filter((s) => !picked.includes(s));
    if (missing.length && missing.length < p.services.length) consider(missing, p);
  });
  data.order.filter((s) => !picked.includes(s)).forEach((s) => {
    const pairs = svc(s).kind === 'setup'
      ? hosts(s).some((h) => picked.includes(h))
      : hosts(s).some((h) => picked.includes(h)) || picked.some((p) => hosts(p).includes(s));
    if (pairs && !candidates.some((c) => c.add.length === 1 && c.add[0] === s)) consider([s], null);
  });
  // Best share taken off first (in whole percent, so near-ties count as
  // ties); on a tie a named pack wins, then the bigger saving
  const pct = (c) => Math.round((c.off / c.own) * 100);
  candidates.sort((a, b) => pct(b) - pct(a) || !!b.pack - !!a.pack || b.off - a.off);
  return candidates[0] || null;
}

// e.g. "2 services · $… at launch pricing (you save $…)", or for a custom
// price "4 services · your price will be under $… (custom price for the set)"
function describe(q) {
  if (!q.count) return '';
  const what = q.pack ? q.pack.name : `${q.count} service${q.count === 1 ? '' : 's'}`;
  const when = q.launch ? ' at launch pricing' : '';
  if (q.custom) return `${what} · ${data.under.toLowerCase()} ${money(q.total)} (custom price for the set)`;
  const save = q.saving > 0 ? ` (you save ${money(q.saving)})` : '';
  return `${what} · ${money(q.total)}${when}${save}`;
}

// "A, B and C"
const list = (names) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

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

// Fill a suggestion block ([data-offer]) for the current picks. The block
// holds [data-offer-title], [data-offer-text] and a [data-offer-add] button;
// onAdd receives the slugs to tick. Returns the suggestion (or null).
function renderOffer(box, slugs, onAdd) {
  if (!box) return null;
  const s = suggest(slugs);
  box.hidden = !s;
  if (!s) return null;
  const names = s.add.map((x) => svc(x).name);
  const title = box.querySelector('[data-offer-title]');
  const text = box.querySelector('[data-offer-text]');
  const btn = box.querySelector('[data-offer-add]');
  title.textContent = s.pack ? `${s.pack.name} · ${money(s.total)}` : `Pairs well · ${money(s.total)} together`;
  text.textContent = `Get ${list(names)} for only ${money(s.extra)} (instead of ${money(s.own)}).`;
  btn.querySelector('[data-offer-label]').textContent = s.add.length === 1 ? 'Add it' : 'Add both';
  btn.onclick = () => onAdd(s.add);
  return s;
}

if (data) window.vwPricing = { data, quote, suggest, describe, money, countTo, renderOffer, list };
