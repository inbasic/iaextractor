'use strict';

var {Cc, Ci, Cu}  = require('chrome'),
    os            = Cc['@mozilla.org/xre/app-info;1'].getService(Ci.nsIXULRuntime).OS,
    arch          = Cc['@mozilla.org/xre/app-info;1'].getService(Ci.nsIXULRuntime).is64Bit ? 'x64' : 'ia32',
    _             = require('sdk/l10n').get,
    timer         = require('sdk/timers'),
    Request       = require('sdk/request').Request,
    tools         = require('./misc'),
    tools         = require('./misc'),
    prefs         = require('sdk/simple-prefs').prefs,
    childProcess  = require('sdk/system/child_process'),
    {defer, resolve, reject} = require('sdk/core/promise'),
    _prefs        = tools.prefs,
    notify        = tools.notify,
    prompts2      = tools.prompts2,
    download      = require('./download'),
    windows          = {
      get active () { // Chrome window
        return require('sdk/window/utils').getMostRecentBrowserWindow();
      }
    };

var {FileUtils} = Cu.import('resource://gre/modules/FileUtils.jsm');

function inWindows () {
  var d = defer();
  try {
    var file = FileUtils.getFile('WinD', ['System32', 'where.exe']), stderr = '', stdout = '';

    var win = childProcess.spawn(file, ['FFmpeg.exe']);
    win.stdout.on('data', function (data) {
      stdout += data;
    });
    win.stderr.on('data', function (data) {
      stderr += data;
    });
    win.on('close', function (code) {
      if (code === 0) {
        var path = /\w\:.*FFmpeg\.exe/i.exec(stdout);
        if (path) {
          d.resolve(path[0].replace(/\\/g, '\\'));
        }
        else {
          d.reject(Error(_('err23') + ' ' + stdout + ' ' + stderr));
        }
      }
      else {
        d.reject(Error(_('err22') + ' ' + code));
      }
    });
  }
  catch (e) {
    d.reject(Error(_('err21') + ' ' + e));
  }
  return d.promise;
}
function inLinux () {
  var {env} = require('sdk/system/environment');
  var locs = env.PATH.split(':');
  locs.push('/usr/local/bin');
  locs = locs.filter((o, i, l) => l.indexOf(o) === i);
  for (var i = 0; i < locs.length; i++) {
    var file = FileUtils.File(locs[i]);
    file.append('ffmpeg');
    if (file.exists()) {
      return resolve(file.path);
    }
  }
  return reject(Error(_('err21') + ' Not Found'));
}

var where = (os === 'WINNT') ? inWindows : inLinux;

/** Install FFmpeg **/
function installFFmpeg () {
  notify(_('name'), _('msg28'));

  var file = FileUtils.getFile('ProfD', ['ffmpeg' + ((os === 'WINNT') ? '.exe' : '')]);
  if (file.exists() && file.fileSize > 10485760) {
    if (!windows.active.confirm(_('msg29'))) {
      return;
    }
    file.remove(false);
  }
  file.create(Ci.nsIFile.NORMAL_FILE_TYPE, 755);

  new Request({
    url: 'https://api.github.com/repos/inbasic/ffmpeg/releases/latest',
    onComplete: function (response) {
      if (response.status === 200) {
        let json = response.json;
        if (json) {
          let assets = json.assets;
          if (assets) {
            let entry = assets.filter(obj => obj.name.indexOf(os === 'WINNT' ? 'win32' : os.toLowerCase()) !== -1 && obj.name.indexOf(arch) !== -1);
            if (entry.length) {
              var dr = new download.get({
                done: function () {
                  if (file.fileSize > 10485760) {
                    _prefs.setComplexFile('ffmpegPath', file);
                    prefs.extension = 2;
                    //make sure file has executable permission
                    timer.setTimeout(() => file.permissions = 755, 500);
                    notify(_('name'), _('msg26'));
                  }
                  else {
                    notify(_('name'), _('err19'));
                  }
                },
                error: () => notify(_('name'), _('err17'))
              });
              dr(entry[0].browser_download_url, file);
            }
            else {
              notify(_('name'), 'externals.js -> install -> cannot find a suitable FFmpeg for your OS');
            }
          }
          else {
            notify(_('name'), 'externals.js -> install -> response does not have any asset');
          }
        }
        else {
          notify(_('name'), 'externals.js -> install -> response is not a JSON object');
        }
      }
      else {
        notify(_('name'), `install -> cannot connect to server; code: ${response.status}`);
      }
    }
  }).get();
}
exports.installFFmpeg = installFFmpeg;

exports.checkFFmpeg = function () {
  function runFFmpegInstaller() {
    var tmp = prompts2(_('msg27'), _('msg24'), '', '', _('msg21'), true);
    prefs.showFFmpegInstall = tmp.check.value;
    if (tmp.button === 0) {
      installFFmpeg();
    }
  }
  timer.setTimeout(function () {
    where().then(
      function (path) {
        try {
          var file = new FileUtils.File(path);
          _prefs.setComplexFile('ffmpegPath', file);
          prefs.extension = 2;
        }
        catch (e) {
          runFFmpegInstaller();
        }
      },
      runFFmpegInstaller
    );
  }, 4000);
};
