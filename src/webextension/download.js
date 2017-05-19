'use strict';

var download = {};

download.tagInfo = (opusmixing = false) => {
  const audio = {
    m4a: [141, 140, 139],
    get ogg () {
      return opusmixing ? [172, 251, 171, 250, 249] : [172, 171]; // ogg or opus
    },
    opus: [251, 250, 249]
  };
  const video = {
    mp4: {
      low: [134, 133, 160],
      medium: [135],
      high: [138, 266, 264, 299, 137, 298, 136]
    },
    webm: {
      low: [243, 242, 278],
      medium: [246, 245, 244],
      high: [315, 272, 313, 308, 271, 303, 248, 302, 247]
    }
  };
  return {
    list: {
      audio: [
        ...audio.m4a,
        ...audio.ogg
      ],
      video: [
        ...video.mp4.low,
        ...video.mp4.medium,
        ...video.mp4.high,
        ...video.webm.low,
        ...video.webm.medium,
        ...video.webm.high
        ]
    },
    audio,
    video
  };
};

// select a proper audio track
download.guessAudio = (vInfo, info, pretendHD = false, opusmixing = false) => {
  function sort (tmp, toArr) {
    return tmp.sort((a, b) => {
      const i = toArr.indexOf(a.itag),
          j = toArr.indexOf(b.itag);
      if (i === -1 && j === -1) {
        return 0;
      }
      if (i !== -1 && j === -1) {
        return -1;
      }
      if (i === -1 && j !== -1) {
        return +1;
      }
      return i > j;
    });
  }
  let tmp = info.formats.filter((a) => a.dash === 'a');
  let tagInfo = download.tagInfo(opusmixing);
  if (tmp && tmp.length) {
    if (tagInfo.video.mp4.low.indexOf(vInfo.itag) !== -1 && !pretendHD) {  // Low quality (mp4)
      tmp = sort(tmp, [140, 171, 139, 172, 141]);
    }
    else if (tagInfo.video.webm.low.indexOf(vInfo.itag) !== -1 && !pretendHD) {  // Low quality (webm)
      tmp = sort(tmp, tagInfo.audio.ogg.reverse());
    }
    else if (tagInfo.video.mp4.medium.indexOf(vInfo.itag) !== -1 && !pretendHD) { // Medium quality (mp4)
      tmp = sort(tmp, [140, 171, 172, 141, 139]);
    }
    else if (tagInfo.video.webm.medium.indexOf(vInfo.itag) !== -1 && !pretendHD) { // Medium quality (webm)
      tmp = sort(tmp, tagInfo.audio.ogg.reverse());
    }
    else {
      if ([
        ...tagInfo.video.webm.low,
        ...tagInfo.video.webm.medium,
        ...tagInfo.video.webm.high
      ].indexOf(vInfo.itag) !== -1) { //High quality (webm)
        tmp = sort(tmp, tagInfo.audio.ogg);
      }
      else {  //High quality (mp4)
        if (opusmixing) {
          // if opus is selected, make sure to use mkv container
          tmp = sort(tmp, [141, 172, 251, 140, 171, 250, 249, 139]);
        }
        else {
          tmp = sort(tmp, [141, 172, 140, 171, 139]);
        }
      }
    }
    return tmp[0];
  }
  throw Error('error_4');
};

download.get = ({info, itag}, {doMerge, pretendHD, opusmixing, saveAs}) => {
  let vInfo = info.formats.filter(f => f.itag === +itag).pop();
  let ds = [vInfo];
  if (doMerge && vInfo.dash === 'v') {
    let aInfo = download.guessAudio(vInfo, info, pretendHD, opusmixing);
    ds.push(aInfo);
  }
  let ids = [];

  function search (id) {
    return new Promise((resolve, reject) => {
      chrome.downloads.search({id}, ([d]) => {
        if (d) {
          resolve(d);
        }
        else {
          reject(new Error('error_5'));
        }
      });
    });
  }

  function cancel (id) {
    return new Promise(resolve => {
      chrome.downloads.cancel(id, resolve);
    });
  }

  function dl (obj) {
    if (navigator.userAgent.indexOf('Firefox') === -1) {
      return new Promise((resolve, reject) => {
        chrome.downloads.download(obj, (id) => {
          let error = chrome.runtime.lastError;
          return error ? reject(error) : resolve(id);
        });
      });
    }
    else {
      // in Firefox "chrome.downloads.download" does not return id!
      return browser.downloads.download(obj); //jshint ignore:line
    }
  }

  return new Promise((resolve, reject) => {
    function observe (d) {
      if (!d.state || d.state.current === 'in_progress') {
        return;
      }
      const index = ids.indexOf(d.id);
      if (index !== -1) {
        ids.splice(index, 1);
      }
      else {
        return;
      }
      if (ids.length === 0 || d.state.current === 'interrupted') {
        chrome.downloads.onChanged.removeListener(observe);
      }
      if (d.state.current === 'interrupted' && ids.length) {
        Promise.all(ids.map(id => cancel(id))).then(download.badge);
        ids = [];
      }
      else {
        download.badge();
      }
      if (ids.length === 0) {
        if (d.state.current === 'complete') {
          Promise.all(ds.map(d => {
            return search(d.id).then(o => Object.assign(d, o));
          })).then(
            ds => resolve(ds),
            e => reject(e)
          );
        }
        else {
          reject(new Error('error_6'));
        }
      }
    }
    Promise.all(ds.map(o => {
      return dl({
        url: o.url,
        saveAs,
        filename: o.name
      });
    })).then(os => {
      ids = os;
      ids.forEach((id, i) => ds[i].id = id);
      chrome.downloads.onChanged.addListener(observe);
      download.badge();
    }).catch(e => reject(e));
  });
};

download.badge = () => {
  chrome.downloads.search({
    state: 'in_progress'
  }, ds => {
    ds = ds.filter(d => d.byExtensionId === chrome.runtime.id);
    chrome.browserAction.setBadgeText({
      text: ds.length ? ds.length + '' : ''
    });
  });
};
