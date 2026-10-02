// Intake flow: three screens. No backend: the answers are composed into a
// message the visitor sends themselves (WhatsApp or mailto:), or they book a
// 15-minute call on the booking page instead.
//
// · Screen 1 is a multi-select of services with a live total, worked out by
//   pricing.js from the same data that prints the prices on the page.
// · Each screen is a history entry, so the browser Back button steps back.
// · Answers persist in sessionStorage: a mistype, a reload or a trip to
//   WhatsApp and back never loses anything.
// · Validation is inline and only after an attempt to continue.
// · Focus moves to each new question; a live region announces the step.

const form = document.querySelector('[data-intake]');
const pricing = window.vwPricing;

if (form && pricing) {
  const config = JSON.parse(document.getElementById('intake-config').textContent);
  const steps = [...form.querySelectorAll('.intake__step')];
  const total = steps.length;
  const $ = (sel) => form.querySelector(sel);
  const live = $('[data-live]');
  const backBtn = $('[data-back]');
  const nextLabel = $('[data-next-label]');
  const nav = $('.intake__nav');
  const done = $('[data-done]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ease = getComputedStyle(document.documentElement).getPropertyValue('--ease-out').trim() || 'ease';
  const KEY = 'vw-intake-2';
  let current = 1;

  const boxes = [...form.querySelectorAll('input[name="svc"]')];
  const unsure = form.elements.unsure;
  const picked = () => boxes.filter((b) => b.checked).map((b) => b.value);

  // --- persistence --------------------------------------------------------
  const text = ['timeline', 'process', 'name', 'business', 'via'];
  const read = () => {
    const fd = new FormData(form);
    return {
      svc: picked(),
      unsure: unsure.checked,
      ...Object.fromEntries(text.map((f) => [f, (fd.get(f) || '').toString().trim()])),
    };
  };
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(read())); } catch {} };
  const restore = () => {
    let data = {};
    try { data = JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch {}
    // ?service=a,b (from a service card or the bundle builder) is a fresh,
    // explicit choice, so it wins over what was saved
    const params = new URLSearchParams(location.search);
    const preset = (params.get('service') || params.get('need') || '').split(',').filter(Boolean);
    if (preset.length) {
      data.svc = preset;
      data.unsure = false;
    }
    boxes.forEach((b) => { b.checked = (data.svc || []).includes(b.value); });
    unsure.checked = !!data.unsure && !picked().length;
    for (const name of text) {
      const value = data[name];
      const els = form.elements[name];
      if (!value || !els) continue;
      if (els instanceof RadioNodeList) [...els].forEach((el) => { el.checked = el.value === value; });
      else els.value = value;
    }
  };

  // --- live total ----------------------------------------------------------
  const quoteBox = $('[data-quote]');
  const totalEl = $('[data-quote-total]');
  let liveTimer = 0;
  const addPicks = (slugs) => {
    boxes.forEach((b) => { if (slugs.includes(b.value)) b.checked = true; });
    unsure.checked = false;
    updateQuote();
    save();
    summarise();
  };
  const updateQuote = () => {
    const q = pricing.quote(picked());
    // Chips show what each pick costs in this selection: a related service
    // shows its reduced price, a further system its bundle rate
    boxes.forEach((b) => {
      const tag = b.parentElement.querySelector('.chip__price');
      const line = q.lines.find((l) => l.slug === b.value);
      const cheaper = line && line.basis !== 'own';
      tag.textContent = cheaper ? pricing.money(line.price) : tag.dataset.price;
      tag.classList.toggle('is-free', !!cheaper);
    });
    quoteBox.hidden = !q.count;
    $('[data-talk]').hidden = !q.talk;
    if (q.talk) $('[data-offer]').hidden = true;
    else pricing.renderOffer($('[data-offer]'), picked(), addPicks);
    if (!q.count) {
      totalEl.dataset.value = '0';
      return q;
    }
    $('[data-quote-count]').textContent = `${q.pack ? q.pack.name : `${q.count} service${q.count === 1 ? '' : 's'}`} ·`;
    pricing.countTo(totalEl, q.total);
    const save$ = $('[data-quote-save]');
    const notes = q.lines.filter((l) => l.note).map((l) => `${l.name}: ${l.basis === 'addon' ? 'only ' : ''}${pricing.money(l.price)} ${l.basis === 'addon' ? l.note : `(${l.note})`}`);
    save$.hidden = q.saving <= 0;
    save$.textContent = q.saving > 0
      ? `You save ${pricing.money(q.saving)} against standard prices${notes.length ? `. ${notes.join(' · ')}.` : '.'}`
      : '';
    // One calm announcement once the picking pauses, not one per tick
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => { $('[data-quote-live]').textContent = pricing.describe(q); }, 700);
    return q;
  };

  // "Not sure" and specific services exclude each other
  boxes.forEach((b) => b.addEventListener('change', () => {
    if (b.checked) unsure.checked = false;
    updateQuote();
  }));
  unsure.addEventListener('change', () => {
    if (unsure.checked) boxes.forEach((b) => { b.checked = false; });
    updateQuote();
  });

  // --- validation ---------------------------------------------------------
  const rules = {
    1: ['svc'],
    2: ['timeline'],
    3: ['name', 'business'],
  };
  const controls = (name) => (name === 'svc' ? [...boxes, unsure] : (() => {
    const els = form.elements[name];
    return els instanceof RadioNodeList ? [...els] : [els];
  })());
  const showError = (name, on) => {
    const msg = form.querySelector(`[data-error="${name}"]`);
    if (msg) msg.hidden = !on;
    controls(name).forEach((el) => el && el.setAttribute('aria-invalid', String(on)));
  };
  // Booking a call: the booking page asks for name and business, so this
  // form doesn't (asked once, not twice)
  const byCall = () => form.elements.via.value === 'call';
  const valid = (name) => {
    if (name === 'svc') return picked().length > 0 || unsure.checked;
    if ((name === 'name' || name === 'business') && byCall()) return true;
    const els = form.elements[name];
    if (els instanceof RadioNodeList) return !!els.value;
    return els.value.trim().length >= (Number(els.getAttribute('minlength')) || 1);
  };
  const check = (step) => {
    const failed = rules[step].filter((name) => !valid(name));
    rules[step].forEach((name) => showError(name, failed.includes(name)));
    return failed;
  };
  // Clear an error the moment it's fixed (never before the first attempt)
  form.addEventListener('input', (e) => {
    const name = e.target.name === 'unsure' ? 'svc' : e.target.name;
    const msg = form.querySelector(`[data-error="${name}"]`);
    if (msg && !msg.hidden && valid(name)) showError(name, false);
    save();
    summarise();
  });

  // --- summary rail ------------------------------------------------------
  const summarise = () => {
    const data = read();
    const q = pricing.quote(data.svc);
    const values = {
      services: data.unsure ? 'Not sure yet' : q.lines.map((l) => l.name).join(', '),
      total: q.count ? pricing.money(q.total) : '',
      timeline: data.timeline,
      business: data.business,
    };
    form.querySelectorAll('[data-sum]').forEach((row) => {
      const value = values[row.dataset.sum];
      row.hidden = !value;
      row.querySelector('dd').textContent = value;
    });
  };

  // --- navigation ---------------------------------------------------------
  const labels = { whatsapp: 'Open WhatsApp', email: 'Open email', call: 'Book the call' };
  const render = (n, { focus = true, direction = 1 } = {}) => {
    const from = steps[current - 1];
    const to = steps[n - 1];
    current = n;
    if (from !== to) {
      from.classList.remove('is-current');
      to.classList.add('is-current');
      if (!reduced) {
        to.animate(
          [{ opacity: 0, transform: `translateX(${direction * 2.5}rem)` }, { opacity: 1, transform: 'none' }],
          { duration: 520, easing: ease }
        );
      }
    }
    const call = byCall();
    $('[data-who]').hidden = call;
    $('[data-callnote]').hidden = !call;
    if (call) ['name', 'business'].forEach((f) => showError(f, false));
    form.querySelector('[data-count]').textContent = n;
    form.querySelectorAll('.intake__bar li').forEach((li, i) => li.classList.toggle('is-done', i < n));
    backBtn.hidden = n === 1;
    nextLabel.textContent = n === total ? labels[form.elements.via.value] || 'Continue' : 'Continue';
    live.textContent = `Step ${n} of ${total}: ${to.dataset.name}`;
    if (focus) to.querySelector('.intake__q').focus({ preventScroll: true });
    if (focus && to.getBoundingClientRect().top < 80) form.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  };

  const go = (n, push = true) => {
    const dir = n > current ? 1 : -1;
    render(n, { direction: dir });
    if (push) history.pushState({ intakeStep: n }, '', `#step-${n}`);
  };

  [...form.querySelectorAll('input[name="via"]')].forEach((el) => el.addEventListener('change', () => render(current, { focus: false })));

  backBtn.addEventListener('click', () => history.back());

  window.addEventListener('popstate', (e) => {
    if (!done.hidden) finishReset(false);
    const n = e.state?.intakeStep || 1;
    render(Math.min(Math.max(n, 1), total), { direction: n < current ? -1 : 1 });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const failed = check(current);
    if (failed.length) {
      controls(failed[0])[0]?.focus();
      return;
    }
    save();
    if (current < total) go(current + 1);
    else send();
  });

  // --- compose and hand off ----------------------------------------------
  // For a call the booking page already has the name and business, so the
  // notes skip the greeting
  const compose = (d, { greet = true } = {}) => {
    const q = pricing.quote(d.svc);
    const lines = greet ? [`Hi Vector Workflows, I'm ${d.name} from ${d.business}.`, ''] : [];
    if (d.unsure || !q.count) {
      lines.push("What I need: not sure yet, I'd like help choosing.");
    } else {
      lines.push('Services:');
      q.lines.forEach((l) => lines.push(`· ${l.name} ${pricing.money(l.price)}${l.note ? ` (${l.note})` : ''}`));
      lines.push(`Quoted total: ${pricing.describe(q)}`);
      if (q.talk) lines.push("I'd like to talk the price through for these.");
    }
    lines.push(`Timeline: ${d.timeline}`);
    if (d.process) lines.push('', 'How we handle this today:', d.process);
    return lines.join('\n');
  };

  const open = (url, newTab) => {
    // Opened inside the submit (a user gesture), so pop-up blockers allow it
    const a = document.createElement('a');
    a.href = url;
    if (newTab) { a.target = '_blank'; a.rel = 'noopener'; }
    a.click();
  };

  const send = () => {
    const d = read();
    const message = compose(d, { greet: d.via !== 'call' });
    const reopen = $('[data-reopen]');
    let url;
    if (d.via === 'call') {
      // Cal.com prefills its "Additional notes" field from ?notes=
      url = `${config.cal}?notes=${encodeURIComponent(message)}`;
      $('[data-done-badge]').textContent = 'Booking page open';
      $('[data-done-title]').textContent = 'Pick a time that suits you.';
      // The earliest bookable time, kept current by chrome.js
      const hint = $('[data-callnote] [data-book-after]').cloneNode(true);
      $('[data-done-text]').replaceChildren(
        'The booking page should have opened in a new tab, with your answers in the notes. ',
        hint,
        '. If the page didn\'t open, use the button below.'
      );
      $('[data-reopen-label]').textContent = 'Open the booking page';
    } else if (d.via === 'email') {
      const subject = d.unsure || !d.svc.length ? `Project enquiry · ${d.business}` : `Project enquiry: ${d.svc.length} service${d.svc.length === 1 ? '' : 's'} · ${d.business}`;
      url = `mailto:${config.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
      $('[data-done-badge]').textContent = 'Message ready';
      $('[data-done-title]').textContent = 'Your message is ready.';
      $('[data-done-text]').textContent = 'Your mail app should have opened with the message filled in. Press send there. If nothing opened, use the button below, or copy the message.';
      $('[data-reopen-label]').textContent = 'Open email again';
    } else {
      // config.whatsapp is the studio's WhatsApp link without its pre-filled text
      url = `${config.whatsapp}?text=${encodeURIComponent(message)}`;
      $('[data-done-badge]').textContent = 'Message ready';
      $('[data-done-title]').textContent = 'Your message is ready.';
      $('[data-done-text]').textContent = 'WhatsApp should have opened in a new tab with the message filled in. Press send there. If it didn\'t open, use the button below, or copy the message.';
      $('[data-reopen-label]').textContent = 'Open WhatsApp again';
    }
    const newTab = d.via !== 'email';
    open(url, newTab);

    $('[data-preview]').textContent = message;
    reopen.href = url;
    if (newTab) { reopen.target = '_blank'; } else { reopen.removeAttribute('target'); }

    steps.forEach((s) => s.classList.remove('is-current'));
    nav.hidden = true;
    done.hidden = false;
    live.textContent = d.via === 'call' ? 'The booking page is open.' : 'Your message is ready to send.';
    done.focus();
  };

  const finishReset = (clear) => {
    done.hidden = true;
    nav.hidden = false;
    if (clear) {
      form.reset();
      try { sessionStorage.removeItem(KEY); } catch {}
      updateQuote();
      summarise();
    }
  };

  $('[data-restart]').addEventListener('click', () => {
    finishReset(true);
    steps[current - 1]?.classList.remove('is-current');
    current = 1;
    steps[0].classList.add('is-current');
    history.replaceState({ intakeStep: 1 }, '', location.pathname);
    render(1);
  });

  $('[data-copy-btn]').addEventListener('click', async (e) => {
    const label = e.currentTarget.querySelector('.btn__label');
    try {
      await navigator.clipboard.writeText($('[data-preview]').textContent);
      label.textContent = 'Copied';
    } catch {
      label.textContent = 'Select the text above to copy';
    }
    setTimeout(() => { label.textContent = 'Copy message'; }, 2400);
  });

  // --- boot ----------------------------------------------------------------
  restore();
  updateQuote();
  summarise();
  const fromHash = Number((location.hash.match(/^#step-(\d)$/) || [])[1]) || 1;
  // Only resume at a later step if every earlier step is already answered
  let start = 1;
  for (let n = 1; n < Math.min(fromHash, total); n++) {
    if (rules[n].every(valid)) start = n + 1; else break;
  }
  // The ?service preset has been applied (and saved): drop it from the URL so
  // a reload keeps later edits instead of re-applying it
  save();
  history.replaceState({ intakeStep: start }, '', location.pathname + (start > 1 ? `#step-${start}` : ''));
  steps.forEach((s) => s.classList.toggle('is-current', Number(s.dataset.step) === start));
  current = start;
  render(start, { focus: false });
  form.classList.add('is-ready');
}
