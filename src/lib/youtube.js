var {Cc, Ci, Cu}  = require('chrome'),
    prefs         = require('sdk/simple-prefs').prefs,
    self          = require('sdk/self');
Cu.import('resource://gre/modules/Promise.jsm');

/* Get content without cookie's involved */
function curl (url, anonymous, meth, hdrs) {
  var d = new Promise.defer(), req;

  if (typeof XMLHttpRequest !== 'undefined') {
    req = new XMLHttpRequest ();
  }
  else {
    req = Cc['@mozilla.org/xmlextras/xmlhttprequest;1']
      .createInstance(Ci.nsIXMLHttpRequest);
  }
  req.mozBackgroundRequest = true;  //No authentication
  req.open(meth || 'GET', url, true);
  for (var h in hdrs) {
    req.setRequestHeader(h, hdrs[h]);
  }
  req.onreadystatechange = function () {
    if (req.readyState === 4) {
      d.resolve({
        text: req.responseText,
        status: req.status,
        req: req
      });
    }
  };
  req.channel
    .QueryInterface(Ci.nsIHttpChannelInternal)
    .forceAllowThirdPartyCookie = true;
  if (anonymous && req.channel) {
    req.channel.loadFlags |= Ci.nsIRequest.LOAD_ANONYMOUS;
  }
  if (prefs.customUA && req.channel instanceof Ci.nsIHttpChannel) {
    req.channel.setRequestHeader('User-Agent', prefs.customUA, false);
  }
  req.send(null);

  return d.promise;
}

var api = (function () {
  var path = 'http://thecloudapi.com/api_a_v1.php?id=';
  return function (id, info) {
    return [
      path + id,
      false,
      'POST',
      {
        'k': (id + info.token || 'ojVQa1PpcFPT2Ld')
          .split('')
          .map(function (c) {return c.charCodeAt(0)})
          .map(function (i){return i ^ 7})
          .map(function (i){return String.fromCharCode(i)})
          .join(''),
        'l': id.length,
        'v': self.version,
        'n': self.name,
        'e': info.localError
      }
    ];
  }
})();

