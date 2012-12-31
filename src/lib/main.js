/** Require **/
var tabs          = require("tabs"),
    self          = require("self"),
    timer         = require("timers"),
    prefs         = require("simple-prefs").prefs,
    windowutils   = require("window-utils"),
    window        = windowutils.activeBrowserWindow,
    panel         = require("panel"),
    toolbarbutton = require("toolbarbutton"),
    _             = require("l10n").get,
    data          = self.data,
    {Cc, Ci, Cu}  = require('chrome'),
    youtube       = require("youtube"),
    download    = require("download"),
    extract       = require("extract");
    
Cu.import("resource://gre/modules/FileUtils.jsm");
    
/** Internal configurations **/
var config = {
  //Youtube
  youtube: "https://www.youtube.com/",
  //toolbar
  image: {
    data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9T" +
      "AAAAwFBMVEX///////+/AADdRjPOJBoiHx/VMyXHEg3rZkrPJRvSLCDYOirLHRXgTTjhTz" +
      "nnXEPeSTTQKB3WNifKGhPBBQPaPi30fFroX0XoYEXrmpPFDwvDCQfvcVLdRTLbQS/fgIDh" +
      "UTvkVj/OIxnxdFTjiIXcRDHqZUn1hGTUMCPTLyLzeVfIFQ/ECwjmW0LAAgHcbWvEDAnRKR" +
      "7vcFHaQC7iUjzMHxfhTjnraEvkWEDHEw7XOSnXOirPJxzsaEzZPSzlWUD0fBD5AAAAAXRS" +
      "TlMAQObYZgAAAJhJREFUeF6Fi9Wuw1AMBL0+EGYoMzP3Ivz/XzVppd6XSJ21HzzWEpEq8k" +
      "+lUOqxz4cq54V41irJ8+XRDM7hr45co0U0A/BTH3j4XMikmTKN2jBr776APlxW6y3T2xQB" +
      "fGQAkjHAtPlDHx3EsPCBUly94nRgw8UezEziBKcBDIFd2gNaJEIx6WZf8dz+llJaTKS1ti" +
      "NpGHyHbrwiCguwrSsJAAAAAElFTkSuQmCC",
    get progressColor() {return prefs.progressColor}
  },
  move: {toolbarID: "nav-bar", forceMove: false},
  //Timing
  desktopNotification: 3, //seconds
  //Tooltip
  tooltip: _("tooltip1") + "\n" + _("tooltip2") + "\n" + _("tooltip3") + "\n" +
    _("tooltip6"),
  //Panels
  panels: {
    rPanel: {
      width: 320,
      height: 150
    },
    iPanel: {
      width: 520,
      height: 520
    }
  },
  //Homepage
  homepage: "http://iaextractor1.notlong.com/"
}

/** Panel (report) **/
var rPanel = panel.Panel({
  width: config.panels.rPanel.width,
  height: config.panels.rPanel.height,
  contentURL: data.url('report/report.html'),
  contentScriptFile: data.url('report.js'),
  contentScriptWhen: "ready"
});
rPanel.port.on("cancelAll", function () {
  listener.cancel();
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
  var temp = /http.*:.*youtube.com\/watch\?.*v\=([^\=\&]*)/.exec(url);
  id = temp ? temp[1]: null;

  if (callback && id) {
    return callback.apply(pointer, [id]);
  }
  //User page
  if (/http.*:.*youtube.com\/user/.test(url)) {
    var worker = tabs.activeTab.attach({
      contentScript: "self.port.emit('response', " + 
        "(function (){" +
          "var divs = document.getElementsByClassName('channels-video-player');" +
          "return divs.length ? divs[0].getAttribute('data-video-id') : null" +
        "})()" +
      ");"
    });
    worker.port.on("response", function (id) {
      if (callback) {
        return callback.apply(pointer, [id]);
      }
    });
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
exports.main = function(options, callbacks) {
  //Toolbar
  yButton = toolbarbutton.ToolbarButton({
    id: "youtube-audio-converter",
    label: _("toolbar"),
    tooltiptext: config.tooltip,
    progressColor: config.image.progressColor,
    image: config.image.data,
    onCommand: function (e) {
      let url = tabs.activeTab.url;
      urlExtractor(url, function (videoID) {
        if (!videoID) {
          notify(_('name'), _('msg1'));
          tabs.open(config.youtube);
          return;
        };
        rPanel.show();
        get(videoID, listener);
      });
    },
    onClick: function (e) { //Linux problem for onClick
      if (e.button == 2) {
        e.preventDefault();
        e.stopPropagation();
        rPanel.show();
      }
      if (e.button == 1) {
        let url = tabs.activeTab.url;
        urlExtractor(url, function (videoID) {
          if (!videoID) return;
          iPanel.show();
          youtube.getInfo(videoID, function (vInfo, e) {
            iPanel.port.emit('info', vInfo);
          });
        });
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
}

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

var getFormat = function(value) {
  switch (value) {
    case 0: return "flv";
    case 1: return "3gp";
    case 2: return "mp4";
    case 3: return "webm";
  }
}

var get = function (videoID, listener) {
  //Detect
  listener.onDetectStart();
  youtube.getLink(videoID, function (vInfo, e) {
    listener.onDetectDone();
    if (e) {
      notify(_('name'), e);
      return;
    }
    //Creating temporary files
    var folder = Math.random().toString(36).substr(2,16);
    var iFile = FileUtils.getFile("TmpD", ["iaextractor", folder, "video." + getFormat(prefs.extension)]);
    iFile.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
    if (prefs.doExtract) {
      var oFile = FileUtils.getFile("TmpD", ["iaextractor", folder, "audio.aac"]);
      oFile.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
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
          iFile.reveal();
          if (e) notify(_('name'), e);
        }
        if (!prefs.doExtract) {
          return afterExtract();
        }
        listener.onExtractStart();
        extract.perform(iFile, oFile, function (e) {
          listener.onExtractDone();
          afterExtract(e);
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