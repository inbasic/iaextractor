'use strict';

var ffmpeg = {
  sep: navigator.platform.startsWith('Win') ? '\\' : '/'
};
ffmpeg.convert = function (command, args, dictionary) {
  return new Promise((resolve, reject) => {
    args = args.split(/\s/).map(s => {
      Object.keys(dictionary).forEach(key => s = s.replace(key, dictionary[key]));
      return s;
    });
    chrome.runtime.sendNativeMessage('com.add0n.node', {
      cmd: 'exec',
      kill: true,
      command,
      arguments: args
    }, obj => {
      console.error(obj);
      if (!obj || obj.error || (obj.code && obj.code !== 0)) {
        reject(new Error(obj ? obj.error || obj.stderr : 'error_12'));
      }
      else {
        resolve();
      }
    });
  });
};

ffmpeg.parent = (path) => {
  return path.split(ffmpeg.sep).slice(0, -1).join(ffmpeg.sep);
};

ffmpeg.extract = (path) => {
  return path.split(ffmpeg.sep).pop().split('.');
};

ffmpeg.resolve = (path, name, extension) => {
  function check (files, name, extension, index = 0) {
    let leafname = name.replace(/\-\d+$/, '') + (index ? '-' + index : '') + '.' + extension;
    for (let n of files) {
      if (n.endsWith(leafname)) {
        return check(files, name, extension, index + 1);
      }
    }
    return leafname;
  }

  return new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage('com.add0n.node', {
      cmd: 'dir',
      path
    }, obj => {
      if (!obj || obj.error || (obj.code && obj.code !== 0)) {
        reject(new Error(obj ? obj.error || obj.stderr : 'error_10'));
      }
      else {
        resolve(path + ffmpeg.sep + check(obj.files, name, extension));
      }
    });
  });
};

ffmpeg.remove = files => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage('com.add0n.node', {
      cmd: 'remove',
      files
    }, obj => {
      if (!obj || obj.error || (obj.code && obj.code !== 0)) {
        reject(new Error(obj ? obj.error || obj.stderr : 'error_11'));
      }
      else {
        resolve();
      }
    });
  });
};
