var iaextractor_parent = document.getElementById("watch-headline-title");

if (iaextractor_parent) {
  var button = document.createElement("button");
  button.setAttribute("title", "Detect all possible download links");
  button.setAttribute("id", "formats-button-small");
  button.addEventListener("click", function () {
    self.port.emit("formats");
  });
  iaextractor_parent.appendChild(button);
}
