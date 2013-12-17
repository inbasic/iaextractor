var {Cc, Ci, Cu} = require('chrome');
Cu.import("resource://gre/modules/Downloads.jsm");

var get, cancel;
if (Downloads.getList) {  // use Downloads.jsm
  Cu.import("resource://gre/modules/Promise.jsm");
  var cache = [];
  get = function (callback, pointer) {
    return function (url, file, aPrivacyContext, aIsPrivate, callback2, pointer2) {
      Promise.all([
        Downloads.createDownload({
          source: {
            url: url,
            isPrivate: aIsPrivate
          },
          target: file
        }),
        Downloads.getList(Downloads.PUBLIC)
      ]).then(function([dl, list]) {
        // Adapting to the old download object
        dl.id = Math.floor(Math.random()*100000);
        Object.defineProperty(dl, "amountTransferred", {get: function (){return dl.currentBytes}});
        Object.defineProperty(dl, "size", {get: function (){return dl.totalBytes}});
        // Observe progress
        list.add(dl);
        var view = {
          onDownloadChanged: function (d) {
            if (d != dl) return;
            if (callback && callback.progress) {
              callback.progress.apply(pointer, [dl]);
            }
            if (d.succeeded && d.stopped) {
              if (callback && callback.done) callback.done.apply(pointer, [dl]);
            }
            if (d.stopped && !(d.canceled || d.succeeded) && d.error) {
              if (callback && callback.error) callback.error.apply(pointer, [dl, d.error.message]);
            }
            if (d.stopped && !(d.canceled || d.succeeded) && !d.error) {
              if (callback && callback.paused) callback.paused.apply(pointer, [dl]);
            }
            if (d.stopped && d.canceled) {
              if (callback && callback.error) callback.error.apply(pointer, [dl]);
            }
            if (d.stopped) list.removeView(view);
          }
        };
        list.addView(view);
        dl.start();
        cache.push({id: dl.id, dl: dl});
        if (callback2) callback2.apply(pointer2, [dl]);
      }, function (err) {throw err});
    }
  }
  cancel = function (id) {
    cache.forEach (function (obj) {
      if (obj.id == id) obj.dl.cancel();
    });
  }
}
else {  // Old
  var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService),
      dm = Cc["@mozilla.org/download-manager;1"].createInstance(Ci.nsIDownloadManager);
  get = function (callback, pointer) {
    var dl,
        persist = Cc["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].createInstance(Ci.nsIWebBrowserPersist);
    persist.persistFlags = persist.PERSIST_FLAGS_REPLACE_EXISTING_FILES | persist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;

    var listener;
    var mListener = function (download) {
      this.download = download;
    }
    mListener.prototype = {
      download: null,
      onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage, aDownload) {},
      onSecurityChange: function(prog, req, state, dl) { },
      onProgressChange: function(prog, req, prog, progMax, tProg, tProgMax, dl) {
        if (dl.id != this.download.id) return;
        if (callback && callback.progress) callback.progress.apply(pointer, [dl]);
      },
      onStateChange: function(prog, req, flags, status, dl) {},
      onDownloadStateChange : function(state, dl) {
        if (dl.id != this.download.id) return;
        
        if (dl.state == Ci.nsIDownloadManager.DOWNLOAD_FINISHED) {
          dm.removeListener(this);
          if (callback && callback.done) callback.done.apply(pointer, [dl]);
        }
        else if (dl.state == Ci.nsIDownloadManager.DOWNLOAD_PAUSED) {
          if (callback && callback.paused) callback.paused.apply(pointer, [dl]);
        }
        else if (dl.state == Ci.nsIDownloadManager.DOWNLOAD_FAILED ||
          dl.state == Ci.nsIDownloadManager.DOWNLOAD_CANCELED ||
          dl.state == Ci.nsIDownloadManager.DOWNLOAD_BLOCKED_PARENTAL ||
          dl.state ==  Ci.nsIDownloadManager.DOWNLOAD_BLOCKED_POLICY ||
          dl.state == Ci.nsIDownloadManager.DOWNLOAD_DIRTY) {
          dm.removeListener(this);
          if (callback && callback.error) callback.error.apply(pointer, [dl]);
        }
      }
    }

    return function (url, file, aPrivacyContext, aIsPrivate, callback2, pointer2) {
      // Create URI
      var urlURI = ioService.newURI(url, null, null),
          fileURI = ioService.newFileURI(file);   
      // Start download, Currently the extension is not available on private mode due to panel module incompatibility
      dl = dm.addDownload(dm.DOWNLOAD_TYPE_DOWNLOAD, urlURI, fileURI, null, null, null, null, persist, aIsPrivate || false);
      listener = new mListener(dl);
      dm.addListener(listener);
      persist.progressListener = dl.QueryInterface(Ci.nsIWebProgressListener);
      persist.saveURI(dl.source, null, null, null, null, file, aPrivacyContext);
      
      if (callback2) callback2.apply(pointer2, [dl]);
    }
  };
  cancel = function (id) {
    dm.cancelDownload(id);
  };
}
exports.get = get;
exports.cancel = cancel;

exports.show = function () {
  Cc["@mozilla.org/download-manager-ui;1"]
    .createInstance(Ci.nsIDownloadManagerUI).show();
}