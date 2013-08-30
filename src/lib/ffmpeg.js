var {Cc, Ci, Cu}  = require('chrome'),
    _             = require("sdk/l10n").get,
    sp            = require("sdk/simple-prefs"),
    prefs         = sp.prefs;

Cu.import("resource://gre/modules/FileUtils.jsm");
exports.ffmpeg = function (input, callback, pointer) {
  if (typeof (input) == "string") {
    input = new FileUtils.File(input);
  }

  var ffmpegPath = prefs.ffmpegPath;
  if (!ffmpegPath) {
    throw _("err12");
  }
  // Create a temporary folder
  var ext = /([^\.]*)$/.exec(input.leafName);
  ext = ext ? ext[1] : "";
  var dir = FileUtils.getDir("TmpD", [Math.random().toString(36).substring(7)]);
  input.copyTo(dir, "a." + ext);
  var tmp = new FileUtils.File(dir.path);
  tmp.append("a." + ext);

  ffmpeg = new FileUtils.File(ffmpegPath);
  if (!ffmpeg.exists()) {
    throw _("err13") + " " + ffmpeg.path;
    return;
  }
  var process = Cc["@mozilla.org/process/util;1"]
    .createInstance(Ci.nsIProcess);
  process.init(ffmpeg);
  var args = prefs.ffmpegInputs.split(" ");
  args.forEach(function (arg, index) {
    args[index] = arg
      .replace("%input", tmp.path)
      .replace("%output", tmp.path.replace(/\.+[^\.]*$/, ""));
  });
  
  process.runAsync(args, args.length, {
    observe: function(subject, topic, data) {
      var outExt = /\%output\.(\S+)/.exec(prefs.ffmpegInputs);
      outExt = outExt ? outExt[1] : "";
      var tmp2 = new FileUtils.File(dir.path);
      tmp2.append("a." + outExt);
      if (tmp2.exists()) {
        tmp2.copyTo(input.parent, input.leafName.replace(ext, outExt));
      }
    
      if (callback) {
        callback.apply(pointer, []);
      }
    }
  });
}