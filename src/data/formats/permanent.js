var iaextractor_parent = window.content.document.getElementById('watch-headline-title') ||
                         window.content.document.getElementById('vo'),
    button = window.content.document.getElementById('formats-button-small'),
    isFeather = window.content.document.getElementById('vo') != null;

if (button) button.parentNode.removeChild(button);
if (iaextractor_parent) {
  button = document.createElement("button");
  button.setAttribute("dir", "ltr"); 
  var icon = document.createElement("span"); 
  if (isFeather) icon.setAttribute("class", "yt-uix-button-icon-wrapper"); 
  button.setAttribute("title", "Detect all possible download links");
  if (isFeather) {
    button.setAttribute("class", "b");
    button.setAttribute("type", "feather");
  }
  else {
    button.setAttribute("class", "yt-uix-button yt-uix-button-text");
  }
  button.setAttribute("id", "formats-button-small");
  button.addEventListener("click", function () {
    this.blur();
    self.port.emit("formats");
  });
  button.appendChild(icon);
  button.appendChild(document.createTextNode('Download'));
  iaextractor_parent.appendChild(button);
}

// Update toolbar button (HTML5 History API)
self.port.emit("page-update");
// Clean up
self.on("detach", function() {
  var panel;
  try {
    button = window.content.document.getElementById('formats-button-small');
  } catch (e) {}
  if (button && button.parentNode) button.parentNode.removeChild(button);
});