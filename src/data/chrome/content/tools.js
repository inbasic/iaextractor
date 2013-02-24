var Cc = Components.classes,
    Ci = Components.interfaces,
    Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");

var $ = function (id) {
  return document.getElementById(id);
}

var bundle;
var config = {
  url: {
    queue: "http://api.online-convert.com/get-queue",
    token: "http://add0n.com/online-convert.php?request=token&userAgent=" + btoa(navigator.userAgent),
    status: "http://add0n.com/online-convert.php?request=status&hash="
  }
}
/** Report **/
function report (msg) {
  var info = $("info");
  info.appendItem(msg);
  info.ensureIndexIsVisible(info.childNodes.length - 1);
}

/** File Drag & Drop for Tab1 **/
var drag1 = {
  checkDrag: function (event) {
    var isFile = event.dataTransfer.types.contains("application/x-moz-file");
    if (isFile) {
      event.preventDefault();
    }
  },
  doDrop: function(event) {
    var dropFile = event.dataTransfer.mozGetDataAt("application/x-moz-file", 0);
    if (dropFile instanceof Components.interfaces.nsIFile) {
      if (!/\.aac/i.test(dropFile.leafName)) {
        alert(bundle.getString("err7"));
        return;
      }
      $("p1").removeAttribute("mod");
      $("p2").removeAttribute("mod");
      $("p3").removeAttribute("mod");
      $("p4").removeAttribute("mod");
      $("p5").removeAttribute("mod");
      $("p4-2").value = "-";
      convert (dropFile.path, $("bitrate").selectedItem.value, function (state, msg, err) {
        switch (state) {
          case 0:
            $("p1").setAttribute("mod", err ? "failed" : "progress");
            break;
          case 1:
            $("p1").setAttribute("mod", "done");
            $("p2").setAttribute("mod", err ? "failed" : "progress");
            break;
          case 2:
            $("p2").setAttribute("mod", "done");
            $("p3").setAttribute("mod", err ? "failed" : "progress");
            break;
          case 3:
            $("p3").setAttribute("mod", "done");
            $("p4").setAttribute("mod", err ? "failed" : "progress");
            $("p4-2").value = msg;
            break;
          case 4:
            $("p4").setAttribute("mod", "done");
            $("p5").setAttribute("mod", err ? "failed" : "progress");
            var dl = new exports.get({
              progress: function (){},
              done: function (dl) {
                $("p5").setAttribute("mod", "done");
              },
              error: function (dl) {
                $("p5").setAttribute("mod", "failed");
              }
            });
            var audioName = dropFile.leafName.replace(/\.+[^\.]*$/, ".mp3");
            audioName += /\./.test(audioName) ? "" : ".mp3";
            var oFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
            oFile.initWithPath(dropFile.parent.path);
            oFile.append(audioName);
            oFile.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);
            dl(msg, oFile);
            break;
        }
        if (err) {
          alert(err);
        }
      });
    }
  }
}

/** File Drag & Drop for Tab1 **/
var drag2 = {
  checkDrag: function (event) {
    var isFile = event.dataTransfer.types.contains("application/x-moz-file");
    if (isFile) {
      event.preventDefault();
    }
  },
  doDrop: function(event) {
    var dropFile = event.dataTransfer.mozGetDataAt("application/x-moz-file", 0);
    if (dropFile instanceof Components.interfaces.nsIFile) {
      if (!/\.flv/i.test(dropFile.leafName)) {
        alert(bundle.getString("err8"));
        return;
      }
      var audioName = dropFile.leafName.replace(/\.+[^\.]*$/, ".aac");
      audioName += /\./.test(audioName) ? "" : ".aac";
      var oFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
      oFile.initWithPath(dropFile.parent.path);
      oFile.append(audioName);
      oFile.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);
      exports.perform(dropFile, oFile, function (e) {
        if (e) {
          alert(e);
        }
      });
    }
  }
}

