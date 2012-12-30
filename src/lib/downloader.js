var {Cc, Ci, Cu} = require('chrome');

var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService),
  downloadManagerUI = Cc["@mozilla.org/download-manager-ui;1"].createInstance(Ci.nsIDownloadManagerUI);
      
var get = function (callback, pointer) {
  var dl,
      dm = Cc["@mozilla.org/download-manager;1"].createInstance(Ci.nsIDownloadManager),
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
      else if (dl.state == Ci.nsIDownloadManager.DOWNLOAD_FAILED ||
        dl.state == Ci.nsIDownloadManager.DOWNLOAD_CANCELED ||
        dl.state == Ci.nsIDownloadManager.DOWNLOAD_BLOCKED_PARENTAL ||
        dl.state ==  Ci.nsIDownloadManager.DOWNLOAD_BLOCKED_POLICY ||
        dl.state == Ci.nsIDownloadManager.DOWNLOAD_DIRTY){
        dm.removeListener(this);
        if (callback && callback.error) callback.error.apply(pointer, [dl]);
      }
    }
  }

  return function (url, file) {
    // Create URI
    var urlURI = ioService.newURI(url, null, null),
        fileURI = ioService.newFileURI(file);   
    // Start download             
    dl = dm.addDownload(dm.DOWNLOAD_TYPE_DOWNLOAD, urlURI, fileURI, null, null, null, null, persist, false);
    listener = new mListener(dl);
    dm.addListener(listener);
    persist.progressListener = dl.QueryInterface(Ci.nsIWebProgressListener);
    persist.saveURI(dl.source, null, null, null, null, file);
  }
};
exports.get = get;

exports.show = function () {
  downloadManagerUI.show(window, dl.id, Ci.nsIDownloadManagerUI.REASON_NEW_DOWNLOAD);
}