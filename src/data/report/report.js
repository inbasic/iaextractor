var $ = function (id) { 
  return document.getElementById(id);
} 
var _ = function (id) {
  var items = $("locale").getElementsByTagName("span");
  for (var i = 0; i < items.length; i++) {
    if (items[i].getAttribute("data-l10n-id") == id) {
      return items[i].textContent;
    }
  }
  return id;
}

var downloadButton = $("download-button"),
    formatsButton = $("formats-button"),
    aCheckbox = $("audio-checkbox"),
    sCheckbox = $("resolve-size-checkbox"),
    downloadButtonLabel = $("download-button-label"),
    toolbar = $("download-manager-toolbar");

var mList = function (name, el1, el2, value, func) {
  var isHidden = true;
  var radios = document.getElementsByName(name);
  
  function set (soft) {
    el1.textContent = el2.children[value].childNodes[1].textContent;
    radios[parseInt(value)].checked = true;
    if (!soft) func(value);
  }
  set(true);
  el1.addEventListener("click", function () {
    el2.style.display = isHidden ? 'block' : 'none';
    isHidden = !isHidden;
    window.scrollTo(0, document.body.scrollHeight);
  }, false);
  window.addEventListener("click", function (e) {
    if (e.button != 0) return;
    if (e.originalTarget == el1 || e.originalTarget.parent == el1) return;
    isHidden = true;
    el2.style.display = 'none';
    if (e.originalTarget.localName != "label" && e.originalTarget.localName != "input")
      return;
    for (var i = 0; i < radios.length; i++) {
      if (radios[i].checked) {
        value = radios[i].value;
        set();
      }
    }
  }, false);

  return {
    get value () {return value},
    set value (v) {
      value = v;
      set();
    }
  }
}

var download = new mList (
  "dinput", 
  $('download-list'), 
  $('download-addition'),
  0,
  function (value) {
    self.port.emit("cmd", "destination", value);
  }
);
var quality = new mList (
  "vinput", 
  $('video-list'), 
  $('video-addition'),
  0,
  function (value) {
    self.port.emit("cmd", "quality", value);
  }
);
var format = new mList (
  "finput", 
  $('format-list'), 
  $('format-addition'),
  0,
  function (value) {
    self.port.emit("cmd", "format", value);
  }
);

function tabSelector (e) {
  var n;
  if (typeof(e) == "number") {
    n = e;
  }
  else {
    n = 0;
    var child = e.originalTarget
    if (child.localName != "span") {
      return;
    }
    while ((child = child.previousSibling)) {
      if(child.localName) {
        n += 1;
      }
    }
  }
  //Select a new tab
  var tabs = $("tabs").getElementsByClassName("tab");
  var tabpanels = $("tabpanels").getElementsByClassName("tabpanel");
  for (var i = 0; i < tabs.length; i++) {
    var tab = tabs[i], 
        tabpanel = tabpanels[i];
    if (i == n) {
      tab.setAttribute("selected", true);
      tabpanel.setAttribute("selected", true);
    }
    else {
      tab.removeAttribute("selected");
      tabpanel.removeAttribute("selected");
    }
  }
}
$("tabs").addEventListener("click", tabSelector, false);

var dm = {}, inList = [];
var dmUI = {
  set: function (id, item) {
    if (id && item) {
      dm[id] = item;
    }
    else if (item) {
      inList.push(item);
    }
    else {
      dm[id] = inList.shift();
    }
  },
  get: (function () {
    var cache = [];
    return function (item) {
      if (typeof (item) == "number") {
        item = dm[item];
      }
      
      if (item.hasAttribute("cache")) {
        return cache[item.getAttribute("cache")];
      }
      var span = item.getElementsByTagName("span");
      var progress = item.getElementsByClassName("progress-inner");
      var image = item.getElementsByTagName("img");
      
      var rtn = {
        set name(value) {span[0].textContent = value},
        set description(value) {span[1].textContent = value},
        get progress() {return progress[0]},
        set progress(value) {progress[0].style.width = value},
        get close() {return image[1]}
      };
      item.setAttribute("cache", cache.push(rtn) - 1);
      return rtn;
    }
  })(),
  get count () {
    return Object.getOwnPropertyNames(dm).length;
  },
  isEmpty: function () {
    return dmUI.count == 0;
  },
  checkState: function () {
    //exceed ?
    var label = $("download-manager-toolbar-label");
    if (dmUI.count > 3) {
      label.textContent = _("show-numbers").replace("%d", (dmUI.count - 3));
    }
    else {
      label.textContent = _("show-history");
    }
  },
  add: function () {
    //Show download manager
    $("no-download-manager").style.display = "none";
    $("download-manager").style.display = "block";
    //Add new download item
    var _item = $("download-item");
    var item = _item.cloneNode(true);
    $("download-manager").appendChild(item);
    item.style.display = "inline-block";
    this.get(item).close.addEventListener("click", function (e) {
      var id = e.originalTarget.getAttribute("dlID");
      if (id) {
        self.port.emit("cmd", "cancel", id);
      }
    }, true);
    return item;
  },
  remove: function (id) {
    $("download-manager").removeChild(dm[id]);
    delete dm[id];
   
    if (dmUI.isEmpty()) {
      $("no-download-manager").style.display = "block";
      $("download-manager").style.display = "none";
    }
  }
}

