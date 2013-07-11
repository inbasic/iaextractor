var iaextractor_parent = document.getElementById("watch-headline-title");

if (iaextractor_parent) {
  var button = document.createElement("button");
  button.setAttribute("title", "Detect all possible download links");
  button.setAttribute("id", "formats-button-small");
  //button.setAttribute("class", "yt-uix-tooltip");
  var img = document.createElement("img");
  img.setAttribute(
    "src", 
    "resource://feca4b87-3be4-43da-a1b1-137c24220968-at-jetpack/iaextractor/data/formats/injected-button.png"
  );
  button.addEventListener("click", function () {
    self.port.emit("formats");
  });
  button.appendChild(img);
  iaextractor_parent.appendChild(button);
}