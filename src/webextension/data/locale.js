'use strict';

document.addEventListener('DOMContentLoaded', () => {
  [...document.querySelectorAll('[data-i18n]')].forEach(e => {
    e[e.dataset.mtd || 'textContent'] = chrome.i18n.getMessage(e.dataset.i18n);
  });
});

var locale = {
  get: (name) => chrome.i18n.getMessage(name) || name
};
