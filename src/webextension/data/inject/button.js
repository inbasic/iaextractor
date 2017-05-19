'use strict';

/* close panel on reload */
(function (callback) {
  document.addEventListener('spfrequest', callback);
  window.addEventListener('yt-navigate-start', callback);
})(function () {
  chrome.runtime.sendMessage({
    method: 'close-panel'
  });
});

/* appeding button */
function prepare (button, cname) {
  button.dataset.tooltipText = 'Detect all possible download links';
  button.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    chrome.runtime.sendMessage({
      method: 'display-panel'
    });
  });
  button.classList.add(cname);
  button.classList.remove('yt-uix-clickcard-target', 'pause-resume-autoplay');
}

// old UI
(function (callback) {
  document.addEventListener('DOMContentLoaded', callback);
  document.addEventListener('spfdone', callback);
})(function () {
  const parent = document.getElementById('watch8-secondary-actions');
  if (parent) {
    // find class names; use a top level button
    const button = parent.querySelector('#watch8-secondary-actions>button').cloneNode(true);
    if (button) {
      prepare(button, 'iaextractor-webx-button');
      const span = button.querySelector('span');
      if (span) {
        span.textContent = 'Download';
        parent.appendChild(button);
      }
      else {
        console.error('Cannot find span element on the sample button element', button);
      }
    }
    else {
      console.error('Cannot find a sample button in the parent element', parent);
    }
  }
});
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
        prepare(button, 'iaextractor-new-button');
        //top.parentNode.appendChild(button);
        top.parentNode.insertBefore(button, [...top.parentNode.children].pop());
      }
      window.removeEventListener('yt-visibility-refresh', observe);
    }
  }
  window.addEventListener('yt-visibility-refresh', observe);
})();
