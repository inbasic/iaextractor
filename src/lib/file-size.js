var {Cc, Ci} = require('chrome');

function format (size) {
  if (size >= Math.pow(2, 30)) {
    return (size / Math.pow(2, 30)).toFixed(1) + " GB";
  }
  if (size >= Math.pow(2, 20)) {
    return (size / Math.pow(2, 20)).toFixed(1) + " MB";
  }
  if (size >= Math.pow(2, 10)) {
    return (size / Math.pow(2, 10)).toFixed(1) + " KB";
  }
  return size + " B";
}

var cache = {};
var calculate = function (url, callback, pointer) {
  if (cache[url]) {
    callback.apply(pointer, [url, format(cache[url])]);
    return;
  }
  var sent = false;
  var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
    .createInstance(Ci.nsIXMLHttpRequest);
  req.open('GET', url, true);
  req.setRequestHeader('Cache-Control', 'no-cache');
  req.channel.loadFlags |= Ci.nsIRequest.LOAD_BYPASS_CACHE;  
  req.onreadystatechange = function (aEvt) {
    if (sent) return;
    if (req.readyState == 3) {
      var size = req.getResponseHeader("Content-Length");
      if (req.status == 200) {
        if (size) {
          cache[url] = size;
          callback.apply(pointer, [url, format(size)]);
          sent = true;
          req.abort();
        }
      }
    }
    if (req.readyState == 4) {
      if (req.status == 200) {
        var size = null;
        try {
          size = req.getResponseHeader("Content-Length");
        }
        catch (e){}
        cache[url] = size;
        callback.apply(pointer, [url, format(size)]);
      }
      else {
        callback.apply(pointer, [url, null]);
      }
      sent = true;
      req.abort();
    }
  };
  req.send(null);
}
exports.calculate = calculate;