var {Cc, Ci, Cu}  = require('chrome'),
    os            = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS,
    _             = require("sdk/l10n").get,
    timer         = require("sdk/timers"),
    data          = require("sdk/self").data,
    Request       = require("sdk/request").Request,
    tools         = require("./misc"),
    tools         = require("./misc"),
    prefs         = require("sdk/simple-prefs").prefs,
    _prefs        = tools.prefs,
    notify        = tools.notify,
    prompts2      = tools.prompts2,
    download      = require("./download"),
    windows          = {
      get active () { // Chrome window
        return require('sdk/window/utils').getMostRecentBrowserWindow()
      }
    };

Cu.import("resource://gre/modules/Promise.jsm");
Cu.import(data.url("subprocess/subprocess.jsm"));
Cu.import("resource://gre/modules/FileUtils.jsm");

function inWindows () {
  var d = new Promise.defer();
  try {
    var file = FileUtils.getFile("WinD", ["System32", "where.exe"]);
    subprocess.call({
      command:     file,
      arguments:   ['FFmpeg.exe'],
      done: function(result) {
        if (result.exitCode == 0) {
          var path = /\w\:.*FFmpeg\.exe/i.exec(result.stdout);
          if (path) {
            d.resolve(path[0].replace(/\\/g, "\\"));
          }
          else {
            d.reject(Error(_("err23") + " " + result.stdout));
          }
        }
        else {
          d.reject(Error(_("err22") + " " + result.exitCode));
        }
      }
    });
  }
  catch (e) {
    d.reject(Error(_("err21") + " " + e));
  }
  return d.promise;
}
function inLinux () {
  var d = new Promise.defer();
  try {
    var file = FileUtils.File("/usr/bin/which");
    subprocess.call({
      command:     file,
      arguments:   ['ffmpeg'],
      done: function(result) {
        if (result.exitCode == 0) {
          var path = /\/.*ffmpeg/i.exec(result.stdout);
          if (path) {
            d.resolve(path[0]);
          }
          else {
            d.reject(Error(_("err23") + " " + result.stdout));
          }
        }
        else {
          d.reject(Error(_("err22") + " " + result.exitCode));
        }
      }
    });
  }
  catch (e) {
    d.reject(Error(_("err21") + " " + e));
  }
  return d.promise;
}

var where = (os == "WINNT") ? inWindows : inLinux;

/** Install FFmpeg **/
function installFFmpeg () {
  notify(_('name'), _('msg28'));
  var pageURL = "https://downloads.sourceforge.net/project/iaextractor/FFmpeg/%os/ffmpeg"
    .replace("%os", os) + (os == "WINNT" ? ".exe" : "");
  Request({
    url: pageURL,
    onComplete: function (response) {
      if (response.status == 200) {
        var url = (new RegExp(pageURL.replace("https", "http.{0,1}") + "[^\"]*")).exec(response.text);
        if (!url) {
          notify(_('name'), _('err18'));
          return;
        }
        url = url[0].replace(/\&amp\;/g, "&");
        var file = FileUtils.getFile("ProfD", ["ffmpeg" + ((os == "WINNT") ? ".exe" : "")]);
        if (file.exists() && file.fileSize > 10485760) {
          if (!windows.active.confirm(_("msg29"))) return
          file.remove(false);
        }
        file.create(Ci.nsIFile.NORMAL_FILE_TYPE, 755);
        var dr = new download.get({
          done: function (dl) {
            if (file.fileSize > 10485760) {
              _prefs.setComplexFile("ffmpegPath", file);
              prefs.extension = 2;
              //make sure file has executable permission
              timer.setTimeout(function () {
                file.permissions = 0755;  
              }, 500);
              notify(_('name'), _('msg26'));
            }
            else {
              notify(_('name'), _('err19'));
            }
          },
          error: function (dl, e) {
            notify(_('name'), _('err17'));
          }
        });
        dr(url, file);
      }
    }
  }).get();
}
exports.installFFmpeg = installFFmpeg;

exports.checkFFmpeg = function () {
  function runFFmpegInstaller() {
    var tmp = prompts2(_("msg27"), _("msg24"), "", "", _("msg21"), true);
    prefs.showFFmpegInstall = tmp.check.value;
    if (tmp.button == 0) {
      installFFmpeg();
    }
  }
  timer.setTimeout(function () {
    where().then(
      function (path) {
        try {
          var file = new FileUtils.File(path);
          _prefs.setComplexFile("ffmpegPath", file);
          prefs.extension = 2;
        }
        catch (e) {
          runFFmpegInstaller();
        }
      },
      runFFmpegInstaller
    );
  }, 4000);
}