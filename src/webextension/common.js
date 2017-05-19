/* globals download, ffmpeg, locale */
'use strict';

function close (id) {
  chrome.tabs.executeScript(id, {
    'runAt': 'document_start',
    'code': `
      [...document.querySelectorAll('.iaextractor-webx-iframe')].forEach(p => p.parentNode.removeChild(p));
    `
  });
}

function notify (request) {
  chrome.storage.local.get({
    notification: true
  }, prefs => {
    if (prefs.notification) {
      let message = request.error || request.message || request;
      message = locale.get(message);
      let optns = Object.assign({
        type: 'basic',
        iconUrl: '/data/icons/48.png',
        title: locale.get('title'),
        message
      }, {
        //requireInteraction: request.requireInteraction,
        isClickable: request.isClickable
      });
      chrome.notifications.create(optns);
    }
  });
}

chrome.runtime.onMessage.addListener((request, sender, response) => {
  if (request.method === 'error' || request.method === 'message') {
    notify(request);
  }
  else if (request.method === 'display-panel') {
    let id = request.tabId || sender.tab.id;
    chrome.tabs.executeScript(id, {
      'runAt': 'document_start',
      'code': `!!document.querySelector('.iaextractor-webx-iframe')`
    }, rs => {
      const error = chrome.runtime.lastError;
      let r = rs && rs[0];
      if (error) {
        notify(error);
      }
      else if (r) {
        close(id);
      }
      else {
        chrome.tabs.executeScript(id, {
          'runAt': 'document_start',
          'file': '/data/inject/panel.js'
        });
      }
    });
  }
  else if (request.method === 'download') {
    chrome.storage.local.get({
      pretendHD: false,
      opusmixing: false,
      doMerge: true,
      toAudio: true,
      toMP3: false,
      remove: true,
      ffmpeg: '',
      savein: '',
      saveAs: false,
      commands: {
        toMP3: '-loglevel error -i %input -q:a 0 %output',
        toAudio: '-loglevel error -i %input -acodec copy -vn %output',
        muxing: '-loglevel error -i %audio -i %video -acodec copy -vcodec copy %output'
      }
    }, prefs => {
      download.get(request, prefs).then(
        ds => {
          let vInfo = ds.filter(d => d.dash !== 'a').shift() || ds[0];
          let aInfo = ds.filter(d => d !== vInfo).shift();
          let root = prefs.savein || ffmpeg.parent(vInfo.filename);
          let [leafname, extension] = ffmpeg.extract(vInfo.filename);

          // audio and video muxing
          if (ds.length === 2 && prefs.doMerge && !prefs.ffmpeg) {
            notify({
              message: 'message_2',
              isClickable: true,
              requireInteraction: true
            });
            window.setTimeout(() => chrome.runtime.openOptionsPage(), 2000);
          }
          else if (ds.length === 2 && prefs.doMerge) {
            // we now allow OPUS for muxing; if vInfo === 'mp4', change container to MKV
            if (extension === 'mp4' && prefs.opusmixing) {
              extension = 'mkv';
            }
            leafname = leafname.replace(' - DASH', '');
            ffmpeg.resolve(root, leafname, extension).then(output => {
              return ffmpeg.convert(prefs.ffmpeg, prefs.commands.muxing, {
                '%audio': aInfo.filename,
                '%video': vInfo.filename,
                '%output': output
              });
            }).then(() => {
              if (prefs.remove) {
                return ffmpeg.remove([aInfo.filename, vInfo.filename]);
              }
            }).catch(e => notify(e));
          }
          // extract audio
          else if (ds.length === 1 && vInfo.dash !== 'v' && prefs.toAudio && prefs.ffmpeg) {
            switch (extension) {
              case 'weba':
              case 'webm':
              case 'ogg':
              case 'vorbis':
                extension = 'ogg';
                break;
              case 'opus':
                break;
              case 'aac':
                break;
              case 'mp4':
              case 'm4a':
                extension = 'm4a';
                break;
              default:
                extension = 'mka'; // "MKA" container format can store a huge number of audio codecs.
            }
            leafname = leafname.replace(' - DASH', '');
            ffmpeg.resolve(root, leafname, extension).then(output => {
              return ffmpeg.convert(prefs.ffmpeg, prefs.commands.toAudio, {
                '%input': vInfo.filename,
                '%output': output
              });
            }).then(() => {
              if (prefs.remove) {
                return ffmpeg.remove([vInfo.filename]);
              }
            }).catch(e => notify(e));
          }
          // convert to mp3
          else if (ds.length === 1 && vInfo.dash !== 'v' && prefs.toMP3 && prefs.ffmpeg) {
            ffmpeg.resolve(root, leafname, 'mp3').then(output => {
              return ffmpeg.convert(prefs.ffmpeg, prefs.commands.toMP3, {
                '%input': vInfo.filename,
                '%output': output
              });
            }).catch(e =>notify(e));
          }
        },
        e => notify(e)
      );
    });
  }
  else if (request.method === 'fetch') {
    const req = new XMLHttpRequest();
    req.open(request.type, request.url);
    req.onload = () => response({
      req
    });
    req.onerror = (error) => response({
      error
    });
    req.send();
    return true;
  }
  //
  if (request.method === 'close-panel') {
    let id = request.tabId || sender.tab.id;
    close(id);
  }
});

// FAQs
window.setTimeout(() => {
  chrome.storage.local.get({
    'version': null,
    'faqs': true
  }, prefs => {
    let version = chrome.runtime.getManifest().version;

    if (prefs.version ? (prefs.faqs && prefs.version !== version) : true) {
      chrome.storage.local.set({version}, () => {
        chrome.tabs.create({
          url: 'http://technologyto.com/extractor.html?version=' + version +
            '&type=' + (prefs.version ? ('upgrade&p=' + prefs.version) : 'install')
        });
      });
    }
  });
}, 3000);

// FF connect
if (navigator.userAgent.indexOf('Firefox') !== -1) { // TO-DO; remove this on FF57 release
  const channel = chrome.runtime.connect({
    name: 'sdk-channel'
  });
  channel.onMessage.addListener(request => {
    if (request.method === 'open-options') {
      chrome.tabs.create({
        url: '/data/options/index.html'
      });
    }
    else if (request.method === 'prefs') {
      chrome.storage.local.set(request.prefs);
    }
  });
}
