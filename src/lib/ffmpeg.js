var {Cc, Ci, Cu}  = require('chrome'),
    _             = require("sdk/l10n").get,
    sp            = require("sdk/simple-prefs"),
    prefs         = sp.prefs;

Cu.import("resource://gre/modules/FileUtils.jsm");
/*
 * inputs: array of input files, for video and audio combiner the second input is the video file
 * options: mode (combine, extract)
 * options: doRemux overwrite "- DASH" filename requirement
 * options: deleteInputs delete input files
 */
exports.ffmpeg = function (inputs, options, callback, pointer) {
  var extensions = [], tmpFiles = [], outputLocation;
  // Is FFmpeg available?
  var ffmpegPath = prefs.ffmpegPath;
  if (!ffmpegPath) {
    throw _("err12");
  }
  //
  if (!options.mode) {
    options.mode = inputs.length == 2 ? "combine" : "extract";
  }
  // Converting inputs to array
  if (typeof (inputs) == "string") inputs = [inputs];
  // Converting inputs to nsiFile
  inputs.forEach (function (input, index) {
    if (typeof (input) == "string") {
      inputs[index] = new FileUtils.File(input);
    }
    var extension = /([^\.]*)$/.exec(inputs[index].leafName);
    extensions[index] = extension ? extension[1] : "";
  });
  // FFmpeg command
  var cmd;
  if (options.mode == "combine") {
    cmd = prefs.ffmpegInputs4;
  }
  else if ((inputs[0].leafName.indexOf(" - DASH") != -1 && prefs.doRemux) || options.doRemux) {
    cmd = prefs.ffmpegInputs3;
  }
  else {
    cmd = prefs.ffmpegInputs;
  }
  var tmp = /\-output\-location \"(.*)\"/.exec (cmd);
  if (tmp && tmp.length) {
    outputLocation = new FileUtils.File(tmp[1]);
    cmd = cmd.replace(/\-output\-location \".*\"/, "");
  }
  // Determining output file extension
  if (options.mode == "combine") { // video and audio combiner
    extensions[2] = extensions[1];
  }
  else {
    var tmp = /\%output\.(\S+)/.exec(cmd); // has user determined the output extension?
    if (tmp && tmp.length) {
      extensions[2] = tmp[1];
      cmd = cmd.replace(/\%output\.\S+/, "%output");
    }
    else if (extensions[0] == "mp4") {
      extensions[2] = "m4a";
    }
    else if (extensions[0] == "webm") {
      extensions[2] = "ogg";
    }
    else {
      extensions[2] = extensions[0];
    }
  }
  // Creating a temporary folder and copying input files
  var tmpDir = FileUtils.getDir("TmpD", [Math.random().toString(36).substring(7)]);
  inputs.forEach (function (input, index) {
    var name = index + "." + extensions[index];
    input.copyTo(tmpDir, name);
    var tmp = new FileUtils.File(tmpDir.path);
    tmp.append(name);    
    tmpFiles[index] = tmp;
  });
  // Preparing FFmpeg command for execution
  var args = cmd.trim().replace(/\s\s+/g, " ").split(" ");
  args.forEach(function (arg, index) {
    args[index] = arg
      .replace("%audio", tmpFiles[0].path)
      .replace("%input", tmpFiles[0].path)
      .replace("%output", tmpFiles[0].path.replace("0." + extensions[0], "2." + extensions[2]));
      
      if (options.mode == "combine") {
        args[index] = args[index].replace("%video", tmpFiles[1].path);
      }
  });
  // FFmpeg execution
  ffmpeg = new FileUtils.File(ffmpegPath);
  if (!ffmpeg.exists()) {
    throw _("err13") + " " + ffmpeg.path;
    return;
  }
  var process = Cc["@mozilla.org/process/util;1"]
    .createInstance(Ci.nsIProcess);
  process.init(ffmpeg);
  process.runAsync(args, args.length, {
    observe: function(subject, topic, data) {
      var tmp = new FileUtils.File(tmpDir.path);
      tmp.append("2." + extensions[2]);
      if (tmp.exists()) {
        var parent = outputLocation || inputs[0].parent;
        tmp.copyTo(parent, (function () { // Make sure file with the same name doesn't exist
          let a = new FileUtils.File(parent.path);
          let name = (inputs[1] || inputs[0]).leafName.replace(" - DASH", "").replace(/\.+[^\.]*$/, "");
          a.append(name + "." + extensions[2]);
          a.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
          return a.leafName;
        })());
      }
    
      if (options.deleteInputs) {
        inputs.forEach(function (input) {
          input.remove(false);
        });
      }
    
      if (callback) {
        callback.apply(pointer, []);
      }
    }
  });
}