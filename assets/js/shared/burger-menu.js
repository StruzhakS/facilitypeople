window.initBurgerMenu = function initBurgerMenu(buttonId, menuId) {
  const burgerBtn = document.getElementById(buttonId);
  const burgerMenu = document.getElementById(menuId);
  if (!burgerBtn || !burgerMenu) return;

  const isMenuOpen = () => {
    return window.getComputedStyle(burgerMenu).display !== 'none';
  };

  burgerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    burgerMenu.style.display = isMenuOpen() ? 'none' : 'block';
  });

  document.addEventListener('click', (e) => {
    if (e.target !== burgerBtn && !burgerMenu.contains(e.target)) {
      burgerMenu.style.display = 'none';
    }
  });
};
