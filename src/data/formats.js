var mDrag = function (elem) {
  var x, y, offX, offY;
  var element = elem;
  var being = false;
  function mouser(e) {
    x = e.pageX;
    y = e.pageY;
    if (being == true) {
      element.style.left = (x - offX) +'px';
      element.style.top  = (y - offY) +'px';
    }
  }
  document.addEventListener("mousemove", mouser, false);
  document.addEventListener("mouseup", function () {
    being = false;
    if (element.style) element.style.cursor = 'auto';
  }, false);
  return function (e) {
    if (!element.style) return;
    being = true;
    element.style.cursor = 'move';
    offX = e.pageX - parseInt(element.style.left ? element.style.left : 40);
    offY = e.pageY - parseInt(element.style.top ? element.style.top : 300);
  }
}

var mMake = function () {
  var css = ' \
   .div-formats { \
      position: fixed; \
      top: 300px; \
      left: 40px; \
      min-width: 250px; \
      background-color: white; \
      margin: 0; \
      padding-left: 0; \
      padding-right: 0; \
      font-family: arial, sans-serif; \
      font-size: 15px; \
      border: 1px solid #D4D4D4; \
      z-index: 2147483647; \
    } \
    .div-formats .title { \
      color: #555555; \
      background-color: #DCDCDC; \
      background-image: linear-gradient(to bottom, #F0F0F0 0px, #DCDCDC 100%); \
      height: 26px; \
      line-height: 26px; \
      padding-left: 10px; \
      font-size: 14px; \
    } \
    .div-formats .close { \
      cursor: pointer; \
      background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAQCAYAAAB3AH1ZAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAadEVYdFNvZnR3YXJlAFBhaW50Lk5FVCB2My41LjEwMPRyoQAAAHhJREFUSEvtlcsKQCEIRP1m/x+6uQjExoGL0AMS3IhxBp1KVFUqKdWowO1sOZ4AMIHWa5bRG7AOVtB6zTIGrhOQFzHgkzAC8iIGfBaWeMADUzgxoQfmcFNPTBhFwF5yC6II3HqqgK0rQDtfasLt1/DX3/Ce4usn8AFPKaXAhWH6vwAAAABJRU5ErkJggg==); \
      display:block; \
      width: 16px; \
      height: 16px; \
      background-position: 0 0;  \
      margin-right: 2px; margin-top: 4px; \
    } \
    .div-formats .close:hover { \
      background-position: 16px 0; \
    } \
    .div-formats ul { \
      box-shadow: none; \
      overflow: auto; \
      padding: 2px; \
      list-style-type: none; \
      margin: 0 0 2px 0px; \
    } \
    .div-formats span { \
      float: left; \
      cursor: pointer; \
      border: solid 1px transparent; \
      margin: 0; \
      padding-left: 5px; \
      width: 97% \
      height: 24px; \
      line-height: 24px; \
    } \
    .div-formats span:hover { \
      background: yellow; \
    } \
    .div-formats a { \
      color: #555555; \
    }'
  var head = document.getElementsByTagName('head')[0];
  var style = document.createElement('style');
  style.type = 'text/css';
  style.appendChild(document.createTextNode(css));
  head.appendChild(style);

  var parent = document.createElement("div");
  parent.setAttribute("class", "div-formats");
  var drag = new mDrag (parent);
  parent.addEventListener("mousedown", function (e) {drag(e)}, true);
  var title = document.createElement("div");
  parent.appendChild(title);
  title.setAttribute("class", "title");
  title.setAttribute("align", "center");
  var text = document.createTextNode("Video formats");
  title.appendChild(text);
  var img = document.createElement("img");
  img.setAttribute("align", "right");
  img.setAttribute("class", "close");
  img.addEventListener("click", function () {
    document.body.removeChild(parent);
  }, true);
  title.appendChild(img);
  var ul = document.createElement("ul");
  parent.appendChild(ul);
  document.body.appendChild(parent);

  return function (vInfo) {
    function item (txt, url, name) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.setAttribute("href", url + "&keepalive=yes&title=" + encodeURI(name));
      a.setAttribute("download", name);
      var span = document.createElement("span");
      text = document.createTextNode(txt);
      span.appendChild(text);
      a.appendChild(span);
      li.appendChild(a);
      ul.appendChild(li);
    }
    vInfo.formats.forEach(function (format) {
      item(format.container + " [" + format.quality + "] ... " 
        + format.audioEncoding + " [" + format.audioBitrate + "K]", format.url, vInfo.title);
    })
  }
}

var make = new mMake();

self.port.on("info", function(vInfo) {
  make(vInfo);
});

