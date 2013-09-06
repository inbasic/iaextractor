var {Cc, Ci} = require("chrome"),
    Request  = require("sdk/request").Request,
    prefs    = require("sdk/simple-prefs").prefs;

function format (size) {
  if (size >= Math.pow(2, 30)) {
    return (size / Math.pow(2, 30)).toFixed(0) + " GB";
  }
  if (size >= Math.pow(2, 20)) {
    return (size / Math.pow(2, 20)).toFixed(0) + " MB";
  }
  if (size >= Math.pow(2, 10)) {
    return (size / Math.pow(2, 10)).toFixed(0) + " KB";
  }
  return size + " B";
}
exports.format = format;

/** Low level prefs **/
var _prefs = (function () {
  var pservice = Cc["@mozilla.org/preferences-service;1"].
    getService(Ci.nsIPrefService).
    getBranch("extensions.feca4b87-3be4-43da-a1b1-137c24220968@jetpack.");
  return {
    getIntPref: pservice.getIntPref,
    setIntPref: pservice.setIntPref,
    getCharPref: pservice.getCharPref,
    setCharPref: pservice.setCharPref,
    getBoolPref: pservice.getBoolPref,
    setBoolPref: pservice.setBoolPref,
    getComplexValue: pservice.getComplexValue,
    setComplexValue: function (id, val) {
      var str = Cc["@mozilla.org/supports-string;1"]
        .createInstance(Ci.nsISupportsString);
      str.data = val;
      pservice.setComplexValue(id, Ci.nsISupportsString, str);
    }
  }    
})();
exports.prefs = _prefs;

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

/** Signature updater **/
var update = function (callback, pointer) {
  var url = "http://add0n.com/signature.php?request=";

  Request({
    url: url + "ver",
    onComplete: function (response) {
      if (response.status == 200) {
        var version = parseInt(response.text);
        if (version > (prefs.decoder_ver || 0)) {
          Request({
            url: url + "alg",
            onComplete: function (response) {
              if (response.status != 200) return;
              prefs.decoder_alg = response.text
              prefs.decoder_ver = version;
            }
          }).get();
        }
      }
      if (callback) callback.apply(pointer);
    }
  }).get();
}
exports.update = update;

/** Calculate file size **/
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
      else {  // Size is zero, try to update decoder from server
        var lastUpdate = parseInt(prefs.getLastUpdate) || 0;
        var current = (new Date()).getTime();
        //Check for new update if 60 mins is passed.
        if (current > lastUpdate + 60 * 60000) {
          update(function () {
            calculate(url, callback, pointer);
          });
          prefs.getLastUpdate = current + ""; //Store as string
        }
        else {
          callback.apply(pointer, [url, null]);
        }
      }
      sent = true;
      req.abort();
    }
  };
  req.send(null);
}
exports.fileSize = calculate;