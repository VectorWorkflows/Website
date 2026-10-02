// Services page bundle builder: tick services on their cards and a bar
// counts the total up, with the saving, using the same pricing.js as /start.
// The bar suggests the best pack or pairing for what's picked. From three
// services up the price is custom: the total reads "Your price will be
// under …" and the bar offers a call to set it.
// "Continue" carries the picks into the intake (/start/?service=a,b).
//
// Picks persist for the session. Reduced motion: the bar appears without
// sliding and numbers are set, not counted.

const pricing = window.vwPricing;
const bar = document.querySelector('[data-bundle]');

if (pricing && bar) {
  const KEY = 'vw-bundle';
  const boxes = [...document.querySelectorAll('input[data-pick]')];
  const totalEl = bar.querySelector('[data-bundle-total]');
  const countEl = bar.querySelector('[data-bundle-count]');
  const saveEl = bar.querySelector('[data-bundle-save]');
  const go = bar.querySelector('[data-bundle-go]');
  const offer = bar.querySelector('[data-offer]');
  const talk = bar.querySelector('[data-talk]');
  const talkLink = bar.querySelector('[data-talk-link]');
  const under = bar.querySelector('[data-bundle-under]');
  const live = document.querySelector('[data-bundle-live]');
  const start = go.getAttribute('href');
  const cal = talkLink.getAttribute('href');
  let liveTimer = 0;

  const picked = () => boxes.filter((b) => b.checked).map((b) => b.value);

  const add = (slugs) => {
    boxes.forEach((b) => { if (slugs.includes(b.value)) b.checked = true; });
    update();
  };

  const update = ({ announce = true } = {}) => {
    const slugs = picked();
    const q = pricing.quote(slugs);
    try { sessionStorage.setItem(KEY, JSON.stringify(slugs)); } catch {}
    document.documentElement.classList.toggle('has-bundle', q.count > 0);
    bar.classList.toggle('is-open', q.count > 0);
    bar.inert = q.count === 0;
    // Cards show what each pick costs in this bundle
    boxes.forEach((b) => {
      const line = q.lines.find((l) => l.slug === b.value);
      const note = b.closest('.pick')?.querySelector('[data-pick-note]');
      if (note) note.textContent = !line || line.basis === 'own' ? '' : line.basis === 'addon' ? `only ${pricing.money(line.price)} ${line.note}` : `${pricing.money(line.price)} · ${line.note}`;
    });
    // Three or more: a custom price, set on a call (the total becomes a
    // ceiling); below that, suggest the pack or pairing that takes the most off
    talk.hidden = !q.custom;
    under.hidden = !q.custom;
    let s = null;
    if (q.custom) {
      offer.hidden = true;
      const notes = `Services: ${q.lines.map((l) => l.name).join(', ')}. Quoted on the site: ${pricing.describe(q)}.`;
      talkLink.href = `${cal}?notes=${encodeURIComponent(notes)}`;
    } else {
      s = pricing.renderOffer(offer, slugs, add);
    }
    if (!q.count) {
      totalEl.dataset.value = '0';
      if (announce) live.textContent = 'Bundle cleared.';
      return;
    }
    countEl.textContent = q.pack ? q.pack.name : `${q.count} service${q.count === 1 ? '' : 's'}`;
    pricing.countTo(totalEl, q.total);
    saveEl.textContent = q.saving > 0 && !q.custom ? `You save ${pricing.money(q.saving)}` : '';
    go.href = `${start}?service=${slugs.join(',')}`;
    if (announce) {
      clearTimeout(liveTimer);
      const extra = q.custom ? ' Custom pricing unlocked: one price for the whole set, on a 15-minute call.' : s ?` Suggested: get ${pricing.list(s.add.map((x) => pricing.data.services[x].name))} for only ${pricing.money(s.extra)}, instead of ${pricing.money(s.own)}.` : '';
      liveTimer = setTimeout(() => { live.textContent = `Bundle: ${pricing.describe(q)}.${extra}`; }, 700);
    }
  };

  boxes.forEach((b) => b.addEventListener('change', () => update()));
  document.querySelectorAll('[data-pack-add]').forEach((btn) =>
    btn.addEventListener('click', () => add(btn.dataset.packAdd.split(','))));
  bar.querySelector('[data-bundle-clear]').addEventListener('click', () => {
    boxes.forEach((b) => { b.checked = false; });
    update();
    boxes[0]?.focus();
  });

  let saved = [];
  try { saved = JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch {}
  boxes.forEach((b) => { b.checked = saved.includes(b.value); });
  update({ announce: false });
}
