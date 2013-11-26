/* Test cases:
 * 1. http://www.youtube.com/watch?v=XraeBDMm2PM (Non English) [okay]
 * 2. http://www.youtube.com/watch?v=0VJqrlH9cdI (English) [okay]
 * 3. http://www.youtube.com/watch?v=9kmUf3fflrA [Fail]
 */

var {Cc, Ci, Cu, components} = require('chrome'),
    _            = require("sdk/l10n").get,
    Request      = require("sdk/request").Request,
    youtube      = require("./youtube"),
    windows          = {
      get active () { // Chrome window
        return require('sdk/window/utils').getMostRecentBrowserWindow()
      }
    };
 
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");

function xmlToSrt (str) {
  var parser = new windows.active.DOMParser();

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

var subtitle = function (video_id, langID, oFile, callback, pointer) {
  var lang = "en", name = "";
  switch (langID) {
    case 0: lang = "en"; name = "English (en)"; break;
    case 1: lang = "fr"; name = "French (fr)"; break;
    case 2: lang = "de"; name = "German (de)"; break;
    case 3: lang = "it"; name = "Italian (it)"; break;
    case 4: lang = "ja"; name = "Japanese"; break;
    case 5: lang = "es"; name = "Spanish (es)"; break;
    case 6: lang = "ru"; name = "Russian (ru)"; break;
  }
  youtube.getInfo(video_id, function (vInfo) {
    if (vInfo.ttsurl) {
      var url = vInfo.ttsurl + "&kind=" + (vInfo.cc_asr ? "asr" : "") + "&lang=" + lang  + "&name=";
      Request({
        url: url,
        onComplete: function (response) {
          analyse (response.text);
        }
      }).get();
      url += name;
      Request({
        url: url,
        onComplete: function (response) {
          analyse (response.text);
        }
      }).get();

      var responses = [];
      function analyse (txt) {
        responses.push(txt);
        if (responses.length == 2) {
          var tmp = "";
          if (responses[0].length && responses[0].indexOf("Error 404") === -1) {
            tmp = responses[0];
          }
          else if (responses[1].length && responses[1].indexOf("Error 404") === -1) {
            tmp = responses[1];
          }
          else {
            if (callback) callback.apply(pointer, [_('err11')]);
            return;
          }
          var ostream = FileUtils.openSafeFileOutputStream(oFile)
          var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].
                          createInstance(Ci.nsIScriptableUnicodeConverter);
          converter.charset = "UTF-8";
          var istream = converter.convertToInputStream(xmlToSrt(tmp));
          NetUtil.asyncCopy(istream, ostream, function(status) {
            if (!components.isSuccessCode(status)) {
              if (callback) callback.apply(pointer, [_('err10')]);
              return;
            }
            callback.apply(pointer);
          });
        }
      }
    }
    else {
      if (callback) callback.apply(pointer, [_('err11')]);
    }
  });
}
exports.get = subtitle;