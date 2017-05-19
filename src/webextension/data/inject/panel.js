/* globals id */
'use strict';

(function (detect) {
  // remove old panels
  [...document.querySelectorAll('.iaextractor-webx-iframe')].forEach(p => p.parentNode.removeChild(p));
  chrome.runtime.sendMessage({
    method: 'close-panel'
  }, () => {
    // add the new panel
    const d = detect();
    if (d) {
      if (id) {
        const iframe = document.createElement('iframe');
        iframe.classList.add('iaextractor-webx-iframe');
        iframe.src = chrome.runtime.getURL('/data/inject/panel/index.html?id=' + id);
        d.player.appendChild(iframe);
      }
      else {
        chrome.runtime.sendMessage({
          method: 'error',
          message: 'error_8'
        });
      }
    }
    else {
      chrome.runtime.sendMessage({
        method: 'error',
        message: 'error_9'
      });
    }
  });
})(function () {
  const players = [
    ...document.getElementsByTagName('embed'),
    ...document.getElementsByTagName('video')
  ]
  .sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width);

  if (players.length) {
    if (players[0].localName === 'embed') { //Flash player
      return {
        player: players[0],
        method: 'insertAdjacentHTML'
      };
    }
    else {  //HTML5 player
      return {
        player: players[0].parentNode.parentNode,
        method: 'insertAdjacentHTML'
      };
    }
  }
  else {
    const parentDiv = document.getElementById('player-api');
    if (parentDiv) {
      return {
        player: parentDiv,
        method: 'innerHTML'
      };
    }
  }
});
