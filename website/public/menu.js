// The phone menu is a <details> element and opens and closes with its button without this script.
// The script adds what a menu needs beyond that: Escape closes it and puts the focus back on the
// button, and a click outside it or on one of its links closes it.
for (const menu of document.querySelectorAll('details.menu')) {
  const button = menu.querySelector('summary');
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.open) {
      menu.open = false;
      button.focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (menu.open && (!menu.contains(e.target) || e.target.closest('a'))) menu.open = false;
  });
}
