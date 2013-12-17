var iaextractor_parent = window.content.document.getElementById('watch-headline-title'),
    button = window.content.document.getElementById('formats-button-small');

if (button) button.parentNode.removeChild(button);
if (iaextractor_parent) {
  button = document.createElement("button"),
      icon = document.createElement("span"); 
  icon.setAttribute("id", "icon-wrapper"); 
  icon.setAttribute("class", "yt-uix-button-icon-wrapper"); 
  button.setAttribute("title", "Detect all possible download links");
  button.textContent = "Download";
  button.setAttribute("class", "yt-uix-button yt-uix-button-text");
  button.setAttribute("id", "formats-button-small");
  button.addEventListener("click", function () {
    this.blur();
    self.port.emit("formats");
  });
  button.appendChild(icon);
  iaextractor_parent.appendChild(button);
}

// Update toolbar button (HTML5 History API)
self.port.emit("page-update");
// Clean up
self.on("detach", function() {
  button = window.content.document.getElementById('formats-button-small');
  if (button) button.parentNode.removeChild(button);
});