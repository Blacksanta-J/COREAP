(function (global) {
  'use strict';

  var STORAGE_KEYS = ['portal-theme', 'elevador-theme', 'procesador-theme'];

  function readSavedTheme() {
    var saved = null;
    for (var i = 0; i < STORAGE_KEYS.length; i++) {
      try {
        saved = localStorage.getItem(STORAGE_KEYS[i]);
      } catch (e) {}
      if (saved === 'light' || saved === 'dark') return saved;
    }
    if (global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  function bootstrapTheme() {
    var theme = readSavedTheme();
    document.documentElement.setAttribute('data-theme', theme);
    return theme;
  }

  function getTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function setTheme(theme) {
    theme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    try {
      STORAGE_KEYS.forEach(function (key) {
        localStorage.setItem(key, theme);
      });
    } catch (e) {}
    syncThemeToggle(document.getElementById('themeToggle'));
  }

  function syncThemeToggle(btn) {
    if (!btn) return;
    var dark = getTheme() === 'dark';
    btn.textContent = dark ? '☀️' : '🌙';
    btn.title = dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
    btn.setAttribute('aria-label', btn.title);
  }

  function initThemeToggle(id) {
    var btn = document.getElementById(id || 'themeToggle');
    if (!btn || btn.dataset.themeBound === '1') return;
    btn.dataset.themeBound = '1';
    syncThemeToggle(btn);
    btn.addEventListener('click', function () {
      setTheme(getTheme() === 'dark' ? 'light' : 'dark');
    });
  }

  function autoInitThemeToggle() {
    initThemeToggle('themeToggle');
  }

  bootstrapTheme();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInitThemeToggle);
  } else {
    autoInitThemeToggle();
  }

  global.PortalTheme = {
    bootstrapTheme: bootstrapTheme,
    getTheme: getTheme,
    setTheme: setTheme,
    syncThemeToggle: syncThemeToggle,
    initThemeToggle: initThemeToggle
  };
})(window);
