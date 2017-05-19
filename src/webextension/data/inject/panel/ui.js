/* globals youtube */
'use strict';

var tItem = document.getElementById('template-item');
var tPage = document.getElementById('template-page');
var items = document.getElementById('items');
var toolbar = document.getElementById('toolbar');
var info;

function page () {
  toolbar.textContent = '';
  let a = items.querySelector('a:last-of-type');
  if (a) {
    const pages = Math.floor(
      a.getBoundingClientRect().left / window.innerWidth
    ) + 1;
    for (let i = 1; i <= pages; i += 1) {
      let item = document.importNode(tPage.content, true);
      item.querySelector('label').textContent = i;
      item.querySelector('label').setAttribute('for', 'page-' + i);
      item.querySelector('input').id = 'page-' + i;
      item.querySelector('input').checked = i === 1;
      toolbar.appendChild(item);
    }
  }
}
window.addEventListener('resize', page);

function build (o) {
  info = o;
  document.body.dataset.loading = false;
  info.formats.forEach(format => {
    const textContent = [].concat.apply([], [
      format.container.toUpperCase(),
      format.dash === 'a' ? 'audio-only' : format.resolution || format.quality,
      '-',
      format.dash === 'v' ? 'video-only' : [
        format.audioEncoding.toUpperCase(),
        format.audioBitrate + 'K',
      ]
    ]).join(' ');
    let item = document.importNode(tItem.content, true);
    item.querySelector('span:nth-child(2)').textContent = textContent;
    const title = format.name;
    item.querySelector('a').href = format.url + '&title=' +
      encodeURIComponent(title);
    item.querySelector('a').download = title;
    item.querySelector('a').dataset.itag = format.itag;
    if (format.dash) {
      item.querySelector('img').src = (format.dash === 'v' ? 'video' : 'audio') + '-only.svg';
    }
    const size = item.querySelector('span:last-of-type');
    youtube.size(format.url, true).then(s => {
      size.textContent = s;
    });
    item = items.appendChild(item);
  });
  page();
}

document.addEventListener('change', e => {
  const id = /\d+/.exec(e.target.id);
  if (id) {
    items.style = `transform: translate(-${100 * (id[0] - 1)}%, 0)`;
  }
});
