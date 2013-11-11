var iaextractor_parent = window.content.document.getElementById('watch-headline-title'),
    ibutton = window.content.document.getElementById('formats-button-small');
if (ibutton) ibutton.parentNode.removeChild(ibutton);
if (iaextractor_parent) {
  var button = document.createElement("button"),
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