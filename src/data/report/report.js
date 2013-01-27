var $ = function (id) {
  return document.getElementById(id);
}

var mList = function (name, el1, el2, value, func1, func2) {
  var isHidden = true;
  var radios = document.getElementsByName(name);
  
  function set (soft) {
    el1.textContent = func1(value);
    radios[parseInt(value)].checked = true;
    if (!soft) func2(value);
  }
  set(true);
  el1.addEventListener("click", function () {
    el2.style.display = isHidden ? 'block' : 'none';
    isHidden = !isHidden;
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

var downloadButton = $("download-button");

var download = new mList (
  "dinput", 
  $('download-list'), 
  $('download-addition'),
  0,
  function (value) {
    switch (value + "") {
      case "0": return "Default Downloads directory";
      case "1": return "Home directory";
      case "2": return "OS temporary directory";
      case "3": return "Desktop directory";
      case "4": return "Select folder each time";
      case "5": return "User folder";
    }
  },
  function (value) {
    self.port.emit("destination", value);
  }
);
var quality = new mList (
  "vinput", 
  $('video-list'), 
  $('video-addition'),
  0,
  function (value) {
    switch (value + "") {
      case "0": return "hd1080";
      case "1": return "hd720";
      case "2": return "High";
      case "3": return "Medium";
      case "4": return "Small";
    }
  },
  function (value) {
    self.port.emit("quality", value);
  }
);

self.port.on("update", function(dIndex, vIndex, isRed) {
  download.value = dIndex;
  quality.value = vIndex;
  if (isRed) {
    downloadButton.setAttribute("type", "active");
  }
  else {
    downloadButton.removeAttribute("type");
  }
  downloadButton[isRed ? "setAttribute" : "removeAttribute"]("type", "active");
});
self.port.on("detect", function(str) {
  $("detect").firstChild.nodeValue = str;
});
self.port.on("download", function(str) {
  $("download").firstChild.nodeValue = str;
});
self.port.on("extract", function(str) {
  $("extract").firstChild.nodeValue = str;
});

downloadButton.addEventListener("click", function () {
  self.port.emit("download");
}, true);
$("cancel").addEventListener("click", function () {
  self.port.emit("cancelAll");
}, true);
$("formats").addEventListener("click", function () {
  self.port.emit("formats");
}, true);
$("embed").addEventListener("click", function () {
  self.port.emit("embed");
}, true);