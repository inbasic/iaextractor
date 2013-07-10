/** Require **/
var {Cc, Ci, Cu}  = require('chrome'),
    {Hotkey}      = require("sdk/hotkeys"),
    tabs          = require("sdk/tabs"),
    self          = require("sdk/self"),
    timer         = require("sdk/timers"),
    sp            = require("sdk/simple-prefs"),
    panel         = require("sdk/panel"),
    _             = require("sdk/l10n").get,
    pageMod       = require("sdk/page-mod"),
    windowutils   = require("window-utils"),
    toolbarbutton = require("./toolbarbutton"),
    userstyles    = require("./userstyles"),
    youtube       = require("./youtube"),
    subtitle      = require("./subtitle"),
    download      = require("./download"),
    extract       = require("./extract"),
    tools         = require("./misc"),
    Request       = require("sdk/request").Request,
    data          = self.data,
    window        = windowutils.activeBrowserWindow,
    prefs         = sp.prefs,
    fileSize      = tools.fileSize,
    format        = tools.format,
    _prefs        = tools.prefs,
    prompts       = tools.prompts;
    
Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
/** Load style **/
userstyles.load(data.url("overlay.css"));
/** Internal Preferences **/
try {
  _prefs.getIntPref("decoder_versn")
} catch (e) {
  // YouTube keeps changing signature decoding algorithm. These values will be updated accordingly.
  _prefs.setIntPref("decoder_versn", 1);
  _prefs.setCharPref("decoder_function", '(function(){return function(t,n){function r(e,t){var n="";t.forEach(function(t){if(!t[1])t[1]=t[0]+1;var r=e.substring(t[0],t[1]);if(t[3]==-1){r.reverse().join("")}n+=r});return n}if(n.length==88){t=t+"&signature="+r(n,[[48],[81,67,-1],[82],[66,62,-1],[85],[61,48,-1],[67],[47,12,-1],[3],[11,3,-1],[2],[12]])}else if(n.length==87){t=t+"&signature="+r(n,[[62],[82,62,-1],[83],[61,52,-1],[0],[51,2,-1]])}else if(n.length==86){t=t+"&signature="+r(n,[[2,63],[82],[64,82],[63]])}else if(n.length==85){t=t+"&signature="+r(n,[[76],[82,76,-1],[83],[75,60,-1],[0],[59,50,-1],[1],[49,2,-1]])}else if(n.length==84){t=t+"&signature="+r(n,[[83,36,-1],[2],[35,26,-1],[3],[25,3,-1],[26]])}else if(n.length==83){t=t+"&signature="+r(n,[[0,81]])}else if(n.length==82){t=t+"&signature="+r(n,[[36],[79,67,-1],[81],[66,40,-1],[33],[39,36,-1],[40],[35],[0],[67],[32,0,-1],[34]])}return t}})()');
}
Request({ //Update signature decoder from server
  url: "http://add0n.com/signature.php?request=version",
  onComplete: function (response) {
    if (response.status != 200) return;
    var version = parseInt(response.text);
    if (version > _prefs.getIntPref("decoder_versn")) {
      Request({
        url: "http://add0n.com/signature.php?request=function",
        onComplete: function (response) {
          if (response.status != 200) return;
          _prefs.setCharPref("decoder_function", response.text);
          _prefs.setIntPref("decoder_versn", version);
        }
      }).get();
    }
  }
}).get();

