var prefs   = require("sdk/simple-prefs").prefs,
    Request = require("sdk/request").Request,
    _       = require("sdk/l10n").get;

function _getInfo(videoID, callback, pointer) {
  const INFO_URL = 'http://www.youtube.com/get_video_info?hl=en_US&el=detailpage&dash="0"&video_id=';
  
  var formatDictionary = function (obj) {
    var id = obj.itag;
    // itag, container, Video resolution, Video encoding, Video profile, Audio encoding, Audio bitrate (kbit/s)
    const F = {
      5:   ["flv",  "240",  "H.283",  null,       "mp3", 64],
      6:   ["flv",  "270",  "H.263",  null,       "mp3", 64],
      13:  ["3gp",  "N/A",  "MPEG-4", null,       "aac", null],
      17:  ["3gp",  "144",  "MPEG-4", "simple",   "aac", 24],
      18:  ["mp4",  "360",  "H.264",  "baseline", "aac", 96],
      22:  ["mp4",  "720",  "H.264",  "high",     "aac", 192],
      34:  ["flv",  "360",  "H.264",  "main",     "aac", 128],
      35:  ["flv",  "280",  "H.264",  "main",     "aac", 128],
      36:  ["3gp",  "240",  "MPEG-4", "simple",   "aac", 38],
      37:  ["mp4",  "1080", "H.264",  "high",     "aac", 192],
      38:  ["mp4",  "3072", "H.264",  "high",     "aac", 192],
      43:  ["webm", "360",  "VP8",    null,       "ogg", 128],
      44:  ["webm", "480",  "VP8",    null,       "ogg", 128],
      45:  ["webm", "720",  "VP8",    null,       "ogg", 192],
      46:  ["webm", "1080", "vp8",    null,       "ogg", 192],
      82:  ["mp4",  "360",  "H.264",  "3D",       "aac", 96],
      83:  ["mp4",  "240",  "H.264",  "3D",       "aac", 96],
      84:  ["mp4",  "720",  "H.264",  "3D",       "aac", 192],
      85:  ["mp4",  "520",  "H.264",  "3D",       "aac", 152],
      100: ["webm", "360",  "VP8",    "3D",       "ogg", 128],
      101: ["webm", "360",  "VP8",    "3D",       "ogg", 192],
      102: ["webm", "720",  "VP8",    "3D",       "ogg", 192],
      120: ["flv",  "720",  "AVC",    "L3.1",     "aac", 128],
//    92:  ["mp4",  "240",  null,     "Apple",    "?",   "?"],  //Live Streaming
//    93:  ["mp4",  "360",  null,     "Apple",    "?",   "?"],  //Live Streaming
//    94:  ["mp4",  "480",  null,     "Apple",    "?",   "?"],  //Live Streaming
//    95:  ["mp4",  "720",  null,     "Apple",    "?",   "?"],  //Live Streaming
//    96:  ["mp4",  "1080", null,     "Apple",    "?",   "?"],  //Live Streaming
//    132: ["mp4",  "240",  null,     "Apple",    "?",   "?"],  //Live Streaming
//    151: ["mp4",  "72",   null,     "Apple",    "?",   "?"],  //Live Streaming
      139: ["m4a",  "48",   null,     "DASH A",   "aac", 38],   //Audio-only
      140: ["m4a",  "128",  null,     "DASH A",   "aac", 128],  //Audio-only
      141: ["m4a",  "256",  null,     "DASH A",   "aac", 256],  //Audio-only
      171: ["webm", "128",  null,     "DASH A",   "ogg", 128],  //Audio-only
      172: ["webm", "256",  null,     "DASH A",   "ogg", 192],  //Audio-only
      160: ["mp4",  "144",  null,     "DASH V",   null,  null], //Video-only
      133: ["mp4",  "240",  null,     "DASH V",   null,  null], //Video-only
      134: ["mp4",  "360",  null,     "DASH V",   null,  null], //Video-only
      135: ["mp4",  "480",  null,     "DASH V",   null,  null], //Video-only
      136: ["mp4",  "720",  null,     "DASH V",   null,  null], //Video-only
      137: ["mp4",  "1080", null,     "DASH V",   null,  null], //Video-only
      138: ["mp4",  "1080", null,     "DASH V",   null,  null], //Video-only
      264: ["mp4",  "1200", null,     "DASH V",   null,  null], //Video-only
      242: ["webm", "240",  null,     "DASH V",   null,  null], //Video-only
      243: ["webm", "360",  null,     "DASH V",   null,  null], //Video-only
      244: ["webm", "480",  null,     "DASH V",   null,  null], //Video-only
      245: ["webm", "480",  null,     "DASH V",   null,  null], //Video-only
      246: ["webm", "480",  null,     "DASH V",   null,  null], //Video-only
      247: ["webm", "720",  null,     "DASH V",   null,  null], //Video-only
      248: ["webm", "1080", null,     "DASH V",   null,  null]  //Video-only
    }
    if (!F[id]) return;
    // Right resolution from YouTube server
    var res = obj.size ? /\d+x(\d+)/.exec(obj.size) : null;
    var tmp = {
      container:     F[id][0],
      resolution:    (res && res.length ? res[1] : F[id][1]) + "p",
      encoding:      F[id][2],
      profile:       F[id][3],
      audioEncoding: F[id][4],
      audioBitrate:  F[id][5],
    };
    if ([139, 140, 141, 171, 172].indexOf(id) != -1) {
      tmp.quality = "audio-only";
    }
    if ([160, 133, 134, 135, 136, 137, 138, 264, 242, 243, 244, 245, 246, 247, 248].indexOf(id) != -1) {
      tmp.quality = tmp.resolution + " Video-only";
    }
    return tmp;
  }

  function quary(str) {
    var temp = {};
    var vars = str.split("&");
    for (var i = 0; i < vars.length; i++) {
      var pair = vars[i].split("=");
      if (pair[0] == "url_encoded_fmt_stream_map" || pair[0] == "adaptive_fmts") {
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
  function parser(info) {
    //Clean keys
    ['keywords', 'fmt_list', 'fexp'].forEach(function (key) {
      if (!info[key]) return;
      info[key] = info[key].split(',').filter(function (v) {
        return v !== '';
      });
    });
    // convert some strings to JavaScript numbers and booleans
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
    for (var i in info.fmt_list) {
      info.fmt_list[i] = info.fmt_list[i].split('/');
    }
    info.video_verticals = (info.video_verticals ? info.video_verticals : "")
      .slice(1, -1)
      .split(',')
      .filter(function (val) {
        return val !== '';
      });
    for (var i in info.video_verticals) {
      info.video_verticals[i] = parseInt(info.video_verticals[i], 10)
    }
    
    var _f = function () {      // parse the formats map
      var sep1 = ',', sep2 = '&', sep3 = '=', videoFormats;
      if (info.url_encoded_fmt_stream_map && info.adaptive_fmts) {
        videoFormats = 
          info.url_encoded_fmt_stream_map.replace(/\\u0026/g, "&").replace(/\\\//g, '/') + 
          sep1 + 
          info.adaptive_fmts.replace(/\\u0026/g, "&").replace(/\\\//g, '/');
      }
      else if (info.url_encoded_fmt_stream_map) {
        videoFormats = 
          info.url_encoded_fmt_stream_map.replace(/\\u0026/g, "&").replace(/\\\//g, '/');
      }
      else if (info.adaptive_fmts) {
        videoFormats = 
          info.adaptive_fmts.replace(/\\u0026/g, "&").replace(/\\\//g, '/');
      }
      else {
        return null;
      }
      var objs = new Array();
      var videoFormatsGroup = videoFormats.split(sep1);
      for (var i = 0; i < videoFormatsGroup.length; i++) {
        var videoFormatsElem = videoFormatsGroup[i].split(sep2);
        var videoFormatsPair = {};
        for (var j = 0; j < videoFormatsElem.length; j++) {
          var pair = videoFormatsElem[j].split(sep3);
          if (pair.length == 2) {
            videoFormatsPair[pair[0]] = decodeURIComponent(unescape(unescape(pair[1])));
          }
        }
        if (videoFormatsPair['url'] == null) continue;
        url = videoFormatsPair['url'];
        if (url.indexOf("ratebypass") == -1) url += "&ratebypass=yes";
        if (videoFormatsPair['itag'] == null) continue;
        videoFormatsPair['itag'] = parseInt(videoFormatsPair['itag']);
        itag = videoFormatsPair['itag'];
        if (videoFormatsPair['sig']) {
          videoFormatsPair['url'] = url + '&signature=' + videoFormatsPair['sig'];
        }
        else if (videoFormatsPair['s']) {
          var sig = (videoFormatsPair['s'] + "").split("");
          function swap(arr, b) {
              l3 = arr[0];
              l4 = arr[b % arr.length];
              arr[0] = l4;
              arr[b] = l3;
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
          videoFormatsPair.url = url + "&signature=" + sig.join("");
        }
        else {
          videoFormatsPair.url = url;
        }
        var format = formatDictionary(videoFormatsPair);
        if (!format) continue;
        for (var j in format) {
          videoFormatsPair[j] = format[j];
        }
        objs.push(videoFormatsPair);
      }

      delete info.url_encoded_fmt_stream_map;
      delete info.adaptive_fmts;
      // Sorting audio-only and video-only formats
      return objs.sort(function (a,b) {
        var audio = [141, 172, 171, 140, 139],
            video = [160, 133, 134, 135, 136, 137, 138, 264, 242, 243, 244, 245, 246, 247, 248],
            aaIndex = audio.indexOf(a.itag) != -1,
            baIndex = audio.indexOf(b.itag) != -1,
            avIndex = video.indexOf(a.itag) != -1,
            bvIndex = video.indexOf(b.itag) != -1;
        
        if (aaIndex && baIndex) {
          return b.audioBitrate - a.audioBitrate;
        }
        if (avIndex && bvIndex) {
          return b.bitrate - a.bitrate;
        }
      });
    }
    // Request new codec
    if ((info.player || info.use_cipher_signature) && info.player != prefs.player) { // if there is no html5 player but ciphered signature ...
      Request({
        url: "http://add0n.com/signature2.php?id=" + (info.player || ""),
        onComplete: function (response) {
          if (response.status != 200) throw 'Error: Cannot connect to Youtube server.';
        
          if (response.text) {
            if (response.text && response.text.indexOf("Error") == -1) {
              var tmp = response.text.split("\n");
              prefs.player = tmp[0];
              prefs.ccode = tmp[1];
            }
            else {
              throw _("err16") + " ... " + response.text;
            }
            info.formats = _f ();
            if (callback) callback.apply(pointer, [info]);
          }
        }
      }).get();
    }
    else {    
      info.formats = _f ();
      if (callback) callback.apply(pointer, [info]);
    }
  }

  Request({
    url: INFO_URL + videoID,
    onComplete: function (response) {
      if (response.status != 200) throw 'Error: Cannot connect to Youtube server.';

      var info = quary(response.text);
      if (true) {

      
        Request({
          url: "http://www.youtube.com/watch?v=" + videoID,
          onComplete: function (response) {
            if (response.status != 200) throw 'Error: Cannot connect to Youtube server.';

            var tmp1 = /url\_encoded\_fmt\_stream\_map\"\:\ \"([^\"]*)/.exec(response.text);
            var tmp2 = /adaptive\_fmts\"\:\ \"([^\"]*)/.exec(response.text);
            if (!tmp1 && !tmp2) {
              throw 'Error: Cannot detect url_encoded_fmt_stream_map or adaptive_fmts in the HTML file.';
            }
            else {
              info.url_encoded_fmt_stream_map = tmp1 ? tmp1[1] : null;
              info.adaptive_fmts = tmp2 ? tmp2[1] : null;
              var tmp2 = /html5player-([^\"]*).js/.exec(response.text);
              if (tmp2 && tmp2.length == 2) {
                info.player = tmp2[1];
              }
              parser(info);
            }
          }
        }).get();
      } 
      else {
        parser(info);
      }
    }
  }).get();
}
//Do not localize
var getFormat = function (value) {
  switch (value) {
  case 0:
    return "flv";
  case 1:
    return "3gp";
  case 2:
    return "mp4";
  case 3:
    return "webm";
  }
}
//Do not localize
var getQuality = function (value) {
  switch (value) {
  case 4:
    return "small";
  case 3:
    return "medium";
  case 2:
    return "high";
  case 1:
    return "hd720";
  case 0:
    return "hd1080";
  }
}

var getLink = function (videoID, fIndex, callback, pointer) {
  try {
    _getInfo(videoID, function (info) {
      var quality = prefs.quality, detected;
      if (!fIndex) {
        //format is already sorted high to low
        var tmp = info.formats.filter(function (a) {
          return a.container == getFormat(prefs.extension)
        });
        if (prefs.doExtract && getFormat(prefs.extension) == "flv") {
          var tmp2 = tmp.filter(function (a) {
            return a.audioEncoding == "aac"
          });
          if (tmp2.length) {
            tmp = tmp2;
          }
        }
        var qualityValue = prefs.quality;
        while (tmp.length && !detected && qualityValue > -1) {
          var b = tmp.filter(function (a) {
            if (a.quality == getQuality(qualityValue))
              return true;
            else
              return false
          });
          if (b.length) detected = b[0];
          qualityValue -= 1;
        }
        if (!detected && tmp.length) detected = tmp[0]
        if (!detected) detected = info.formats[0]; //Get highest quality
      } 
      else {
        detected = info.formats[fIndex];
      }
      detected.parent = info;
      if (callback) callback.apply(pointer, [null, detected, info]);
    });
  }
  catch (e) {
    if (callback) callback.apply(pointer, [e]);
  }
}
exports.getLink = getLink;

var getInfo = function (videoID, callback, pointer) {
  try {
    _getInfo(videoID, function (info) {
      if (callback) {
        callback.apply(pointer, [info, null]);
      }
    });
  }
  catch (e) {
    if (callback) {
      callback.apply(pointer, [null, e]);
    }
  }
}
exports.getInfo = getInfo;