(function (global) {
  'use strict';

  function scrollToPanels() {
    var anchor = document.querySelector('.section-switcher')
      || document.querySelector('.processor-tabs')
      || document.querySelector('.tab-btn');
    if (!anchor) return;
    var top = anchor.getBoundingClientRect().top + window.scrollY - 12;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }

  function switchSection(btn, id) {
    if (!btn || !id) return;
    var target = document.getElementById(id);
    if (!target || btn.classList.contains('on')) return;

    document.querySelectorAll('.section-switcher .switch-btn').forEach(function (b) {
      b.classList.remove('on');
      b.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.section-pane').forEach(function (p) {
      p.classList.remove('on');
    });

    btn.classList.add('on');
    btn.setAttribute('aria-selected', 'true');
    target.classList.add('on');

    scrollToPanels();

    try {
      history.replaceState(null, '', '#' + id);
    } catch (e) {}
  }

  function switchTab(btn, paneId) {
    if (!btn || !paneId || btn.classList.contains('active')) return;
    var target = document.getElementById(paneId);
    if (!target) return;

    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.tab-pane').forEach(function (p) {
      p.classList.remove('active');
    });

    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    target.classList.add('active');

    scrollToPanels();

    try {
      history.replaceState(null, '', '#' + paneId);
    } catch (e) {}
  }

  function initSectionFromHash() {
    var id = (location.hash || '').replace('#', '');
    if (!id) return;

    var pane = document.getElementById(id);
    if (!pane) return;

    if (pane.classList.contains('section-pane')) {
      var sectionBtn = document.querySelector('.switch-btn[onclick*="' + id + '"]');
      if (sectionBtn) switchSection(sectionBtn, id);
      return;
    }

    if (pane.classList.contains('tab-pane')) {
      var tabBtn = document.querySelector('.tab-btn[onclick*="' + id + '"]');
      if (tabBtn) switchTab(tabBtn, id);
    }
  }

  function bindSectionSwitcher() {
    document.querySelectorAll('.section-switcher .switch-btn, .tab-btn').forEach(function (btn) {
      if (btn.dataset.navBound === '1') return;
      btn.dataset.navBound = '1';
      btn.setAttribute('role', 'tab');
      var selected = btn.classList.contains('on') || btn.classList.contains('active');
      btn.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
    var wrap = document.querySelector('.section-switcher, .tabs-nav, .tab-nav');
    if (wrap && !wrap.getAttribute('role')) {
      wrap.setAttribute('role', 'tablist');
    }
  }

  function initManualNavigation() {
    bindSectionSwitcher();
    initSectionFromHash();
  }

  global.switchSection = switchSection;
  global.switchTab = switchTab;
  global.PortalNav = {
    switchSection: switchSection,
    switchTab: switchTab,
    initManualNavigation: initManualNavigation,
    scrollToPanels: scrollToPanels
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initManualNavigation);
  } else {
    initManualNavigation();
  }
})(window);
