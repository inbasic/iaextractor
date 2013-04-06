var $ = function (id) {
  return document.getElementById(id);
}

var mMake = function (doSize) {
  var sets = [], numberOfItems, activeSet = 0, title;
  //Position
  var players = document.getElementsByTagName("embed");
  if (players.length) {
    var rect = players[0].getBoundingClientRect ();
    document.body.insertAdjacentHTML("afterbegin", 
    '<div id="iaextractor-menu" class="iaextractor-div">' +
    '  <span class="iaextractor-title">Download Video</span> ' +
    '  <input type="submit" id="iaextractor-close" ' + 
    '    style="position: absolute; top: 0px; right: 0px;" value="">' +
    '  <div id="iaextractor-items"></div> ' +
    '  <div class="iaextractor-bottom"> ' +
    '    <input type="submit" id="iaextractor-previous" disabled="true" value="">' +
    '    <input type="submit" id="iaextractor-next" value="">' +
    '  </div>' +
    '</div>');
    var width = 320 + (doSize ? 40 : 0);
    $("iaextractor-menu").setAttribute("style", 
      'top: ' + (rect.top + window.scrollY) + 'px;' + 
      'left: ' + (rect.left + (rect.width - width)) + 'px;' + 
      'width: ' + width + 'px;' + 
      'height: ' + (rect.height) + 'px;">'
    );
    $("iaextractor-items").setAttribute("style", 'height: ' + (rect.height - 85) + 'px;');
    $("iaextractor-items").addEventListener('click', function (e) {
      var p = e.originalTarget;
      if (p.localName != "p") {
        return true;
      }
      e.preventDefault();
      e.stopPropagation ();
      self.port.emit("download", p.getAttribute("fIndex"));
      return false;
    });
    $("iaextractor-close").addEventListener('click', function (e) {
      e.originalTarget.parentNode.parentNode.removeChild(e.originalTarget.parentNode);
    });
    $('iaextractor-previous').addEventListener('click', function () {
      make.previous();
    });
    $('iaextractor-next').addEventListener('click', function () {
      make.next();
    });
    
    numberOfItems = Math.floor((rect.height - 62 - 10) / 51);
  }

  return {
    init: function (vInfo) {
      /**
       * @param {Number} index of YouTube link in vInfo object
       */
      function item (fIndex, txt, url) {
        var a = document.createElement("a");
        a.setAttribute("class", "iaextractor-link");
        a.setAttribute("href", url);
        var p = document.createElement("p");
        p.setAttribute("class", "iaextractor-item");
        p.setAttribute("fIndex", fIndex);
        p.textContent = txt;
        a.appendChild(p);
        $("iaextractor-items").appendChild(a);
      }
      // Split formats into lists
      if (vInfo) {
        while (vInfo.formats.length) {
          sets.push(vInfo.formats.splice(0, numberOfItems));
        }
        title = vInfo.title;
      }
      // Clear old list
      while (document.getElementsByClassName("iaextractor-link").length) {
        var elem = document.getElementsByClassName("iaextractor-link")[0];
        elem.parentNode.removeChild(elem);
      }
      //Add new list
      function map (str) {
        switch (str) {
          case "hd720":
            return "HD720p";
          case "hd1080":
            return "HD1080p";
          default:
            return str.toLowerCase().replace(/./, function($1) {return $1.toUpperCase();});
        }
      }
      sets[activeSet].forEach(function (format, index) {
        var url = format.url + "&keepalive=yes&title=" + encodeURIComponent(title);
        item (
          activeSet * numberOfItems + index,
          format.container.toUpperCase() + " " + map(format.quality) + 
          " - " + 
          format.audioEncoding.toUpperCase() + " " + format.audioBitrate + "K", 
          url
        );
        if (doSize) {
          self.port.emit("file-size-request", url, index);
        }
      });
      if (sets.length == 1) {
        $('iaextractor-next').disabled = true;
      }
    },
    next: function () {
      activeSet += 1;
      this.init();
      $('iaextractor-previous').disabled = false;
      if (activeSet + 1 == sets.length) {
        $('iaextractor-next').disabled = true;
      }
    },
    previous: function () {
      activeSet -= 1;
      this.init();
      $('iaextractor-next').disabled = false;
      if (activeSet == 0) { 
        $('iaextractor-previous').disabled = true;
      }
    }
  }
}

//Deactivate old workers
function destroy() {
  //Remove old elements
  while (document.getElementsByClassName("iaextractor-div").length) {
    var elem = document.getElementsByClassName("iaextractor-div")[0];
    elem.parentNode.removeChild(elem);
  }
  //Remove event Listeners
  document.documentElement.removeEventListener("iaextractor-next", next, true);
  document.documentElement.removeEventListener("iaextractor-previous", previous, true);
}
var event = document.createEvent('CustomEvent');
event.initCustomEvent('detach', true, true, {});
document.documentElement.dispatchEvent(event);
document.documentElement.addEventListener("detach", destroy, true);

var make = new mMake(self.options.doSize);
self.port.on("info", function(vInfo) {
  if (!$("iaextractor-items")) return;
  make.init(vInfo);
});
self.port.on("file-size-response", function(url, size, index) {
  var a = $("iaextractor-items").childNodes[index];
  var p = a.childNodes[0];
  //Reject wrong file size
  if (a.getAttribute("href") != url) {
    return;
  }
  p.textContent += " - " + size;
});