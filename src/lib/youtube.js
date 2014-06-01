var {Cc, Ci, Cu}  = require('chrome'),
    prefs         = require("sdk/simple-prefs").prefs;
Cu.import("resource://gre/modules/Promise.jsm");

function mixer (i) {
  var arr = [
    "ossw=((ppp)~hrsreb)dhj(pfsdo8q:",
    "ossw=((fcc7i)dhj(tn`ifsrub4)wow8nc:",
    "ossw=((ppp)~hrsreb)dhj(`bsXqncbhXniah8ok:biXRT!bk:cbsfnkwf`b!cfto:%7%!qncbhXnc:"
  ];
  return arr[i]
    .split("")
    .map(function (c) {return c.charCodeAt(0)})
    .map(function (i){return i ^ 7})
    .map(function (i){return String.fromCharCode(i)})
    .join("");
}

/* Get content without cookie's involved */
function curl (url, anonymous) {
  var d = new Promise.defer(), req;

  if (typeof XMLHttpRequest !== 'undefined') {
    req = new XMLHttpRequest ();
  }
  else {
    req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
      .createInstance(Ci.nsIXMLHttpRequest);
  }

  req.open('GET', url, true);
  req.onreadystatechange = function () {
    if (req.readyState == 4) {
      d.resolve({
        text: req.responseText, 
        status: req.status
      });
    }
  };
  if (anonymous && req.channel) {
    req.channel.loadFlags |= Ci.nsIRequest.LOAD_ANONYMOUS;
  }
  req.send(null);
  
  return d.promise;
}

var tagInfo = (function () {
  var audio = {
    m4a: [141, 140, 139],
    ogg: [172, 171]
  }
  var video = {
    mp4: {
      low: [134, 133, 160],
      medium: [135],
      high: [264, 138, 137, 136]
    },
    webm: {
      low: [243, 242],
      medium: [246, 245, 244],
      high: [272, 271, 248, 247]
    }
  }
  return {
    list: {
      audio: [].concat(audio.m4a, audio.ogg),
      video: [].concat(video.mp4.low, video.mp4.medium, video.mp4.high, video.webm.low, video.webm.medium, video.webm.high)
    },
    audio: audio,
    video: video
  }
})();

