self.port.on("info", function(str) {
  document.getElementById("info-box").innerHTML = str;
});