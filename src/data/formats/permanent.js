var iaextractor_parent = window.content.document.getElementById('watch-headline-title');
if (iaextractor_parent) {
  var button = document.createElement("button");
  button.setAttribute("title", "Detect all possible download links");
  button.textContent = "Download";
  button.setAttribute("id", "formats-button-small");
  button.addEventListener("click", function () {
    self.port.emit("formats");
  });
  iaextractor_parent.appendChild(button);
}

// Update toolbar button (HTML5 History API)
self.port.emit("page-update");