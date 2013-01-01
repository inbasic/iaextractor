var container = document.getElementById("jsoneditor");
var editor = new JSONEditor(container, {
  mode: "viewer",
  name: "Youtube"
});

self.port.on("info", function(json) {
  editor.clear();
  editor.set(JSON.parse(JSON.stringify(json)));
  editor.expandAll();
});