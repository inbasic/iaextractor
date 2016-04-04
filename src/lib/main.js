var {Cc, Ci, Cu}  = require('chrome'),
    {Hotkey}      = require('sdk/hotkeys'),
    tabs          = require('sdk/tabs'),
    self          = require('sdk/self'),
    timer         = require('sdk/timers'),
    sp            = require('sdk/simple-prefs'),
    panel         = require('sdk/panel'),
    _             = require('sdk/l10n').get,
    unload        = require('sdk/system/unload'),
    pageMod       = require('sdk/page-mod'),
    userstyles    = require('./userstyles'),
    youtube       = require('./youtube'),
    subtitle      = require('./subtitle'),
    download      = require('./download'),
    extract       = require('./extract'),
    ffmpeg        = require('./ffmpeg'),
    tools         = require('./misc'),
    external      = require('./external'),
    data          = self.data,
    prefs         = sp.prefs,
    format        = tools.format,
    fileSize      = tools.fileSize,
    _prefs        = tools.prefs,
    prompts       = tools.prompts,
    prompts2      = tools.prompts2,
    notify        = tools.notify,
    windows          = {
      get active () { // Chrome window
        return require('sdk/window/utils').getMostRecentBrowserWindow();
      }
    },
    isAustralis   = 'gCustomizeMode' in windows.active,
    toolbarbutton = isAustralis ? require('./toolbarbutton/new') : require('./toolbarbutton/old');

var {FileUtils} = Cu.import('resource://gre/modules/FileUtils.jsm');
var {Services} = Cu.import('resource://gre/modules/Services.jsm');
var {AddonManager} = Cu.import('resource://gre/modules/AddonManager.jsm');

var connect = {};
Cu.import(data.url('shared/connect.jsm'), connect);
connect.glow.require = require;

/** Load style **/
userstyles.load(data.url('overlay.css'));

/** Internal configurations **/
var config = {
  //URLs
  urls: {
    youtube: 'https://www.youtube.com/',
    tools: 'chrome://iaextractor/content/tools.xul',
    homepage: 'http://technologyto.com/extractor.html',
    update: 'http://technologyto.com/extractor.html',
    flashgot: 'https://addons.mozilla.org/firefox/addon/flashgot/',
    downthemall: 'https://addons.mozilla.org/firefox/addon/downthemall/',
    tdmanager: 'https://addons.mozilla.org/en-US/firefox/addon/turbo-download-manager/',
    instruction: 'http://technologyto.com/extractor.html#instruction',
    converterXPI: 'https://addons.mozilla.org/firefox/downloads/latest/540376/addon-540376-latest.xpi'
  },
  //toolbar
  toolbar: {
    id: 'youtube-audio-converter',
    move: {
      toolbarID: 'nav-bar',
      insertbefore: 'home-button',
      forceMove: false
    }
  },
  //Timing
  desktopNotification: 3, //seconds
  noAudioExtraction: 4,
  //Tooltip
  tooltip: _('name') + '\n\n' + _('tooltip1') + '\n' + _('tooltip2'),
  //Panels
  panels: {
    rPanel: {
      width: 300,
      height: 230
    },
    iPanel: {
      width: 520,
      height: 520
    }
  }
};

var iPanel, rPanel, cmds, yButton, IDExtractor;

/** Inject menu and button into YouTube pages **/
pageMod.PageMod({
  include: ['*.youtube.com'],
  contentScriptFile: prefs.inject ? data.url('formats/permanent.js') : [],
  contentScriptWhen: 'start',
  attachTo: ['existing', 'top'],
  contentStyleFile: data.url('formats/permanent.css'),
  onAttach: function(worker) {
    worker.port.on('formats', function() {
      cmds.onShiftClick();
    });
    worker.port.on('page-update', function() {
      monitor();
    });
  }
});

/** Toolbar Panel **/
rPanel = panel.Panel({
  width: config.panels.rPanel.width,
  height: config.panels.rPanel.height,
  contentURL: data.url('report.html'),
  contentScriptFile: data.url('report/report.js'),
  contentScriptWhen: 'ready'
});
rPanel.cmds = {
  tools: function () {
    rPanel.hide();
    AddonManager.getAddonByID('jid1-kps5PrGBNtzSLQ@jetpack', function (addon) {
      if (addon) {
        if (addon.isActive) {
          windows.active.open(
            'chrome://imconverter/content/ui.xul',
            'iaextractor',
            'chrome,minimizable=yes,all,resizable=yes'
          ).focus();
        }
        else {
          notify(_('name'), _('msg36'));
        }
      }
      else {
        notify(_('name'), _('msg30'));
        timer.setTimeout(function () {
          tabs.open('https://addons.mozilla.org/en-US/firefox/addon/media-converter-and-muxer/');
        }, 1000);
      }
    });
  }
}
rPanel.port.on('cmd', function (cmd) {
  switch (cmd) {
  case 'download':
    cmds.onCommand(null, null, true, null);
    break;
  case 'show-download-manager':
    download.show();
    break;
  case 'formats':
    rPanel.hide();
    cmds.onShiftClick();
    break;
  case 'embed':
    cmds.onCtrlClick();
    break;
  case 'destination':
    prefs.dFolder = parseInt(arguments[1]);
    break;
  case 'quality':
    prefs.quality = parseInt(arguments[1]);
    break;
  case 'format':
    prefs.extension = parseInt(arguments[1]);
    break;
  case 'do-extract':
    prefs.doExtract = arguments[1];
    break;
  case 'do-subtitle':
    prefs.doSubtitle = arguments[1];
    break;
  case 'do-size':
    prefs.getFileSize = arguments[1];
    break;
  case 'tools':
    rPanel.cmds.tools();
    break;
  case 'cancel':
    listener.cancel(parseInt(arguments[1]));
    break;
  case 'settings':
    windows.active.BrowserOpenAddonsMgr(
      'addons://detail/' + encodeURIComponent('feca4b87-3be4-43da-a1b1-137c24220968@jetpack')
    );
    rPanel.hide();
    break;
  }
});
rPanel.on('show', function () {
  rPanel.port.emit(
    'update',
    prefs.doExtract,
    prefs.doSubtitle,
    prefs.getFileSize,
    prefs.dFolder,
    prefs.quality,
    prefs.extension,
    yButton.saturate
  );
});

