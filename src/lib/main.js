/** Require **/
var tabs          = require("sdk/tabs"),
    self          = require("sdk/self"),
    timer         = require("sdk/timers"),
    prefs         = require("sdk/simple-prefs").prefs,
    panel         = require("sdk/panel"),
    _             = require("sdk/l10n").get,
    pageMod       = require("sdk/page-mod"),
    windowutils   = require("window-utils"),
    window        = windowutils.activeBrowserWindow,
    data          = self.data,
    {Cc, Ci, Cu}  = require('chrome'),
    toolbarbutton = require("toolbarbutton"),
    youtube       = require("youtube"),
    download      = require("download"),
    extract       = require("extract");
    
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
  move: {toolbarID: "nav-bar", forceMove: false},
  //Timing
  desktopNotification: 3, //seconds
  //Tooltip
  tooltip: _("tooltip1") + "\n" + _("tooltip2") + "\n" + _("tooltip3") + "\n" +
    _("tooltip6") + "\n" + _("tooltip7") + "\n" + _("tooltip8"),
  //Panels
  panels: {
    rPanel: {
      width: 380,
      height: 320 // Set this on Ubuntu
    },
    iPanel: {
      width: 520,
      height: 520
    }
  },
  //pref
  pref: "extensions.feca4b87-3be4-43da-a1b1-137c24220968@jetpack.",
  //Homepage
  homepage: "http://iaextractor1.notlong.com/"
}

/** Panel (report) **/
var rPanel = panel.Panel({
  width: config.panels.rPanel.width,
  height: config.panels.rPanel.height,
  contentURL: data.url('report.html'),
  contentScriptFile: data.url('report/report.js'),
  contentScriptWhen: "ready"
});
rPanel.port.on("download", function () {
  cmds.onCommand();
});
rPanel.port.on("cancelAll", function () {
  listener.cancel();
});
rPanel.port.on("formats", function () {
  cmds.onShiftClick();
});
rPanel.port.on("embed", function () {
  cmds.onCtrlClick();
});
rPanel.port.on("destination", function (value) {
  prefs.dFolder = parseInt(value);
});
rPanel.port.on("quality", function (value) {
  prefs.quality = parseInt(value);
});
rPanel.port.on("format", function (value) {
  prefs.extension = parseInt(value);
});
rPanel.port.on("extract", function (value) {
  prefs.doExtract = value;
});
rPanel.port.on("tools", function (value) {
  rPanel.hide();
  window.open(config.tools, 'iaextractor', 'chrome,minimizable=yes,all');
});
rPanel.on("show", function() {
  rPanel.port.emit("update", prefs.doExtract, prefs.dFolder, prefs.quality, prefs.extension, yButton.saturate);
});

var iPanel = panel.Panel({
  width: config.panels.iPanel.width,
  height: config.panels.iPanel.height,
  contentURL: data.url('info.html'),
  contentScriptFile: [data.url('info/jsoneditor/jsoneditor.js'), data.url('info/info.js')],
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
  onCommand: function (e, tbb) {
    let url = tabs.activeTab.url;
    urlExtractor(url, function (videoID) {
      if (!videoID) {
        tabs.open(config.youtube);
        return;
      };
      rPanel.show(tbb);
      get(videoID, listener);
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
    let worker = tabs.activeTab.attach({
      contentScriptFile: data.url("formats/inject.js"),
    });
    urlExtractor(url, function (videoID) {
      if (!videoID) return;
      youtube.getInfo(videoID, function (vInfo) {
        worker.port.emit('info', vInfo);
      });
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
    urlExtractor(tab.url, function (videoID) {
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
}

/** Inject foramts menu into Youtube pages **/
pageMod.PageMod({
  include: ["*.youtube.com"],
  contentStyleFile : data.url("formats/permanent.css"),
  contentScriptWhen: "start"
});

/** Detect a Youtube download link, download it and extract the audio**/
var listener = (function () {
  var objs = [];
  var detects = 0, downloads = 0, extracts = 0;
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
      rPanel.port.emit('detect', ++detects);
    },
    onDetectDone: function () {
      rPanel.port.emit('detect', --detects);
    },
    onDownloadStart: function () {
      rPanel.port.emit('download', ++downloads);
    },
    onDownloadDone: function (dl) {
      remove(dl);
      rPanel.port.emit('download', --downloads);
    },
    onExtractStart: function () {
      rPanel.port.emit('extract', ++extracts);
    },
    onExtractDone: function () {
      rPanel.port.emit('extract', --extracts);
    },
    onProgress: function (dl) {
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
    cancel: function () {
      var dm = Cc["@mozilla.org/download-manager;1"]
        .getService(Ci.nsIDownloadManager);
      objs.forEach(function (dl) {
        dm.cancelDownload(dl.id);
      });
    }
  }
})();

var get = function (videoID, listener) {
  //Detect
  listener.onDetectStart();
  youtube.getLink(videoID, function (vInfo, title, e) {
    listener.onDetectDone();
    if (e) {
      notify(_('name'), e);
      return;
    }
    //Creating temporary files
    var videoName = title.replace(/[\:\\\/\?\*\"\>\<\|]/g, "_");
    var audioName = videoName;
    var root, audioPath = [], videoPath = [];
    var iFile, oFile;
    if (prefs.dFolder == 4) { //Select folder by user
      let nsIFilePicker = Ci.nsIFilePicker;
      let fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
      fp.init(window, _("prompt3"), nsIFilePicker.modeSave);
      fp.appendFilter("Video File", "*." + vInfo.container);
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
        let _prefs = Cc["@mozilla.org/preferences-service;1"].
          getService(Ci.nsIPrefService).getBranch(config.pref);
        iFile = _prefs.getComplexValue("userFolder", Ci.nsIFile);
        iFile.append(videoName + "." + vInfo.container);
        iFile.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);
        if (prefs.doExtract) {
          oFile = _prefs.getComplexValue("userFolder", Ci.nsIFile);
          oFile.append(audioName + ".aac");
          oFile.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);
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
        oFile.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
      }
    }
    //Download
    listener.onDownloadStart();
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
    var dr = new download.get({
      progress: listener.onProgress,
      done: function (dl) {
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
        listener.onExtractStart();
        extract.perform(iFile, oFile, function (e) {
          if (prefs.extension != "0") { //
            notify(_("name"), _("msg5"));
          }
          listener.onExtractDone();
          afterExtract(prefs.extension == "0" ? e : null);
        });
      },
      error: function (dl) {
        listener.onError(dl);
        listener.onDownloadDone(dl);
      }
    });
    dr(vInfo.url, iFile);
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
