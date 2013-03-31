/** Require **/
var {Cc, Ci, Cu}  = require('chrome'),
    tabs          = require("sdk/tabs"),
    self          = require("sdk/self"),
    timer         = require("sdk/timers"),
    sp            = require("sdk/simple-prefs"),
    prefs         = sp.prefs,
    panel         = require("sdk/panel"),
    _             = require("sdk/l10n").get,
    pageMod       = require("sdk/page-mod"),
    windowutils   = require("window-utils"),
    window        = windowutils.activeBrowserWindow,
    data          = self.data,
    toolbarbutton = require("./toolbarbutton"),
    youtube       = require("./youtube"),
    download      = require("./download"),
    extract       = require("./extract"),
    tools         = require("./misc"),
    fileSize      = tools.fileSize,
    format        = tools.format;
    
Cu.import("resource://gre/modules/FileUtils.jsm");
    
/** Internal configurations **/
var config = {
  //Youtube
  youtube: "https://www.youtube.com/",
  tools: "chrome://iaextractor/content/tools.xul",
  //toolbar
  image: {
    get progressColor() {return prefs.progressColor}
  },
  move: {toolbarID: "nav-bar", insertbefore: "home-button", forceMove: false},
  //Timing
  desktopNotification: 3, //seconds
  //Tooltip
  tooltip: _("tooltip1") + "\n" + _("tooltip2"),
  //Panels
  panels: {
    rPanel: {
      width: 387,
      height: 247
    },
    iPanel: {
      width: 520,
      height: 520
    }
  },
  //pref
  pref: "extensions.feca4b87-3be4-43da-a1b1-137c24220968@jetpack.",
  //Homepage
  homepage: "http://add0n.com/youtube.html"
}
/** Functions **/
var _prefs = (function () {
  var pservice = Cc["@mozilla.org/preferences-service;1"].
    getService(Ci.nsIPrefService).getBranch(config.pref)
  return {
    getComplexValue: pservice.getComplexValue,
    setComplexValue: function (id, val) {
      var str = Cc["@mozilla.org/supports-string;1"]
        .createInstance(Ci.nsISupportsString);
      str.data = val;
      pservice.setComplexValue(id, Ci.nsISupportsString, str);
    }
  }    
})();

/** Panels **/
var rPanel = panel.Panel({
  width: config.panels.rPanel.width,
  height: config.panels.rPanel.height,
  contentURL: data.url('report.html'),
  contentScriptFile: data.url('report/report.js'),
  contentScriptWhen: "ready"
});
rPanel.port.on("cmd", function (cmd) {
  switch (cmd) {
    case "download":
      cmds.onCommand(null, null, true, null);
      break;
    case "show-download-manager":
      download.show();
      break;
    case "formats":
      rPanel.hide();
      cmds.onShiftClick();
      break;
    case "embed":
      cmds.onCtrlClick();
      break;
    case "destination":
      prefs.dFolder = parseInt(arguments[1]);
      break;
    case "quality":
      prefs.quality = parseInt(arguments[1]);
      break;
    case "format":
      prefs.extension = parseInt(arguments[1]);
      break;
    case "do-extract":
      prefs.doExtract = arguments[1];
      break;
    case "do-size":
      prefs.getFileSize = arguments[1];
      break;
    case "tools":
      rPanel.hide();
      window.open(config.tools, 'iaextractor', 'chrome,minimizable=yes,all');
      break;
    case "cancel":
      listener.cancel(parseInt(arguments[1]));
      break;
  }
});
rPanel.on("show", function() {
  rPanel.port.emit(
    "update", 
    prefs.doExtract, 
    prefs.getFileSize, 
    prefs.dFolder, 
    prefs.quality, 
    prefs.extension, 
    yButton.saturate
  );
});

var iPanel = panel.Panel({
  width: config.panels.iPanel.width,
  height: config.panels.iPanel.height,
  contentURL: data.url('info.html'),
  contentScriptFile: [
    data.url('info/jsoneditor/jsoneditor.js'), 
    data.url('info/info.js')
  ],
  contentScriptWhen: "ready"
});

