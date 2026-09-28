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
    })
  );

  menu.addEventListener('close', () => setExpanded(false));

  menu.addEventListener('click', (event) => {
    // Close on the close button, or when any link inside is followed
    if (event.target.closest('[data-menu-close], a')) menu.close();
  });

  // If the viewport grows to where the nav island shows, retire the menu
  matchMedia('(min-width: 64rem)').addEventListener('change', (event) => {
    if (event.matches && menu.open) menu.close();
  });
}
