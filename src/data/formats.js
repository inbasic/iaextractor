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
    '<style>' +
    '  .iaextractor-div {' +
    '    font-family: "Segoe UI", Tahoma, Helvetica, "Sans-Serif";' +
    '    position: absolute;' +
    '    background: #31859B;' +
    '    color: white;' +
    '    z-index: 2147483647;' +
    '  }' +
    '  .iaextractor-item {' +
    '    background: #17365D url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAadEVYdFNvZnR3YXJlAFBhaW50Lk5FVCB2My41LjEwMPRyoQAAAHZJREFUOE9j+P//PwMlmJBmoNlggFPdqAH/GbCFwX1YyGGhQXIoerAZ4IDHAJAcQQNACvqxGAISw7AQVzQKABUjewXEBokRbQBIIbJXMJwOMwykEF9qAzkbq9ORNeEzAF9KhadxPIFOWArZC4RVY1FBKDMRlAcArg5JwJVkhDYAAAAASUVORK5CYII=") 5px center no-repeat;' +
    '    padding-left: 28px;' +
    '    cursor: pointer;' +
    '    line-height: 28px;' +
    '    margin: 13px 20px;' +
    '  }' +
    '  .iaextractor-item:hover {' +   
    '    outline: 3px solid rgb(58, 58, 58);' +
    '  }' +
    '  .iaextractor-link {' +
    '    color: white !important;' +
    '    text-decoration:none;' +
    '  }' +
    '  .iaextractor-link:hover {' +
    '    text-decoration:none;' +
    '  }' +
    '  #iaextractor-previous {' +
    '    background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABGdBTUEAALGPC/xhBQAAAAlwSFlzAAAOwQAADsEBuJFr7QAAABp0RVh0U29mdHdhcmUAUGFpbnQuTkVUIHYzLjUuMTAw9HKhAAACi0lEQVRIS52WP2xNcRTHXzWh1FDRdH1FIhEdqUSQdLBp0gWLP6tFjMqK3SIRBiYJi1Gl2o6GJrUw2KjQRkiwoAnP53N7bnvve7/b+/Qln9x7f79zvufe8zu/83uNRuLXarUaMAhjMAnTsAi/Au8dc04bbVNS5bEQ3sb1KNyHN/AeZuEh3A68d8w5bbTVR9/qQEz2w3lYgI9wF05BEwagL/DeMee00VYfffs7IhgVdsJN+ARTMApb675bGzgCz8JXDbXWXXnw0y7CEjyGg3XC7fP6hK8aavVlNvH25u9VvLmGvZsI0BtB/Hq11MwCWAEuknkcraiq7cyZ911gSirjqwGmWc1BA1hmVoKL1ZFzxhS/Ag/gDuyBnqoI8QJqqTlmAGvZchsvOvmWsAMuwxf4DDfAStswg2qF5qQibpg5GM69QnyI6y34Cu/gkgG7WRvsmuA+mTaAu9KNM1AIYL4V982/wzXYB65XFbuZyypHrdBc9OEnuEPzSTfTVfgG/rw+hUc1uKjHI4Aaaq6kAlimM/A3AvzmutwFb7E5kwpQShFG1vMJmIc/YJquw1kFgtOJ+wnGsnXkWkpRapENchLsLyvwBA7Alhqy8sWmCWuLXFWmBnHT2GNs089hdXfW/LAplWnlRsOwBw7BS/gBrs1ex7vYaK+xyzZasVUcTjQx07IfjsUXmN+NWoWd1baz1ioMUmx2Izxvttnpa7Nz7dbTyYPt+gLYal3Qkbo8J75UcX3VUGu1Xceq5weOvSY/cPzU/zlwfHN91SgfOIVATuRHpsZ2RStiGNqPTMec00Zb03IOOo/Mti9JHfpzONqv3P7ivWN2YavlHtQf+m2Bin9bXiDwAexb4n1Xf1v+AdF8BEGTkEWjAAAAAElFTkSuQmCC) no-repeat;' +
    '    cursor: pointer;' +
    '    width: 24px;' +
    '    height: 24px;' +
    '    border: none;' +
    '  }' +
    '  #iaextractor-next {' +
    '    background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABGdBTUEAALGPC/xhBQAAAAlwSFlzAAAOwAAADsABataJCQAAABp0RVh0U29mdHdhcmUAUGFpbnQuTkVUIHYzLjUuMTAw9HKhAAAChElEQVRIS52WOWgVURRAvwaMMRYJCbZxAUFMaRIIKqRIp2CljUtrI5ZGS5feRhBSaBUwjWUiLiktBG20sNOIC6KgNlFBv+eM9+O8lxlnyMBh5s/d5t13732/06m4ut1uB0ZhBubgPqzC98Bn3ylTR90qV+m7cNzPfRrm4QW8hkdwG64HPvtOmTrqaqNtfSCEg3AKnsJbuAlHYAyGYGvgs++UqaOuNtoOrotgVNgOV+EdLMMUbGlatzowGTba6kNf/0z54dJOw3u4A/ubHOdybcJWH2dcaaETX2/+nsVXqNi3gQB9EcTV60ufRQArwE1yeZN1juNDTMcwuAcDNRVoutwTfY4awDJ7Dm5Wbc6RbYJdcANuwfmqIPoIX1bXjAGsZcvt6P/SEiuwyi7DR/gE52CbsvKlr/A5ZwAbxpoea5P3cHiW+yv4DNdgRzkIzzthRd8GeAM2zlBsurU+Au5NHXuQXYSvsRKDFPbhwz3S56oBfoIdWpQV90PgBi00cBf5F/DyfqHkw4/U51pVgOMIXsKHFvyIAL+5P4SifwxUDpCnyPwdAwPVcQLZJXCjf8ETOAxF/3BPUpRsMkLLcXMD+5Avgul1Bs32nEeAZJNblWnW9fdw6OheAhsr6Xx+J2Vqo9kUbRptN3oP4Bs8hgOuOOuBXqPZvEWj9UaF7T3VMCrMrTPmIOw1jRVDb4L3yagwiEbm0kE1ni+5ZQM67LRNh13ktjyu3bzxNk6z1OhcW8e1o//vuC5tnofEFdjIgePh5Jdrq4/0wCkFcpidjHSp7MZbEZZdfmT6Tpk66tYfmdlKyoe+leCkXQFni+0vPvtOmTrtDv0sUP63xY5fC3y2XBv/tvwBsMQEQXsa/zUAAAAASUVORK5CYII=) no-repeat;' +
    '    cursor: pointer;' +
    '    width: 24px;' +
    '    height: 24px;' +
    '    border: none;' +
    '  }' +
    '  #iaextractor-close {' +
    '    background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABGdBTUEAALGPC/xhBQAAAAlwSFlzAAAOvgAADr4B6kKxwAAAABp0RVh0U29mdHdhcmUAUGFpbnQuTkVUIHYzLjUuMTAw9HKhAAACQElEQVRIS53WvYpUQRAF4AVFBTcw2MBsNRM08w/M1ljfwJ/X2FBQ1tRQNDHVF1BYdR9A0EQxUnBFfQRFg/F8w+2hp7fvOM7Agb7VVaeqq6uqZ20ymayNYCPyrWA72A32g18DrMns0aHb5ekJj0b5SvA4+BB8CV4HT4IHA6zJ7NGhy4btHGfr4HgUbgZvg2/Bw+BasBmcCI4NsCazR4cuG7Y4Zry1g/Vs3Au+By+CS8GRNqLON53LwfPBFgeuKXdx4Gi3gx/B0+DsEsTt6dmwxYHLaWcO5O/dEDnFQys4YMPW6XHhnDpQAS5JHqWljezAxVU6hzv6OKQZ5wYyZaYSXFab85OR7QRXO0RnIrsT0KmDwoEL55YNtazcrjeKIkf+J/jUOEH+Ztij054SF85tDjTMXnCqE6XIkft9DM4Hp4NXg+xz47icZDNyfbJLoCs1jtruNR4nyIuTQk7WSx0OXDj3ffwMdOi0rEYg8uKkOLqwQB8Xzt/LOqjTUhxwOhbQnIN/pciF1mmp07VUihZdcqmWOi11utrq6l7yWJlqInWuTNtqKdVl736wsExXbTROkI812vvsTRutHhUXOxe3aFT09kxWY2c2Kjiph925fK867Ngadt6G2bDjQCS3AqP2WUBxrATH5GzY4sA1N64ZeSTuBuXBcdT/eXBEzhbHgQenRGWjPJmUTUWDy5zS/vWTSWaPDl1puRGMPpnFSe/R34uh2aL9wZrMxFQtj4KlHv06v/Xflpch+BqYW2C91N+Wv9jmVRD9tG0nAAAAAElFTkSuQmCC) no-repeat;' +
    '    cursor: pointer;' +
    '    width: 24px;' +
    '    height: 24px;' +
    '    border: none;' +
    '  }' +
    '  #iaextractor-previous:disabled,' +
    '  #iaextractor-next:disabled {' +
    '    background: none;' +
    '    display: none;' +
    '  }' +
    '</style>' +
    '<div id="iaextractor-menu" class="iaextractor-div" style="top:' + (rect.top + window.scrollY) + "px; left:" + (rect.left + rect.width/2) + "px; width:" + (rect.width/2) + "px; height:" + (rect.height) + "px" + '">' +
    '  <input type="submit" id="iaextractor-previous" disabled="true" style="float:right; margin: 8px;" name="" value="" onclick="var event = document.createEvent(\'CustomEvent\'); event.initCustomEvent(\'iaextractor-previous\', true, true, {}); document.documentElement.dispatchEvent(event);">' +
    '  <input type="submit" id="iaextractor-next" style="float:right; margin: 8px;" name="" value="" onclick="var event = document.createEvent(\'CustomEvent\'); event.initCustomEvent(\'iaextractor-next\', true, true, {}); document.documentElement.dispatchEvent(event);">' +
    '  <input type="submit" id="iaextractor-close" style="float:left; margin: 8px;" name="" value="" onclick="this.parentNode.parentNode.removeChild(this.parentNode)">' +
    '  <center style="font-size: 20px; line-height: 44px;">Download Video</center> ' +
    '</div>');
    
    numberOfItems = Math.floor(rect.height / 40);
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
        $("iaextractor-menu").appendChild(a);
      }
      // Split formats into lists
      if (vInfo) {
        while (vInfo.formats.length) {
          sets.push(vInfo.formats.splice(0, numberOfItems - 1));
        }
        title = vInfo.title;
      }
      // Clear old list
      while (document.getElementsByClassName("iaextractor-link").length) {
        var elem = document.getElementsByClassName("iaextractor-link")[0];
        elem.parentNode.removeChild(elem);
      }
      //Add new list
      sets[activeSet].forEach(function (format, index) {
        item(format.container.toUpperCase() + " " + format.quality + " - " + 
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

//Remove old elements
while (document.getElementsByClassName("iaextractor-div").length) {
  var elem = document.getElementsByClassName("iaextractor-div")[0];
  elem.parentNode.removeChild(elem);
}
//Deactivate old workers
var event = document.createEvent('CustomEvent');
event.initCustomEvent('iaextractor-destroy', true, true, {});
document.documentElement.dispatchEvent(event);
//Add destroy listener
document.documentElement.addEventListener("iaextractor-destroy", function(event) {
  document.documentElement.removeEventListener("iaextractor-next", next, true);
  document.documentElement.removeEventListener("iaextractor-next", previous, true);
}, true);

var make = new mMake();
self.port.on("info", function(vInfo, worker) {
  _worker = worker;
  //Update the menu
  window.setTimeout(function () {make.init(vInfo);}, 500);
});
var next = function () {
  make.next();
};
document.documentElement.addEventListener("iaextractor-next", next, true);
var previous = function () {
  make.previous();
};
document.documentElement.addEventListener("iaextractor-previous", previous, true);