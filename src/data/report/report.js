var addTooltip = (function () {
  var count = 0;
  var tooltip = document.getElementById("tooltiptext");
  function clear () {
    while(tooltip.firstChild) tooltip.removeChild(tooltip.firstChild);
  }
  
  return function (id, txt) {
    var elem = document.getElementById(id);
    elem.addEventListener("mouseover", function () {
      clear();
      tooltip.appendChild(document.createTextNode(txt));
      count += 1;
    }, true);
    elem.addEventListener("mouseout", function () {
      window.setTimeout(function () {
        count -= 1;
        if (!count) clear();
      }, 1000);
    }, true)
  }
})();

addTooltip("formats", "Display all available formats.");
addTooltip("embed", "Extract all embed videos.");
addTooltip("cancel", "Cancel all active video downloads.");

self.port.on("detect", function(str) {
  document.getElementById("detect").firstChild.nodeValue = str;
});
self.port.on("download", function(str) {
  document.getElementById("download").firstChild.nodeValue = str;
});
self.port.on("extract", function(str) {
  document.getElementById("extract").firstChild.nodeValue = str;
});

document.getElementById("cancel").addEventListener("click", function () {
  self.port.emit("cancelAll", null);
}, true);
document.getElementById("formats").addEventListener("click", function () {
  self.port.emit("formats", null);
}, true);
document.getElementById("embed").addEventListener("click", function () {
  self.port.emit("embed", null);
}, true);