self.port.emit('click-link', "hi there");

self.port.on("detect", function(str) {
  document.getElementById("detect").innerHTML = str;
});
self.port.on("download", function(str) {
  document.getElementById("download").innerHTML = str;
});
self.port.on("extract", function(str) {
  document.getElementById("extract").innerHTML = str;
});