/** Internal configurations **/
var config = {
  //URLs
  urls: {
    youtube: "https://www.youtube.com/",
    tools: "chrome://iaextractor/content/tools.xul",
    homepage: "http://add0n.com/youtube.html"
  },
  //toolbar
  toolbar: {
    id: "youtube-audio-converter",
    move: {
      toolbarID: "nav-bar", 
      get insertbefore () {
        var id;
        try {
          id = _prefs.getCharPref("nextSibling");
        } catch(e) {}
        return id ? id : "home-button"
      },
      forceMove: false
    }
  },
  //Timing
  desktopNotification: 3, //seconds
  noAudioExtraction: 4,
  //Tooltip
  tooltip: _("name") + "\n\n" + _("tooltip1") + "\n" + _("tooltip2"),
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
  }
}

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
    case "do-subtitle":
      prefs.doSubtitle = arguments[1];
      break;
    case "do-size":
      prefs.getFileSize = arguments[1];
      break;
    case "tools":
      rPanel.hide();
      window.open(config.urls.tools, 'iaextractor', 'chrome,minimizable=yes,all,resizable=false');
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
    prefs.doSubtitle, 
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
var IDExtractor = (function () {
  var urls = [], IDs = [];
  function cache(url, id) {
    var index = urls.push(url) - 1;
    IDs[index] = id;
  }
  
  return function (url, callback, pointer) {
    //Cache XMLHttpRequest of non YouTube pages
    if (typeof(url) == "object" && url.origin) {
      var obj = url;
      var index = urls.indexOf(obj.origin);
      if (index == -1) {
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
    if (index !== -1) {
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
      worker.port.on("response", function (id) {
        if (callback) {
          cache(url, id);
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
        catch(e) {
          return null
        }
      }
      fetchId(tmp + "");
    }
    //Other YouTube pages
    else if (/http.*:.*youtube.com/.test(url)) {
      var tmp = function () {
        try {
          var embed = document.getElementsByTagName("embed")[0];
          var str = decodeURIComponent(embed.getAttribute("flashvars"));
          var id = /video\_id\=([^\&]*)/.exec(str);
          return id[1];
        }
        catch (e) {}
        try {
          var video = document.getElementsByTagName("video")[0];
          return video.getAttribute("data-youtube-id");
        }
        catch (e) {}
        
        return null
      }
      fetchId(tmp + "");
    }
    else {
      return callback.apply(pointer, [null]);
    }
  }
})();

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
    if (tbb) {
      if (!prefs.oneClickDownload || !prefs.silentOneClickDownload) {
        try {
          rPanel.show(tbb);
        }
        catch (e) {
          rPanel.show(null, tbb);
        }
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
        new getVideo(videoID, listener, fIndex);
      }
      else {
        tabs.open(config.urls.youtube);
        rPanel.hide();
      }
    });
  },
  onMiddleClick: function (e, tbb) {
    let url = tabs.activeTab.url;
    IDExtractor(url, function (videoID) {
      if (!videoID) return;
      try {
        iPanel.show(tbb);
      }
      catch (e) {
        iPanel.show(null, tbb);
      }
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
            tabs.open(config.urls.youtube + "watch?v=" + arr[obj[1]]);
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
    IDExtractor(url, function (videoID) {
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
    id: config.toolbar.id,
    label: _("toolbar"),
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
  
  //Install
  if (options.loadReason == "install" || prefs.forceVisible) {
    //If adjacent button is restartless wait for its creation
    timer.setTimeout(function (){
      yButton.moveTo(config.toolbar.move);
    }, 800);
  }
  hotkey.initialization().register();
  // Check current page
  monitor(tabs.activeTab);
  //Welcome page
  if (options.loadReason == "upgrade" || options.loadReason == "install") {
    timer.setTimeout(function () {
      tabs.open({url: config.urls.homepage, inBackground : false});
    }, 3000);
  }
  //Reload about:addons to set new observer.
  for each (var tab in tabs) {
    if (tab.url == "about:addons") {
      tab.reload();
    }
  }
}

/** Monitor **/
function monitor (tab) {
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
  timer.setTimeout(monitor, 500);
});
tabs.on('activate', monitor);

/** Store toolbar button position **/
var aWindow = windowutils.activeBrowserWindow;
var aftercustomizationListener = function () {
  let button = aWindow.document.getElementById(config.toolbar.id);
  if (!button) return;
  _prefs.setCharPref("nextSibling", button.nextSibling.id);
}
aWindow.addEventListener("aftercustomization", aftercustomizationListener, false); 
exports.onUnload = function (reason) {
  //Remove toolbar listener
  aWindow.removeEventListener("aftercustomization", aftercustomizationListener, false); 
  //Close tools window
  let wm = Cc["@mozilla.org/appshell/window-mediator;1"]
    .getService(Ci.nsIWindowMediator);   
  let enumerator = wm.getEnumerator("iaextractor:tools");
  while (enumerator.hasMoreElements()) {
    let win = enumerator.getNext();
    win.close();
  }
  //Remove observer
  hotkey.destroy();
  http.destroy();
}

/** Hotkeys **/
var hotkey = {
  _key: null,
  initialization: function () {
    Services.obs.addObserver(hotkey.observer, "addon-options-displayed", false);
    //
    sp.on("downloadHKey", function () {
      if (hotkey._key) {
        hotkey._key.destroy();
      }
      hotkey.register();
    });
    return this;
  },
  register: function () {
    if (prefs.downloadHKey.split("+").length == 1 || !prefs.downloadHKey) {
      return;
    }
    var key = prefs.downloadHKey.replace(/\ \+\ /g, "-").toLowerCase();
    key = key.split("-");
    key[key.length - 1] = key[key.length - 1][0];
    key = key.join("-");
    this._key = Hotkey({
      combo: key,
      onPress: function() {
        cmds.onCommand(null, null, true, null);
      }
    });
  },
  observer: {
    observe: function(doc, aTopic, aData) {
      if (aTopic == "addon-options-displayed" && aData == self.id) {
        var list = doc.getElementsByTagName("setting");
        list = Array.prototype.slice.call(list);
        list = list.filter(function (elem) {
          return elem.getAttribute("pref-name") == "downloadHKey"
        });
        var textbox = list[0];
        textbox.setAttribute("readonly", true);
        textbox.addEventListener("keydown", hotkey.listen);
        hotkey.textbox = textbox;
      }
    }
  },
  listen: function (e) {
    e.stopPropagation();
    e.preventDefault();
    var comb = [];
    prefs.downloadHKey = "";  //Fire listener
    if ((e.ctrlKey || e.shiftKey || e.altKey) && (e.keyCode >= 65 && e.keyCode <=90)) {
      if (e.ctrlKey) comb.push("Accel");
      if (e.shiftKey) comb.push("Shift");
      if (e.altKey) comb.push("Alt");
      comb.push(String.fromCharCode(e.keyCode));
      prefs.downloadHKey = comb.join(" + ");
    }
    else {
      hotkey.textbox.value = _("err8");
      if (hotkey._key) {
        hotkey._key.destroy();
      }
    }
  },
  destroy: function () {
    if (hotkey.textbox) {
      hotkey.textbox.removeEventListener("keydown", hotkey.listen);
    }
    try {
      Services.obs.removeObserver(hotkey.observer, "addon-options-displayed");
    }
    catch (e) {}
  } 
}

/** HTTP Observer **/
var http = (function () {
  var cache = [];
  return {
    initialize: function () {
      Services.obs.addObserver(http.observer, "http-on-examine-response", false);
      Services.obs.addObserver(http.observer, "http-on-examine-cached-response", false);
    },
    destroy: function () {
      try {
        Services.obs.removeObserver(http.observer, "http-on-examine-response");
      }
      catch (e) {}
      try {
        Services.obs.removeObserver(http.observer, "http-on-examine-cached-response");
      }
      catch (e) {}
    },
    observer: {
      observe: function(doc, aTopic, aData) {
        var channel = doc.QueryInterface(Ci.nsIHttpChannel);
        if(channel.requestMethod != "GET") {
          return;
        }
        channel.visitResponseHeaders({
          visitHeader: function ( aHeader, aValue ) {
            if ( aHeader.indexOf( "Content-Type" ) != -1 ) {
              if ( aValue.indexOf("audio") != -1 || aValue.indexOf("video") != -1 ) {
                var request = doc.QueryInterface(Ci.nsIRequest);
                var url = request.name
                  .replace(/signature\=[^\&]*\&/, "")
                  .replace(/range\=[^\&]*\&/, "")
                  .replace(/expire\=[^\&]*\&/, "");
                if (cache.indexOf(url) == -1) {
                  cache.push(url);
                  var notificationCallbacks =
                    channel.notificationCallbacks ? 
                      channel.notificationCallbacks : channel.loadGroup.notificationCallbacks;
               
                  if (notificationCallbacks) {
                    var domWin = notificationCallbacks.getInterface(Ci.nsIDOMWindow);
                    IDExtractor({
                      origin: domWin.top.document.URL,
                      title: aValue.split("/")[0] + "_" + domWin.top.document.title,
                      vInfo: {
                        url: request.name,
                        container: aValue.split("/")[1],
                        audioBitrate: "",
                        audioEncoding: "",
                        resolution: "",
                        quality: ""
                      }
                    });
                    monitor(tabs.activeTab);
                    //gBrowser.getBrowserForDocument(doc)
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

/** Pref listener **/
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
/** Call this with new **/
var getVideo = (function () {
  return function (videoID, listener, fIndex) {
    var doExtract = prefs.doExtract;
  
    function onDetect () {
      listener.onDetectStart();
      youtube.getLink(videoID, fIndex, function (vInfo, title, user, e) {
        listener.onDetectDone();
        if (e) {
          notify(_('name'), e);
        }
        else {
          onFile (vInfo, title, user);
        }
      });
    }
    function onFile (vInfo, title, user) {
      // Do not generate audio file if video format is not FLV
      if (vInfo.container.toLowerCase() != "flv" && doExtract) {
        //Prevent conflict with video info notification
        timer.setTimeout(function (){
          notify(_('name'), _('msg5'))
        }, config.noAudioExtraction * 1000);
        doExtract = false;
      }
      var name = ((prefs.addUserInfo && user ? user + " - " : "") + title)
        .replace(/[:\?\¿]/g, "")
        .replace(/[\\\/]/g, "-")
        .replace(/[\*]/g, "^")
        .replace(/[\"]/g, "'")
        .replace(/[\<]/g, "[")
        .replace(/[\>]/g, "]")
        .replace(/[|]/g, "-");
      var vFile;
      //Select folder by nsIFilePicker
      if (prefs.dFolder == 4) {
        let nsIFilePicker = Ci.nsIFilePicker;
        let fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
        fp.init(window, _("prompt3"), nsIFilePicker.modeSave);
        fp.appendFilter(_("msg14"), "*." + vInfo.container);
        fp.defaultString = name + "." + vInfo.container;
        let res = fp.show();
        if (res == nsIFilePicker.returnCancel) return;
        vFile = fp.file;
      }
      //Select folder by userFolder
      else if (prefs.dFolder == 5) {
        try {
          //Simple-prefs doesnt support complex type
          vFile = _prefs.getComplexValue("userFolder", Ci.nsIFile);
          vFile.append(name + "." + vInfo.container);
        }
        catch (e) {
          notify(_("name"), _("err7") + "\n\n" + _("err") + ": " + e.message);
          return;
        }
      }
      else {
        var videoPath = [];
        switch(prefs.dFolder) {
          case 2:
            root = "TmpD";
            let folder = Math.random().toString(36).substr(2,16);
            videoPath.push("iaextractor");
            videoPath.push(folder);
            break;
          case 0:
            root = "DfltDwnld"
            break;
          case 1:
            root = "Home";
            break;
          case 3:
            root = "Desk";
            break;
        }
        videoPath.push(name + "." + vInfo.container);
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
            let name = vFile.leafName.replace(/\.+[^\.]*$/, "");
            aFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
            aFile.initWithPath(vFile.parent.path);
            aFile.append(name + ".aac");
            aFile_first = false;
          }
          return aFile;
        },
        get sFile () {
          if (aFile_first) {
            let name = vFile.leafName.replace(/\.+[^\.]*$/, "");
            sFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
            sFile.initWithPath(vFile.parent.path);
            sFile.append(name + ".srt");
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
        error: function (dl) {
          listener.onError(dl);
          listener.onDownloadDone(dl, true);
        }
      });
      console.error(vInfo.url);
      listener.onDownloadStart(dr(vInfo.url, obj.vFile));
      notify(
        _('name'), 
        _('msg3').replace("%1", vInfo.quality)
          .replace("%2", vInfo.container)
          .replace("%3", vInfo.resolution)
          .replace("%6", vInfo.audioEncoding)
          .replace("%7", vInfo.audioBitrate)
      );
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
        onSubtitle(obj);
      }
      if (!doExtract) {
        return afterExtract();
      }
      listener.onExtractStart(id);
      extract.perform(id, obj.vFile, obj.aFile, function (id, e) {
        listener.onExtractDone(id);
        afterExtract(prefs.extension == "0" ? e : null);
      });
    }
    function onSubtitle (obj) {
      if (!prefs.doSubtitle) return;
      var lang = "en";
      switch (prefs.subtitleLang) {
        case 1: lang = "ar"; break;
        case 2: lang = "zh"; break;
        case 3: lang = "nl"; break;
        case 4: lang = "fr"; break;
        case 5: lang = "de"; break;
        case 6: lang = "it"; break;
        case 7: lang = "ja"; break;
        case 8: lang = "ko"; break;
        case 9: lang = "pl"; break;
        case 10: lang = "ru"; break;
        case 11: lang = "es"; break;
        case 12: lang = "tr"; break;
      }
      subtitle.get(videoID, lang, obj.sFile, function (e) {
        if (e) notify(_('name'), e);
      });
    }
    //
    if (typeof(videoID) == "object") {
      var obj = videoID[0];
      console.error(videoID.length);
      onFile (obj.vInfo, obj.title);
    }
    else {
      onDetect();
    }
  }
})();

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