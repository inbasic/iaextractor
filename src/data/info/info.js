var container = document.getElementById("jsoneditor");
var editor = new JSONEditor(container, {
  mode: "viewer",
  name: "Youtube",
  history: false
});

self.port.on("info", function(json) {
  editor.set(json);
});