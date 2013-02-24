var $ = function (id) {
  return document.getElementById(id);
}

var mMake = function () {
  var sets = [], numberOfItems, activeSet = 0, title;
  //Position
  var players = document.getElementsByTagName("embed");
  if (players.length) {
    var rect = players[0].getBoundingClientRect ();
    document.body.insertAdjacentHTML("afterbegin", 
    '<div id="iaextractor-menu" class="iaextractor-div" style="' + 
    '  top: ' + (rect.top + window.scrollY) + 'px;' + 
    '  left: ' + (rect.left + rect.width/2) + 'px;' + 
    '  width: ' + (rect.width/2) + 'px;' + 
    '  height: ' + (rect.height) + 'px;">' +
    '  <span class="iaextractor-title">Download Video</span> ' +
    '  <input type="submit" id="iaextractor-close" ' + 
    '    style="position: absolute; top: 0px; right: 0px;"' + 
    '    value=""' + 
    '    onclick="this.parentNode.parentNode.removeChild(this.parentNode)">' +
    '  <div id="iaextractor-items" style="height: ' + (rect.height - 85) + 'px;"></div> ' +
    '  <div class="iaextractor-bottom"> ' +
    '    <input type="submit" id="iaextractor-previous" disabled="true" value=""' + 
    '      onclick="var event = document.createEvent(\'CustomEvent\');' + 
    '               event.initCustomEvent(\'iaextractor-previous\', true, true, {});' + 
    '               document.documentElement.dispatchEvent(event);">' +
    '    <input type="submit" id="iaextractor-next" value=""' + 
    '      onclick="var event = document.createEvent(\'CustomEvent\');' +
    '               event.initCustomEvent(\'iaextractor-next\', true, true, {});' + 
    '               document.documentElement.dispatchEvent(event);">' +
    '  </div>' +
    '</div>');
    numberOfItems = Math.floor((rect.height - 62 - 10) / 51);
  }

  return {
    init: function (vInfo) {
      function item (txt, url, name) {
        var a = document.createElement("a");
        a.setAttribute("class", "iaextractor-link");
        a.setAttribute("href", url + "&keepalive=yes&title=" + encodeURI(name));
        var p = document.createElement("p");
        p.setAttribute("class", "iaextractor-item");
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
        item(format.container.toUpperCase() + " " + map(format.quality) + " - " + 
          format.audioEncoding.toUpperCase() + " " + format.audioBitrate + "K", format.url, title)
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

var make = new mMake();
self.port.on("info", function(vInfo) {
  make.init(vInfo);
});
var next = function () {
  make.next();
};
document.documentElement.addEventListener("iaextractor-next", next, true);
var previous = function () {
  make.previous();
};
document.documentElement.addEventListener("iaextractor-previous", previous, true);