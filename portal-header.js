/**
 * Portal COREAP — header compartido (estilo actopublico_final.html).
 * Se monta en todas las vistas excepto index.html y login.html.
 */
(function (global) {
  'use strict';

  var SKIP_PAGES = { 'index.html': true, 'login.html': true, '': true };
  var SUBTITLE = 'Dirección de Carrera Docente · GCBA';
  var BA_LOGO =
    '<svg width="75" height="40" viewBox="0 0 75 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
    + '<g clip-path="url(#clip0_portal_ba)">'
    + '<path d="M73.6406 31.6806L59.3778 4.12091C58.1475 1.67445 55.627 0 52.7012 0H52.6941C49.7717 0 47.2477 1.67445 46.0175 4.12091L35.9778 23.5199C34.8568 21.5246 33.0695 19.9595 30.9121 19.1134C33.3198 17.372 34.8885 14.5342 34.8885 11.3334C34.8885 7.6214 32.7805 4.40998 29.6995 2.8166C26.9851 1.38891 23.8865 0.581651 20.601 0.581651H5.58386C2.49581 0.581651 0 3.07746 0 6.15846V34.1059C0 37.1869 2.49581 39.6827 5.58386 39.6827H21.8243C24.9546 39.6827 27.9334 39.0341 30.6372 37.8778L31.6665 37.3808C31.7229 37.3526 31.7793 37.3244 31.8357 37.2962C32.8122 38.9142 34.5783 40.0035 36.6123 40.0035C38.872 40.0035 40.8178 38.664 41.6956 36.7286C42.1327 35.7064 43.1198 34.9837 44.2831 34.9273H61.1087C62.2755 34.9837 63.259 35.7064 63.6961 36.7286C64.5704 38.664 66.5198 40.0035 68.7794 40.0035C71.8639 40.0035 74.3598 37.5007 74.3598 34.4302C74.3598 33.4291 74.1024 32.4914 73.6371 31.6841" fill="#FFFFFF"/>'
    + '</g>'
    + '<defs><clipPath id="clip0_portal_ba"><rect width="74.3633" height="40" fill="white"/></clipPath></defs>'
    + '</svg>';

  function currentPage() {
    var path = global.location.pathname || '';
    var page = path.split('/').pop();
    return page || 'index.html';
  }

  function extraActions(page) {
    if (page !== 'admin-usuarios.html') return '';
    return ''
      + '<span class="portal-header-email" id="adminEmail"></span>'
      + '<a class="portal-home-link" href="#" id="logoutBtn">Salir</a>';
  }

  function headerHtml(page) {
    return ''
      + '<div class="topbar-logo">' + BA_LOGO + '</div>'
      + '<div class="topbar-right">'
      + '<div class="portal-title">PORTAL COREAP<span>' + SUBTITLE + '</span></div>'
      + '<div class="portal-topbar-actions">'
      + '<a class="portal-home-link" href="index.html">Inicio</a>'
      + '<button type="button" class="theme-toggle" id="themeToggle" title="Cambiar tema" aria-label="Cambiar tema">🌙</button>'
      + extraActions(page)
      + '</div>'
      + '</div>';
  }

  function renderHeader(el) {
    if (!el) return;
    var page = currentPage();
    el.className = 'portal-topbar';
    el.setAttribute('role', 'banner');
    el.innerHTML = headerHtml(page);
    if (global.PortalTheme && typeof global.PortalTheme.initThemeToggle === 'function') {
      global.PortalTheme.initThemeToggle('themeToggle');
    }
  }

  function ensureHeaderMount() {
    var shell = document.querySelector('.page-shell');
    if (!shell) return null;

    var existing = document.getElementById('portal-header')
      || shell.querySelector('.portal-topbar')
      || shell.querySelector('.topbar');
    if (existing) return existing;

    var header = document.createElement('header');
    header.id = 'portal-header';
    shell.insertBefore(header, shell.firstChild);
    return header;
  }

  function init() {
    if (SKIP_PAGES[currentPage()]) return;
    var mount = document.getElementById('portal-header')
      || document.querySelector('.page-shell .portal-topbar')
      || document.querySelector('.page-shell .topbar')
      || ensureHeaderMount();
    renderHeader(mount);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.PortalHeader = { init: init, render: renderHeader };
})(window);
