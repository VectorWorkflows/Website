// Intake flow: four screens, one question each. No backend: the answers are
// composed into a message the visitor sends themselves (wa.me or mailto:).
//
// · Each screen is a history entry, so the browser Back button steps back.
// · Answers persist in sessionStorage: a mistype, a reload or a trip to
//   WhatsApp and back never loses anything.
// · Validation is inline and only after an attempt to continue.
// · Focus moves to each new question; a live region announces the step.

const form = document.querySelector('[data-intake]');

if (form) {
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
  const KEY = 'vw-intake';
  let current = 1;

  // --- persistence --------------------------------------------------------
  const fields = ['need', 'budget', 'timeline', 'process', 'name', 'business', 'via'];
  const read = () => Object.fromEntries(fields.map((f) => [f, (new FormData(form).get(f) || '').toString().trim()]));
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(read())); } catch {} };
  const restore = () => {
    let data = {};
    try { data = JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch {}
    const preset = new URLSearchParams(location.search).get('need');
    if (preset && !data.need) {
      const match = form.querySelector(`input[name="need"][data-slug="${CSS.escape(preset)}"]`);
      if (match) data.need = match.value;
    }
    for (const [name, value] of Object.entries(data)) {
      if (!value) continue;
      const els = form.elements[name];
      if (!els) continue;
      if (els instanceof RadioNodeList) {
        [...els].forEach((el) => { el.checked = el.value === value; });
      } else {
        els.value = value;
      }
    }
  };

  // --- validation ---------------------------------------------------------
  const rules = {
    1: ['need'],
    2: ['budget', 'timeline'],
    3: [],
    4: ['name', 'business'],
  };
  const showError = (name, on) => {
    const msg = form.querySelector(`[data-error="${name}"]`);
    if (msg) msg.hidden = !on;
    const els = form.elements[name];
    const list = els instanceof RadioNodeList ? [...els] : [els];
    list.forEach((el) => el && el.setAttribute('aria-invalid', String(on)));
  };
  const valid = (name) => {
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
    const name = e.target.name;
    const msg = form.querySelector(`[data-error="${name}"]`);
    if (msg && !msg.hidden && valid(name)) showError(name, false);
    save();
    summarise();
  });

  // --- summary rail ------------------------------------------------------
  const summarise = () => {
    const data = read();
    form.querySelectorAll('[data-sum]').forEach((row) => {
      const value = data[row.dataset.sum];
      row.hidden = !value;
      row.querySelector('dd').textContent = value;
    });
  };

  // --- navigation ---------------------------------------------------------
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
    form.querySelector('[data-count]').textContent = n;
    form.querySelectorAll('.intake__bar li').forEach((li, i) => li.classList.toggle('is-done', i < n));
    backBtn.hidden = n === 1;
    const last = n === total;
    const via = form.elements.via.value;
    nextLabel.textContent = last ? (via === 'email' ? 'Open email' : 'Open WhatsApp') : 'Continue';
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

  // Tapping an answer on screen 1 moves straight on. Keyboard users move
  // between options with the arrow keys (which also fire "change"), so the
  // shortcut only applies right after a pointer press.
  let lastPointer = 0;
  $('.opts--cards').addEventListener('pointerdown', () => { lastPointer = performance.now(); });
  form.querySelectorAll('input[name="need"]').forEach((el) =>
    el.addEventListener('change', () => {
      showError('need', false);
      if (performance.now() - lastPointer < 900) setTimeout(() => current === 1 && go(2), reduced ? 0 : 260);
    })
  );

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
      const first = form.elements[failed[0]];
      (first instanceof RadioNodeList ? first[0] : first).focus();
      return;
    }
    save();
    if (current < total) go(current + 1);
    else send();
  });

  // --- compose and hand off ----------------------------------------------
  const compose = (d) => {
    const lines = [
      `Hi Vector Workflows, I'm ${d.name} from ${d.business}.`,
      '',
      `What I need: ${d.need}`,
      `Budget: ${d.budget}`,
      `Timeline: ${d.timeline}`,
    ];
    if (d.process) lines.push('', 'How it works today:', d.process);
    return lines.join('\n');
  };

  const send = () => {
    const d = read();
    const text = compose(d);
    const url = d.via === 'email'
      ? `mailto:${config.email}?subject=${encodeURIComponent(`Project enquiry: ${d.need} · ${d.business}`)}&body=${encodeURIComponent(text)}`
      : `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(text)}`;

    // Open inside the click (user gesture), then show the confirmation
    const a = document.createElement('a');
    a.href = url;
    if (d.via !== 'email') { a.target = '_blank'; a.rel = 'noopener'; }
    a.click();

    $('[data-preview]').textContent = text;
    const reopen = $('[data-reopen]');
    reopen.href = url;
    if (d.via === 'email') { reopen.removeAttribute('target'); } else { reopen.target = '_blank'; }
    $('[data-reopen-label]').textContent = d.via === 'email' ? 'Open email again' : 'Open WhatsApp again';
    $('[data-done-text]').textContent = d.via === 'email'
      ? 'Your mail app should have opened with the message filled in. Press send there. If nothing opened, use the button below, or copy the message.'
      : 'WhatsApp should have opened in a new tab with the message filled in. Press send there. If it didn\'t open, use the button below, or copy the message.';

    steps.forEach((s) => s.classList.remove('is-current'));
    nav.hidden = true;
    done.hidden = false;
    live.textContent = 'Your message is ready to send.';
    done.focus();
  };

  const finishReset = (clear) => {
    done.hidden = true;
    nav.hidden = false;
    if (clear) {
      form.reset();
      try { sessionStorage.removeItem(KEY); } catch {}
      summarise();
    }
  };

  $('[data-restart]').addEventListener('click', () => {
    finishReset(true);
    steps[current - 1]?.classList.remove('is-current');
    current = 1;
    steps[0].classList.add('is-current');
    history.replaceState({ intakeStep: 1 }, '', location.pathname + location.search);
    render(1);
  });

  $('[data-copy]').addEventListener('click', async (e) => {
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
  summarise();
  const fromHash = Number((location.hash.match(/^#step-(\d)$/) || [])[1]) || 1;
  // Only resume at a later step if every earlier step is already answered
  let start = 1;
  for (let n = 1; n < Math.min(fromHash, total); n++) {
    if (rules[n].every(valid)) start = n + 1; else break;
  }
  history.replaceState({ intakeStep: start }, '', start > 1 ? `#step-${start}` : location.pathname + location.search);
  steps.forEach((s) => s.classList.toggle('is-current', Number(s.dataset.step) === start));
  current = start;
  render(start, { focus: false });
  form.classList.add('is-ready');
}
