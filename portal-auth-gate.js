/**
 * Portal COREAP — gate síncrono de sesión.
 * Debe cargarse en <head> lo antes posible (antes del body) en todas
 * las vistas protegidas. Si no hay sesión, redirige a login sin pintar la UI.
 */
(function (global) {
  'use strict';

  var SESSION_KEY = 'portal-session-v1';
  var page = (global.location.pathname || '').split('/').pop() || 'index.html';

  function reveal() {
    document.documentElement.classList.remove('portal-auth-pending');
    var el = document.getElementById('portal-auth-gate-css');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  global.PortalAuthGate = { reveal: reveal };

  if (page === 'login.html') return;

  /* Ocultar body de inmediato (antes de que exista) */
  var css = document.createElement('style');
  css.id = 'portal-auth-gate-css';
  css.textContent = 'html.portal-auth-pending body{visibility:hidden!important;opacity:0!important}';
  (document.head || document.documentElement).appendChild(css);
  document.documentElement.classList.add('portal-auth-pending');

  function hasSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
      if (!raw) return false;
      var session = JSON.parse(raw);
      return !!(session && session.email);
    } catch (e) {
      return false;
    }
  }

  if (!hasSession()) {
    var next = encodeURIComponent(page);
    global.location.replace('login.html?next=' + next);
    return;
  }

  /* Si requireAuth no corre (error de carga), no dejar la pantalla en blanco */
  setTimeout(function () {
    if (document.documentElement.classList.contains('portal-auth-pending')) {
      reveal();
    }
  }, 2500);
})(window);
