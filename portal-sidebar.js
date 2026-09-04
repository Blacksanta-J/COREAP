/**
 * Portal COREAP — sidebar de navegación compartido.
 * Se monta en todas las vistas excepto index.html y login.html.
 */
(function (global) {
  'use strict';

  var SKIP_PAGES = { 'index.html': true, 'login.html': true, '': true };
  var ESTATUTO_URL = 'https://notebooklm.google.com/notebook/ca0a14ee-512b-4db6-a2e2-9f803cac6bb6';

  var NAV_SECTIONS = [
    {
      label: 'Portal',
      items: [
        { href: 'actopublico_final.html', label: 'Acto Público', icon: '📋', module: 'acto_publico' },
        { href: 'cronograma.html', label: 'Cronograma', icon: '📅', module: 'cronograma' },
        { href: 'seguimiento_final.html', label: 'Seguimiento', icon: '📊', disabled: true },
        { href: 'clasificacion_final.html', label: 'Clasificación', icon: '🗂️', module: 'clasificacion' }
      ]
    },
    {
      label: 'Herramientas',
      items: [
        { href: 'Elevador.html', label: 'Eleves Acto', icon: '📄', module: 'eleves_acto' },
        { href: 'Elevador-Control.html', label: 'Eleves Concursos', icon: '🏆', module: 'eleves_concursos' },
        { href: 'Control-POF.html', label: 'Control POF', icon: '🔎', module: 'control_pof' },
        { href: 'Impactar-Memos.html', label: 'Impactar Memos', icon: '📝', module: 'impactar_memos' },
        { href: 'POF-APEL.html', label: 'POF APEL', icon: '📑', module: 'pof_apel' },
        { href: 'Vacantes-Provisorias.html', label: 'Vacantes Provisorias', icon: '📌', module: 'vacantes_provisorias' }
      ]
    },
    {
      label: 'Admin',
      items: [
        { href: 'admin-usuarios.html', label: 'Usuarios', icon: '👥', module: 'admin_usuarios' },
        { href: 'admin-roles.html', label: 'Permisos de roles', icon: '🔑', module: 'admin_roles' },
        { href: 'admin-logs.html', label: 'Log de procesos', icon: '📜', module: 'admin_logs' }
      ]
    }
  ];

  function currentPage() {
    var path = global.location.pathname || '';
    var page = path.split('/').pop();
    return page || 'index.html';
  }

  function canShowItem(item) {
    if (!item.module) return true;
    if (global.PortalAuth && typeof global.PortalAuth.canAccess === 'function') {
      return global.PortalAuth.canAccess(item.module);
    }
    return true;
  }

  function buildHtml(page) {
    var html = '';
    var sectionIndex = 0;

    html += '<a class="nav-btn-home" href="index.html"><span class="nav-icon">🏠</span>HOME</a>';
    html += '<div class="nav-divider"></div>';

    NAV_SECTIONS.forEach(function (section) {
      var visible = section.items.filter(canShowItem);
      if (!visible.length) return;
      if (sectionIndex > 0) html += '<div class="nav-divider"></div>';
      sectionIndex += 1;
      html += '<div class="sidebar-note">' + section.label + '</div>';
      visible.forEach(function (item) {
        if (item.disabled) {
          html += '<span class="nav-link disabled" aria-disabled="true" title="Próximamente">';
          html += '<span class="nav-icon">' + item.icon + '</span>' + item.label;
          html += '<span class="nav-soon">Pronto</span></span>';
          return;
        }
        var active = page === item.href ? ' active' : '';
        html += '<a class="nav-link' + active + '" href="' + item.href + '">';
        html += '<span class="nav-icon">' + item.icon + '</span>' + item.label + '</a>';
      });
    });

    html += '<div class="nav-divider"></div>';
    html += '<div class="sidebar-note">Consulta</div>';
    html += '<a class="nav-btn-estatuto" href="' + ESTATUTO_URL + '" target="_blank" rel="noopener noreferrer">';
    html += '<span class="btn-icon">⚖️</span>Consultar Estatuto Docente</a>';
    return html;
  }

  function renderSidebar(mountEl) {
    if (!mountEl) return;
    mountEl.className = 'sidebar';
    mountEl.setAttribute('aria-label', 'Navegación del portal');
    mountEl.innerHTML = buildHtml(currentPage());
  }

  function ensureLayoutForTools() {
    if (document.querySelector('.layout')) return;

    var main = document.querySelector('.portal-tool-main');
    var wrap = document.querySelector('.wrap');
    var target = main || wrap;
    if (!target || !target.parentNode) return;

    var layout = document.createElement('div');
    layout.className = 'layout';
    var aside = document.createElement('aside');
    aside.id = 'portal-sidebar';

    target.parentNode.insertBefore(layout, target);

    var content = document.createElement('div');
    content.className = 'content portal-tool-content';
    layout.appendChild(aside);
    layout.appendChild(content);
    content.appendChild(target);
  }

  function init() {
    var page = currentPage();
    if (SKIP_PAGES[page]) return;

    ensureLayoutForTools();

    var mount = document.getElementById('portal-sidebar');
    if (!mount) return;

    // Pintar al instante para evitar el "pop" de ~1s; refiltrar cuando auth esté listo.
    renderSidebar(mount);

    if (global.PortalAuth && typeof global.PortalAuth.ready === 'function') {
      global.PortalAuth.ready().then(function () {
        renderSidebar(mount);
        if (typeof global.PortalAuth.whenSynced === 'function') {
          return global.PortalAuth.whenSynced().then(function () {
            renderSidebar(mount);
          });
        }
      }).catch(function () {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.PortalSidebar = {
    init: init,
    render: renderSidebar,
    currentPage: currentPage
  };
})(window);