/** Get video id from URL **/
function urlExtractor (url, callback, pointer) {
  var id;
  //Watch
  var temp = /http.*:.*youtube.com\/watch\?.*v\=([^\=\&]*)/.exec(url);
  id = temp ? temp[1]: null;
  if (callback && id) {
    return callback.apply(pointer, [id]);
  }
  //Rest
  function fetchId (script) {
    var worker = tabs.activeTab.attach({
      contentScript: "self.port.emit('response', (%s)())".replace("%s", script)
    });
    worker.port.on("response", function (id) {
      if (callback) {
        return callback.apply(pointer, [id]);
      }
    });
  }
  //User page
  if (/http.*:.*youtube.com\/user/.test(url)) {
    var tmp = function () {
      try {
        var divs = document.getElementsByClassName('channels-video-player');
        if (!divs.length) {
          divs = document.getElementsByClassName('c4-flexible-player-box');
        }
        return divs.length ? divs[0].getAttribute('data-video-id') : null
      }
      catch(e){
        return null
      }
    }
    fetchId(tmp + "");
  }
  //movie
  else if (/http.*:.*youtube.com\/movie/.test(url)) {
    var tmp = function () {
      try {
        var divs = document.getElementsByClassName('ux-thumb-wrap');
        return divs.length ? /v\=([^\=\&]*)/.exec(divs[0].getAttribute('href'))[1] : null
      }
      catch(e){
        return null
      }
    }
    fetchId(tmp + "");
  }
  else {
    callback.apply(pointer, []);
  }
}

/** Welcome page **/
var welcome = function () {
  timer.setTimeout(function () {
    tabs.open({url: config.homepage, inBackground : false});
  }, 3000);
}

