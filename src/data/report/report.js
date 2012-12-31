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