self.port.on("detect", function(str) {
  document.getElementById("detect").innerHTML = str;
});
self.port.on("download", function(str) {
  document.getElementById("download").innerHTML = str;
});
self.port.on("extract", function(str) {
  document.getElementById("extract").innerHTML = str;
});

document.getElementById("cancel").addEventListener("click", function () {
  self.port.emit("cancelAll", null);
}, true);