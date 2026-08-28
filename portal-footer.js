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
      + '<a class="footer-jayjay-link" href="' + JAYJAY_URL + '" target="_blank" rel="noopener noreferrer" title="Clic: rebota por la pantalla. Ctrl+clic: YouTube">'
      + '<span class="footer-jayjay-wrap" aria-hidden="true">'
      + '<span class="footer-jayjay-flyer">'
      + '<span class="footer-jayjay-flame footer-jayjay-flame--a"></span>'
      + '<span class="footer-jayjay-flame footer-jayjay-flame--b"></span>'
      + '<span class="footer-jayjay-flame footer-jayjay-flame--c"></span>'
      + '<span class="footer-jayjay-flame footer-jayjay-flame--d"></span>'
      + '<img src="assets/footer-jayjay.png" alt="Jay Jay" class="footer-jayjay" width="64" height="64" loading="lazy" />'
      + '</span>'
      + '</span>'
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
    bindJayJayDvd(el.querySelector('.footer-jayjay-link'));
  }

  var dvdState = null;

  function prefersReducedMotion() {
    return global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function stopDvdBounce() {
    if (!dvdState) return;
    if (dvdState.rafId) cancelAnimationFrame(dvdState.rafId);
    var link = dvdState.link;
    if (link) {
      link.classList.remove('is-dvd-bounce');
      link.style.left = '';
      link.style.top = '';
      link.style.width = '';
      link.style.height = '';
      link.removeAttribute('aria-label');
    }
    dvdState = null;
  }

  function rotateFlyerForVelocity(link, vx, vy) {
    var flyer = link && link.querySelector('.footer-jayjay-flyer');
    if (!flyer) return;
    var angle = Math.atan2(vy, vx) * (180 / Math.PI);
    flyer.style.transform = 'rotate(' + (angle + 12) + 'deg)';
  }

  function startDvdBounce(link) {
    if (!link || prefersReducedMotion()) return;
    stopDvdBounce();

    var rect = link.getBoundingClientRect();
    var w = rect.width || 64;
    var h = rect.height || 64;
    var speed = 2.4;
    var angle = (Math.random() * 0.5 + 0.2) * Math.PI;
    if (Math.random() > 0.5) angle = Math.PI - angle;
    var vx = Math.cos(angle) * speed;
    var vy = Math.sin(angle) * speed;
    if (Math.abs(vx) < 1) vx = vx < 0 ? -1.4 : 1.4;
    if (Math.abs(vy) < 1) vy = vy < 0 ? -1.4 : 1.4;

    link.classList.add('is-dvd-bounce');
    link.setAttribute('aria-label', 'Avioncito rebotando. Clic para detener. Ctrl+clic abre YouTube.');
    link.style.left = rect.left + 'px';
    link.style.top = rect.top + 'px';
    link.style.width = w + 'px';
    link.style.height = h + 'px';

    dvdState = {
      link: link,
      x: rect.left,
      y: rect.top,
      w: w,
      h: h,
      vx: vx,
      vy: vy,
      rafId: null
    };

    rotateFlyerForVelocity(link, vx, vy);

    function step() {
      if (!dvdState || dvdState.link !== link) return;
      var maxX = Math.max(0, global.innerWidth - dvdState.w);
      var maxY = Math.max(0, global.innerHeight - dvdState.h);

      dvdState.x += dvdState.vx;
      dvdState.y += dvdState.vy;

      if (dvdState.x <= 0) {
        dvdState.x = 0;
        dvdState.vx = Math.abs(dvdState.vx);
      } else if (dvdState.x >= maxX) {
        dvdState.x = maxX;
        dvdState.vx = -Math.abs(dvdState.vx);
      }
      if (dvdState.y <= 0) {
        dvdState.y = 0;
        dvdState.vy = Math.abs(dvdState.vy);
      } else if (dvdState.y >= maxY) {
        dvdState.y = maxY;
        dvdState.vy = -Math.abs(dvdState.vy);
      }

      link.style.left = dvdState.x + 'px';
      link.style.top = dvdState.y + 'px';
      rotateFlyerForVelocity(link, dvdState.vx, dvdState.vy);
      dvdState.rafId = requestAnimationFrame(step);
    }

    dvdState.rafId = requestAnimationFrame(step);
  }

  function bindJayJayDvd(link) {
    if (!link || link.__jayjayDvdBound) return;
    link.__jayjayDvdBound = true;

    link.addEventListener('click', function (e) {
      if (e.ctrlKey || e.metaKey || e.button === 1) return;
      if (dvdState && dvdState.link === link) {
        e.preventDefault();
        stopDvdBounce();
        return;
      }
      e.preventDefault();
      startDvdBounce(link);
    });

    global.addEventListener('resize', function () {
      if (!dvdState || dvdState.link !== link) return;
      var rect = link.getBoundingClientRect();
      dvdState.w = rect.width || dvdState.w;
      dvdState.h = rect.height || dvdState.h;
      dvdState.x = Math.min(Math.max(0, dvdState.x), Math.max(0, global.innerWidth - dvdState.w));
      dvdState.y = Math.min(Math.max(0, dvdState.y), Math.max(0, global.innerHeight - dvdState.h));
    });
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

  global.PortalFooter = { init: init, render: renderFooter, stopDvdBounce: stopDvdBounce };
})(window);
