var container = document.getElementById("jsoneditor");
var editor = new JSONEditor(container, {
  mode: "viewer",
  name: "Youtube"
});

// get json
function getJSON() {
    var json = editor.get();
    alert(JSON.stringify(json, null, 2));
}

self.port.on("info", function(json) {
  editor.clear();
  editor.set(JSON.parse(JSON.stringify(json)));
  editor.expandAll();
});