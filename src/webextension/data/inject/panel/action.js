/* globals youtube, build, items, info */
'use strict';

var id = document.location.search.split('id=').pop();
youtube.perform(id).then(
  info => build(info),
  e => {
    document.body.dataset.loading = false;
    items.setAttribute('pack', 'center');
    items.setAttribute('align', 'center');
    items.textContent = e.message;
  }
);

document.addEventListener('click', e => {
  const cmd = e.target.dataset.cmd;
  if (cmd === 'toggle-toolbar') {
    let item = e.target.parentNode;
    [...items.querySelectorAll('a')]
      .filter(a => a !== item)
      .forEach(a => a.dataset.toolbar = 'false');
    item.dataset.toolbar =
    document.body.dataset.integration =
      item.dataset.toolbar === 'false';
    return;
  }
  else if (cmd === 'close-me') {
    chrome.runtime.sendMessage({
      method: 'close-panel'
    });
  }
  // do not load audio or video files inside the iframe
  const a = e.target.closest('a');
  if (a) {
    if (a.dataset.itag) {
      chrome.runtime.sendMessage({
        method: 'download',
        info,
        itag: a.dataset.itag
      });
    }
    e.preventDefault();
  }
});
