// The detailing flagship's controls, re-created small: the tint previewer
// and the three-step booking request. (The coverage switcher is CSS only.)
// Both start from markup that already reads correctly without this file.

// Tint: each slider darkens its glass (opacity only) and says what the law
// allows on the front side windows. Shades are visible light transmission.
const SHADES = [0, 70, 50, 35, 20, 5];      // 0 = no film
const DARK = [0.1, 0.32, 0.5, 0.64, 0.8, 0.94];

document.querySelectorAll('[data-tint]').forEach((box) => {
  const limit = Number(box.dataset.limit);
  const law = box.querySelector('[data-tint-law]');
  const label = (v) => (v ? `${v}%` : 'No film');
  const update = (range) => {
    const where = range.dataset.tintRange;
    const v = SHADES[range.value];
    box.querySelector(`[data-glass="${where}"]`).style.opacity = DARK[range.value];
    box.querySelector(`[data-tint-out="${where}"]`).textContent = v ? `${v}%` : 'None';
    range.setAttribute('aria-valuetext', v ? `${v} per cent of light through` : 'No film');
    if (where !== 'front') return;
    const over = v && v < limit;
    law.toggleAttribute('data-over', !!over);
    law.textContent = over
      ? `${v}% is darker than Arizona allows on the front side windows: film there must let through at least ${limit}% of the light. Behind the driver it's fine.`
      : `In Arizona, film on the front side windows must let through at least ${limit}% of the light. ${label(v)} is within it. Behind the driver there is no shade limit.`;
  };
  box.querySelectorAll('[data-tint-range]').forEach((range) => range.addEventListener('input', () => update(range)));
});

// Booking: one step at a time, checked before moving on. Nothing is sent.
document.querySelectorAll('[data-bk]').forEach((box) => {
  const form = box.querySelector('[data-bk-form]');
  const steps = [...form.querySelectorAll('.bk__step')];
  const tabs = [...box.querySelectorAll('[data-bk-tab]')];
  const back = form.querySelector('[data-bk-back]');
  const nextLabel = form.querySelector('[data-bk-next-label]');
  const nav = form.querySelector('.bk__nav');
  const done = form.querySelector('[data-bk-done]');
  const live = box.querySelector('[data-bk-live]');
  let at = 0;

  // The next six open days (Monday to Saturday), from tomorrow
  const days = form.querySelector('[data-bk-days]');
  const name = days.querySelector('input').name;
  const d = new Date();
  const opts = [];
  while (opts.length < 6) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 0) continue;
    const short = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const full = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    opts.push(`<label class="choice"><input type="radio" name="${name}" value="${full}"><span>${short}</span></label>`);
  }
  days.innerHTML = opts.join('');

  const picked = (step) => [...step.querySelectorAll('input:checked')];
  const show = (n, moved = true) => {
    at = n;
    steps.forEach((s, i) => s.classList.toggle('is-current', i === n));
    tabs.forEach((t, i) => {
      if (i === n) t.setAttribute('aria-current', 'step');
      else t.removeAttribute('aria-current');
      t.classList.toggle('is-done', i < n);
    });
    back.disabled = n === 0;
    nextLabel.textContent = n === steps.length - 1 ? 'See the request' : 'Next';
    if (moved) {
      box.classList.add('has-moved');
      steps[n].querySelector('legend').focus();
      live.textContent = `Step ${n + 1} of ${steps.length}: ${steps[n].querySelector('legend').textContent}`;
    }
  };
  const flag = (step, bad) => {
    step.querySelector('[data-bk-err]').hidden = !bad;
    step.querySelectorAll('input').forEach((i) => (bad ? i.setAttribute('aria-invalid', 'true') : i.removeAttribute('aria-invalid')));
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const step = steps[at];
    // Step 3 needs a day; its morning/afternoon choice is always set
    const ok = at === 2 ? step.querySelector('[data-bk-days] input:checked') : picked(step).length;
    flag(step, !ok);
    if (!ok) {
      step.querySelector('input').focus();
      live.textContent = step.querySelector('[data-bk-err]').textContent;
      return;
    }
    if (at < steps.length - 1) return show(at + 1);
    const [time] = picked(steps[2]).filter((i) => !i.closest('[data-bk-days]'));
    const sum = {
      vehicle: picked(steps[0])[0].value,
      svc: picked(steps[1]).map((i) => i.value).join(', '),
      day: `${steps[2].querySelector('[data-bk-days] input:checked').value}, ${time.value}`,
    };
    for (const [k, v] of Object.entries(sum)) done.querySelector(`[data-bk-sum="${k}"]`).textContent = v;
    box.classList.add('is-done');
    nav.hidden = true;
    done.hidden = false;
    tabs.forEach((t) => { t.removeAttribute('aria-current'); t.classList.add('is-done'); });
    done.querySelector('.bk__done-title').focus();
    live.textContent = 'Request ready. Nothing was sent.';
  });
  back.addEventListener('click', () => show(at - 1));
  form.addEventListener('change', (e) => flag(e.target.closest('.bk__step'), false));
  form.querySelector('[data-bk-reset]').addEventListener('click', () => {
    form.reset();
    box.classList.remove('is-done');
    nav.hidden = false;
    done.hidden = true;
    show(0);
  });

  box.classList.add('is-live');
  show(0, false);
});
