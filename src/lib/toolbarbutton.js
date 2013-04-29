const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const NS_SVG = "http://www.w3.org/2000/svg";
const NS_XLINK = "http://www.w3.org/1999/xlink";

const winUtils = require("window-utils");
const browserURL = "chrome://browser/content/browser.xul";

/** unload+.js **/
var unload = (function () {
  var unloaders = [];

  function unloadersUnlaod() {
    unloaders.slice().forEach(function(unloader) unloader());
    unloaders.length = 0;
  }

  require("unload").when(unloadersUnlaod);

  function removeUnloader(unloader) {
    let index = unloaders.indexOf(unloader);
    if (index != -1)
      unloaders.splice(index, 1);
  }

  return {
    unload: function unload(callback, container) {
      // Calling with no arguments runs all the unloader callbacks
      if (callback == null) {
        unloadersUnlaod();
        return null;
      }

      var remover = removeUnloader.bind(null, unloader);

      // The callback is bound to the lifetime of the container if we have one
      if (container != null) {
        // Remove the unloader when the container unloads
        container.addEventListener("unload", remover, false);

        // Wrap the callback to additionally remove the unload listener
        let origCallback = callback;
        callback = function() {
          container.removeEventListener("unload", remover, false);
          origCallback();
        }
      }

      // Wrap the callback in a function that ignores failures
      function unloader() {
        try {
          callback();
        }
        catch(ex) {}
      }
      unloaders.push(unloader);

      // Provide a way to remove the unloader
      return remover;
    }
  };
})().unload;

/** listen.js **/
var listen = function listen(window, node, event, func, capture) {
  // Default to use capture
  if (capture == null)
    capture = true;

  node.addEventListener(event, func, capture);
  function undoListen() {
    node.removeEventListener(event, func, capture);
  }

  // Undo the listener on unload and provide a way to undo everything
  let undoUnload = unload(undoListen, window);
  return function() {
    undoListen();
    undoUnload();
  };
}

