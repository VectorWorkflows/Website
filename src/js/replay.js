// Replay player. The page already contains each replay's FINAL state
// (rendered by build.py); this resets it and plays it back on a virtual
// clock that only advances while playing, so pausing is exact.
//
// Plays only when: motion is allowed, the panel is on screen, the tab is
// visible and the visitor hasn't pressed pause. Reduced motion keeps the
// static, fully populated final state untouched.

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const HOLD = 5200; // ms the finished state rests before looping

const css = (el, name) => getComputedStyle(el).getPropertyValue(name).trim();

class Player {
  constructor(root, { loopGap = HOLD } = {}) {
    this.root = root;
    this.loopGap = loopGap;
    this.steps = [...root.querySelectorAll('[data-at]')].sort((a, b) => a.dataset.at - b.dataset.at);
    this.duration = Number(root.dataset.duration) || Number(this.steps.at(-1)?.dataset.at) || 0;
    this.muts = new Map([...root.querySelectorAll('[data-mut]')].map((el) => [el.dataset.mut, el]));
    this.clock = root.querySelector('[data-clock]');
    this.btn = root.querySelector('[data-play]');
    this.ease = css(root, '--ease-out') || 'ease';
    this.userPaused = false;
    this.inView = false;
    this.raf = 0;

    this.btn?.addEventListener('click', () => {
      this.userPaused = !this.userPaused;
      this.update();
    });
    new IntersectionObserver(([entry]) => {
      this.inView = entry.isIntersecting;
      this.update();
    }, { threshold: 0.2 }).observe(root);
    document.addEventListener('visibilitychange', () => this.update());

    this.reset();
    root.classList.add('is-live');
  }

  get playing() {
    return !this.userPaused && this.inView && !document.hidden;
  }

  update() {
    this.root.classList.toggle('is-paused', this.userPaused);
    this.btn?.setAttribute('aria-label', `${this.userPaused ? 'Play' : 'Pause'} ${this.btn.dataset.noun || 'replay'}`);
    if (this.playing && !this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame((t) => this.tick(t));
    } else if (!this.playing && this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  reset() {
    this.elapsed = 0;
    this.next = 0;
    this.steps.forEach((el) => el.classList.add('is-pending'));
    this.muts.forEach((el) => this.setMut(el, 0, false));
    if (this.clock) this.clock.textContent = '00:00';
  }

  tick(now) {
    this.elapsed += Math.min(now - this.last, 100); // clamp: no jump after a stall
    this.last = now;
    while (this.next < this.steps.length && this.steps[this.next].dataset.at <= this.elapsed) {
      this.reveal(this.steps[this.next++]);
    }
    if (this.elapsed >= this.duration + this.loopGap) this.loop();
    this.raf = requestAnimationFrame((t) => this.tick(t));
  }

  loop() {
    const stage = this.root.querySelector('.replay__stage, .logreel__list');
    const fade = stage?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 360, easing: this.ease, fill: 'forwards' });
    this.elapsed = -600; // a beat of darkness before the next run
    const restart = () => {
      this.reset();
      stage?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: this.ease, fill: 'forwards' });
    };
    fade ? (fade.onfinish = restart) : restart();
  }

  reveal(el) {
    // FLIP the siblings the new item pushes (bottom-anchored feeds). In a
    // hidden view the rects are all zero, so nothing animates there.
    const sibs = [...el.parentElement.children].filter((c) => c !== el && !c.classList.contains('is-pending'));
    const before = sibs.map((c) => c.getBoundingClientRect().top);
    el.classList.remove('is-pending');
    let push = 0;
    sibs.forEach((c, i) => {
      const dy = before[i] - c.getBoundingClientRect().top;
      if (dy) {
        push = dy;
        c.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 560, easing: this.ease });
      }
    });
    // The newcomer rises by the same distance its siblings travel, so the
    // lane moves as one piece instead of overlapping mid-flight.
    el.animate(
      [
        { opacity: 0, transform: `translateY(${push || 12}px)` },
        { opacity: 1, offset: 0.55 },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 560, easing: this.ease }
    );
    if (el.dataset.t && this.clock) this.clock.textContent = el.dataset.t;
    if (el.dataset.apply) {
      const changes = JSON.parse(el.dataset.apply);
      const cals = new Set();
      for (const [id, index] of Object.entries(changes)) {
        const mut = this.muts.get(id);
        if (!mut) continue;
        this.setMut(mut, index, true);
        const cal = mut.closest('.rp-cal');
        if (cal) cals.add(cal);
      }
      cals.forEach((cal) => {
        cal.classList.remove('is-shifting');
        void cal.offsetWidth; // restart the stagger
        cal.classList.add('is-shifting');
      });
    }
  }

  setMut(el, index, flash) {
    const values = el._values || (el._values = JSON.parse(el.dataset.values));
    const [text, tone] = values[index];
    el.textContent = text;
    el.classList.remove('rp-pill--warn', 'rp-pill--wait', 'rp-pill--ok');
    if (tone) el.classList.add('rp-pill', `rp-pill--${tone}`);
    if (flash) {
      el.classList.remove('is-changed');
      void el.offsetWidth;
      el.classList.add('is-changed');
    }
  }
}

function initViews(root) {
  const buttons = root.querySelectorAll('[data-view-btn]');
  buttons.forEach((btn) =>
    btn.addEventListener('click', () => {
      root.dataset.view = btn.dataset.viewBtn;
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    })
  );
}

// The log reel has no data-at from build: give each line a slot in sequence
function prepareReel(reel) {
  const lines = [...reel.querySelectorAll('.log-line')];
  lines.forEach((line, i) => {
    line.dataset.at = String(400 + i * 1150);
    delete line.dataset.apply; // no owner view to mutate here
  });
  reel.dataset.duration = String(400 + (lines.length - 1) * 1150);
  reel.querySelector('[data-play]').dataset.noun = 'log';
}

document.querySelectorAll('[data-replay]').forEach(initViews);

if (!reduced.matches) {
  document.querySelectorAll('[data-replay]').forEach((root) => new Player(root));
  document.querySelectorAll('[data-logreel]').forEach((reel) => {
    prepareReel(reel);
    new Player(reel, { loopGap: 2400 });
  });
}
