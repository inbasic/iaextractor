var _           = require("sdk/l10n").get,
    timer       = require("sdk/timers"),
   {Cc, Ci, Cu} = require('chrome');

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");

/** Read stream **/
function read(iFile, callback, pointer) {
  var data = "",
      uri = NetUtil.ioService.newFileURI(iFile);
      channel = NetUtil.ioService.newChannelFromURI(uri);
      
  channel.asyncOpen({
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIRequestObserver, Ci.nsIStreamListener]),
    onStartRequest: function(request, context) {},
    onDataAvailable: function(request, context, stream, offset, count) {
      data += NetUtil.readInputStreamToString(stream, count);
    },
    onStopRequest: function(request, context, result) {
      callback.apply(pointer, [data])
    }
  }, null);
}

/** Write stream **/
function write (oFile, data) {
  var fileStream = FileUtils.openFileOutputStream(oFile,
    FileUtils.MODE_WRONLY | FileUtils.MODE_CREATE | FileUtils.MODE_TRUNCATE);

  fileStream.write(data, data.length);
  if (fileStream instanceof Ci.nsISafeOutputStream) {
      fileStream.finish();
  } else {
      fileStream.close();
  }
}

/** Extract Audio **/
function extract(stream, callback, pointer) {
  var pointer = 0, audio = "", oldPercent = 0, stack = 0;

  if (stream.slice(0,3) != "FLV") {
     throw Error(_("err1"));
  }
  
  var readInt =    function () { return stream[++pointer].charCodeAt(0);}
  var readByte =   function () { return readInt().toString(16); }
  var read3Bytes = function () { return readInt() * 65536 + readInt() * 256 + readInt();}
  
  pointer = 2;
  var version = readByte();
  var exists = readByte();
  
  if (exists != 5 && exists != 4) {
    throw Error(_("err2"));
  }
  
  pointer = 8
  var _aacProfile, _sampleRateIndex, _channelConfig;
  function oneChunk () {
    pointer += 4; // PreviousTagSize0 skipping

    if (pointer >= stream.length - 1) {
Cc['@mozilla.org/consoleservice;1']
            .getService(Ci.nsIConsoleService)
            .logStringMessage("ooo");
            
            
      if (callback && callback.done) {
        callback.done.apply(pointer, [audio]);
      }
      return;
    }
    
    var tagType = readByte();
    while (tagType != 8) {
      var skip = read3Bytes() + 11;    
      pointer += skip;
      if (pointer >= stream.length - 1) {
        if (callback && callback.done) {
          callback.done.apply(pointer, [audio]);
        }
        return;
      }
      tagType = readByte();
    }
    
    var dataSize = read3Bytes();    
    read3Bytes(); //skip timestamps 
    readByte();   //skip TimestampExtended
    read3Bytes(); //skip streamID
    
    var mediaInfo = readInt(),
        format = mediaInfo >> 4,
        rate = (mediaInfo >> 2) & 0x3,
        bits = (mediaInfo >> 1) & 0x1,
        chans = mediaInfo & 0x1;
    dataSize -= 1;
    
    var chunk = stream.slice(pointer+2, pointer + dataSize + 1);
    // AAC [http://wiki.multimedia.cx/index.php?title=Understanding_AAC]
    if (format == 10) {
      if(stream[pointer+1].charCodeAt(0).toString(16) == 0) { //Header
        var byte1 = stream[pointer+2].charCodeAt(0),
            byte2 = stream[pointer+3].charCodeAt(0);

        _aacProfile = ((byte1 & 0xF8) >> 3) - 1;  //11111000
        _sampleRateIndex = ((byte1 & 0x7) << 1) + //00000111
          ((byte2 & 0x80) >> 7);                  //10000000
        _channelConfig = (byte2 & 0x78) >> 3;     //01111000

        if ((_aacProfile < 0) || (_aacProfile > 3)) {
          throw Error(_("err3"));
        }
        if (_sampleRateIndex > 12) {
          throw Error(_("err4"));
        }
        if (_channelConfig > 6) {
          throw Error(_("err5"));
        }
      }
      else { //Audio data
        var buffer = new ArrayBuffer(8),
            bytes8 = new Uint8Array(buffer),
            bytes32 = new Uint32Array(buffer);
        bytes8[6] = 0xFF;
        bytes8[5] = 0xF1;
        bytes8[4] = (_aacProfile << 6) + (_sampleRateIndex << 2) + ((_channelConfig & 8) << 2);
        bytes32[0] = (_channelConfig & 3) << 30
        bytes32[0] += (chunk.length  + 7) << 13;
        bytes32[0] += 0x7FF << 2;
        audio +=  String.fromCharCode.apply(null, bytes8.subarray(0,7)).split("").reverse().join("");
        audio +=  chunk;
      }
      pointer += dataSize;
    }
    else {
      throw Error(_("err6"));
    }
    if (callback && callback.progress) {
      var percent = pointer/stream.length * 100;
      if (percent > oldPercent + 5) {
        oldPercent = percent;
        callback.progress.apply(pointer, [pointer/stream.length * 100]);
      }
    }
    //async call to prevent stack overflow for long extractions
    stack += 1;
    if (stack == 1000) {
      stack = 0;
      timer.setTimeout(function () {oneChunk();}, 0);
    }
    else {
      oneChunk();
    }
  }
  oneChunk();
}

exports.perform = function (id, iFile, oFile, done, progress, pointer) {
  read(iFile, function (stream) {
    try {
      extract(stream, {
        done: function (audio) {
          write(oFile, audio);
          done.apply(pointer, [id]);
        },
        progress: function (percent) {
          if (progress) {
            progress.apply(pointer, [id, percent]);
          }
        }
      });
    }
    catch(e) {
      write(oFile, e.toString());
      oFile.moveTo(null, oFile.leafName + ".error.log");
      done.apply(pointer, [id, e]);
    }
  });
}