/** **/
exports.ToolbarButton = function ToolbarButton(options) {
  var unloaders = [],
      toolbarID = "",
      insertbefore = "",
      destroyed = false,
      destoryFuncs = [];
      
  var delegate = {
    onTrack: function (window) {
      if ("chrome://browser/content/browser.xul" != window.location || destroyed)
        return;
      let doc = window.document;
      let $ = function(id) doc.getElementById(id);

      options.tooltiptext = options.tooltiptext || '';

      // create toolbar button
      let stack = doc.createElementNS(NS_XUL, "stack");
      stack.setAttribute("class", "toolbarbutton-icon");
      //stack.appendChild(svg);
      let box = doc.createElementNS(NS_XUL, "vbox");
      box.setAttribute("flex", "1");
      box.setAttribute("align", "center");
      box.setAttribute("pack", "end");
      let progressmeter = doc.createElementNS(NS_XUL, "box");
      progressmeter.setAttribute("class", "progress");
      box.appendChild(progressmeter);
      let img = doc.createElementNS(NS_XUL, "image");
      img.setAttribute("class", "normal");
      let tbb = doc.createElementNS(NS_XUL, "toolbarbutton");
      tbb.setAttribute("id", options.id);
      tbb.setAttribute("type", "button");
      tbb.setAttribute("class", "toolbarbutton-1 chromeclass-toolbar-additional iaextractor");
      tbb.setAttribute("label", options.label);
      tbb.setAttribute('tooltiptext', options.tooltiptext);
      stack.appendChild(box);
      stack.appendChild(img);
      tbb.appendChild(stack);

      tbb.addEventListener("command", function(e) {
        if (options.onCommand)
          options.onCommand(e, tbb); // TODO: provide something?
      }, true);
      if (options.onClick) {
        tbb.addEventListener("click", function (e) {
          options.onClick(e, tbb);
        }, true);
      }
      if (options.panel) {
        tbb.addEventListener("contextmenu", function (e) {
          e.stopPropagation();
          e.preventDefault();
          options.panel.show(tbb);
        }, true);
      }
      // add toolbarbutton to palette
      ($("navigator-toolbox") || $("mail-toolbox")).palette.appendChild(tbb);

      // find a toolbar to insert the toolbarbutton into
      if (toolbarID) {
        var tb = $(toolbarID);
      }
      if (!tb) {
        var tb = toolbarbuttonExists(doc, options.id);
      }

      // found a toolbar to use?
      if (tb) {
        let b4;

        // find the toolbarbutton to insert before
        if (insertbefore) {
          b4 = $(insertbefore);
        }
        if (!b4) {
          let currentset = tb.getAttribute("currentset").split(",");
          let i = currentset.indexOf(options.id) + 1;

          // was the toolbarbutton id found in the curent set?
          if (i > 0) {
            let len = currentset.length;
            // find a toolbarbutton to the right which actually exists
            for (; i < len; i++) {
              b4 = $(currentset[i]);
              if (b4) break;
            }
          }
        }
        tb.insertItem(options.id, b4, null, false);
      }

      var saveTBNodeInfo = function(e) {
        toolbarID = tbb.parentNode.getAttribute("id") || "";
        insertbefore = (tbb.nextSibling || "")
            && tbb.nextSibling.getAttribute("id").replace(/^wrapper-/i, "");
      };

      window.addEventListener("aftercustomization", saveTBNodeInfo, false);

      // add unloader to unload+'s queue
      var unloadFunc = function() {
        tbb.parentNode.removeChild(tbb);
        window.removeEventListener("aftercustomization", saveTBNodeInfo, false);
      };
      var index = destoryFuncs.push(unloadFunc) - 1;
      listen(window, window, "unload", function() {
        destoryFuncs[index] = null;
      }, false);
      unloaders.push(unload(unloadFunc, window));
    },
    onUntrack: function (window) {}
  };
  var tracker = winUtils.WindowTracker(delegate);

  function setProgress(aOptions) {
    getToolbarButtons(function(tbb) {
      let image = tbb.childNodes[0].childNodes[1];
      let progressbar = tbb.childNodes[0].childNodes[0].childNodes[0];
      if (!aOptions.progress) {
        image.setAttribute("class", "normal");
        progressbar.style.height = 0;
      }
      else {
        image.setAttribute("class", "counter");
        progressbar.style.height = (9 * aOptions.progress) + "px";
      }
    }, options.id);
    return aOptions.progress;
  }
  function setSaturate(aOptions) {
    getToolbarButtons(function(tbb) {
      if (!aOptions.value) {
        tbb.setAttribute("type", "gray");
      }
      else {
        tbb.removeAttribute("type");
      }
    }, options.id);
    options.saturate = aOptions.value;
    return aOptions.value;
  }
  
  return {
    destroy: function() {
      if (destroyed) return;
      destroyed = true;

      if (options.panel)
        options.panel.destroy();

      // run unload functions
      destoryFuncs.forEach(function(f) f && f());
      destoryFuncs.length = 0;

      // remove unload functions from unload+'s queue
      unloaders.forEach(function(f) f());
      unloaders.length = 0;
    },
    moveTo: function(pos) {
      if (destroyed) return;

      // record the new position for future windows
      toolbarID = pos.toolbarID;
      insertbefore = pos.insertbefore;

      // change the current position for open windows
      for each (var window in winUtils.windowIterator()) {
        if (browserURL != window.location) return;

        let doc = window.document;
        let $ = function (id) doc.getElementById(id);

        // if the move isn't being forced and it is already in the window, abort
        if (!pos.forceMove && $(options.id)) return;

        var tb = $(toolbarID);
        var b4 = $(insertbefore);

        // TODO: if b4 dne, but insertbefore is in currentset, then find toolbar to right

        if (tb) {
          tb.insertItem(options.id, b4, null, false);
          tb.setAttribute("currentset", tb.currentSet);
          doc.persist(tb.id, "currentset");
        }
      };
    },
    get label() options.label,
    set label(value) {
      options.label = value;
      getToolbarButtons(function(tbb) {
        tbb.label = value;
      }, options.id);
      return value;
    },
    set progress(value) setProgress({progress: value}),
    set saturate(value) setSaturate({value: value}),
    get saturate() options.saturate,
    get tooltiptext() options.tooltiptext,
    set tooltiptext(value) {
      options.tooltiptext = value;
      getToolbarButtons(function(tbb) {
        tbb.setAttribute('tooltiptext', value);
      }, options.id);
    },
  };
};

function getToolbarButtons(callback, id) {
  let buttons = [];
  for each (var window in winUtils.windowIterator()) {
    if (browserURL != window.location) continue;
    let tbb = window.document.getElementById(id);

    if (tbb) buttons.push(tbb);
  }
  if (callback) buttons.forEach(callback);
  return buttons;
}

function toolbarbuttonExists(doc, id) {
  var toolbars = doc.getElementsByTagNameNS(NS_XUL, "toolbar");
  for (var i = toolbars.length - 1; ~i; i--) {
    if ((new RegExp("(?:^|,)" + id + "(?:,|$)")).test(toolbars[i].getAttribute("currentset")))
      return toolbars[i];
  }
  return false;
}
