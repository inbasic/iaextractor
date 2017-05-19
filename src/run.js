'use strict';

var sp = require('sdk/simple-prefs');
var utils = require('sdk/window/utils');
var self = require('sdk/self');

function loadSDK () {
  require('./lib/main.js');
  sp.on('openOptions', () => {
    utils.openDialog({
      url: 'chrome://iaextractor/content/options.xul',
      name: 'iaextractor-options',
      features: 'chrome,titlebar,toolbar,centerscreen,dialog=no,resizable'
    }).focus();
  });
}

function loadWebE () {
  try {
    return require('sdk/webextension').startup();
  }
  catch (e) {
    return Promise.reject(e);
  }
}

if (sp.prefs.experiment) {
  loadWebE().then(api => {
    const {browser} = api;
    browser.runtime.onConnect.addListener(channel => {
      sp.on('openOptions', () => {
        channel.postMessage({
          method: 'open-options'
        });
      });
      if (sp.prefs.ffmpegPath) {
        channel.postMessage({
          method: 'prefs',
          prefs: {
            ffmpeg: sp.prefs.ffmpegPath,
            version: self.version
          }
        });
      }
    });
  }).catch(e => {
    loadSDK();
    console.error('WebExtension Error', e);
    sp.prefs.experiment = false;
  });
}
else {
  loadSDK();
}

sp.on('experiment', () => {
  if (sp.prefs.experiment) {
    utils.getMostRecentBrowserWindow().alert(
      `Please disable and re-enable the extension to switch to the experimental WebExtension version

Make sure to refresh this page afterward and visit the new options page to install a minimal native client for the extension to recognize FFmpeg media converter.
      `
    );
  }
  else {
    utils.getMostRecentBrowserWindow().alert(
      `Please disable and re-enable the extension to switch back to the SDK version

Note that the WebExtension version will replace the SDK version on Firefox 57 release. So please help us fix the WebExtension bugs by opening new bug reports.
      `
    );
  }
});