/** Initialize **/
var yButton;
var cmds = {
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
  onCommand: function (e, tbb, download, fIndex) {
    let url = tabs.activeTab.url;
    urlExtractor(url, function (videoID) {
      if (!videoID) {
        tabs.open(config.youtube);
        return;
      };
      if (tbb) {
        rPanel.show(tbb);
      }
      if (download) {
        get(videoID, listener, fIndex);
      }
    });
  },
  onMiddleClick: function (e, tbb) {
    let url = tabs.activeTab.url;
    urlExtractor(url, function (videoID) {
      if (!videoID) return;
      iPanel.show(tbb);
      youtube.getInfo(videoID, function (vInfo, e) {
        iPanel.port.emit('info', vInfo);
      });
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
      contentScript: "self.port.emit('response', (%s)())".replace("%s", script + "")
    });
    worker.port.on("response", function (arr) {
      if (arr) {
        if (arr && arr.length) {
          arr = arr.filter(function(elem, pos) {
              return arr.indexOf(elem) == pos;
          });
          var obj = prompts(_("prompt1"), _("prompt2"), arr);
          if (obj[0] && obj[1] != -1) {
            tabs.open(config.youtube + "watch?v=" + arr[obj[1]]);
          }
        }
        else {
          notify(_("name"), _("msg4"));
        }
      }
    });
  },
  onShiftClick: function () {
    let url = tabs.activeTab.url;
    urlExtractor(url, function (videoID) {
        if (videoID) {
        let worker = tabs.activeTab.attach({
          contentScriptFile: data.url("formats/inject.js"),
          contentScriptOptions: {
            doSize: prefs.getFileSize
          }
        });
        worker.port.on("file-size-request", function (url, index) {
          fileSize(url, function (url, size) {
            worker.port.emit("file-size-response", url, size, index);
          });
        });
        worker.port.on("download", function (fIndex) {
          cmds.onCommand(null, null, true, fIndex);
        });
        youtube.getInfo(videoID, function (vInfo) {
          worker.port.emit('info', vInfo);
        });
      }
      else {
        notify(_('name'), _('msg4'));
      }
    });
  }
}
exports.main = function(options, callbacks) {
  //Toolbar
  yButton = toolbarbutton.ToolbarButton({
    id: "youtube-audio-converter",
    label: _("toolbar"),
    tooltiptext: config.tooltip,
    progressColor: config.image.progressColor,
    image: data.url("notification.png"),
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
  if (options.loadReason == "install") {
    yButton.moveTo(config.move);
  }
  //Monitor tab changes
  function monitor (tab) {
    urlExtractor(tabs.activeTab.url, function (videoID) {
      if (videoID) {
        yButton.saturate = 1;
        yButton.hueRotate = 0;
      }
      else {
        yButton.saturate = 0;
      }
    });
  }
  monitor(tabs.activeTab);
  tabs.on('activate', monitor);
  tabs.on('ready', monitor);
  //Welcome page
  if (options.loadReason == "upgrade" || options.loadReason == "install") {
    welcome();
  }
  //Close tools window
  if (options.loadReason) {
    let wm = Cc["@mozilla.org/appshell/window-mediator;1"]
      .getService(Ci.nsIWindowMediator);   
    let enumerator = wm.getEnumerator("iaextractor:tools");
    while (enumerator.hasMoreElements()) {
      let win = enumerator.getNext();
      win.close();
    }
  }
  // Pref listener
  sp.on("dFolder", function () {
    if (prefs.dFolder == "5" && !prefs.userFolder) {
      rPanel.hide();
      var nsIFilePicker = Ci.nsIFilePicker;
      var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
      fp.init(window, _("msg13"), nsIFilePicker.modeGetFolder);
      var res = fp.show();
      if (res != nsIFilePicker.returnCancel){
        _prefs.setComplexValue("userFolder", fp.file.path);
      }
      else {
        prefs.dFolder = 2;
      }
    }
  });
}

/** Inject foramts menu into Youtube pages **/
pageMod.PageMod({
  include: ["*.youtube.com"],
  contentScriptFile: data.url("formats/permanent.js"),
  contentStyleFile: data.url("formats/permanent.css"),
  onAttach: function(worker) {
    worker.port.on("formats", function() {
      cmds.onShiftClick();
    });
  }
});

/** Detect a Youtube download link, download it and extract the audio**/
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
      rPanel.port.emit('detect', _("msg7"));
    },
    onDetectDone: function () {},
    onDownloadStart: function (dl) {
      rPanel.port.emit('download-start', dl.id, dl.displayName, _("msg6"));
    },
    onDownloadPaused: function (dl) {
      rPanel.port.emit('download-paused', dl.id, _("msg12"));
    },
    onDownloadDone: function (dl, error) {
      rPanel.port.emit('download-done', dl.id, _("msg8"), !prefs.doExtract || error);
      remove(dl);
    },
    onExtractStart: function (id) {
      rPanel.port.emit('extract', id, _("msg9"));
    },
    onExtractDone: function (id) {
      rPanel.port.emit('extract', id, _("msg10"), true);
    },
    onProgress: function (dl) {
      rPanel.port.emit('download-update', 
        dl.id, 
        dl.amountTransferred/dl.size*100, 
        _("msg11"), 
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
      yButton.progress = ttSize/tSize;
      yButton.tooltiptext = 
        _("tooltip4").replace("%1", (tSize/1024/1024).toFixed(1)) +
        "\n" +
        _("tooltip5").replace("%1", (ttSize/tSize*100).toFixed(1));
    },
    onError: remove,
    cancel: function (id) {
      var dm = Cc["@mozilla.org/download-manager;1"]
        .getService(Ci.nsIDownloadManager);
      dm.cancelDownload(id);
    }
  }
})();