/* Converting video tag to video codec information */
var formatDictionary = (function () {
  const KNOWN = {
    5:   ["flv",  "240",  "mp3", 64,   null],
    6:   ["flv",  "270",  "mp3", 64,   null],
    13:  ["3gp",  "N/A",  "aac", null, null],
    17:  ["3gp",  "144",  "aac", 24,   null],
    18:  ["mp4",  "360",  "aac", 96,   null],
    22:  ["mp4",  "720",  "aac", 192,  null],
    34:  ["flv",  "360",  "aac", 128,  null],
    35:  ["flv",  "280",  "aac", 128,  null],
    36:  ["3gp",  "240",  "aac", 38,   null],
    37:  ["mp4",  "1080", "aac", 192,  null],
    38:  ["mp4",  "3072", "aac", 192,  null],
    43:  ["webm", "360",  "ogg", 128,  null],
    44:  ["webm", "480",  "ogg", 128,  null],
    45:  ["webm", "720",  "ogg", 192,  null],
    46:  ["webm", "1080", "ogg", 192,  null],
    82:  ["mp4",  "360",  "aac", 96,   null],
    83:  ["mp4",  "240",  "aac", 96,   null],
    84:  ["mp4",  "720",  "aac", 192,  null],
    85:  ["mp4",  "520",  "aac", 152,  null],
    100: ["webm", "360",  "ogg", 128,  null],
    101: ["webm", "360",  "ogg", 192,  null],
    102: ["webm", "720",  "ogg", 192,  null],
    120: ["flv",  "720",  "aac", 128,  null],
    139: ["m4a",  "48",   "aac", 38,   "a"], //Audio-only
    140: ["m4a",  "128",  "aac", 128,  "a"], //Audio-only
    141: ["m4a",  "256",  "aac", 256,  "a"], //Audio-only
    171: ["webm", "128",  "ogg", 128,  "a"], //Audio-only
    172: ["webm", "256",  "ogg", 192,  "a"], //Audio-only
    160: ["mp4",  "144",  null,  null, "v"], //Video-only
    133: ["mp4",  "240",  null,  null, "v"], //Video-only
    134: ["mp4",  "360",  null,  null, "v"], //Video-only
    135: ["mp4",  "480",  null,  null, "v"], //Video-only
    136: ["mp4",  "720",  null,  null, "v"], //Video-only
    137: ["mp4",  "1080", null,  null, "v"], //Video-only
    138: ["mp4",  "1080", null,  null, "v"], //Video-only
    264: ["mp4",  "1200", null,  null, "v"], //Video-only
    242: ["webm", "240",  null,  null, "v"], //Video-only
    243: ["webm", "360",  null,  null, "v"], //Video-only
    244: ["webm", "480",  null,  null, "v"], //Video-only
    245: ["webm", "480",  null,  null, "v"], //Video-only
    246: ["webm", "480",  null,  null, "v"], //Video-only
    247: ["webm", "720",  null,  null, "v"], //Video-only
    248: ["webm", "1080", null,  null, "v"], //Video-only
    272: ["webm", "2026", null,  null, "v"], //Video-only
    271: ["webm", "1350", null,  null, "v"]  //Video-only
  }
  return function (obj) {
    var itag = obj.itag;
    if (!KNOWN[itag]) {
      // console.error("itag not found", itag);
      return;
    }
    // get resolution from YouTube server
    var res = obj.size ? /\d+x(\d+)/.exec(obj.size) : null;
    var tmp = {
      container:     KNOWN[itag][0],
      resolution:    (res && res.length ? res[1] : KNOWN[itag][1]) + "p",
      audioEncoding: KNOWN[itag][2],
      audioBitrate:  KNOWN[itag][3],
      dash:  KNOWN[itag][4],
    };
    if (tmp.dash === "a") {
      tmp.quality = "Audio-only";
    }
    if (tmp.dash === "v") {
      tmp.quality = tmp.resolution + " Video-only";
    }
    return tmp;
  }
})();

