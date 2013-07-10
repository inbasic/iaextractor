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
exports.format = format;

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
exports.fileSize = calculate;

var prefs = (function () {
  var pservice = Cc["@mozilla.org/preferences-service;1"].
    getService(Ci.nsIPrefService).
    getBranch("extensions.feca4b87-3be4-43da-a1b1-137c24220968@jetpack.");
  return {
    getIntPref: pservice.getIntPref,
    setIntPref: pservice.setIntPref,
    getCharPref: pservice.getCharPref,
    setCharPref: pservice.setCharPref,
    getComplexValue: pservice.getComplexValue,
    setComplexValue: function (id, val) {
      var str = Cc["@mozilla.org/supports-string;1"]
        .createInstance(Ci.nsISupportsString);
      str.data = val;
      pservice.setComplexValue(id, Ci.nsISupportsString, str);
    }
  }    
})();
exports.prefs = prefs;

/** Prompt **/
var prompts = (function () {
  let prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"].
    getService(Ci.nsIPromptService);
  return function (title, content, items) {
    var selected = {};
    var result = prompts.select(null, title, content, items.length, items, selected);
    return [result, selected.value];
  }
})();
exports.prompts = prompts;