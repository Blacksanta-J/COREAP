/**
 * Portal COREAP — gate síncrono de sesión.
 * Debe cargarse en <head> lo antes posible (antes del body) en todas
 * las vistas protegidas. Si no hay sesión, redirige a login sin pintar la UI.
 */
(function (global) {
  'use strict';

  var SESSION_KEY = 'portal-session-v2';
  var ACTIVITY_KEY = 'portal-activity-v2';
  var IDLE_MS = 60 * 60 * 1000;
  var page = (global.location.pathname || '').split('/').pop() || 'index.html';

  try {
    localStorage.removeItem('portal-session-v1');
    sessionStorage.removeItem('portal-session-v1');
  } catch (e) {}

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
      if (!session || !session.email) return false;
      var last = 0;
      try {
        last = Number(localStorage.getItem(ACTIVITY_KEY) || sessionStorage.getItem(ACTIVITY_KEY) || 0);
      } catch (e2) {}
      if (!last && session.at) last = Date.parse(session.at) || 0;
      if (last && (Date.now() - last) > IDLE_MS) {
        try {
          localStorage.removeItem(SESSION_KEY);
          sessionStorage.removeItem(SESSION_KEY);
          localStorage.removeItem(ACTIVITY_KEY);
          sessionStorage.removeItem(ACTIVITY_KEY);
        } catch (e3) {}
        return false;
      }
      return true;
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
  }, 12000);
})(window);
