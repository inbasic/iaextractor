var destination = document.getElementById("destination");
var downloadButton = document.getElementById("download-button");

self.port.on("update", function(index, isRed) {
  destination.selectedIndex = index;
  if (isRed) {
    downloadButton.setAttribute("type", "active");
  }
  else {
    downloadButton.removeAttribute("type");
  }
  downloadButton[isRed ? "setAttribute" : "removeAttribute"]("type", "active");
});
self.port.on("detect", function(str) {
  document.getElementById("detect").firstChild.nodeValue = str;
});
self.port.on("download", function(str) {
  document.getElementById("download").firstChild.nodeValue = str;
});
self.port.on("extract", function(str) {
  document.getElementById("extract").firstChild.nodeValue = str;
});

downloadButton.addEventListener("click", function () {
  self.port.emit("download");
}, true);
document.getElementById("cancel").addEventListener("click", function () {
  self.port.emit("cancelAll");
}, true);
document.getElementById("formats").addEventListener("click", function () {
  self.port.emit("formats");
}, true);
document.getElementById("embed").addEventListener("click", function () {
  self.port.emit("embed");
}, true);
destination.addEventListener("change", function () {
  self.port.emit("destination", destination.value);
}, true);