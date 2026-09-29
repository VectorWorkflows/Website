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