self.port.on("detect", function(msg) {
  var item = dmUI.add();
  //Update fields
  dmUI.get(item).description = msg;
  //Switch to progress tab
  tabSelector(1);
  //
  dmUI.set(null, item);
});
self.port.on("download-start", function(id, name, msg) {
  if (id == -1) return;
  //Finding free slot
  dmUI.set(id, null);
  dmUI.checkState();
  dmUI.get(id).close.setAttribute("dlID", id);
  try {
    var reg = /(.*)\.([^\.]*)$/.exec(name);
    dmUI.get(id).name = reg[1] + " (" + reg[2] + ")";
  }
  catch (e) {
    dmUI.get(id).name = name;
  }
  dmUI.get(id).description = msg;
});
self.port.on("download-update", function(id, percent, msg, amountTransferred, size, speed) {
  if (id == -1) return;
  //  
  dmUI.get(id).progress = percent + "%";
  dmUI.get(id).progress.removeAttribute("type");
  dmUI.get(id).description = msg
    .replace("%f1", amountTransferred)
    .replace("%f2", size)
    .replace("%f3", speed);
});
self.port.on("download-paused", function(id, msg) {
  dmUI.get(id).description = msg;
  dmUI.get(id).progress.setAttribute("type", "inactive");
});
self.port.on("download-done", function(id, msg, rm) {
  dmUI.get(id).progress = "100%";
  dmUI.get(id).description = msg;
  if (rm) {
    dmUI.remove(id);
    dmUI.checkState();
  }
});
self.port.on("extract", function(id, msg, rm) {
  dmUI.get(id).description = msg;
  if (rm) {
    dmUI.remove(id);
    dmUI.checkState();
  }
});

downloadButton.addEventListener("click", function () {
  self.port.emit("cmd", "download");
}, true);
formatsButton.addEventListener("click", function () {
  self.port.emit("cmd", "formats");
}, true);
$("embed-button").addEventListener("click", function () {
  self.port.emit("cmd", "embed");
}, true);
aCheckbox.addEventListener("change", function () {
  self.port.emit("cmd", "do-extract", aCheckbox.checked);
});
sCheckbox.addEventListener("change", function () {
  self.port.emit("cmd", "do-size", sCheckbox.checked);
});
$("tools-button").addEventListener("click", function () {
  self.port.emit("cmd", "tools");
}, true);
toolbar.addEventListener("click", function () {
  self.port.emit("cmd", "show-download-manager");
}, true);
//Onload
self.port.on("update", function(doExtract, doFileSize, dIndex, vIndex, fIndex, isRed) {
  //Resizing tabs
  var width = parseInt(window.getComputedStyle($("tabs"), null).getPropertyValue("width"));
  if (navigator.userAgent.indexOf("Mac OS X") != -1) {
    width -= 1;
  }
  width = (width - 24)/3;
  var tab = document.getElementsByClassName("tab");
  for (var i = 0; i < tab.length; i++) {
    tab[i].style.width = width + "px";
  }
  //
  aCheckbox.checked = doExtract;
  sCheckbox.checked = doFileSize;
  download.value = dIndex;
  quality.value = vIndex;
  format.value = fIndex;
  if (isRed) {
    downloadButton.setAttribute("type", "active");
    formatsButton.setAttribute("type", "active");
    downloadButtonLabel.textContent = _("quick-download");
  }
  else {
    downloadButton.removeAttribute("type");
    formatsButton.removeAttribute("type");
    downloadButtonLabel.textContent = _("open-youtube");
  }
  downloadButton[isRed ? "setAttribute" : "removeAttribute"]("type", "active");
  //If there is no download switch to download tab
  if (dmUI.isEmpty()) {
    tabSelector(0);
  }
});

window.addEventListener("load", function () {
  dmUI.checkState();
}, false);