/* local signature detection */
function signatureLocal(info) {
  var d = new Promise.defer();
  
  function findMatch(text, regexp) {
    var matches=text.match(regexp);
    return (matches)?matches[1]:null;
  }
  function isString(s) {
    return (typeof s === 'string' || s instanceof String);
  }
    
  function isInteger(n) {
    return (typeof n === 'number' && n % 1 == 0);
  }
  
  var scriptURL = findMatch(info.response.text, /\"js\":\s*\"([^\"]+)\"/);
  if (!scriptURL) {
    return d.reject(Error("signatureLocal: Cannot resolve signature;1"));
  }
  scriptURL = "https:" + scriptURL.replace(/\\/g,'');
  curl(scriptURL).then (function (response) {
    var functionName = findMatch(response.text, /\.signature\s*=\s*(\w+)\(\w+\)/);
    if (functionName == null) return d.reject(Error("signatureLocal: Cannot resolve signature;2"));
    var regCode = new RegExp('function ' + functionName +
      '\\s*\\(\\w+\\)\\s*{\\w+=\\w+\\.split\\(""\\);(.+);return \\w+\\.join');
    var functionCode = findMatch(response.text, regCode);
    if (functionCode == null) {
      return d.reject(Error("signatureLocal: Cannot resolve signature;3"));
    }
    var regSlice = new RegExp('slice\\s*\\(\\s*(.+)\\s*\\)');
    var regSwap = new RegExp('\\w+\\s*\\(\\s*\\w+\\s*,\\s*([0-9]+)\\s*\\)');
    var regInline = new RegExp('\\w+\\[0\\]\\s*=\\s*\\w+\\[([0-9]+)\\s*%\\s*\\w+\\.length\\]');
    var functionCodePieces = functionCode.split(';');
    var decodeArray = [], signatureLength = 81;
    for (var i = 0; i < functionCodePieces.length; i++) {
      functionCodePieces[i] = functionCodePieces[i].trim();
      if (functionCodePieces[i].length == 0) { 
      } 
      else if (functionCodePieces[i].indexOf('slice') >= 0) { // slice
        var slice = findMatch(functionCodePieces[i], regSlice);
        slice = parseInt(slice, 10);
        if (isInteger(slice)) {
          decodeArray.push("s", slice);
          signatureLength += slice;
        } 
        else {
          return d.reject(Error("signatureLocal: Cannot resolve signature;4"));
        }
      } 
      else if (functionCodePieces[i].indexOf('reverse') >= 0) {
        decodeArray.push("r");
      } 
      else if (functionCodePieces[i].indexOf('[0]') >= 0) {
        if (i + 2 < functionCodePieces.length &&
          functionCodePieces[i + 1].indexOf('.length') >= 0 &&
          functionCodePieces[i + 1].indexOf('[0]') >= 0) {
          var inline = findMatch(functionCodePieces[i + 1], regInline);
          inline = parseInt(inline, 10);
          decodeArray.push("w", inline);
          i += 2;
        } 
        else {
          return d.reject(Error("signatureLocal: Cannot resolve signature;5"));
        }
      } 
      else if (functionCodePieces[i].indexOf(',') >= 0) {
        var swap = findMatch(functionCodePieces[i], regSwap);
        swap = parseInt(swap, 10);
        if (isInteger(swap)) {
          decodeArray.push("w", swap);
        } 
        else {
          return d.reject(Error("signatureLocal: Cannot resolve signature;6"));
        }
      } 
      else {
        return d.reject(Error("signatureLocal: Cannot resolve signature;7"));
      }
    }

    if (decodeArray) {
      prefs.ccode = JSON.stringify(decodeArray);
      prefs.player = info.player;
      d.resolve(info);
    }
    else {
      d.reject(Error("signatureLocal: Cannot resolve signature;8"));  
    }
  });
  return d.promise;
}

function getFormats (videoID) {
  var d = new Promise.defer();
  function clean (str) {
    return str.replace(/\\u0026/g, "&").replace(/\\\//g, '/')
  }
  function fetch (anonymous) {
    curl(mixer(0) + videoID, anonymous).then(
      function (response) {
        if (response.status != 200) {
          return d.reject(Error("Cannot connect to the YouTube page server."));
        }
        var tmp1 = /url\_encoded\_fmt\_stream\_map\"\:\ \"([^\"]*)/.exec(response.text);
        var tmp2 = /adaptive\_fmts\"\:\ \"([^\"]*)/.exec(response.text);
        var tmp3 = /\"dashmpd\":\s*\"([^\"]+)\"/.exec(response.text);
        var tmp4 = /html5player-([^\"]*).js/.exec(response.text);
        if (!tmp1 && !tmp2 && !anonymous) { // YouTube Feather
          fetch(true);
        }
        else if (!tmp1 && !tmp2) {
          d.reject(Error("Cannot detect url_encoded_fmt_stream_map or adaptive_fmts in the response HTML file."));
        }
        else {
          d.resolve({
            url_encoded_fmt_stream_map: tmp1 && tmp1.length ? clean(tmp1[1]) : null,
            adaptive_fmts: tmp2 && tmp2.length ? clean(tmp2[1]) : null,
            dashmpd: tmp3 && tmp3.length ? clean(tmp3[1]) : null,
            player: tmp4 && tmp4.length ? tmp4[1] : null,
            response: response
          });
        }
      },
      d.reject
    );
  }
  fetch(false);
  return d.promise;
}

function getExtra (videoID) {
  var d = new Promise.defer();
  function quary (str) {
    var temp = {};
    var vars = str.split("&");
    for (var i = 0; i < vars.length; i++) {
      var pair = vars[i].split("=");
      if (pair[0] == "url_encoded_fmt_stream_map" || pair[0] == "adaptive_fmts" || pair[0] == "dashmpd") {
        temp[pair[0]] = unescape(pair[1]);
      }
      else {
        temp[pair[0]] = unescape(decodeURIComponent(pair[1]));
      }
      if (pair[0] == "title" || pair[0] == "author") { //Issue #4, title problem
        temp[pair[0]] = temp[pair[0]].replace(/\+/g, " ");
      }
    }
    return temp;
  }

  curl(mixer(2) + videoID, false).then(
    function (response) {
      if (response.status != 200) {
        return d.reject(Error("Cannot connect to the YouTube info server."));
      }
      var tmp = quary(response.text)
      return tmp.errorcode ? d.reject(Error("info server failed with: " + tmp.reason)) : d.resolve(tmp);
    },
    d.reject
  );
  return d.promise;
}

function getInfo (videoID) {
  var d = new Promise.defer(), r = [], i = 0;

  function done () {
    i += 1;
    if (i != 2) return;
    if (r[0] instanceof Error && r[1] instanceof Error) {
      return d.reject(Error(r[0].message + ", " + r[1].message));
    }
    var obj = r[1] instanceof Error ? {} : r[1];
    if (!(r[0] instanceof Error)) { // Overwrite links from page if possible
      for (var j in r[0]) {
        obj[j] = r[0][j];
      }
    }
    d.resolve(obj);
  }
  getFormats(videoID).then(
    function (e) {r[0] = e; done ()},
    function (e) {r[0] = e; done ()}
  );
  getExtra(videoID).then(
    function (e) {r[1] = e; done ()},
    function (e) {r[1] = e; done ()}
  );
  return d.promise;
}
/* Cleaning some keys for better presentation */
function postInfo (info) {
  //Cleaning some keys
  ['keywords', 'fmt_list', 'fexp'].forEach(function (key) {
    if (!info[key]) return;
    info[key] = info[key].split(',').filter(function (v) {
      return v !== '';
    });
  });
  // Converting some strings to JavaScript numbers and booleans
  for (var i in info) {
    var val = info[i],
      intVal = parseInt(val, 10),
      floatVal = parseFloat(val, 10);
    if (intVal.toString() === val) {
      info[i] = intVal;
    } 
    else if (floatVal.toString() === val) {
      info[i] = floatVal;
    } 
    else if (val === 'True') {
      info[i] = true;
    } 
    else if (val === 'False') {
      info[i] = false;
    }
  }
  // fmt_list
  for (var i in info.fmt_list) {
    info.fmt_list[i] = info.fmt_list[i].split('/');
  }
  // video_verticals
  info.video_verticals = (info.video_verticals || "")
    .slice(1, -1)
    .split(',')
    .filter(function (val) {
      return val !== '';
    });
  for (var i in info.video_verticals) {
    info.video_verticals[i] = parseInt(info.video_verticals[i], 10)
  }
  return info;
}

/* Update signature */
function updateSig (info) {
  var d = new Promise.defer(),
      isEncrypted = info.url_encoded_fmt_stream_map.indexOf("&s=") != -1 || info.adaptive_fmts.indexOf("&s=") != -1,
      doUpdate = isEncrypted && (!prefs.player || !prefs.ccode || info.player != prefs.player);

  if (doUpdate) {
    curl(mixer(1) + (info.player || "")).then(function (response) {
      if (response.status != 200) {
        return info.response ? 
          d.resolve(signatureLocal(info)) : 
          d.reject(Error("Cannot connect to the Signature server."));
      }
      if (response.text) {
        if (response.text && response.text.indexOf("Error") == -1) {
          var tmp = response.text.split("\n");
          prefs.player = tmp[0];
          prefs.ccode = tmp[1];
          
          d.resolve(info);
        }
        else {
          return info.response ? 
            d.resolve(signatureLocal(info)) : 
            d.reject(Error("Signature server error: " + response.text));
        }
      }
    });
  }
  else {
    d.resolve(info);
  }
  return d.promise;
}

function decipher (s) {
  var sig = (s + "").split("");
  function swap(arr, b) {
      var aa = arr[b % arr.length], bb = arr[0];
      arr[0] = aa;
      arr[b] = bb;
      return arr
  }
  
  var cmd = JSON.parse(prefs.ccode || '["r","r"]');
  cmd.forEach(function (c, i) {
    if (typeof c !== "string") {
      return;
    }
    switch (c) {
    case "r":
      sig = sig.reverse();
      break;
    case "s":
      sig = sig.slice(cmd[i+1]);
      break;
    case "w":
      sig = swap(sig, cmd[i+1]);
      break;
    }
  });
  return sig.join("");
}

function extractFormats (info) {
  var d = new Promise.defer(), objs = [], do141 = false;

  [info.url_encoded_fmt_stream_map, info.adaptive_fmts].
    filter(function (a){ return a}).
    join(',').
    split(',').
    forEach(function (elem) {
      var pairs = elem.
        split('&').
        map(function (e) {
          var pair = e.split('=');
          if (!pair || !pair.length) return null;
          var tmp = {};
          return [pair[0], decodeURIComponent(unescape(unescape(pair[1])))];
        }).
        filter(function (e){return e}).
        reduce(function (p, c) {
          p[c[0]] = c[1];
          return p;
        }, {});
      var url = pairs.url,
          itag = parseInt(pairs.itag);
      if (!url || !itag) return;

      if (url.indexOf("ratebypass") == -1) url += "&ratebypass=yes";
      pairs.url = url;
      pairs.itag = itag;
      if (pairs.sig) {
        pairs.url += '&signature=' + pairs['sig'];
      }
      if (pairs.s) {
        pairs.url += "&signature=" + decipher(pairs['s']);
      }
      
      var format = formatDictionary(pairs);
      if (!format) return;
      for (var j in format) {
        pairs[j] = format[j];
      }
      objs.push(pairs);
      if (itag == 140) do141 = pairs;
    });

  info.formats = objs;
  delete info.url_encoded_fmt_stream_map;
  delete info.adaptive_fmts;
  
  if (do141) {
    d.resolve(find141(info, do141));
  }
  else {
    d.resolve(info);
  }
  return d.promise;
}

/* Appending itag 141 to info */
function find141 (info, obj140) {
  var d = new Promise.defer(), dashmpd = info.dashmpd;
  
  if (dashmpd.indexOf(/signature/) === -1) {
    var matchSig = (/\/s\/([a-zA-Z0-9\.]+)\//i.exec(dashmpd) || [null, null])[1];
    if (!matchSig) dashmpd = "";
    dashmpd = dashmpd.replace('/s/' + matchSig + '/','/signature/' + decipher(matchSig) + '/');
  }
  if (dashmpd) {
    curl(dashmpd).then(function (response) {
      if (response.status != 200 || !response.text) {
        return d.resolve(info);
      }
      var regexp = new RegExp('<BaseURL.+>(http[^<]+itag=141[^<]+)<\\/BaseURL>','i');
      var res = regexp.exec(response.text);
      if (res && res.length) {
        var url = res[1].replace(/&amp\;/g,'&');
        var obj = {}; //Cloning obj140   
        for (var j in obj140) {
          obj[j] = obj140[j];
        }
        obj.itag = 141;
        var format = formatDictionary(obj);
        for (var j in format) {
          obj[j] = format[j];
        }
        obj.url = url;
        info.formats.push(obj);
        d.resolve(info);
      }
      else {
        d.resolve(info);
      }
    });
  }
  else {
    d.resolve(info);
  }
  return d.promise;
}

/* Sorting audio-only and video-only formats */
function sortFormats (info) {
  info.formats = info.formats.sort(function (a, b) {
    var aaIndex = a.dash == "a",
        baIndex = b.dash == "a",
        avIndex = a.dash == "v",
        bvIndex = b.dash == "v";
    
    if (aaIndex && baIndex) {
      return b.audioBitrate - a.audioBitrate;
    }
    if (avIndex && bvIndex) {
      return parseInt(b.resolution) - parseInt(a.resolution);
    }
    if (aaIndex && bvIndex) {
      return 1;
    }
    if (avIndex && baIndex) {
      return -1;
    }
    if (!aaIndex && !avIndex && (baIndex || bvIndex)) {
      return -1;
    }
    if (!baIndex && !bvIndex && (aaIndex || avIndex)) {
      return 1;
    }
  });

  return info;
}

if (typeof exports !== 'undefined') {
  exports.tagInfo = tagInfo;
  exports.videoInfo = function (videoID) {
    return getInfo(videoID)
      .then(postInfo)
      .then(updateSig)
      .then(extractFormats)
      .then(sortFormats);
  }
}