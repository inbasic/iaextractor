var prefs   = require("sdk/simple-prefs").prefs,
    Request = require("sdk/request").Request;

function _getInfo(videoID, callback, pointer) {
  const INFO_URL = 'http://www.youtube.com/get_video_info?hl=en_US&el=detailpage&video_id=';
  
  var formatDictionary = function (id) {
    // itag, container, Video resolution, Video encoding, Video profile, Video bitrate (Mbit/s), Audio encoding, Audio bitrate (kbit/s)
    const F = {
      "5":   ["flv",  "240",  "H.283",  null,       "0.25",  "mp3", 64],
      "6":   ["flv",  "270",  "H.263",  null,       "0.8",   "mp3", 64],
      "13":  ["3gp",  "N/A",  "MPEG-4", null,       "0.5",   "aac", null],
      "17":  ["3gp",  "144",  "MPEG-4", "simple",   "0.05",  "aac", 24],
      "18":  ["mp4",  "360",  "H.264",  "baseline", "0.5",   "aac", 96],
      "22":  ["mp4",  "720",  "H.264",  "high",     "2-2.9", "aac", 152],
      "34":  ["flv",  "360",  "H.264",  "main",     "0.5",   "aac", 128],
      "35":  ["flv",  "280",  "H.264",  "main",     "0.8-1", "aac", 128],
      "36":  ["3gp",  "240",  "MPEG-4", "simple",   "0.17",  "aac", 38],
      "37":  ["mp4",  "1080", "H.264",  "high",     "3-4.3", "aac", 152],
      "38":  ["mp4",  "3072", "H.264",  "high",     "3.5-5", "aac", 152],
      "43":  ["webm", "360",  "VP8",    null,       "0.5",   "ogg", 128],
      "44":  ["webm", "480",  "VP8",    null,       "1",     "ogg", 128],
      "45":  ["webm", "720",  "VP8",    null,       "2",     "ogg", 192],
      "46":  ["webm", "1080", "vp8",    null,       null,    "ogg", 192],
      "82":  ["mp4",  "360",  "H.264",  "3D",       "0.5",   "aac", 96],
      "83":  ["mp4",  "240",  "H.264",  "3D",       "0.5",   "aac", 96],
      "84":  ["mp4",  "720",  "H.264",  "3D",       "2-2.9", "aac", 152],
      "85":  ["mp4",  "520",  "H.264",  "3D",       "2-2.9", "aac", 152],
      "100": ["webm", "360",  "VP8",    "3D",       null,    "ogg", 128],
      "101": ["webm", "360",  "VP8",    "3D",       null,    "ogg", 192],
      "102": ["webm", "720",  "VP8",    "3D",       null,    "ogg", 192],
      "120": ["flv",  "720",  "AVC",    "L3.1",     2,       "aac", 128]
    }
    return {
      container:     F[id][0],
      resolution:    F[id][1] + "p",
      encoding:      F[id][2],
      profile:       F[id][3],
      bitrate:       F[id][4],
      audioEncoding: F[id][5],
      audioBitrate:  F[id][6],
    }
  }

  function quary(str) {
    var temp = {};
    var vars = str.split("&");
    for (var i = 0; i < vars.length; i++) {
      var pair = vars[i].split("=");
      if (pair[0] == "url_encoded_fmt_stream_map") {
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
    
    var _f = function () {
      videoFormats = info.url_encoded_fmt_stream_map;

      // parse the formats map
      var sep1 = '%2C', sep2 = '%26', sep3 = '%3D';
      if (videoFormats.indexOf(',') > -1) {
        sep1 = ',';
        sep2 = (videoFormats.indexOf('&') > -1) ? '&' : '\\u0026';
        sep3 = '=';
      }

      var objs = new Array();
      var videoFormatsGroup = videoFormats.split(sep1);
      for (var i = 0; i < videoFormatsGroup.length; i++) {
        var videoFormatsElem = videoFormatsGroup[i].split(sep2);
        var videoFormatsPair = {};
        for (var j = 0; j < videoFormatsElem.length; j++) {
          var pair = videoFormatsElem[j].split(sep3);
          if (pair.length == 2) {
            videoFormatsPair[pair[0]] = pair[1];
          }
        }
        if (videoFormatsPair['url'] == null) continue;
        url = unescape(unescape(videoFormatsPair['url'])).replace(/\\\//g, '/').replace(/\\u0026/g, '&');
        if (videoFormatsPair['itag'] == null) continue;
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
        var format = formatDictionary(videoFormatsPair.itag);
        if (!format) {
          err = new Error('No such format for itag ' + data.itag + ' found');
        }
        for (var j in format) {
          videoFormatsPair[j] = format[j]
        }
        objs.push(videoFormatsPair);
      }

      delete info.url_encoded_fmt_stream_map;
      return objs;
    }
    
    if (info.player && info.player != prefs.player) { // Request new codec
      console.error('requesting new sig');
    
      Request({
        url: "http://add0n.com/signature2.php?id=" + info.player,
        onComplete: function (response) {
          if (response.text) {
            var tmp = response.text.split("\n");
            prefs.player = tmp[0];
            prefs.ccode = tmp[1];
          
            info.formats = _f ();
            if (callback) callback.apply(pointer, [info]);
          }
        }
      }).get();
    }
    else {
      console.error('Using cache');
    
      info.formats = _f ();
      if (callback) callback.apply(pointer, [info]);
    }
  }

  Request({
    url: INFO_URL + videoID,
    onComplete: function (response) {
      if (response.status != 200) throw 'Error: Cannot connect to Youtube server.';

      var info = quary(response.text);
      if (response.text.indexOf("use_cipher_signature=True") != -1) {
        Request({
          url: "http://www.youtube.com/watch?v=" + videoID,
          onComplete: function (response) {
            if (response.status != 200) throw 'Error: Cannot connect to Youtube server.';

            var tmp = /url\_encoded\_fmt\_stream\_map\"\:\ \"([^\"]*)/.exec(response.text);
            if (!tmp || !tmp.length) {
              throw 'Error: Cannot detect url_encoded_fmt_stream_map from HTML file.';
            } 
            else {
              info.url_encoded_fmt_stream_map = tmp[1];
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
      if (callback) callback.apply(pointer, [null, detected, info.title, info.author]);
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