var get = function (videoID, listener, fIndex) {
  //Detect
  listener.onDetectStart();
  youtube.getLink(videoID, fIndex, function (vInfo, title, user, e) {
    listener.onDetectDone();
    if (e) {
      notify(_('name'), e);
      return;
    }
    //Creating temporary files
    var videoName = ((prefs.addUserInfo ? user + " - " : "") + title).replace(/[\:\\\/\?\*\"\>\<\|]/g, "_");
    var audioName = videoName;
    var root, audioPath = [], videoPath = [];
    var iFile, oFile;
    if (prefs.dFolder == 4) { //Select folder by user
      let nsIFilePicker = Ci.nsIFilePicker;
      let fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
      fp.init(window, _("prompt3"), nsIFilePicker.modeSave);
      fp.appendFilter(_("msg14"), "*." + vInfo.container);
      fp.defaultString = videoName + "." + vInfo.container;
      let res = fp.show();
      if (res == nsIFilePicker.returnCancel) return;
      iFile = fp.file;
      if (prefs.doExtract) {
        audioName = iFile.leafName.replace(/\.+[^\.]*$/, ".aac");
        audioName += /\./.test(audioName) ? "" : ".aac";
        oFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
        oFile.initWithPath(iFile.parent.path);
        oFile.append(audioName);
      }
    }
    else if (prefs.dFolder == 5) { //Select folder by user
      try {
        //Simple-prefs doesnt support complex type
        iFile = _prefs.getComplexValue("userFolder", Ci.nsIFile);
        iFile.append(videoName + "." + vInfo.container);
        iFile.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);
        if (prefs.doExtract) {
          oFile = _prefs.getComplexValue("userFolder", Ci.nsIFile);
          oFile.append(audioName + ".aac");
        }
      }
      catch (e) {
        notify(_("name"), _("err7") + "\n\n" + _("err") + ": " + e.message);
        return;
      }
    }
    else {
      switch(prefs.dFolder) {
        case 2:
          root = "TmpD";
          let folder = Math.random().toString(36).substr(2,16);
          videoPath = ["iaextractor", folder];
          audioPath = ["iaextractor", folder];
          break;
        case 0:
          root = "DfltDwnld"
          videoPath = [];
          audioPath = [];
          break;
        case 1:
          root = "Home";
          videoPath = [];
          audioPath = [];
          break;
        case 3:
          root = "Desk";
          videoPath = [];
          audioPath = [];
          break;
      }
      videoPath.push(videoName + "." + vInfo.container);
      audioPath.push(audioName + ".aac");
      
      iFile = FileUtils.getFile(root, videoPath);
      iFile.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
      if (prefs.doExtract) {
        oFile = FileUtils.getFile(root, audioPath);
      }
    }
    //Download
    var dr = new download.get({
      progress: listener.onProgress,
      paused: listener.onDownloadPaused,
      done: function (dl) {
        var id = dl.id;
        listener.onDownloadDone(dl);
        function afterExtract (e) {
          if (prefs.open) {
            try {
              iFile.reveal();
            }
            catch(_e) {
              tabs.open(iFile.parent.path);
            }
          }
          if (e) notify(_('name'), e);
        }
        if (!prefs.doExtract) {
          return afterExtract();
        }
        listener.onExtractStart(id);
        
        oFile.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);
        extract.perform(id, iFile, oFile, function (id, e) {
          if (prefs.extension != "0") { //
            notify(_("name"), _("msg5"));
          }
          listener.onExtractDone(id);
          afterExtract(prefs.extension == "0" ? e : null);
        });
      },
      error: function (dl) {
        listener.onError(dl);
        listener.onDownloadDone(dl, true);
      }
    });
    listener.onDownloadStart(dr(vInfo.url, iFile));
    notify(
      _('name'), 
      _('msg3').replace("%1", vInfo.quality)
        .replace("%2", vInfo.container)
        .replace("%3", vInfo.resolution)
        .replace("%4", vInfo.encoding)
        .replace("%5", vInfo.bitrate)
        .replace("%6", vInfo.audioEncoding)
        .replace("%7", vInfo.audioBitrate)
    );
  });
}

/** Notifier **/
// https://github.com/fwenzel/copy-shorturl/blob/master/lib/simple-notify.js
var notify = (function () {
  return function (title, text) {
    try {
      let alertServ = Cc["@mozilla.org/alerts-service;1"].
                      getService(Ci.nsIAlertsService);
      //In linux config.image does not work properly!
      alertServ.showAlertNotification(data.url("notification.png"), title, text);
    }
    catch(e) {
      let browser = windowutils.activeBrowserWindow.gBrowser,
          notificationBox = browser.getNotificationBox();

      notification = notificationBox.appendNotification(
        text, 
        'jetpack-notification-box',
        data.url("notification.png"), 
        notificationBox.PRIORITY_INFO_MEDIUM, 
        []
      );
      timer.setTimeout(function() {
          notification.close();
      }, config.desktopNotification * 1000);
    }
  }
})();

/** Prompt **/
var prompts = (function () {
  let prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
  return function (title, content, items) {
    var selected = {};
    var result = prompts.select(null, title, content, items.length, items, selected);
    return [result, selected.value];
  }
})();
