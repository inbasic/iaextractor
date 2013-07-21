var $ = (function() {
  var cache = [];
  return function(id) {
    if (cache[id]) {
      return cache[id];
    }
    cache[id] = document.getElementById(id);
    return cache[id];
  }
})();

// Make new menu
var mMake = function (doSize) {
  var sets = [], numberOfItems, activeSet = 0, title, currentIndex;
  //Flash player
  var players = document.getElementsByTagName("embed"); 
  //HTML5 player
  if (!players.length) {
    tmp = document.getElementsByTagName("video");
    if (tmp.length) {
      players = [tmp[0].parentNode.parentNode];
    }
  }
  if (players.length) {
    var player = players[0];
    var rect = player.getBoundingClientRect();

    player.insertAdjacentHTML("afterend", 
    '<div id="iaextractor-menu">' +
    '  <span type="title">Download Video</span> ' +
    '  <span id="iaextractor-close" class="iaextractor-button"><i></i></span>' +
    '  <span id="iaextractor-sort" class="iaextractor-button"><i></i></span>' +
    '  <span id="iaextractor-icon" class="iaextractor-button" disabled="true"><i></i></span>' +
    '  <span id="iaextractor-settings" class="iaextractor-button"><i></i></span>' +
    '  <div id="iaextractor-items"></div> ' +
    '  <span type="footer"> ' +
    '    <span id="iaextractor-previous" class="iaextractor-button" disabled="true"><i></i></span>' +
    '    <span id="iaextractor-next" class="iaextractor-button"><i></i></span>' +
    '  </span>' +
    '  <ul id="iaextractor-downloader">' + 
    '    <li>Firefox downloader</li>' + 
    '    <li>Flashgot</li>' + 
    '    <li>DownThemAll</li>' + 
    '    <li>DownThemAll (Turbo)</li>' + 
    '  </ul>' +
    '</div>');

    var width = 350 + (doSize ? 40 : 0);
    $("iaextractor-menu").setAttribute("style", 
      ' top: -' + (rect.height + 2) + 'px;' + 
      ' left: ' + (rect.width - width) + 'px;' + 
      ' width: ' + width + 'px;'
    );
    $("iaextractor-items").setAttribute("style", 'height: ' + (rect.height - 85) + 'px;');
    var downloader = $("iaextractor-downloader");
    $("iaextractor-items").addEventListener('click', function (e) {
      var elem = e.originalTarget;
      //Dropdown
      var dropdown = (elem.localName == "span") ? elem : elem.parentNode;
      if (dropdown.className.indexOf("iaextractor-dropdown") !== -1) {
        var tmp = dropdown.getBoundingClientRect();
        downloader.style.left = tmp.left + "px";
        downloader.style.top = (tmp.top + 30) + "px";
        downloader.style.display = "block";
        currentIndex = parseInt(dropdown.parentNode.children[1].getAttribute("fIndex"));
      
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      //Direct Download
      if (elem.localName != "span" || !elem.hasAttribute("fIndex")) {
        return true;
      }
      self.port.emit("download", elem.getAttribute("fIndex"));
      
      e.preventDefault();
      e.stopPropagation();
      return false;
    }, false);
    downloader.addEventListener('click', function (e) {
      switch (e.originalTarget) {
        case downloader.children[0]:
          self.port.emit("download", currentIndex);
          break;
        case downloader.children[1]:
          var href = $("iaextractor-items").children[currentIndex].getAttribute("href");
          self.port.emit("flashgot", title, href);
          break;
        case downloader.children[2]:
          var href = $("iaextractor-items").children[currentIndex].getAttribute("href");
          self.port.emit("downThemAll", href, false);
          break;
        case downloader.children[3]:
          var href = $("iaextractor-items").children[currentIndex].getAttribute("href");
          self.port.emit("downThemAll", href, true);
      }
      downloader.style.display = "none";
    }, false);
    $("iaextractor-close").addEventListener('click', function (e) {
      var elem = $("iaextractor-menu");
      elem.parentNode.removeChild(elem);
    }, false);
    $('iaextractor-previous').addEventListener('click', function () {
      make.previous();
    }, false);
    $('iaextractor-next').addEventListener('click', function () {
      make.next();
    }, false);
    window.addEventListener("click", function (e) {
      var elem = e.originalTarget;
      if (elem != downloader && elem.parentNode != downloader) {
        downloader.style.display = "none";
      }
    });
    
    numberOfItems = Math.floor((rect.height - 62 - 10) / 51);
  }

  return {
    init: function (vInfo) {
      /**
       * @param {Number} index of YouTube link in vInfo object
       */
      function item (fIndex, txt, url) {
        $("iaextractor-items").insertAdjacentHTML("beforeend", 
          '<a class="iaextractor-link" href="' + url + '">' + 
          '  <div>' +
          '    <span class="iaextractor-button iaextractor-download-icon" disabled="true"><i></i></span>' + 
          '    <span style="margin-left: 40px;" fIndex="' + fIndex + '">' +
                txt +
          '    </span>' +
          '    <span class="iaextractor-button iaextractor-dropdown"><i></i></span>' +
          '  </div>' +
          '</a>'
        );
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
      });
      if (doSize) {
        window.setTimeout(function () {
          sets[activeSet].forEach(function (format, index) {
            self.port.emit("file-size-request", format.url, index);
          });
        }, 400);
      }
      if (sets.length == 1) {
        $('iaextractor-next').setAttribute("disabled", true);
      }
    },
    next: function () {
      activeSet += 1;
      this.init();
      $('iaextractor-previous').removeAttribute("disabled");
      if (activeSet + 1 == sets.length) {
        $('iaextractor-next').setAttribute("disabled", true)
      }
    },
    previous: function () {
      activeSet -= 1;
      this.init();
      $('iaextractor-next').removeAttribute("disabled");
      if (activeSet == 0) { 
        $('iaextractor-previous').setAttribute("disabled", true);
      }
    }
  }
}

//Deactivate old workers
function destroy() {
  //Remove old elements
  while (document.getElementById("iaextractor-menu")) {
    var elem = document.getElementById("iaextractor-menu");
    elem.parentNode.removeChild(elem);
  }
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
  if (!a) return;
  var span = a.children[0].children[1];
  //Rejecting wrong file size
  if (a.getAttribute("href").indexOf(url) === -1) {
    return;
  }
  span.textContent += " - " + size;
});