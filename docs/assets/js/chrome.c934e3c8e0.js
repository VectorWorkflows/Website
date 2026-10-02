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
