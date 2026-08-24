/**
 * Portal COREAP — pie de página compartido (estilo actopublico_final.html).
 * Se monta en todas las vistas excepto index.html y login.html.
 */
(function (global) {
  'use strict';

  var SKIP_PAGES = { 'login.html': true, '': true };
  var JAYJAY_URL = 'https://www.youtube.com/watch?v=EgWb3WhBnpA&list=RDEgWb3WhBnpA&start_radio=1';

  function currentPage() {
    var path = global.location.pathname || '';
    var page = path.split('/').pop();
    return page || 'index.html';
  }

  function footerHtml() {
    return ''
      + '<span>COREAP — Comisión de Registro y Evaluación de Antecedentes Profesionales</span>'
      + '<div class="footer-brand">'
      + '<a href="' + JAYJAY_URL + '" target="_blank" rel="noopener noreferrer" title="Jay Jay the Jet Plane">'
      + '<img src="assets/footer-jayjay.png" alt="Jay Jay" class="footer-jayjay" width="64" height="64" loading="lazy" />'
      + '</a>'
      + '<div class="footer-brand-text">'
      + '<span class="footer-brand-name">J&amp;J CO.</span>'
      + '<span class="footer-brand-sub">Desarrollo a cargo de J&amp;J CO.</span>'
      + '</div>'
      + '</div>';
  }

  function renderFooter(el) {
    if (!el) return;
    el.className = 'portal-footer';
    el.setAttribute('role', 'contentinfo');
    el.innerHTML = footerHtml();
  }

  function ensureFooterMount() {
    var shell = document.querySelector('.page-shell');
    if (!shell) return null;

    var existing = document.getElementById('portal-footer') || shell.querySelector('.portal-footer');
    if (existing) return existing;

    var footer = document.createElement('footer');
    footer.id = 'portal-footer';
    shell.appendChild(footer);
    return footer;
  }

  function init() {
    if (SKIP_PAGES[currentPage()]) return;

    var mount = document.getElementById('portal-footer')
      || document.querySelector('.portal-footer')
      || ensureFooterMount();

    renderFooter(mount);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.PortalFooter = { init: init, render: renderFooter };
})(window);