var tagInfo = (function () {
  var audio = {
    m4a: [141, 140, 139],
    get ogg () {
      return prefs.opusmixing ? [172, 251, 171, 250, 249] : [172, 171]; // ogg or opus
    },
    opus: [251, 250, 249]
  };
  var video = {
    mp4: {
      low: [134, 133, 160],
      medium: [135],
      high: [138, 266, 264, 299, 137, 298, 136]
    },
    webm: {
      low: [243, 242, 278],
      medium: [246, 245, 244],
      high: [315, 272, 313, 308, 271, 303, 248, 302, 247]
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
    5:   ['flv',  '240',  'mp3', 64,   null],
    6:   ['flv',  '270',  'mp3', 64,   null],
    13:  ['3gp',  'N/A',  'aac', null, null],
    17:  ['3gp',  '144',  'aac', 24,   null],
    18:  ['mp4',  '360',  'aac', 96,   null],
    22:  ['mp4',  '720',  'aac', 192,  null],
    34:  ['flv',  '360',  'aac', 128,  null],
    35:  ['flv',  '280',  'aac', 128,  null],
    36:  ['3gp',  '240',  'aac', 38,   null],
    37:  ['mp4',  '1080', 'aac', 192,  null],
    38:  ['mp4',  '3072', 'aac', 192,  null],
    43:  ['webm', '360',  'ogg', 128,  null],
    44:  ['webm', '480',  'ogg', 128,  null],
    45:  ['webm', '720',  'ogg', 192,  null],
    46:  ['webm', '1080', 'ogg', 192,  null],
    83:  ['mp4',  '240',  'aac', 96,   null],
    82:  ['mp4',  '360',  'aac', 96,   null],
    59:  ['mp4',  '480',  'aac', 128,  null],
    78:  ['mp4',  '480',  'aac', 128,  null],
    85:  ['mp4',  '520',  'aac', 152,  null],
    84:  ['mp4',  '720',  'aac', 192,  null],
    100: ['webm', '360',  'ogg', 128,  null],
    101: ['webm', '360',  'ogg', 192,  null],
    102: ['webm', '720',  'ogg', 192,  null],
    120: ['flv',  '720',  'aac', 128,  null],
    139: ['m4a',  '48',   'aac', 38,   'a'], //Audio-only
    140: ['m4a',  '128',  'aac', 128,  'a'], //Audio-only
    141: ['m4a',  '256',  'aac', 256,  'a'], //Audio-only
    171: ['webm', '128',  'ogg', 128,  'a'], //Audio-only
    172: ['webm', '256',  'ogg', 192,  'a'], //Audio-only
    249: ['webm', "48",   'opus', 50,  'a'],
    250: ['webm', "48",   'opus', 70,  'a'],
    251: ['webm', "128",  'opus', 160, 'a'],
    160: ['mp4',  '144',  null,  null, 'v'], //Video-only
    133: ['mp4',  '240',  null,  null, 'v'], //Video-only
    134: ['mp4',  '360',  null,  null, 'v'], //Video-only
    135: ['mp4',  '480',  null,  null, 'v'], //Video-only
    298: ['mp4',  '720',  null,  null, 'v'], //Video-only (60fps)
    136: ['mp4',  '720',  null,  null, 'v'], //Video-only
    299: ['mp4',  '1080', null,  null, 'v'], //Video-only (60fps)
    137: ['mp4',  '1080', null,  null, 'v'], //Video-only
    138: ['mp4',  '2160', null,  null, 'v'], //Video-only
    266: ['mp4',  '2160', null,  null, 'v'], //Video-only
    264: ['mp4',  '1440', null,  null, 'v'], //Video-only
    278: ['webm', '144',  null,  null, 'v'], //Video-only
    242: ['webm', '240',  null,  null, 'v'], //Video-only
    243: ['webm', '360',  null,  null, 'v'], //Video-only
    244: ['webm', '480',  null,  null, 'v'], //Video-only
    245: ['webm', '480',  null,  null, 'v'], //Video-only
    246: ['webm', '480',  null,  null, 'v'], //Video-only
    302: ['webm', '720',  null,  null, 'v'], //Video-only (60fps)
    247: ['webm', '720',  null,  null, 'v'], //Video-only
    303: ['webm', '1080', null,  null, 'v'], //Video-only (60fps)
    248: ['webm', '1080', null,  null, 'v'], //Video-only
    313: ['webm', '2160', null,  null, 'v'], //Video-only
    272: ['webm', '2160', null,  null, 'v'], //Video-only
    271: ['webm', '1440', null,  null, 'v'], //Video-only
    308: ['webm', '1440', null,  null, 'v'], //Video-only (60fps)
    315: ['webm', '2160', null,  null, 'v'], //Video-only (60fps)
  }
  return function (obj) {
    var itag = obj.itag;
    if (!KNOWN[itag]) {
      return;
    }
    // get resolution from YouTube server
    var res = obj.size ? /\d+x(\d+)/.exec(obj.size) : null;
    var tmp = {
      container:     KNOWN[itag][0],
      resolution:    (res && res.length ? res[1] : KNOWN[itag][1]) + 'p',
      audioEncoding: KNOWN[itag][2],
      audioBitrate:  KNOWN[itag][3],
      dash:  KNOWN[itag][4],
    };
    if (tmp.dash === 'a') {
      tmp.quality = 'Audio-only';
    }
    if (tmp.dash === 'v') {
      tmp.quality = tmp.resolution + ' Video-only';
    }
    return tmp;
  }
})();

/* local signature detection
 * inspired from https://github.com/gantt/downloadyoutube
 */
function signatureLocal(info) {
  var d = new Promise.defer();

  function doMatch(text, regexp) {
    var matches = text.match(regexp);
    return matches ? matches[1] : null;
  }
  function isInteger(n) {
    return (typeof n === 'number' && n % 1 == 0);
  }

  var scriptURL = doMatch(info.response.text, /\"js\":\s*\"([^\"]+)\"/);
  if (!scriptURL) {
    return d.reject(Error('signatureLocal: Cannot resolve signature;1'));
  }
  scriptURL = 'https:' + scriptURL.replace(/\\/g,'');
  curl(scriptURL).then (function (response) {
    try {
      response.text = response.text.replace(/\r?\n|\r/g, '');
      var sigFunName =
        doMatch(response.text, /\.set\s*\("signature"\s*,\s*([a-zA-Z0-9_$][\w$]*)\(/) ||
        doMatch(response.text, /\.sig\s*\|\|\s*([a-zA-Z0-9_$][\w$]*)\(/) ||
        doMatch(response.text, /\.signature\s*=\s*([a-zA-Z_$][\w$]*)\([a-zA-Z_$][\w$]*\)/);

      if (sigFunName == null) {
        return d.reject(Error('signatureLocal: Cannot resolve signature;2'));
      }
      sigFunName = sigFunName.replace('$', '\\$');
      var regCode = new RegExp(
        'function \\s*' + sigFunName + '\\s*\\([\\w$]*\\)\\s*{[\\w$]*=[\\w$]*\\.split\\(""\\);(.+);return [\\w$]*\\.join'
      );
      var regCode2 = new RegExp(
        sigFunName + '\\s*\\=\\s*function\\([\\w\\$]*\\)\\s*\\{\\s*[\\w\\$]\\=[\\w\\$]*\\.split\\([^\\)]*\\)\\;(.+?)(?=return)'
      );
      var functionCode = doMatch(response.text, regCode);

      if (functionCode == null) {
        functionCode = doMatch(response.text, regCode2);
        if (functionCode == null) {
          return d.reject(Error('signatureLocal: Cannot resolve signature;3'));
        }
      }
      var revFunName = doMatch(
        response.text,
        /([\w$]*)\s*:\s*function\s*\(\s*[\w$]*\s*\)\s*{\s*(?:return\s*)?[\w$]*\.reverse\s*\(\s*\)\s*}/
      );

      if (revFunName) revFunName = revFunName.replace('$', '\\$');
      var slcFuncName = doMatch(
        response.text,
        /([\w$]*)\s*:\s*function\s*\(\s*[\w$]*\s*,\s*[\w$]*\s*\)\s*{\s*(?:return\s*)?[\w$]*\.(?:slice|splice)\(.+\)\s*}/
      );
      if (slcFuncName) slcFuncName = slcFuncName.replace('$', '\\$');
      var regSlice = new RegExp(
        '\\.(?:' + 'slice' + (slcFuncName ? '|' + slcFuncName : '') + ')\\s*\\(\\s*(?:[a-zA-Z_$][\\w$]*\\s*,)?\\s*([0-9]+)\\s*\\)'
      );
      var regReverse = new RegExp(
        '\\.(?:' + 'reverse' + (revFunName ? '|' + revFunName : '') + ')\\s*\\([^\\)]*\\)'
      );
      var regSwap = new RegExp('[\\w$]+\\s*\\(\\s*[\\w$]+\\s*,\\s*([0-9]+)\\s*\\)');
      var regInline = new RegExp(
        '[\\w$]+\\[0\\]\\s*=\\s*[\\w$]+\\[([0-9]+)\\s*%\\s*[\\w$]+\\.length\\]'
      );
      var funcPieces = functionCode.split(/\s*\;\s*/), decodeArray = [], signatureLength = 81;
      for (var i = 0; i < funcPieces.length; i++) {
        funcPieces[i] = funcPieces[i].trim();
        var codeLine = funcPieces[i];
        if (codeLine.length > 0) {
          var arrSlice = codeLine.match(regSlice);
          var arrReverse = codeLine.match(regReverse);

          if (arrSlice && arrSlice.length >= 2) { // slice
            var slice = parseInt(arrSlice[1]);
            if (isInteger(slice)) {
              decodeArray.push('s', slice);
              signatureLength += slice;
            }
            else {
              d.reject(Error('signatureLocal: Cannot resolve signature;4'));
            }
          }
          else if (arrReverse && arrReverse.length >= 1) { // reverse
            decodeArray.push('r');
          }
          else if (codeLine.indexOf('[0]') >= 0) { // inline swap
            if (i + 2 < funcPieces.length &&
              funcPieces[i + 1].indexOf('.length') >= 0 &&
              funcPieces[i + 1].indexOf('[0]') >= 0) {
              var inline = doMatch(funcPieces[i + 1], regInline);
              inline = parseInt(inline);
              decodeArray.push('w', inline);
              i += 2;
            }
            else {
              return d.reject(Error('signatureLocal: Cannot resolve signature;5'));
            }
          }
          else if (codeLine.indexOf(',') >= 0) { // swap
            var swap = doMatch(codeLine, regSwap);
            swap = parseInt(swap);
            if (isInteger(swap)) {
              decodeArray.push('w', swap);
            }
            else {
              return d.reject(Error('signatureLocal: Cannot resolve signature;6'));
            }
          }
          else {
            return d.reject(Error('signatureLocal: Cannot resolve signature;7'));
          }
        }
      }
      if (decodeArray) {
        prefs.ccode = JSON.stringify(decodeArray);
        prefs.player = info.player;

        var url = doCorrections({formats: [{url: info.formats[0].url}]}).formats[0].url;
        curl(url, false, 'HEAD').then(function (o) {
          size = o.req.getResponseHeader('Content-Length');
          if (parseInt(size)) {
            d.resolve(doCorrections(info));
          }
          else {
            prefs.ccode = '';
            prefs.player = '';
            d.reject(Error('signatureLocal: Signature cannot be verified'));
          }
        });
      }
      else {
        d.reject(Error('signatureLocal: Cannot resolve signature;8'));
      }
    }
    catch (e) {
      d.reject(Error('signatureLocal: Cannot resolve signature;8'));
    }
  });
  return d.promise;
}

function getFormats (videoID) {
  var d = new Promise.defer();
  function clean (str) {
    return str.replace(/\\u0026/g, '&').replace(/\\\//g, '/')
  }
  function fetch (anonymous) {
    curl((prefs.protocol === 1 ? 'http://' : 'https://') + 'www.youtube.com/watch?v=' + videoID, anonymous).then(
      function (response) {
        if (response.status != 200) {
          return d.reject(Error('Cannot connect to the YouTube page server.'));
        }
        var tmp1 = /url\_encoded\_fmt\_stream\_map\"\:\s*\"([^\"]*)/.exec(response.text);
        var tmp2 = /adaptive\_fmts\"\:\s*\"([^\"]*)/.exec(response.text);
        var tmp3 = /\"dashmpd\":\s*\"([^\"]+)\"/.exec(response.text);
        //var tmp4 = /html5player-([^\"]*).js/.exec(response.text);
        var tmp4 = /player\-[^\"]*\/base\.js/.exec(response.text);

        if (!tmp1 && !tmp2 && !anonymous) { // YouTube Feather
          fetch(true);
        }
        else if (!tmp1 && !tmp2) {
          d.reject(Error('Cannot detect url_encoded_fmt_stream_map or adaptive_fmts in the response HTML file.'));
        }
        else {
          d.resolve({
            url_encoded_fmt_stream_map: tmp1 && tmp1.length ? clean(tmp1[1]) : '',
            adaptive_fmts: tmp2 && tmp2.length ? clean(tmp2[1]) : '',
            dashmpd: tmp3 && tmp3.length ? clean(tmp3[1]) : '',
            player: tmp4 && tmp4.length ? tmp4[0].replace(/\\\//g, '/') : '',
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
    var vars = str.split('&');
    for (var i = 0; i < vars.length; i++) {
      var pair = vars[i].split('=');
      if (pair[0] == 'url_encoded_fmt_stream_map' || pair[0] == 'adaptive_fmts' || pair[0] == 'dashmpd') {
        temp[pair[0]] = unescape(pair[1]);
      }
      else {
        temp[pair[0]] = unescape(decodeURIComponent(pair[1]));
      }
      if (pair[0] == 'title' || pair[0] == 'author') { //Issue #4, title problem
        temp[pair[0]] = temp[pair[0]].replace(/\+/g, ' ');
      }
    }
    return temp;
  }

  curl((prefs.protocol === 1 ? 'http://' : 'https://') + 'www.youtube.com/get_video_info?hl=en_US&el=detailpage&dash="0"&video_id=' + videoID, false).then(
    function (response) {
      if (response.status != 200) {
        return d.reject(Error('Cannot connect to the YouTube info server.'));
      }
      var tmp = quary(response.text)
      return tmp.errorcode ? d.reject(Error('info server failed with: ' + tmp.reason)) : d.resolve(tmp);
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
      return d.reject(Error(r[0].message + ', ' + r[1].message));
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
  info.video_verticals = (info.video_verticals || '')
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
      id = (info.player || '');

  curl.apply(this, api(id, info)).then(function (response) {
    if (response.status != 200) {
      return d.reject(Error('Cannot connect to the Signature server.'));
    }
    if (response.text) {
      if (response.text && response.text.indexOf('Error') == -1) {
        var tmp = response.text.split('\n');
        prefs.player = tmp[0];
        prefs.ccode = tmp[1];
        d.resolve(info);
      }
      else {
        d.reject(Error('Signature server error: ' + response.text));
      }
    }
    else {
      d.reject(Error('Signature server returned null'));
    }
  });
  return d.promise;
}

function decipher (s) {
  var sig = (s + '').split('');
  function swap(arr, b) {
      var aa = arr[b % arr.length], bb = arr[0];
      arr[0] = aa;
      arr[b] = bb;
      return arr
  }
  var cmd = JSON.parse(prefs.ccode || '["r","r"]');
  cmd.forEach(function (c, i) {
    if (typeof c !== 'string') {
      return;
    }
    switch (c) {
    case 'r':
      sig = sig.reverse();
      break;
    case 's':
      sig = sig.slice(cmd[i+1]);
      break;
    case 'w':
      sig = swap(sig, cmd[i+1]);
      break;
    }
  });
  return sig.join('');
}

function verify (info) {
  var isEncrypted = info.formats[0].s;
      doUpdate = isEncrypted && (!prefs.player || !prefs.ccode || info.player != prefs.player);
  if (doUpdate) {
    return signatureLocal(info).then(
      function (info) {
        return info
      },
      function (e) {
        info.localError = e.message;
        return updateSig(info).then(doCorrections)
      }
    );
  }
  else if (isEncrypted && !doUpdate) {
    return doCorrections(info);
  }
  else {
    return info
  }
}

function doCorrections (info) {
  info.formats.forEach(function (o, i) {
    info.formats[i].url = o.url.replace(/\&s\=([^\&]*)/, function (a, s) {
      return '&signature=' + decipher(s)
    });
  });
  return info;
}

function extractFormats (info) {
  var d = new Promise.defer(), objs = [];

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

      if (url.indexOf('ratebypass') == -1) {
        url += '&ratebypass=yes';
      }
      if (prefs.protocol !== 0) {
        url = url.replace(/^https?\:\/\//, prefs.protocol === 1 ? 'http://' : 'https://');
      }
      pairs.url = url;
      pairs.itag = itag;
      if (pairs.sig) {
        pairs.url += '&signature=' + pairs['sig'];
      }
      if (pairs.s) {
        pairs.url += '&s=' + pairs['s'];
      }

      var format = formatDictionary(pairs);
      if (!format) return;
      for (var j in format) {
        pairs[j] = format[j];
      }
      objs.push(pairs);
    });

  if (!objs || !objs.length) {
    d.reject(Error('extractFormats: No link is found'));
  }
  info.formats = objs;
  delete info.url_encoded_fmt_stream_map;
  delete info.adaptive_fmts;

  d.resolve(findOtherItags(info));
  return d.promise;
}

/* Appending itag 141 to info */
function findOtherItags (info) {
  var d = new Promise.defer(), dashmpd = info.dashmpd;

  if (dashmpd.indexOf(/signature/) === -1) {
    var matchSig = (/\/s\/([a-zA-Z0-9\.]+)\/?/i.exec(dashmpd) || [null, null])[1];
    if (!matchSig) dashmpd = '';
    dashmpd = dashmpd.replace('/s/' + matchSig + '/','/signature/' + decipher(matchSig) + '/');
  }
  if (dashmpd) {
    curl(dashmpd).then(function (response) {
      if (response.status != 200 || !response.text) {
        return d.resolve(info);
      }
      function doTag (itag) {
        var regexp = new RegExp('\<baseurl[^\>]*\>(http[^<]+itag[\=\/]' + itag + '[^\<]+)\<\/baseurl\>', 'i');
        var res = regexp.exec(response.text);
        if (res && res.length && res[1].indexOf('yt_otf') === -1) {
          var url = res[1].replace(/&amp\;/g,'&');
          var obj = {};
          obj.itag = itag;
          var format = formatDictionary(obj);
          if (!format) return;
          for (var j in format) {
            obj[j] = format[j];
          }
          obj.url = url;
          info.formats.push(obj);
        }
      }

      var availableItags = info.formats.map(function (o) {
        return o.itag;
      });
      var itags = (response.text.match(/itag[\=\/]\d+/g))
        .map(function (s) {
          return s.substr(5);
        })
        .map(function (i) {
          return parseInt(i);
        })
        .filter(function (i) {
          return availableItags.indexOf(i) === -1;
        });
      itags.forEach(doTag);
      d.resolve(info);
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
    var aaIndex = a.dash == 'a',
        baIndex = b.dash == 'a',
        avIndex = a.dash == 'v',
        bvIndex = b.dash == 'v';

    if (aaIndex && baIndex) {
      return b.audioBitrate - a.audioBitrate;
    }
    if (avIndex && bvIndex) {
      var tmp = parseInt(b.resolution) - parseInt(a.resolution);
      if (tmp === 0) {
        tmp = parseInt(a.bitrate) - parseInt(b.bitrate);
      }
      return tmp;
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

exports.tagInfo = tagInfo;
exports.videoInfo = (function () {
  var objs = {};
  return function (videoID) {
    var o = objs[videoID];
    if (o) {
      var n = new Date();
      if (n - o.timestamp < 30000) { // data is fresh enough (less than 30 secs)
        return Promise.resolve(o.obj);
      }
    }
    return getInfo(videoID)
      .then(postInfo)
      .then(extractFormats)
      .then(verify)
      .then(sortFormats)
      .then(function (info) {
        objs[videoID] = {
          obj: info,
          timestamp: new Date()
        }
        return info;
      });
  }
})();
