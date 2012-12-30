/** Require **/
var tabs          = require("tabs"),
    self          = require("self"),
    timer         = require("timers"),
    sp            = require("simple-prefs"),
    prefs         = sp.prefs,
    pageMod       = require("page-mod"),
    windowutils   = require("window-utils"),
    window        = windowutils.activeBrowserWindow,
    toolbarbutton = require("toolbarbutton"),
    _             = require("l10n").get,
    data          = self.data,
    {Cc, Ci, Cu}  = require('chrome'),
    youtube       = require("youtube"),
    downloader    = require("downloader"),
    extract       = require("extract");
    
/** Internal configurations **/
var config = {
  //Youtube
  youtube: "https://www.youtube.com/",
  yRegExp: /http.*:.*youtube.com\/watch\?v\=([^\=\&]*)/,
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
  tooltip: _("tooltip1") + "\n" + _("tooltip2") + "\n" + _("tooltip3")
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
      if (!config.yRegExp.test(url)) {
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
  if (options.loadReason == "install") {
    yButton.moveTo(config.move);
  }
  //Monitor tab changes
  function monitor (tab) {
    if (config.yRegExp.test(tab.url)) {
      yButton.saturate = 1;
      yButton.hueRotate = 0;
    }
    else {
      yButton.saturate = 0;
    }
  }
  monitor(tabs.activeTab);
  tabs.on('activate', monitor);
  tabs.on('ready', monitor);
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
        _("tooltip4").replace("%1", (tSize/1024/1024).toFixed(1)) +
        "\n" +
        _("tooltip5").replace("%1", (ttSize/tSize*100).toFixed(1));
    },
    onError: remove
  }
})();

var get = function (url, listener) {
  //Detect
  listener.onDetectStart();
  var videoID = config.yRegExp.exec(url)[1];
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