/** To MP3**/
function convert(path, bitrate, callback, pointer) {
  function makeDoc (arr) {
    function _makeDoc (doc, parent, arr) {
      var node
      if (typeof(arr[0]) == "string") {
          node = doc.createElement(arr[0]);
      }
      else {
        for(i in arr) {
          _makeDoc(doc, parent, arr[i]);
        }
        return;
      }

      if (typeof(arr[1]) == "string")
        node.textContent = arr[1];
      else
        _makeDoc(doc, node, arr[1]);

      parent.appendChild(node)
      return node;
    }
    var doc = document.implementation.createDocument("", "", null);
    _makeDoc(doc, doc, arr);
    return (new XMLSerializer().serializeToString(doc));
  }
    
  function send (url, form, callback, pointer) { //callback(req, err)
    var req = new XMLHttpRequest();
    req.open('POST', url, true);
    req.onreadystatechange = function (aEvt) {
      if (req.readyState == 4) {
        if(req.status == 200) {
          callback.apply(pointer, [req]);
        }
        else {
          callback.apply(pointer, [null, bundle.getString("err0") + req.status]);
        }
      }
    }
    var formdata = new FormData();
    form.forEach(function (data){
      formdata.append(data[0], data[1]); 
    });
    req.send(formdata);
  }
  
  if (callback) callback.call(pointer, 0);
  send (config.url.token, [], function (req, err) {
    if (err) {
      if (callback) callback.call(pointer, 0, null, err);
      return;
    }
    var parser = new DOMParser();
    var doc = parser.parseFromString(req.responseText,'text/xml');
    var token = doc.getElementsByTagName('token');
    if (!token.length) {
      if (callback) {
        callback.call(pointer, 0, null, 
          bundle.getString("err1") + "\n\n" + 
          doc.getElementsByTagName('message')[0].textContent);
      }
      return;
    }
    token = token[0].textContent;
    var server = doc.getElementsByTagName('server');
    if (!server.length) {
      if (callback) callback.call(pointer, 0, null, bundle.getString("err2"));
      return;
    }
    server = server[0].textContent;
    // Request Convert
    if (callback) callback.call(pointer, 1);
    var file = File(path);
    xml = makeDoc (['queue', [
      ['token', token], 
      ['targetType', 'audio'], 
      ['targetMethod', 'convert-to-mp3'], 
      ['format', ['bitrate', bitrate]]
    ]]);
    send(server + '/queue-insert', [['queue', xml], ['file', file]], function (req, err) {
      if (err) {
        if (callback) callback.call(pointer, 1, null, err);
        return;
      }
      doc = parser.parseFromString(req.responseText,'text/xml');
      var msgUpload = doc.getElementsByTagName('message');
      if (!msgUpload.length) {
        if (callback) callback.call(pointer, 1, null, bundle.getString("err3"));
        return;
      }
      msgUpload = msgUpload[0].textContent;
      
      var hash = doc.getElementsByTagName('hash');
      if (!hash.length) {
        if (callback) callback.call(pointer, 1, null, bundle.getString("err4"));
        return;
      }
      hash = hash[0].textContent;
      // Check conversion status
      if (callback) callback.call(pointer, 2);
      
      function check () {
        send(config.url.status + hash, [], function (req, err) {
          if (err) {
            if (callback) callback.call(pointer, 3, null, err);
            return;
          }
          doc = parser.parseFromString(req.responseText,'text/xml');
          var msgStatus = doc.getElementsByTagName('message');
          if (!msgStatus.length) {
            if (callback) callback.call(pointer, 3, null, bundle.getString("err5"));
            return;
          }
          msgStatus = msgStatus[0].textContent;
          var code = doc.getElementsByTagName('code');
          if (!code.length) {
            if (callback) callback.call(pointer, 3, null, bundle.getString("err6"));
            return;
          }
          code = code[0].textContent;
          
          if (callback) callback.call(pointer, 3, msgStatus, code == "105");
          
          if (code == "101" || code == "102" || code == "104") {
            setTimeout(function () {check()}, 500);
          }
          else if (code == "100") {
            if (callback) callback.call(pointer, 4, server + '/download-file/' + hash);
          }
          else {
            if (callback) callback.call(pointer, 4, null, msgStatus);
            return;
          }
        });
      }
      check();
    });
  });
};

window.addEventListener("load", function () {
  bundle = $("bundle");
}, false);