/** Get video id from URL **/
IDExtractor = (function () {
  var urls = [], IDs = [];
  function cache(url, id) {
    var index = urls.push(url) - 1;
    IDs[index] = id;
  }

  return function (url, callback, pointer) {
    //Cache XMLHttpRequest of non YouTube pages
    if (typeof(url) === 'object' && url.origin) {
      var obj = url;
      var index = urls.indexOf(obj.origin);
      if (index === -1) {
        index = urls.push(obj.origin) - 1;
      }
      if (!IDs[index]) {
        IDs[index] = [];
      }
      IDs[index].push(obj);

      return;
    }
    //Is it in the cache?
    var index = urls.indexOf(url);
    if (index !== -1 && IDs[index]) {
      return callback.apply(pointer, [IDs[index]]);
    }
    var id;
    //Watch page
    var temp = /http.*:.*youtube.com\/watch\?.*v\=([^\=\&]*)/.exec(url);
    id = temp ? temp[1]: null;
    if (callback && id) {
      cache(url, id);
      return callback.apply(pointer, [id]);
    }
    //Rest
    function fetchId (script) {
      var worker = tabs.activeTab.attach({
        contentScript: "self.port.emit('response', (%s)())".replace("%s", script)
      });
      worker.port.on('response', function (id) {
        if (callback) {
          cache(url, id);
          worker.destroy();
          return callback.apply(pointer, [id]);
        }
      });
    }
    //movie
    if (/http.*:.*youtube.com\/movie/.test(url)) {
      var tmp = function () {
        try {
          var divs = document.getElementsByClassName('ux-thumb-wrap');
          return divs.length ? /v\=([^\=\&]*)/.exec(divs[0].getAttribute('href'))[1] : null
        }
        catch(e) {
          return null
        }
      }
      fetchId(tmp + '');
    }
    //Other YouTube pages
    else if (/http.*:.*youtube.com/.test(url)) {
      var tmp = function () {
        var embeds = (document.querySelector('body') || document).getElementsByTagName('embed');
        var html5s = (document.querySelector('body') || document).getElementsByTagName('video');

        var players = [].concat.apply([].concat.apply([], embeds), html5s)
        .sort(function (a, b) {
          return b.getBoundingClientRect().width - a.getBoundingClientRect().width;
        });
        if (players.length) {
          if (players[0].localName === 'embed') {
            try {
              var str = decodeURIComponent(players[0].getAttribute('flashvars'));
              var id = /video\_id\=([^\&]*)/.exec(str);
              return id[1];
            }
            catch (e) {}
          }
          else {
            return players[0].getAttribute('data-youtube-id');
          }
        }
        return null;
      }
      fetchId(tmp + '');
    }
    else {
      return callback.apply(pointer, [null]);
    }
  }
})();

