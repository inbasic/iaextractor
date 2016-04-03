'use strict';

var {require} = Components.utils.import('resource://gre/modules/commonjs/toolkit/require.js', {});

function emit (msg) {
  Components.classes['@mozilla.org/observer-service;1']
    .getService(Components.interfaces.nsIObserverService)
    .notifyObservers(null, 'iaextractor', msg);
}

document.addEventListener('click', function (e) {
  let target = e.target;
  if (target.localName === 'label') {
    let checkbox = target.parentNode.querySelector('checkbox');
    if (checkbox) {
      checkbox.click();
    }
  }
  if (target.classList.contains('text-link')) {
    require('sdk/tabs').open(target.textContent);
  }
}, false);

var myPrefObserver = {
  branch: Components.classes['@mozilla.org/preferences-service;1']
    .getService(Components.interfaces.nsIPrefService)
    .getBranch('extensions.feca4b87-3be4-43da-a1b1-137c24220968@jetpack.'),
  register: function () {
    if (!('addObserver' in this.branch)) {
      this.branch.QueryInterface(Components.interfaces.nsIPrefBranch2);
    }
    this.branch.addObserver('', this, false);
    document.querySelector('[preference="userFolder"]').disabled = this.branch.getIntPref('dFolder') !== 5;
  },
  unregister: function () {
    this.branch.removeObserver('', this);
  },
  observe: function (aSubject, aTopic, aData) {
    switch (aData) {
      case 'dFolder':
        let id = aSubject.getIntPref(aData);
        document.querySelector('[preference="userFolder"]').disabled = id !== 5;
        break;
    }
  },
};
myPrefObserver.register();

document.getElementById('namePattern-placeholders').addEventListener('command', function (e) {
  let label = e.target.label;
  let textbox = document.querySelector('[preference="namePattern"]');
  let value = textbox.value;
  if (label) {
    let position = textbox.selectionStart + label.length;
    textbox.value = value.substr(0, textbox.selectionStart) + label + value.substr(textbox.selectionStart);
    textbox.selectionStart = textbox.selectionEnd = position;
    textbox.focus();
  }
}, false);

(function (textbox) {
  textbox.addEventListener('keydown', function (e) {
    if (e.keyCode === 9 || (e.ctrlKey && e.keyCode === 87) || (e.altKey && e.keyCode === 115)) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    let comb = [];
    if ((e.ctrlKey || (e.shiftKey && e.altKey) || (e.shiftKey && e.ctrlKey) || e.altKey) && (e.keyCode >= 65 && e.keyCode <= 90)) {
      if (e.ctrlKey) {
        comb.push('Accel');
      }
      if (e.shiftKey) {
        comb.push('Shift');
      }
      if (e.altKey) {
        comb.push('Alt');
      }
      comb.push(String.fromCharCode(e.keyCode));
      myPrefObserver.branch.setCharPref('downloadHKey', comb.join(' + '));
    }
    else {
      myPrefObserver.branch.setCharPref('downloadHKey', '');
    }
  }, true);
})(document.querySelector('[preference="downloadHKey"]'));

