var {Cc, Ci, Cu}  = require('chrome'),
    _             = require("sdk/l10n").get,
    sp            = require("sdk/simple-prefs"),
    prefs         = sp.prefs;

Cu.import("resource://gre/modules/FileUtils.jsm");
//One input for conversion, two inputs for combining files
exports.ffmpeg = function (callback, pointer, input1, input2) {
  if (input1 && typeof (input1) == "string") {
    input1 = new FileUtils.File(input1);
  }
  if (input2 && typeof (input2) == "string") {
    input2 = new FileUtils.File(input2);
  }

  var ffmpegPath = prefs.ffmpegPath;
  if (!ffmpegPath) {
    throw _("err12");
  }
  // Create a temporary folder
  var ext1 = /([^\.]*)$/.exec(input1.leafName);
  ext1 = ext1 ? ext1[1] : "";
  if (input2) {
    var ext2 = /([^\.]*)$/.exec(input2.leafName);
    ext2 = ext2 ? ext2[1] : "";
  }
  var dir = FileUtils.getDir("TmpD", [Math.random().toString(36).substring(7)]);
  input1.copyTo(dir, "a." + ext1);
  var tmp1 = new FileUtils.File(dir.path);
  tmp1.append("a." + ext1);
  var tmp2;
  if (input2) {
    input2.copyTo(dir, "a." + ext2);
    tmp2 = new FileUtils.File(dir.path);
    tmp2.append("a." + ext2);
  }

  ffmpeg = new FileUtils.File(ffmpegPath);
  if (!ffmpeg.exists()) {
    throw _("err13") + " " + ffmpeg.path;
    return;
  }
  var process = Cc["@mozilla.org/process/util;1"]
    .createInstance(Ci.nsIProcess);
  process.init(ffmpeg);
  var args;
  if (!input2) {
    args = prefs.ffmpegInputs.split(" ");
    args.forEach(function (arg, index) {
      args[index] = arg
        .replace("%input", tmp1.path)
        .replace("%output", tmp1.path.replace(/\.+[^\.]*$/, "-output"));
    });
  }
  else {
    args = prefs.ffmpegInputs2.split(" ");
    args.forEach(function (arg, index) {
      args[index] = arg
        .replace("%audio", tmp1.path)
        .replace("%video", tmp2.path)
        .replace("%output", tmp1.path.replace(/\.+[^\.]*$/, "-output"));
    });
  }
  process.runAsync(args, args.length, {
    observe: function(subject, topic, data) {
      var outExt = /\%output\.(\S+)/.exec(prefs[input2 ? "ffmpegInputs2" : "ffmpegInputs"]);
      outExt = outExt ? outExt[1] : "";
      var tmp2 = new FileUtils.File(dir.path);
      tmp2.append("a-output." + outExt);
      var name = (input2 || input1).leafName.replace(/\.+[^\.]*$/, "");
      // Make sure file with the same name doesn't exist
      var tmp3 = new FileUtils.File(input1.parent.path);
      tmp3.append(name + "." + outExt);
      if (tmp3.exists()) {
        name += "-converted"
      }
      if (tmp2.exists()) {
        tmp2.copyTo(input1.parent, name + "." + outExt);
      }
    
      if (callback) {
        callback.apply(pointer, []);
      }
    }
  });
}