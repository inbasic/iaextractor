'use strict';

var id;

document.addEventListener('iaextractor', e => {
  if (e.detail.id) {
    console.error('ID', e.detail);
    id = e.detail.id;
  }
});

// Finding id
function findID () {
  const url = document.location.href;
  const tmp = /v\=([^\=\&]*)|embed\/([^\=\&]*)/.exec(url);
  if (tmp && tmp.length) {
    document.dispatchEvent(new CustomEvent('iaextractor', {
      detail: {
        id: tmp[1]
      }
    }));
  }
  else {
    const parent = document.documentElement;
    parent.appendChild(
      Object.assign(document.createElement('script'), {
        textContent: `
          var yttools = yttools || [];
          yttools.push(function (e) {
            document.dispatchEvent(new CustomEvent('iaextractor', {
              detail: {
                id: e.getVideoData()['video_id']
              }
            }));
          });
          function onYouTubePlayerReady (e) {
            yttools.forEach(c => c(e));
          }

          (function (observe) {
            observe(window, 'ytplayer', (ytplayer) => {
              observe(ytplayer, 'config', (config) => {
                if (config && config.args) {
                  config.args.jsapicallback = 'onYouTubePlayerReady';
                }
              });
            });
          })(function (object, property, callback) {
            let value;
            let descriptor = Object.getOwnPropertyDescriptor(object, property);
            Object.defineProperty(object, property, {
              enumerable: true,
              configurable: true,
              get: () => value,
              set: (v) => {
                callback(v);
                if (descriptor && descriptor.set) {
                  descriptor.set(v);
                }
                value = v;
                return value;
              }
            });
          });
        `
      })
    );
  }
}

findID();
document.addEventListener('spfdone', findID, false);
window.addEventListener('yt-navigate-finish', findID, false);
