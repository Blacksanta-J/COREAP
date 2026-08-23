/**
 * Portal COREAP — header compartido con menú de usuario.
 * Se monta en todas las vistas excepto login.html.
 */
(function (global) {
  'use strict';

  var SKIP_PAGES = { 'login.html': true, '': true };
  var DEFAULT_SUBTITLE = 'Dirección de Carrera Docente · GCBA';
  var PAGE_SUBTITLES = {
    'index.html': 'Comisión de Registro y Evaluación de Antecedentes Profesionales.'
  };
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

  function subtitleFor(page) {
    return PAGE_SUBTITLES[page] || DEFAULT_SUBTITLE;
  }

  function userMenuHtml() {
    return ''
      + '<div class="user-menu" id="userMenu" hidden>'
      + '<button type="button" class="user-menu-toggle" id="userMenuToggle" aria-expanded="false" aria-haspopup="true" aria-controls="userMenuPanel">'
      + '<span class="user-menu-name" id="userName"></span>'
      + '<span class="user-menu-caret" aria-hidden="true">▾</span>'
      + '</button>'
      + '<div class="user-menu-panel" id="userMenuPanel" role="menu">'
      + '<div class="user-menu-meta">'
      + '<span class="user-menu-email" id="userEmail"></span>'
      + '<span class="role-pill" id="userRole"></span>'
      + '</div>'
      + '<div class="user-menu-actions">'
      + '<a class="topbar-link" id="adminLink" href="admin-usuarios.html" hidden role="menuitem">Usuarios</a>'
      + '<button type="button" class="theme-toggle" id="themeToggle" aria-label="Cambiar tema" title="Cambiar tema" role="menuitem">🌙</button>'
      + '<button type="button" class="theme-toggle" id="logoutBtn" title="Cerrar sesión" aria-label="Cerrar sesión" role="menuitem">⎋</button>'
      + '</div>'
      + '</div>'
      + '</div>';
  }

  function headerHtml(page) {
    var homeLink = page === 'index.html'
      ? ''
      : '<a class="portal-home-link" href="index.html">Inicio</a>';

    return ''
      + '<div class="topbar-logo">' + BA_LOGO + '</div>'
      + '<div class="topbar-right">'
      + '<div class="portal-title">PORTAL COREAP<span>' + subtitleFor(page) + '</span></div>'
      + '<div class="portal-topbar-actions">'
      + homeLink
      + userMenuHtml()
      + '</div>'
      + '</div>';
  }

  function setMenuOpen(menu, toggle, open) {
    if (!menu || !toggle) return;
    menu.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function bindUserMenu(root) {
    var menu = root.querySelector('#userMenu');
    var toggle = root.querySelector('#userMenuToggle');
    if (!menu || !toggle || toggle.dataset.bound === '1') return;
    toggle.dataset.bound = '1';

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      setMenuOpen(menu, toggle, !menu.classList.contains('open'));
    });
    document.addEventListener('click', function (e) {
      if (!menu.contains(e.target)) setMenuOpen(menu, toggle, false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setMenuOpen(menu, toggle, false);
    });
  }

  function fillUserMenu(user) {
    if (!user) return;
    var menu = document.getElementById('userMenu');
    if (!menu) return;

    var nameEl = document.getElementById('userName');
    var emailEl = document.getElementById('userEmail');
    var roleEl = document.getElementById('userRole');
    var adminLink = document.getElementById('adminLink');
    var logoutBtn = document.getElementById('logoutBtn');

    var displayName = user.nombre || (global.PortalAuth && PortalAuth.roleLabel
      ? PortalAuth.roleLabel(user.role)
      : user.role);
    if (nameEl) nameEl.textContent = displayName;
    if (emailEl) emailEl.textContent = user.email || '';
    if (roleEl) {
      roleEl.textContent = global.PortalAuth && PortalAuth.roleLabel
        ? PortalAuth.roleLabel(user.role)
        : (user.role || '');
    }

    if (adminLink) {
      var canAdmin = false;
      if (global.PortalAuth && PortalAuth.MODULES && typeof PortalAuth.canAccess === 'function') {
        canAdmin = PortalAuth.canAccess(PortalAuth.MODULES.admin_usuarios, user);
      } else if (user.role === 'admin') {
        canAdmin = true;
      }
      adminLink.hidden = !canAdmin;
    }

    if (logoutBtn && logoutBtn.dataset.bound !== '1') {
      logoutBtn.dataset.bound = '1';
      logoutBtn.addEventListener('click', function () {
        if (global.PortalAuth && typeof PortalAuth.logout === 'function') {
          PortalAuth.logout();
        }
        location.replace('login.html');
      });
    }

    menu.hidden = false;
  }

  function readSessionFallback() {
    try {
      var raw = sessionStorage.getItem('portal-session-v1');
      if (!raw) return null;
      var session = JSON.parse(raw);
      if (!session || !session.email) return null;
      return {
        email: session.email,
        role: session.role,
        nombre: session.nombre || ''
      };
    } catch (e) {
      return null;
    }
  }

  function hydrateUser() {
    function apply() {
      var user = null;
      if (global.PortalAuth && typeof PortalAuth.currentUser === 'function') {
        user = PortalAuth.currentUser();
      }
      if (!user) user = readSessionFallback();
      if (user) fillUserMenu(user);
    }

    if (global.PortalAuth && typeof PortalAuth.ready === 'function') {
      PortalAuth.ready().then(apply).catch(apply);
    } else {
      apply();
    }
  }

  function renderHeader(el) {
    if (!el) return;
    var page = currentPage();
    el.className = 'portal-topbar';
    el.id = el.id || 'portal-header';
    el.setAttribute('role', 'banner');
    el.innerHTML = headerHtml(page);
    bindUserMenu(el);
    if (global.PortalTheme && typeof global.PortalTheme.initThemeToggle === 'function') {
      global.PortalTheme.initThemeToggle('themeToggle');
    }
    hydrateUser();
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

  global.PortalHeader = {
    init: init,
    render: renderHeader,
    fillUserMenu: fillUserMenu
  };
})(window);
