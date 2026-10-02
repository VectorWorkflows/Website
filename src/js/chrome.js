// Video posters: nothing is requested from YouTube until the visitor
// presses play. Without JS the poster is a plain link to the video.
document.querySelectorAll('[data-video]').forEach((box) => {
  box.querySelector('[data-video-play]')?.addEventListener('click', (event) => {
    event.preventDefault();
    const frame = document.createElement('iframe');
    frame.src = `https://www.youtube-nocookie.com/embed/${box.dataset.video}?autoplay=1&rel=0`;
    frame.title = box.dataset.title || 'Video';
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    box.replaceChildren(frame);
    frame.focus();
  });
});

// "Book a call after 3:35 PM today (IST)": the earliest slot the booking
// page will offer, in the visitor's own time. Each [data-book-after] holds
// the notice in hours (data/booking.json, matching the Cal.com event) and,
// until this runs, a plain "at least N hours from now". Rounded up to five
// minutes; refreshed every minute.
const bookAfter = () => {
  const now = new Date();
  document.querySelectorAll('[data-book-after]').forEach((el) => {
    const step = 5 * 60000;
    const at = new Date(Math.ceil((now.getTime() + Number(el.dataset.bookAfter) * 3600000) / step) * step);
    const days = Math.round((new Date(at).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86400000);
    const day = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `on ${at.toLocaleDateString('en-US', { weekday: 'long' })}`;
    const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const zone = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' }).formatToParts(at).find((p) => p.type === 'timeZoneName')?.value;
    el.textContent = `Book a call after ${time} ${day}${zone ? ` (${zone})` : ''}`;
  });
};
bookAfter();
setInterval(bookAfter, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) bookAfter(); });

// Tooltips. A [data-tip] trigger names its bubble with aria-describedby (so
// the text is always its accessible description, shown or not). The bubble
// shows on mouse hover and on keyboard focus, never on a touch tap, except
// for a [data-tip-toggle] button, which also toggles it on tap or click.
// Esc closes it. It opens in the top layer (popover) where that exists, and
// is placed inside the viewport either way, so nothing can clip it.
{
  const canPop = typeof HTMLElement.prototype.showPopover === 'function';
  const EDGE = 12; // px kept clear of the screen edges
  let open = null; // { trigger, tip, pinned }

  const place = () => {
    if (!open) return;
    const { trigger, tip } = open;
    const r = trigger.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const x = Math.max(EDGE, Math.min(r.left, vw - w - EDGE));
    const below = r.bottom + 8;
    const y = below + h > innerHeight - EDGE && r.top - 8 - h > EDGE ? r.top - 8 - h : below;
    // Top layer: viewport coordinates. Otherwise: relative to its .tipwrap
    const o = canPop ? { left: 0, top: 0 } : tip.parentElement.getBoundingClientRect();
    tip.style.left = `${Math.round(x - o.left)}px`;
    tip.style.top = `${Math.round(y - o.top)}px`;
    if (!canPop) tip.style.right = 'auto';
  };
  const hide = () => {
    if (!open) return;
    const { trigger, tip } = open;
    open = null;
    if (canPop) tip.hidePopover(); else tip.classList.remove('is-open');
    if (trigger.hasAttribute('data-tip-toggle')) trigger.setAttribute('aria-pressed', 'false');
  };
  const show = (trigger, tip, pinned = false) => {
    if (open && open.trigger !== trigger) hide();
    if (!open) {
      open = { trigger, tip, pinned };
      if (canPop) tip.showPopover(); else tip.classList.add('is-open');
    }
    open.pinned = open.pinned || pinned;
    if (trigger.hasAttribute('data-tip-toggle')) trigger.setAttribute('aria-pressed', String(open.pinned));
    place();
  };

  document.querySelectorAll('[data-tip]').forEach((trigger) => {
    const tip = document.getElementById(trigger.getAttribute('aria-describedby'));
    if (!tip) return;
    if (canPop) tip.popover = 'manual';
    const mine = () => open?.trigger === trigger;
    trigger.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') show(trigger, tip); });
    trigger.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && mine() && !open.pinned) hide(); });
    trigger.addEventListener('focus', () => { if (trigger.matches(':focus-visible')) show(trigger, tip); });
    trigger.addEventListener('blur', () => { if (mine()) hide(); });
    if (trigger.hasAttribute('data-tip-toggle')) {
      trigger.setAttribute('aria-pressed', 'false');
      trigger.addEventListener('click', () => (mine() && open.pinned ? hide() : show(trigger, tip, true)));
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) hide(); });
  document.addEventListener('pointerdown', (e) => { if (open && !open.trigger.contains(e.target)) hide(); });
  addEventListener('scroll', place, { passive: true });
  addEventListener('resize', place, { passive: true });
}

// Shared chrome: the site menu. A native modal <dialog> does the heavy
// lifting (inert background, Esc to close, focus returned to the opener);
// the open/close animation is pure CSS (@starting-style). This file only
// wires the buttons and keeps aria-expanded honest.

const menu = document.getElementById('site-menu');

if (menu && typeof menu.showModal === 'function') {
  const openers = document.querySelectorAll('[data-menu-open]');
  const setExpanded = (state) =>
    openers.forEach((btn) => btn.setAttribute('aria-expanded', String(state)));

  openers.forEach((btn) =>
    btn.addEventListener('click', () => {
      menu.showModal();
      setExpanded(true);
      document.dispatchEvent(new Event('menu:open')); // motion.js pauses smooth scroll
    })
  );

  menu.addEventListener('close', () => {
    setExpanded(false);
    document.dispatchEvent(new Event('menu:close'));
  });

  menu.addEventListener('click', (event) => {
    // Close on the close button, or when any link inside is followed
    if (event.target.closest('[data-menu-close], a')) menu.close();
  });

  // If the viewport grows to where the nav island shows, retire the menu
  matchMedia('(min-width: 64rem)').addEventListener('change', (event) => {
    if (event.matches && menu.open) menu.close();
  });
}
