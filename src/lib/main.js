/** Require **/
var tabs             = require("tabs"),
    self             = require("self"),
    timer            = require("timers"),
    sp               = require("simple-prefs"),
    prefs            = sp.prefs,
    pageMod          = require("page-mod"),
    windowutils      = require("window-utils"),
    window           = windowutils.activeBrowserWindow,
    toolbarbutton    = require("toolbarbutton"),
    _                = require("l10n").get,
    data             = self.data,
    {Cc, Ci, Cu}     = require('chrome'),
    youtube          = require("youtube"),
    downloader       = require("downloader"),
    extract          = require("extract");
    
/** Internal configurations **/
var config = {
  youtube: "https://www.youtube.com/",
  image: {
    data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TA" +
      "AAAwFBMVEX///////+/AADdRjPOJBoiHx/VMyXHEg3rZkrPJRvSLCDYOirLHRXgTTjhTznnXEP" +
      "eSTTQKB3WNifKGhPBBQPaPi30fFroX0XoYEXrmpPFDwvDCQfvcVLdRTLbQS/fgIDhUTvkVj/OI" +
      "xnxdFTjiIXcRDHqZUn1hGTUMCPTLyLzeVfIFQ/ECwjmW0LAAgHcbWvEDAnRKR7vcFHaQC7iUjz" +
      "MHxfhTjnraEvkWEDHEw7XOSnXOirPJxzsaEzZPSzlWUD0fBD5AAAAAXRSTlMAQObYZgAAAJhJR" +
      "EFUeF6Fi9Wuw1AMBL0+EGYoMzP3Ivz/XzVppd6XSJ21HzzWEpEq8k+lUOqxz4cq54V41irJ8+X" +
      "RDM7hr45co0U0A/BTH3j4XMikmTKN2jBr776APlxW6y3T2xQBfGQAkjHAtPlDHx3EsPCBUly94" +
      "nRgw8UezEziBKcBDIFd2gNaJEIx6WZf8dz+llJaTKS1tiNpGHyHbrwiCguwrSsJAAAAAElFTkS" +
      "uQmCC",
    progressColor: "rgba(255, 255, 0, 0.8)"
  },

  move: {toolbarID: "nav-bar", forceMove: false},
  
  desktopNotification: 3, //seconds
  
  tooltip: "Left click: Open Youtube/Download video & audio\nRight click: Show progress panel"
}

/** Panel **/
var panel = require("panel").Panel({
  width: 320,
  height: 200,
  contentURL: data.url('report.html'),
  contentScriptFile: data.url('report.js'),
  contentScriptWhen: "ready"
});
panel.port.on("click-link", function(url) {
  console.log(url);
});

/** Initialize **/
var yButton, url;
exports.main = function(options, callbacks) {
  //Toolbar
  yButton = toolbarbutton.ToolbarButton({
    id: "youtube-audio-converter",
    label: _("toolbar"),
    tooltiptext: config.tooltip,
    progressColor: config.image.progressColor,
    image: config.image.data,
    onCommand: function (e) {
      if (!url) {
        notify(_('name'), _('msg1'));
        tabs.open(config.youtube);
        return;
      };
      panel.show();
      get(url, listener);
    },
    onClick: function (e) { //Linux problem for onClick
      if (e.button == 2) {
        e.preventDefault();
        e.stopPropagation();
        panel.show();
      }
    }
  });
  //Monitor
  function monitor (tab) {
    if (/http.*:.*youtube.com\/watch\?v\=/.test(tab.url)) {
      yButton.saturate = 1;
      yButton.hueRotate = 0;
      
      url = tab.url;
    }
    else {
      yButton.saturate = 0;
      url = null;
    }
  }
  monitor(tabs.activeTab);
  tabs.on('activate', monitor);
  tabs.on('ready', monitor);
  //Install
  if (options.loadReason == "install") {
    yButton.moveTo(config.move);
  }
}

/** Detect a Youtube link and download it and extract audio**/
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
      panel.port.emit('detect', ++detects);
    },
    onDetectDone: function () {
      panel.port.emit('detect', --detects);
    },
    onDownloadStart: function () {
      panel.port.emit('download', ++downloads);
    },
    onDownloadDone: function (dl) {
      remove(dl);
      panel.port.emit('download', --downloads);
    },
    onExtractStart: function () {
      panel.port.emit('extract', ++extracts);
    },
    onExtractDone: function () {
      panel.port.emit('extract', --extracts);
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
        _("size").replace("%1", (tSize/1024/1024).toFixed(1)) +
        "\n" +
        _("progress").replace("%1", (ttSize/tSize*100).toFixed(1));
    },
    onError: function (dl) {
      remove(dl);
    }
  }
})();

var get = function (url, listener) {
  //Detect
  listener.onDetectStart();
  var videoID = /\?v\=([^\=\&]*)/.exec(url)[1];
  //vInfo: url, quality, fallback_host, type, itag, container, resolution, encoding, profile, bitrate, audioEncoding, audioBitrate
  youtube.detect(videoID, parseInt(prefs.quality), function (vInfo, e) { 
    listener.onDetectDone();
    if (e) {
      notify(_('name'), e);
      return;
    }
    //Creating temporary files
    var folder = Math.random().toString(36).substr(2,16);
    Cu.import("resource://gre/modules/FileUtils.jsm");
    var iFile = FileUtils.getFile("TmpD", ["iaextractor", folder, "video.flv"]);
    iFile.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
    var oFile = FileUtils.getFile("TmpD", ["iaextractor", folder, "audio.aac"]);
    oFile.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
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
    var dr = new downloader.get({
      progress: listener.onProgress,
      done: function (dl) {
        listener.onDownloadDone(dl);
        listener.onExtractStart();
        extract.perform(iFile, oFile, function (e) {
          listener.onExtractDone();
          iFile.reveal();
          if (e) notify(_('name'), e);
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
var notify = (function () { // https://github.com/fwenzel/copy-shorturl/blob/master/lib/simple-notify.js
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

      notification = notificationBox.appendNotification(text, 'jetpack-notification-box',
          data.url("notification.png"), notificationBox.PRIORITY_INFO_MEDIUM, []
      );
      timer.setTimeout(function() {
          notification.close();
      }, config.desktopNotification * 1000);
    }
  }
})();