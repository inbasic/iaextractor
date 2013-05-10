var {Cc, Ci, Cu, components} = require('chrome'),
    _            = require("sdk/l10n").get,
    windowutils  = require("window-utils"),
    window       = windowutils.activeBrowserWindow;
 
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");

function xmlToSrt (str) {
  var parser = new window.DOMParser();

  var getTimes = function (node) {
    var start = parseFloat(node.getAttribute("start"));
    var end = start + parseFloat(node.getAttribute("dur"));
    function toTime (secs) {
      var mil = (secs % 1).toFixed(3).replace("0.", "");
      var sec_numb    = parseInt(secs, 10);
      var hours   = Math.floor(sec_numb / 3600);
      var minutes = Math.floor((sec_numb - (hours * 3600)) / 60);
      var seconds = sec_numb - (hours * 3600) - (minutes * 60);
      if (hours   < 10) {hours   = "0" + hours;}
      if (minutes < 10) {minutes = "0" + minutes;}
      if (seconds < 10) {seconds = "0" + seconds;}
      
      return hours + ":" + minutes + ":" + seconds + "," + mil;
    }

    return {start: toTime(start), end: toTime(end)}
  }

  var dom = parser.parseFromString(str, "text/html");
  var texts = dom.getElementsByTagName("text");
  var srt = "";
  for (var i = 0; i < texts.length; i++) {
    var times = getTimes(texts[i]);
    srt += (i+1) + "\n" + times.start + " --> " + times.end + "\n" + texts[i].textContent + "\n\n";
  }
  return srt;
}

var subtitle = function (id, lang, oFile, callback, pointer) {
  var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
    .createInstance(Ci.nsIXMLHttpRequest);
  req.open('GET', "http://video.google.com/timedtext?lang=" + (lang || "en") + "&v=" + id, true);
  req.onreadystatechange = function () {
    if (req.readyState != 4) return;
    if (req.status != 200) {
      if (callback) callback.apply(pointer, [_('err9')]);
      return;
    }

    if (req.responseText.length) {
      var ostream = FileUtils.openSafeFileOutputStream(oFile)
      var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].
                      createInstance(Ci.nsIScriptableUnicodeConverter);
      converter.charset = "UTF-8";
      var istream = converter.convertToInputStream(xmlToSrt(req.responseText));
      NetUtil.asyncCopy(istream, ostream, function(status) {
        if (!components.isSuccessCode(status)) {
          if (callback) callback.apply(pointer, [_('err10')]);
          return;
        }
        callback.apply(pointer);
      });
    }
    else {
      if (callback) callback.apply(pointer, [_('err11')]);
    }
  }
  req.send();
}
exports.get = subtitle;