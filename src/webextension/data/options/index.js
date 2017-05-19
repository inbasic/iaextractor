/* globals locale */
'use strict';

document.addEventListener('click', e => {
  let cmd = e.target.dataset.cmd;
  if (cmd === 'reset') {
    e.target.parentNode.parentNode.querySelector('input').value = e.target.dataset.value;
  }
});
document.addEventListener('change', e => {
  if (e.target.dataset.cmd === 'insert') {
    let patern = document.getElementById('pattern');
    let {value, selectionStart, selectionEnd} = patern;
    patern.value = value.substr(0, selectionStart) + e.target.value + value.substr(selectionEnd);
    patern.focus();
  }
});

function save() {
  let ffmpeg = document.getElementById('ffmpeg').value;
  let doMerge = document.getElementById('doMerge').checked;
  let pretendHD = document.getElementById('pretendHD').checked;
  let remove = document.getElementById('remove').checked;
  let toAudio = document.getElementById('post-process').value === 'audio';
  let toMP3 = document.getElementById('post-process').value === 'mp3';
  let opusmixing = document.getElementById('opusmixing').checked;
  let pattern = document.getElementById('pattern').value;
  let savein = document.getElementById('savein').value;
  let saveAs = document.getElementById('saveAs').checked;
  let faqs = document.getElementById('faqs').checked;
  let notification = document.getElementById('notification').checked;
  let commands = {
    toAudio: document.getElementById('toAudio').value,
    toMP3: document.getElementById('toMP3').value,
    muxing: document.getElementById('muxing').value
  };

  chrome.storage.local.set({
    ffmpeg,
    doMerge,
    pretendHD,
    remove,
    toAudio,
    toMP3,
    opusmixing,
    pattern,
    savein,
    saveAs,
    notification,
    faqs,
    commands
  }, () => {
    const status = document.getElementById('status');
    status.textContent = locale.get('opt_013');
    setTimeout(() => status.textContent = '', 750);
  });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore() {
  // Use default value color = 'red' and likesColor = true.
  chrome.storage.local.get({
    ffmpeg: '',
    doMerge: true,
    toAudio: true,
    toMP3: false,
    pretendHD: true,
    remove: true,
    opusmixing: false,
    pattern: '[file_name].[extension]',
    savein: '',
    saveAs: false,
    notification: true,
    faqs: true,
    commands: {
      toMP3: '-loglevel error -i %input -q:a 0 %output',
      toAudio: '-loglevel error -i %input -acodec copy -vn %output',
      muxing: '-loglevel error -i %audio -i %video -acodec copy -vcodec copy %output'
    }
  }, prefs => {
    document.getElementById('ffmpeg').value = prefs.ffmpeg;
    document.getElementById('doMerge').checked = prefs.doMerge;
    document.getElementById('pretendHD').checked = prefs.pretendHD;
    document.getElementById('remove').checked = prefs.remove;
    document.getElementById('post-process').value = prefs.toAudio ? 'audio' : (prefs.toMP3 ? 'mp3' : 'nothing');
    document.getElementById('opusmixing').checked = prefs.opusmixing;
    document.getElementById('pattern').value = prefs.pattern;
    document.getElementById('savein').value = prefs.savein;
    document.getElementById('saveAs').checked = prefs.saveAs;
    document.getElementById('toAudio').value = prefs.commands.toAudio;
    document.getElementById('toMP3').value = prefs.commands.toMP3;
    document.getElementById('muxing').value = prefs.commands.muxing;
    document.getElementById('notification').checked = prefs.notification;
    document.getElementById('faqs').checked = prefs.faqs;
  });
}
document.addEventListener('DOMContentLoaded', restore);
document.getElementById('save').addEventListener('click', save);