/** Initialize **/
cmds = {
  /**
   * onCommand
   *
   * @param {Event} mouse event.
   * @param {Object} Toolbar button object, used to detect the position of panel.
   * @param {Boolean} auto start download after link detection
   * @param {Number} index of YouTube link in vInfo object
   *
   * no return output
   */
  onCommand: function (e, tbb, download, itag) {
    if (tbb) {
      if (!prefs.oneClickDownload || !prefs.silentOneClickDownload) {
        rPanel.show(tbb);
      }
      if (prefs.oneClickDownload) {
        download = true;
      }
      else {
        return;
      }
    }
    let url = tabs.activeTab.url;
    IDExtractor(url, function (videoID) {
      if (download && videoID) {
        new getVideo(videoID, listener, itag);
      }
      else {
        tabs.open(config.urls.youtube);
        rPanel.hide();
      }
    });
  },
  onMiddleClick: function (e, tbb) {
    if (!iPanel) {  //Do not load it on initialization
      iPanel = panel.Panel({
        width: config.panels.iPanel.width,
        height: config.panels.iPanel.height,
        contentURL: data.url('info.html'),
        contentScriptFile: [
          data.url('info/jsoneditor/jsoneditor.js'),
          data.url('info/info.js')
        ],
        contentScriptWhen: 'ready'
      });
    }
    IDExtractor(tabs.activeTab.url, function (videoID) {
      if (!videoID) return;
      iPanel.show(tbb);
      youtube.videoInfo(videoID).then(
        function (info) {
          iPanel.port.emit('info', info);
        },
        function (e) {
          notify(_('name'), e);
        }
      );
    });
  },
  onCtrlClick: function () {
    var script = function () {
      var reg = /embed\/([^\=\&\'\"\\\/\_\-\<\>]{5,})/g, arr = [], test;
      while ((test = reg.exec(document.body.innerHTML)) !== null) {
        arr.push(test[1]);
      }
      reg = /watch\?.*v\=([^\=\&\'\"\\\/\_\-\<\>]{5,})/g;
      while ((test = reg.exec(document.body.innerHTML)) !== null) {
        arr.push(test[1]);
      }
      return arr
    }
    let worker = tabs.activeTab.attach({
      contentScript: "self.port.emit('response', (%s)())".replace('%s', script + '')
    });
    worker.port.on('response', function (arr) {
      if (arr) {
        if (arr && arr.length) {
          arr = arr.filter(function(elem, pos) {
              return arr.indexOf(elem) == pos;
          });
          var obj = prompts(_('prompt1'), _('prompt2'), arr);
          if (obj[0] && obj[1] != -1) {
            tabs.open(config.urls.youtube + 'watch?v=' + arr[obj[1]]);
          }
        }
        else {
          notify(_('name'), _('msg4'));
        }
      }
    });
  },
  onShiftClick: function () {
    let url = tabs.activeTab.url;
    IDExtractor(url, function (videoID) {
      if (videoID) {
        let worker = tabs.activeTab.attach({
          contentScriptFile: data.url('formats/inject.js'),
          contentScriptOptions: {
            doSize: prefs.getFileSize,
            showFLV: prefs.showFLV,
            showWEBM: prefs.showWEBM,
            showMP4: prefs.showMP4,
            show3GP: prefs.show3GP
          }
        });
        worker.port.on('file-size-request', function (url, i1, i2) {
          fileSize(url, function (url, size) {
            worker.port.emit('file-size-response', url, size, i1, i2);
          });
        });
        worker.port.on('download', function (itag) {
          // Show instruction
          if (!prefs.showInstruction) {
            var tmp = prompts2(_('msg17'), _('msg18'), _('msg19'), _('msg20'), _('msg21'), true);
            prefs.showInstruction = tmp.check.value;
            if (tmp.button == 1) {
              timer.setTimeout(function () {
                tabs.open('http://technologyto.com/extractor.html#instruction');
              }, 1000);
            }
          }
          cmds.onCommand(null, null, true, itag);
        });
        youtube.videoInfo(videoID).then(
          function (info) {
            // Prevent cycling object
            info.formats = info.formats.map(function (f) {
              f.parent = null;
              return f;
            });
            worker.port.emit('info', info);
          },
          function (e) {
            notify(_('name'), e);
          }
        );
        worker.port.on('flashgot', flashgot);
        worker.port.on('tdmanager', tdmanager);
        worker.port.on('downThemAll', downThemAll);
        worker.port.on('error', function(code) {
          notify(_('name'), _(code));
        });
      }
      else {
        notify(_('name'), _('msg4'));
      }
    });
  }
}

yButton = toolbarbutton.ToolbarButton({
  id: config.toolbar.id,
  label: _('toolbar'),
  tooltiptext: config.tooltip,
  panel: rPanel,
  onCommand: cmds.onCommand,
  onClick: function (e, tbb) { //Linux problem for onClick
    if (e.button == 1) {
      cmds.onMiddleClick (e, tbb);
    }
    if (e.button == 0 && e.ctrlKey) {
      e.stopPropagation();
      e.preventDefault();
      cmds.onCtrlClick();
    }
    if (e.button == 0 && e.shiftKey) {
      e.stopPropagation();
      e.preventDefault();
      cmds.onShiftClick(e);
    }
  }
});

exports.main = function (options, callbacks) {
  //Install
  if (options.loadReason == 'install' || prefs.forceVisible) {
    //If adjacent button is restartless wait for its creation
    timer.setTimeout(function () {
      yButton.moveTo(config.toolbar.move);
    }, 800);
  }
  // Check current page
  monitor(tabs.activeTab);
  //Welcome page
  if (options.loadReason === 'install' || options.loadReason === 'upgrade') {
    prefs.newVer = options.loadReason;
  }
  if (options.loadReason == 'startup' || options.loadReason == 'install') {
    welcome();
  }
  if (options.loadReason == 'install' && !prefs.ffmpegPath && !prefs.showFFmpegInstall) {
    external.checkFFmpeg();
  }
}

/** Welcome page **/
function welcome () {
  if (prefs.newVer) {
    if (prefs.welcome && prefs.version != self.version) {
      timer.setTimeout(function (p) {
        tabs.open({
          url: (prefs.newVer == 'install' ? config.urls.homepage : config.urls.update) + '?v=' + self.version + (p ? '&p=' + p : ''),
          inBackground : false
        });
        prefs.newVer = '';
      }, 3000, prefs.version);
    }
    else {
      prefs.newVer = '';
    }
  }
  prefs.version = self.version;
}

/** Monitor **/
function monitor () {
  IDExtractor(tabs.activeTab.url, function (videoID) {
    if (videoID) {
      yButton.saturate = 1;
    }
    else {
      yButton.saturate = 0;
    }
  });
}
tabs.on('ready', function () {
  //Even when document is ready, most likely the player is not accessible.
  timer.setTimeout(monitor, 2000);
});
tabs.on('activate', monitor);


exports.onUnload = function (reason) {
  //Close tools window
  let wm = Cc['@mozilla.org/appshell/window-mediator;1']
    .getService(Ci.nsIWindowMediator);
  let enumerator = wm.getEnumerator('iaextractor:tools');
  while (enumerator.hasMoreElements()) {
    let win = enumerator.getNext();
    win.close();
  }
  //Remove observer
  //http.destroy();
}

/** HTTP Observer **/
var http = (function () {
  var cache = [];
  return {
    initialize: function () {
      Services.obs.addObserver(http.observer, 'http-on-examine-response', false);
      Services.obs.addObserver(http.observer, 'http-on-examine-cached-response', false);
    },
    destroy: function () {
      try {
        Services.obs.removeObserver(http.observer, 'http-on-examine-response');
      }
      catch (e) {}
      try {
        Services.obs.removeObserver(http.observer, 'http-on-examine-cached-response');
      }
      catch (e) {}
    },
    observer: {
      observe: function(doc, aTopic, aData) {
        var channel = doc.QueryInterface(Ci.nsIHttpChannel);
        if(channel.requestMethod != 'GET') {
          return;
        }
        channel.visitResponseHeaders({
          visitHeader: function ( aHeader, aValue ) {
            if ( aHeader.indexOf( 'Content-Type' ) != -1 ) {
              if ( aValue.indexOf('audio') != -1 || aValue.indexOf('video') != -1 ) {
                var request = doc.QueryInterface(Ci.nsIRequest);
                var url = request.name
                  .replace(/signature\=[^\&]*\&/, '')
                  .replace(/range\=[^\&]*\&/, '')
                  .replace(/expire\=[^\&]*\&/, '');
                if (cache.indexOf(url) == -1) {
                  cache.push(url);
                  var notificationCallbacks =
                    channel.notificationCallbacks ?
                      channel.notificationCallbacks : channel.loadGroup.notificationCallbacks;

                  if (notificationCallbacks) {
                    var domWin = notificationCallbacks.getInterface(Ci.nsIDOMWindow);
                    IDExtractor({
                      origin: domWin.top.document.URL,
                      title: aValue.split('/')[0] + '_' + domWin.top.document.title,
                      vInfo: {
                        url: request.name,
                        container: aValue.split('/')[1],
                        audioBitrate: '',
                        audioEncoding: '',
                        resolution: '',
                        quality: ''
                      }
                    });
                    monitor(tabs.activeTab);
                  }
                }
              }
            }
          }
        });
      }
    }
  }
})();
//http.initialize ();

/** Pref listener **/
sp.on('ffmpegPath-manual', function () {
  try {
    var file = tools.prefs.getComplexValue('ffmpegPath-manual', Ci.nsILocalFile);
    if (file.exists()) {
      tools.prefs.setComplexFile('ffmpegPath', file);
    }
    else {
      console.error('cannot find FFMpeg at specified path; setting FFMpeg failed.');
    }
  }
  catch (e) {
    console.error(e.message);
  }
});
(function () {
  let hotkey;
  function setup () {
    if (!prefs.downloadHKey || prefs.downloadHKey.split('+').length === 1) {
      if (hotkey) {
        console.error('removing key')
        hotkey.destroy();
        hotkey = null;
      }
      return;
    }
    let key = prefs.downloadHKey.replace(/\ \+\ /g, '-').toLowerCase();
    key = key.split('-');
    key[key.length - 1] = key[key.length - 1][0];
    key = key.join('-');
    if (hotkey) {
      hotkey.destroy();
    }
    hotkey = Hotkey({
      combo: key,
      onPress: function () {
        cmds.onCommand(null, null, true, null);
      }
    });
  }
  setup();
  sp.on('downloadHKey', setup);
})();

/** Detect a YouTube download link, download it and extract the audio**/
var listener = (function () {
  var objs = [];
  function remove (dl) {
    objs.forEach(function (obj, index) {
      if (obj.id == dl.id) {
        objs[index] = null;
      }
    });
    objs = objs.filter(function (a){return a});

    if (!objs.length) {
      yButton.tooltiptext = config.tooltip;
      yButton.progress = 0;
    }
  }

  return {
    onDetectStart: function () {
      rPanel.port.emit('detect', _('msg7'));
    },
    onDetectDone: function () {},
    onDownloadStart: function (dl) {
      rPanel.port.emit(
        'download-start',
        dl.id,
        dl.displayName ? dl.displayName : (new FileUtils.File(dl.target.path)).leafName,
        _('msg6')
      );
    },
    onDownloadPaused: function (dl) {
      rPanel.port.emit('download-paused', dl.id, _('msg12'));
    },
    onDownloadDone: function (dl, error) {
      rPanel.port.emit('download-done', dl.id, _('msg8'), !prefs.doExtract || error);
      remove(dl);
    },
    onExtractStart: function (id) {
      rPanel.port.emit('extract', id, _('msg9'));
    },
    onExtractDone: function (id) {
      rPanel.port.emit('extract', id, _('msg10'), true);
    },
    onProgress: function (dl) {
      rPanel.port.emit('download-update',
        dl.id,
        dl.amountTransferred / dl.size * 100,
        _('msg11'),
        format(dl.amountTransferred),
        format(dl.size),
        format(dl.speed)
      );
      //
      var exist = false;
      objs.forEach(function (obj) {if (dl.id == obj.id) exist = true;});
      if (!exist) objs.push(dl);

      var ttSize = 0, tSize = 0;
      objs.forEach(function (obj) {
        tSize += obj.size;
        ttSize += obj.amountTransferred;
      });
      yButton.progress = ttSize / tSize;
      yButton.tooltiptext =
        _('tooltip4').replace('%1', (tSize/1024/1024).toFixed(1)) +
        '\n' +
        _('tooltip5').replace('%1', (ttSize/tSize*100).toFixed(1));
    },
    onError: remove,
    cancel: function (id) {
      download.cancel(id);
    }
  }
})();

var batch = (function () {
  var cache = {};
  var files = {};
  return {
    add: function (id) {
      cache[id] = 2;
    },
    execute: function (id, file, type, callback, pointer) {
      cache[id] -= 1;
      if (cache[id] == 1) {
        files[id] = file;
        if (callback) callback.apply(pointer);
      }
      else {
        var f1 = files[id], f2 = file;
        if (type == 'audio') {
          [f1, f2] = [f2, f1];
        }
        ffmpeg.ffmpeg([f1, f2], {deleteInputs: prefs.deleteInputs}, function () {
          if (callback) callback.apply(pointer);
        });

      }
    }
  }
})();

/** Call this with new **/
var getVideo = (function () {
  return function (videoID, listener, itag, noAudio, callback, pointer) {
    var doExtract = noAudio ? false : prefs.doExtract;
    var batchID;  // For batch job

    function onDetect () {
      function indexToContainer (value) {
        return ['flv', '3gp', 'mp4', 'webm'][value]
      }

      listener.onDetectStart();
      youtube.videoInfo(videoID).then(
        function (info) {
          var fmt, qualityValue = prefs.quality;

          if (itag) {
            fmt = info.formats.reduce(function (p, c) {
              return p || (c.itag + '' == itag ? c : null);
            }, null);
          }
          if (!itag) {
            var tmp = info.formats.filter(function (a) {
              if (a.dash === 'a') return false;
              if ((!prefs.ffmpegPath || !prefs.doBatchMode) && a.dash === 'v') return false;
              return a.container == indexToContainer(prefs.extension);
            });
            //Sorting base on quality (the current sort is based on video type)
            tmp = tmp.sort(function (a, b) {
              var m = qualityValue === 3 || qualityValue === 4 ? -1 : 1;
              return (parseInt(b.resolution) - parseInt(a.resolution)) * m;
            });
            if (prefs.doExtract && indexToContainer(prefs.extension) == 'flv') {
              var tmp2 = tmp.filter(function (a) {
                return a.audioEncoding == 'aac'
              });
              if (tmp2.length) {
                tmp = tmp2;
              }
            }
            while (tmp.length && !fmt && qualityValue > -1) {
              var b = tmp.filter(function (a) {
                var resolution = parseInt(a.resolution);
                //4 worst, 0 best
                if (qualityValue == 0) {  //HD
                  return resolution >= 1080;
                }
                if (qualityValue == 1) {  //HD
                  return resolution >= 720 && resolution < 1080;
                }
                if (qualityValue == 2) {  //High
                  return resolution >= 480 && resolution < 720;
                }
                if (qualityValue == 3) {  //Medium
                  return resolution >= 240 && resolution < 480;
                }
                if (qualityValue == 4) {  //Small
                  return resolution < 240;
                }
              });
              if (b.length) fmt = b[0];
              qualityValue -= 1;
            }
            if (!fmt && tmp.length) fmt = tmp[0]
            if (!fmt) fmt = info.formats[0]; //Get highest quality
          }
          fmt.parent = info;
          //
          listener.onDetectDone();
          //Remux audio-only streams even if doExtract is not active
          if (!noAudio && fmt.dash == 'a' && prefs.doRemux) {
            doExtract = true;
          }
          onFile (fmt, info);
        },
        function (e) {
          notify(_('name'), e);
        }
      );
    }
    function onFile (vInfo, gInfo) {
      // Do not generate audio file if video has no sound track
      if (vInfo.dash == 'v') {
        doExtract = false;
      }
      // Do not generate audio file if video format is not FLV
      else if (doExtract && !(vInfo.container == 'flv' || prefs.ffmpegPath)) {
        //Prevent conflict with video info notification
        timer.setTimeout(function () {
          notify(_('name'), _('msg5'))
        }, config.noAudioExtraction * 1000);
        doExtract = false;
      }
      // Download proper audio file if video-only format is selected
      if (vInfo.dash == 'v') {
        if (!prefs.showAudioDownloadInstruction) {
          var tmp = prompts2(_('msg22'), _('msg23'), '', '', _('msg21'), true);
          prefs.showAudioDownloadInstruction = tmp.check.value;
          prefs.doBatchMode = tmp.button == 0;
        }
        if (prefs.doBatchMode) {
          // Selecting the audio file
          var tmp = vInfo.parent.formats.filter(function (a) {
            return a.dash === 'a';
          });
          if (tmp && tmp.length) {
            var afIndex;
            function sort (tmp, toArr) {
              return tmp.sort(function (a, b) {
                var i = toArr.indexOf(a.itag),
                    j = toArr.indexOf(b.itag);
                if (i == -1 && j == -1) return 0;
                if (i != -1 && j == -1) return -1;
                if (i == -1 && j != -1) return +1;
                return i > j;
              });
            }

            if (youtube.tagInfo.video.mp4.low.indexOf(vInfo.itag) != -1 && !prefs.pretendHD) {  // Low quality (mp4)
              tmp = sort(tmp, [140, 171, 139, 172, 141]);
            }
            else if (youtube.tagInfo.video.webm.low.indexOf(vInfo.itag) != -1 && !prefs.pretendHD) {  // Low quality (webm)
              tmp = sort(tmp, youtube.tagInfo.audio.ogg.reverse());
            }
            else if (youtube.tagInfo.video.mp4.medium.indexOf(vInfo.itag) != -1 && !prefs.pretendHD) { // Medium quality (mp4)
              tmp = sort(tmp, [140, 171, 172, 141, 139]);
            }
            else if (youtube.tagInfo.video.webm.medium.indexOf(vInfo.itag) != -1 && !prefs.pretendHD) { // Medium quality (webm)
              tmp = sort(tmp, youtube.tagInfo.audio.ogg.reverse());
            }
            else {
              if ([].concat(youtube.tagInfo.video.webm.low, youtube.tagInfo.video.webm.medium, youtube.tagInfo.video.webm.high).indexOf(vInfo.itag) != -1) {  //High quality (webm)
                tmp = sort(tmp, youtube.tagInfo.audio.ogg);
              }
              else {  //High quality (mp4)
                tmp = sort(tmp, [141, 172, 140, 171, 139]);
              }
            }
            afIndex = tmp[0].itag;
            batchID = Math.floor((Math.random()*10000)+1);
            batch.add(batchID);
            vInfo.parent.formats.forEach (function (a, index) {
              if (a.itag == afIndex) {
                new getVideo(videoID, listener, a.itag, true, function (f) {
                  batch.execute(batchID, f, 'audio');
                });
              }
            });
          }
        }
      }
      var vFile;
      //Select folder by nsIFilePicker
      if (prefs.dFolder == 4) {
        let nsIFilePicker = Ci.nsIFilePicker;
        let fp = Cc['@mozilla.org/filepicker;1'].createInstance(nsIFilePicker);
        fp.init(windows.active, _('prompt3'), nsIFilePicker.modeSave);
        fp.appendFilter(_('msg14'), '*.' + vInfo.container);
        fp.defaultString = fileName(videoID, vInfo, gInfo);
        let res = fp.show();
        if (res == nsIFilePicker.returnCancel) {
          // Still no id. Generating a random one
          var id = Math.floor(Math.random()*101) + 10000;
          listener.onDownloadStart({
            id: id,
            displayName: '-'
          });
          listener.onDownloadDone({id: id}, true);
          return;
        }
        vFile = fp.file;
      }
      //Select folder by userFolder
      else if (prefs.dFolder == 5) {
        try {
          //Simple-prefs doesn't support complex type
          vFile = _prefs.getComplexValue('userFolder', Ci.nsIFile);
          vFile.append(fileName(videoID, vInfo, gInfo));
        }
        catch (e) {
          notify(_('name'), _('err7') + '\n\n' + _('err') + ': ' + e.message);
          return;
        }
      }
      else {
        var videoPath = [];
        switch(prefs.dFolder) {
          case 2:
            root = 'TmpD';
            let folder = Math.random().toString(36).substr(2,16);
            videoPath.push('iaextractor');
            videoPath.push(folder);
            break;
          case 0:
            root = 'DfltDwnld'
            break;
          case 1:
            root = 'Home';
            break;
          case 3:
            root = 'Desk';
            break;
        }
        videoPath.push(fileName(videoID, vInfo, gInfo));
        vFile = FileUtils.getFile(root, videoPath);
      }
      var aFile, sFile;
      var vFile_first = true, aFile_first = true, sFile_first = true;
      onDownload(vInfo, {
        get vFile () {
          if (vFile_first) {
            vFile.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
            vFile_first = false;
          }
          return vFile;
        },
        get aFile () {
          if (aFile_first) {
            //To match audio name with video name in case of duplication
            let name = vFile.leafName.replace(/\.+[^\.]*$/, '');
            aFile = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
            aFile.initWithPath(vFile.parent.path);
            aFile.append(name + '.aac');
            aFile_first = false;
          }
          return aFile;
        },
        get sFile () {
          if (aFile_first) {
            let name = vFile.leafName.replace(/\.+[^\.]*$/, '');
            sFile = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
            sFile.initWithPath(vFile.parent.path);
            sFile.append(name + '.srt');
            sFile_first = false;
          }
          return sFile;
        }
      });
    }
    function onDownload (vInfo, obj) {
      var dr = new download.get({
        progress: listener.onProgress,
        paused: listener.onDownloadPaused,
        done: function (dl) {
          listener.onDownloadDone(dl, !doExtract);
          onExtract (vInfo, dl, obj);
        },
        error: function (dl, e) {
          if (e) notify(_('name'), e);
          listener.onDownloadDone(dl, true);
        }
      });
      dr(vInfo.url, obj.vFile, null, false, function (dl) {
        listener.onDownloadStart(dl);
      });
      notify(
        _('name'),
        _('msg3').replace('%1', vInfo.quality)
          .replace('%2', vInfo.container)
          .replace('%3', vInfo.resolution)
          .replace('%6', vInfo.audioEncoding || '')
          .replace('%7', vInfo.audioBitrate || '')
      );
      onSubtitle(obj);
    }
    function onExtract (vInfo, dl, obj) {
      var id = dl.id;

      function afterExtract (e) {
        if (e) notify(_('name'), e);
        if (prefs.open) {
          try {
            obj.vFile.reveal();
          }
          catch(_e) {
            tabs.open(obj.vFile.parent.path);
          }
        }
        if (callback) callback.apply(pointer, [obj.vFile]);
        if (batchID) batch.execute(batchID, obj.vFile, 'video');
      }
      if (!doExtract) {
        return afterExtract();
      }
      listener.onExtractStart(id);
      if ((vInfo.container == 'flv' && vInfo.audioEncoding == 'aac') || !prefs.ffmpegPath) {
        extract.perform(id, obj.vFile, obj.aFile, function (id, e) {
          if (e && prefs.ffmpegPath) {
            ffmpeg.ffmpeg([obj.vFile], {}, function () {
              listener.onExtractDone(id);
              afterExtract();
            });
          }
          else {
            listener.onExtractDone(id);
            afterExtract(prefs.extension == '0' ? e : null);
          }
        });
      }
      else {
        ffmpeg.ffmpeg([obj.vFile], {
          deleteInputs: vInfo.dash && prefs.deleteInputs,
          extension: youtube.tagInfo.audio.opus.indexOf(vInfo.itag) !== -1 ? 'opus' : null
        }, function () {
          listener.onExtractDone(id);
          afterExtract();
        });
      }
    }
    function onSubtitle (obj) {
      return;

      subtitle.get(videoID, prefs.subtitleLang, obj.sFile, function (e) {
        if (e) notify(_('name'), e);
      });
    }
    //
    if (typeof(videoID) == 'object') {
      var obj = videoID[0];
      onFile (obj.vInfo, obj);
    }
    else {
      onDetect();
    }
  }
})();

/** File naming **/
var fileName = function (videoID, vInfo, gInfo) {
  // Add " - DASH" to DASH only files
  var pdate = '';
  if (gInfo.response && gInfo.response.text) {
    pdate = /Published on (\w{3} \d{1,2}\, \d{1,4})/.exec(gInfo.response.text);
  }
  return pattern = prefs.namePattern
    .replace ('[file_name]', gInfo.title + (vInfo.dash ? ' - DASH' : ''))
    .replace ('[extension]', vInfo.container)
    .replace ('[author]', gInfo.author)
    .replace ('[video_id]', videoID)
    .replace ('[video_resolution]', vInfo.resolution || '')
    .replace ('[audio_bitrate]', vInfo.audioBitrate ? (vInfo.audioBitrate + 'K') : '')
    .replace ('[published_date]', pdate && pdate.length ? pdate[1] : '')
    //
    .replace(/\+/g, ' ')
    .replace(/[:\?\¿]/g, '')
    .replace(/[\\\/]/g, '-')
    .replace(/[\*]/g, '^')
    .replace(/[\"]/g, "'")
    .replace(/[\<]/g, '[')
    .replace(/[\>]/g, ']')
    .replace(/[|]/g, '-');
}

/** Flashgot **/
var flashgot = (function () {
  var flashgot;
  try {
    flashgot = Cc['@maone.net/flashgot-service;1']
      .getService(Ci.nsISupports).wrappedJSObject;
  }
  catch (e) {}
  return function (vInfo, gInfo) {
    if (flashgot) {
      var links = [{
        href: vInfo.url,
        fname : fileName(gInfo.video_id, vInfo, gInfo),
        description: _('msg15')
      }];
      links.document = windows.active.document;
      flashgot.download(links, flashgot.OP_ALL, flashgot.defaultDM);
    }
    else {
      notify(_('name'), _('err14'));
      timer.setTimeout(function (){
        tabs.open(config.urls.flashgot);
      }, 2000);
    }
  }
})();

/** DownThemAll **/
var downThemAll = (function () {
  var DTA = {};
  try {
    Cu.import('resource://dta/api.jsm', DTA);
  }
  catch (e) {
    try {
      var glue = {}
      Cu.import('chrome://dta-modules/content/glue.jsm', glue);
      DTA = glue['require']('api');
    }
    catch (e) {}
  }
  return function (vInfo, gInfo, turbo) {
    var fname = fileName(gInfo.video_id, vInfo, gInfo);
    if (DTA.saveSingleItem) {
      var iOService = Cc['@mozilla.org/network/io-service;1']
        .getService(Ci.nsIIOService)
      try {
        DTA.saveSingleItem(windows.active, turbo, {
          url: new DTA.URL(iOService.newURI(vInfo.url, 'UTF-8', null)),
          referrer: '',
          description: _('msg15'),
          fileName: fname,
          destinationName: fname,
          isPrivate: false,
          ultDescription: ''
        });
      }
      catch (e) {
        if (turbo) {
          downThemAll(vInfo, gInfo, false);
        }
      }
    }
    else {
      notify(_('name'), _('err15'));
      timer.setTimeout(function (){
        tabs.open(config.urls.downthemall);
      }, 2000);
    }
  }
})();

var tdmanager = (function () {
  var connect = {};
  function check () {
    try {
      Cu.import('resource://jid0-dsq67mf5kjjhiiju2dfb6kk8dfw-at-jetpack/data/firefox/shared/connect.jsm', connect);
    }
    catch (e) {
      console.error(e);
    }
  }
  return function (vInfo, gInfo) {
    if (!connect.remote) {
      check();
    }
    if (connect.remote) {
      connect.remote.download({
        url: vInfo.url,
        name : fileName(gInfo.video_id, vInfo, gInfo)
      });
    }
    else {
      notify(_('name'), _('err26'));
      timer.setTimeout(function () {
        tabs.open(config.urls.tdmanager);
      }, 2000);
    }
  }
})();

function dFolder (forced) {
  if ((prefs.dFolder === 5 && !prefs.userFolder) || forced === true) {
    rPanel.hide();
    var nsIFilePicker = Ci.nsIFilePicker;
    var fp = Cc['@mozilla.org/filepicker;1'].createInstance(nsIFilePicker);
    fp.init(windows.active, _('msg13'), nsIFilePicker.modeGetFolder);
    var res = fp.show();
    if (res != nsIFilePicker.returnCancel) {
      _prefs.setComplexFile('userFolder', fp.file);
      prefs.dFolder = 5;
    }
    else {
      console.error(prefs.dFolder, prefs.userFolder)
      if (!prefs.userFolder && prefs.dFolder === 5) {
        prefs.dFolder = 3;
      }
    }
  }
}
sp.on('dFolder', dFolder);

(function (observer) {
  Services.obs.addObserver(observer, 'iaextractor', false);
  unload.when(function () {
    Services.obs.removeObserver(observer, 'iaextractor', false);
  });
})({
  observe: function (aSubject, aTopic, aData) {
    if (aTopic === 'iaextractor' && aData === 'userFolder-browse') {
      dFolder(true);
    }
    if (aTopic === 'iaextractor' && aData === 'ffmpegPath-browse') {
      var nsIFilePicker = Ci.nsIFilePicker;
      var fp = Cc['@mozilla.org/filepicker;1'].createInstance(nsIFilePicker);
      fp.init(windows.active, _('msg31'), nsIFilePicker.modeOpen);
      var res = fp.show();
      if (res != nsIFilePicker.returnCancel) {
        _prefs.setComplexFile('userFolder', fp.file);
      }
    }
    if (aTopic === 'iaextractor' && aData === 'proceed') {
      external.installFFmpeg();
    }
    if (aTopic === 'iaextractor' && aData === 'reset') {
      if (!windows.active.confirm(_('msg25'))) {
        return;
      }
      tools.prefs.reset();
      if (prefs.ffmpegPath) {
        prefs.extension = 2;
      }
    }
    if (aTopic === 'iaextractor' && aData === 'install-converter') {
      rPanel.cmds.tools();
    }
    if (aTopic === 'iaextractor' && aData === 'reset-ffmpegInputs') {
      tools.prefs.clearUserPref('ffmpegInputs');
    }
    if (aTopic === 'iaextractor' && aData === 'reset-ffmpegInputs3') {
      tools.prefs.clearUserPref('ffmpegInputs3');
    }
    if (aTopic === 'iaextractor' && aData === 'reset-ffmpegInputs4') {
      tools.prefs.clearUserPref('ffmpegInputs4');
    }
  }
});
// closing the options window on unload
unload.when(function () {
  let wm = Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator);
  let enumerator = wm.getEnumerator(null);
  while(enumerator.hasMoreElements()) {
    let win = enumerator.getNext();
    if (win.location.href.indexOf(self.name) !== -1) {
      win.close();
    }
  };
})
