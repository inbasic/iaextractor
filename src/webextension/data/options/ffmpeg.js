/* globals download, locale */
'use strict';

function notify (message) {
  chrome.runtime.sendMessage({
    method: 'message',
    message: message.message || message
  });
}

function url () {
  let os = /windows|mac|linux/i.exec(navigator.userAgent);
  if (os) {
    os = os[0].toLowerCase();
  }
  else {
    return Promise.reject(new Error('error_1'));
  }

  return new Promise((resolve, reject) => {
    let req = new window.XMLHttpRequest();
    req.open('GET', 'https://api.github.com/repos/inbasic/ffmpeg/releases/latest');
    req.responseType = 'json';
    req.onload = () => {
      try {
        let name = 'ffmpeg-';
        let platform = navigator.platform;
        if (platform === 'Win32') {
          name += 'win32-ia32.exe';
        }
        else if (platform === 'Win64') {
          name += 'win32-x64.exe';
        }
        else if (platform === 'MacIntel') {
          name += 'darwin-x64';
        }
        else if (platform.indexOf('64')) {
          name += 'linux-x64';
        }
        else {
          name += 'linux-ia32';
        }

        resolve({
          url: req.response.assets.filter(a => a.name === name)[0].browser_download_url,
          name,
          container: ''
        });
      }
      catch (e) {}
    };
    req.onerror = () => {
      reject(new Error('error_2'));
    };
    req.send();
  });
}

function move (source, target) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage('com.add0n.node', {
      cmd: 'copy',
      delete: false,
      source,
      target,
      chmod: '0777'
    }, obj => {
      if (obj.error) {
        reject(new Error(obj.error));
      }
      else {
        resolve(target);
      }
    });
  });
}

function ffmpeg () {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage('com.add0n.node', {
      cmd: 'spec'
    }, response => {
      let button = document.querySelector('[data-cmd=install-native]');
      if (response) {
        button.value = locale.get('opt_014');
        url().then(format => {
          return download.get({
            info: {
              formats: [Object.assign(format, {
                itag: 1,
                name: format.name
              })]
            },
            itag: 1
          }, {}).then(([d]) => {
            const name = navigator.platform.startsWith('Win') ? 'ffmpeg.exe' : 'ffmpeg';
            return move(d.filename, (response.env.APPDATA || response.env.HOME) + response.separator + name);
          });
        }).then(resolve).catch(e => reject(e));
      }
      else {
        button.value = locale.get('opt_015');
        reject(new Error('error_3'));
      }
    });
  });
}

document.addEventListener('click', e => {
  const cmd = e.target.dataset.cmd;
  if (cmd === 'install-native') {
    chrome.tabs.create({
      url: '/data/helper/index.html'
    });
  }
  else if (cmd === 'download-ffmpeg') {
    let button = document.querySelector('[data-cmd=download-ffmpeg]');
    button.value = locale.get('opt_018');
    button.disabled = true;
    ffmpeg().then(
      target => {
        chrome.storage.local.set({
          ffmpeg: target,
          doMerge: true
        }, () => {
          notify('message_1');
          button.value = locale.get('opt_014');
          button.disabled = false;
        });
      },
      e => {
        notify(e);
        button.value = locale.get('opt_016');
        button.disabled = false;
      }
    );
  }
});

// init
chrome.runtime.sendNativeMessage('com.add0n.node', {
  cmd: 'version'
}, response => {
  if (response) {
    document.querySelector('[data-cmd=install-native]').value = locale.get('opt_014');
  }
});
chrome.storage.local.get({
  ffmpeg: ''
}, prefs => {
  if (prefs.ffmpeg) {
    document.querySelector('[data-cmd=download-ffmpeg]').value = locale.get('opt_014');
  }
});
