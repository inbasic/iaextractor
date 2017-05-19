/* globals self */
'use strict'

function $ (id) {
  try {
    return window.content.document.getElementById(id);
  }
  catch (e) {
    return null;
  }
}

function html (tag, atts, parent) {
  var elem = document.createElement(tag);
  for (var name in atts) {
    elem.setAttribute(name, atts[name]);
  }
  if (parent) {
    parent.appendChild(elem);
  }
  return elem;
}

function remove () {
  var button = $('formats-button-small');
  if (button && button.parentNode) {
    button.parentNode.removeChild(button);
  }
  var menu = $('iaextractor-menu');
  if (menu && menu.parentNode) {
    menu.parentNode.removeChild(menu);
  }
}

function init () {
  // Remove old button
  remove();
  // old UI
  var parent = $('watch8-secondary-actions') || $('vo');
  if (parent) {
    // Add new button
    var button = html('button', {
      'id': 'formats-button-small',
      'title': 'Detect all possible download links',
      'class': 'yt-uix-button yt-uix-button-size-default yt-uix-button-opacity yt-uix-button-has-icon yt-uix-tooltip'
    }, parent);
    button.addEventListener('click', function () {
      this.blur();
      self.port.emit('formats');
    });

    var title = html('span', {
      'class': 'yt-uix-button-content'
    });
    title.textContent = 'Download';
    var imgContainer = html('span', {
      'class': 'yt-uix-button-icon-wrapper'
    });
    html('img', {
      'class': 'yt-uix-button-icon yt-sprite',
      'src': 'resource://feca4b87-3be4-43da-a1b1-137c24220968-at-jetpack/data/formats/injected-button.png'
    }, imgContainer);
    button.appendChild(imgContainer);
    button.appendChild(title);
  }
}

// new UI
(function () {
  function observe () {
    const top = document.querySelector('ytd-video-primary-info-renderer #top-level-buttons');
    if (top) {
      let button = top.querySelector('ytd-button-renderer');
      if (button) {
        button = button.cloneNode(false);
        let a = top.querySelector('ytd-button-renderer a');
        if (a) {
          a = a.cloneNode(true);
          button.appendChild(a);
        }
        button.id = 'formats-button-small-2';
        button.addEventListener('click', () => self.port.emit('formats'));
        const lastChild = [...top.parentNode.children].pop();
        if (lastChild) {
          top.parentNode.insertBefore(button, lastChild);
        }
        else {
          top.parentNode.appendChild(button);
        }
      }
      window.removeEventListener('yt-visibility-refresh', observe);
    }
  }
  window.addEventListener('yt-visibility-refresh', observe);
})();

// init
document.addEventListener('DOMContentLoaded', init, false);
if (document.readyState !== 'loading') {
  init();
}
function loader () {
  init();
  self.port.emit('page-update');
}
// Update toolbar button (HTML5 History API)
self.port.emit('page-update');
document.addEventListener('spfdone', loader);
document.addEventListener('yt-navigate-start', loader);
self.port.on('detach', function () {
  remove();
  document.removeEventListener('spfdone', loader);
  document.removeEventListener('yt-navigate-start', loader);
});

// Clean up
function resize () {
  var menu = $('iaextractor-menu');
  if (menu && menu.parentNode) {
    menu.parentNode.removeChild(menu);
  }
}
window.addEventListener('resize', resize, false);
self.port.on('detach', function () {
  remove();
  window.removeEventListener('resize', resize);
});
