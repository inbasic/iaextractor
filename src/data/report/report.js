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

var downloadButton = $("download"),
    formatsButton = $("links"),
    aCheckbox = $("audio-checkbox"),
    subCheckbox = $("subtitle-checkbox"),
    sCheckbox = $("resolve-size-checkbox"),
    dmanager = $("download-manager"),
    videop = $("video-preferences"),
    folderp = $("folder-preferences"),
    handler = $("click-handler"),
    qdtoggle = $("qd-toggle"),
    fbtoggle = $("folder-button"),
    tabs = $("tabs");

// e10s compatibility
window.addEventListener("load", function () {
  folderp.style.transform = "translate(0, 230px)";
  videop.style.transform = "translate(0, 230px)";
  $("selected").style.transform = "translate(100px)";
  $("tabpanels").style.transform = "translate(-300px)";
}, false);

var cleanup = function() {
  if (handler.style.display == "block") handler.style.display = "none";
  if (folderp.style.transform == "translate(0px, 129px)") folderp.style.transform = "translate(0, " + 230 + "px)";
  if (videop.style.transform == "translate(0px, 119px)") videop.style.transform = "translate(0, " + 230 + "px)";
}

var slidePanel = function(el, value1, value2) {
  if (el.style.transform == "translate(0px, " + value1 + "px)") {
    handler.style.display = "block";
    el.style.transform = "translate(0, " + value2 + "px)";
  }

  else if (el.style.transform == "translate(0px, " + value2 + "px)") {
    handler.style.display = "none";
    el.style.transform = "translate(0, " + value1 + "px)";
  }
}

handler.addEventListener("click", function () {
  cleanup();
}, false);
fbtoggle.addEventListener("click", function () {
  slidePanel(folderp, 230, 129);
}, false);
qdtoggle.addEventListener("click", function () {
  slidePanel(videop, 230, 119);
}, false);
qdtoggle.addEventListener("mouseover", function () {
  downloadButton.style.backgroundColor = "#FFA05A";
}, false);
qdtoggle.addEventListener("mouseleave", function () {
  downloadButton.style.backgroundColor = "#F79646";
}, false);

var mList = function (name, value, func) {
  var radios = document.getElementsByName(name);

  function set (soft) {
    radios[parseInt(value)].checked = true;
    if (!soft) func(value);
  }
  set(true);

  window.addEventListener("click", function (e) {
    if (e.target.className == "r") cleanup();
    if (e.button != 0) return;
    if (e.originalTarget.localName != "input")
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
  0,
  function (value) {
    self.port.emit("cmd", "destination", value);
  }
);
var quality = new mList (
  "vinput",
  0,
  function (value) {
    self.port.emit("cmd", "quality", value);
  }
);
var format = new mList (
  "finput",
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
    if ($("home").hasAttribute("selected")) {
      $("selected").style.transform = "translate(" + 100 + "px)";
      $("tabpanels").style.transform = "translate(-" + 300 + "px)";
    }
    if ($("downloads").hasAttribute("selected")) {
      $("selected").style.transform = "translate(" + 200 + "px)";
      $("tabpanels").style.transform = "translate(-" + 600 + "px)";
    }
    if ($("preferences").hasAttribute("selected")) {
      $("selected").style.transform = "translate(0)";
      $("tabpanels").style.transform = "translate(0)";
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
      if (!item) return;
      if (item.hasAttribute("cache")) {
        return cache[item.getAttribute("cache")];
      }
      var span = item.getElementsByTagName("span");
      var progress = item.getElementsByClassName("progress-inner");
      var image = item.getElementsByClassName("cancel");

      var rtn = {
        set name(value) {span[0].textContent = value},
        set description(value) {span[1].textContent = value},
        get progress() {return progress[0]},
        set progress(value) {progress[0].style.width = value},
        get close() {return image[0]}
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
  window.setTimeout(function(){tabSelector(2);}, 200);
  dmanager.scrollTop = dmanager.scrollHeight;
  //
  dmUI.set(null, item);
});
self.port.on("download-start", function(id, name, msg) {
  if (id == -1) return;
  //Finding free slot
  dmUI.set(id, null);
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
  if (!dmUI.get(id)) return;
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
  }
});
self.port.on("extract", function(id, msg, rm) {
  dmUI.get(id).description = msg;
  if (rm) {
    dmUI.remove(id);
  }
});

downloadButton.addEventListener("click", function () {
  self.port.emit("cmd", "download");
}, true);
formatsButton.addEventListener("click", function () {
  self.port.emit("cmd", "formats");
}, true);
$("tools").addEventListener("click", function () {
  self.port.emit("cmd", "tools");
}, true);
$("embed").addEventListener("click", function () {
  self.port.emit("cmd", "embed");
}, true);
$("settings-button").addEventListener("click", function () {
  self.port.emit("cmd", "settings");
}, true);
aCheckbox.addEventListener("change", function () {
  self.port.emit("cmd", "do-extract", aCheckbox.checked);
});
subCheckbox.addEventListener("change", function () {
  self.port.emit("cmd", "do-subtitle", subCheckbox.checked);
});
sCheckbox.addEventListener("change", function () {
  self.port.emit("cmd", "do-size", sCheckbox.checked);
});


//Update UI
self.port.on("update", function(doExtract, doSubtitle, doFileSize, dIndex, vIndex, fIndex, isRed) {
  aCheckbox.checked = doExtract;
  subCheckbox.checked = doSubtitle;
  sCheckbox.checked = doFileSize;
  download.value = dIndex;
  quality.value = vIndex;
  format.value = fIndex;
  if (isRed) {
    downloadButton.setAttribute("type", "active");
    formatsButton.setAttribute("type", "active");
    downloadButton.textContent = _("quick-download");
    qdtoggle.style.display = "block";
  }
  else {
    downloadButton.removeAttribute("type");
    formatsButton.removeAttribute("type");
    downloadButton.textContent = _("open-youtube");
    qdtoggle.style.display = "none";
  }
  downloadButton[isRed ? "setAttribute" : "removeAttribute"]("type", "active");
  // If there is no download switch to download tab
  if (dmUI.isEmpty()) {
    tabSelector(1);
  }
  // Restore sliding panels to default state
  cleanup();
});