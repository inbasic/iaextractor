'use strict';

var {Ci, Cu}  = require('chrome'),
    _             = require('sdk/l10n').get,
    sp            = require('sdk/simple-prefs'),
    prefs         = sp.prefs,
    notify        = require('./misc').notify,
    childProcess = require('sdk/system/child_process');

var {FileUtils} = Cu.import('resource://gre/modules/FileUtils.jsm');
/*
 * inputs: array of input files, for video and audio combiner the second input is the video file
 * options: mode (combine, extract)
 * options: doRemux overwrite '- DASH' filename requirement
 * options: deleteInputs delete input files
 */

function isError(str) {
  return str.indexOf('Error') !== -1 ||
    str.indexOf('incorrect codec parameters') !== -1;
}

exports.ffmpeg = function (inputs, options, callback, pointer) {
  var extensions = [], outputLocation;
  // Is FFmpeg available?
  var ffmpegPath = prefs.ffmpegPath;
  if (!ffmpegPath) {
    throw _('err12');
  }
  //
  if (!options.mode) {
    options.mode = inputs.length === 2 ? 'combine' : 'extract';
  }
  // Converting inputs to array
  if (typeof (inputs) === 'string') {
    inputs = [inputs];
  }
  // Converting inputs to nsiFile
  inputs.forEach (function (input, index) {
    if (typeof (input) === 'string') {
      inputs[index] = new FileUtils.File(input);
    }
    var extension = /([^\.]*)$/.exec(inputs[index].leafName);
    extensions[index] = extension ? extension[1] : '';
  });
  // FFmpeg command
  var cmd;
  if (options.mode === 'combine') {
    cmd = prefs.ffmpegInputs4;
  }
  else if ((inputs[0].leafName.indexOf(' - DASH') !== -1 && prefs.doRemux) || options.doRemux) {
    cmd = prefs.ffmpegInputs3;
  }
  else {
    cmd = prefs.ffmpegInputs;
  }
  var tmp = /\-output\-location \"(.*)\"/.exec (cmd);
  if (tmp && tmp.length) {
    outputLocation = new FileUtils.File(tmp[1]);
    cmd = cmd.replace(/\-output\-location \".*\"/, '');
  }
  // Determining output file extension
  if (options.mode === 'combine') { // video and audio combiner
    extensions[2] = extensions[1];
  }
  else {
    if (extensions[0] === 'mp4') {
      extensions[2] = 'm4a';
    }
    else if (extensions[0] === 'webm') {
      extensions[2] = options.extension ? options.extension : 'ogg';
    }
    else {
      extensions[2] = extensions[0];
    }
  }
  // has user determined the output extension?
  var tmp2 = /\%output\.(\S+)/.exec(cmd);
  if (tmp2 && tmp2.length) {
    extensions[2] = tmp2[1];
    cmd = cmd.replace(/\%output\.\S+/, '%output');
  }

  // Creating a temporary folder and copying input files
  var output = (function () {
    let parent = outputLocation || inputs[0].parent;
    let a = new FileUtils.File(parent.path);
    let name = (inputs[1] || inputs[0]).leafName.replace(' - DASH', '').replace(/\.+[^\.]*$/, '');
    a.append(name + '.' + extensions[2]);
    a.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
    let path = a.path;
    a.remove(false);
    return path;
  })();

  // Preparing FFmpeg command for execution
  var args = cmd.trim().replace(/\s\s+/g, ' ').split(' ');
  args.forEach(function (arg, index) {
    args[index] = arg
      .replace('%audio', inputs[0].path)
      .replace('%input', inputs[0].path)
      .replace('%output', output);

    if (options.mode === 'combine') {
      args[index] = args[index].replace('%video', inputs[1].path);
    }
  });
  // FFmpeg execution
  var ffmpeg = new FileUtils.File(ffmpegPath);
  if (!ffmpeg.exists()) {
    throw _('err13') + ' ' + ffmpeg.path;
  }
  var ww = childProcess.spawn(ffmpeg, args);
  var strout = '', stderr = '';
  ww.stdout.on('data', function (data) {
    strout += data;
  });
  ww.stderr.on('data', function (data) {
    stderr += data;
  });
  ww.on('close', function (code) {
    if (code === 0) {
      if (options.deleteInputs && !isError(stderr)) {
        inputs.forEach(function (input) {
          input.remove(false);
        });
      }
      if (isError(stderr)) {
        notify(_('name'), _('err24') + '\n\n' + stderr.substr(stderr.length - 500));
      }

      if (callback) {
        callback.apply(pointer, []);
      }
    }
    else {
      notify(_('name'), _('err25') + ' ' + code);
    }
  });
};
