// Update toolbar button (HTML5 History API)
self.port.emit("page-update");

function $ (id) {
  try {
    return window.content.document.getElementById(id);
  }
  catch (e) {
    return null;
  }
}
function html (tag, atts) {
  var elem = document.createElement(tag);
  atts.forEach(a => elem.setAttribute(a[0], a[1]));
  return elem;
}

function remove () {
  var button = $('formats-button-small');
  if (button && button.parentNode) button.parentNode.removeChild(button);
}

if (window.top === window) {
  window.addEventListener("DOMContentLoaded", function () {
    var parent = $('watch-headline-title') || $('vo'),
        isFeather = $('vo') != null;
    
    if (!parent) return;
    // Remove old button
    remove();
    // Add new button
    var button = html(
      "button", 
      [["dir", "ltr"], ["id", "formats-button-small"], ["title", "Detect all possible download links"]]
        .concat(isFeather ? [["class", "b"], ["type", "feather"]] : [["class", "yt-uix-button yt-uix-button-text"]])
    );
    button.addEventListener("click", function () {
      this.blur();
      self.port.emit("formats");
    });
    var icon = html("span", isFeather ? [] : ["class", "yt-uix-button-icon-wrapper"]);

    button.appendChild(icon);
    button.appendChild(document.createTextNode('Download'));
    parent.appendChild(button);
  }, false);
}

// Clean up
self.on("detach", function() {
  remove();
});