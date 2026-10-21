/* CCTV for Tizen/webOS: private HLS gateway only. No credentials or stream URLs are persisted.
 * Older TV browsers cannot play NVR RTSP in a video element. The gateway remains inside LAN/VPN.
 * ES5 is intentional for Tizen 3. Decode capacity and HLS authentication need hardware tests.
 */
var CctvPolicy = (function () {
  'use strict';
  function privateAddress(host) {
    if (!/^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/.test(host || '')) return false;
    var p = host.split('.'), n = [], i;
    for (i = 0; i < 4; i++) {
      if (p[i].length > 3 || (p[i].length > 1 && p[i].charAt(0) === '0') || +p[i] > 255) return false;
      n[i] = +p[i];
    }
    return n[0] === 10 || n[0] === 172 && n[1] >= 16 && n[1] <= 31 || n[0] === 192 && n[1] === 168;
  }
  function stream(template, channel) {
    if (typeof template !== 'string' || template.length > 2048 || !/^[1-9][0-9]?$/.test(String(channel))
        || channel > 64) throw new Error('Invalid private stream');
    // Avoid URL normalization ambiguities, embedded credentials, queries and fragments. The trusted gateway must keep all playlists/segments private.
    var m = /^(https?):\/\/([0-9.]+)(?::([0-9]+))?(\/[A-Za-z0-9_./{}-]+\.m3u8)$/.exec(template);
    if (!m || !privateAddress(m[2]) || m[4].indexOf('..') >= 0 || m[4].indexOf('//') >= 0
        || m[3] && (+m[3] < 1 || +m[3] > 65535)) throw new Error('Private HLS gateway required');
    return template.replace(/\{channel\}/g, String(channel));
  }
  function order(value, channels) {
    if (channels < 1 || channels > 64 || channels % 1) throw new Error('Invalid channels');
    var result = [], seen = {}, i;
    if (!value || !value.replace(/\s/g, '')) { for (i = 1; i <= channels; i++) result.push(i); return result; }
    var parts = value.split(',');
    if (parts.length > 128) throw new Error('Too many slots');
    for (i = 0; i < parts.length; i++) {
      var v = parts[i].replace(/^\s+|\s+$/g, '');
      if (!/^[0-9]{1,2}$/.test(v) || +v > channels || +v > 0 && seen[+v]) throw new Error('Invalid channel order');
      result.push(+v); if (+v > 0) seen[+v] = true;
    }
    return result;
  }
  function grid(rows, columns) {
    if (typeof rows !== 'number' || typeof columns !== 'number' || !isFinite(rows) || !isFinite(columns) || rows < 1 || rows > 4 || columns < 1 || columns > 4 || rows % 1 || columns % 1) throw new Error('Invalid grid');
    return rows * columns;
  }
  return {privateAddress: privateAddress, stream: stream, order: order, grid: grid};
})();

var CCTV = (function () {
  'use strict';
  var profiles = [{title: 'Hikvision LAN', template: '', channels: 32}, {title: 'VIGI via VPN', template: '', channels: 16}];
  var root, toolbar, tiles, state, current = 0, page = 0, size = 4, rows = 2, columns = 2, expanded = 0, active = false;
  var layout = typeof Prefs !== 'undefined' && Prefs.cctvLayout ? Prefs.cctvLayout() : {};
  layout = layout && typeof layout === 'object' ? layout : {};
  var orders = layout.orders instanceof Array ? layout.orders : ['', ''];
  try { size = CctvPolicy.grid(layout.rows, layout.columns); rows = layout.rows; columns = layout.columns; } catch (e) {}
  function ordered() {
    try { return CctvPolicy.order(orders[current], profiles[current].channels); }
    catch (e) { return CctvPolicy.order('', profiles[current].channels); }
  }
  function saveLayout() { Prefs.set('cctvLayout', {rows: rows, columns: columns, orders: orders}); }
  var videos = [], timeouts = [], previousFocus;
  function t(s) { return I18N.tr(s, s, s); }
  function node(tag, parent, text) {
    var n = document.createElement(tag); if (text) n.textContent = text; if (parent) parent.appendChild(n); return n;
  }
  function stop() {
    for (var i = 0; i < timeouts.length; i++) clearTimeout(timeouts[i]); timeouts = [];
    for (var j = 0; j < videos.length; j++) {
      videos[j].onerror = videos[j].onloadeddata = null;
      try { videos[j].pause(); videos[j].removeAttribute('src'); videos[j].load(); } catch (e) {}
    }
    videos = [];
  }
  function close() {
    stop(); active = false;
    if (root && root.parentNode) root.parentNode.removeChild(root); root = null;
    if (previousFocus && previousFocus.focus) previousFocus.focus();
  }
  function button(parent, text, fn) {
    var b = node('button', parent, text); b.type = 'button'; b.className = 'cctv-button'; b.onclick = fn; return b;
  }
  function focusable() { return root.querySelectorAll('button, input'); }
  function key(e) {
    if (!active) return;
    var k = e.keyCode, target = e.target || document.activeElement, input = target && target.tagName === 'INPUT';
    if (k === 10009 || k === 461 || k === 27) {
      if (expanded) { expanded = 0; render(); } else close();
    } else if (input) { e.stopImmediatePropagation(); return; }
    else if (k >= 37 && k <= 40) {
      var all = focusable(), at = -1, i;
      for (i = 0; i < all.length; i++) if (all[i] === document.activeElement) at = i;
      var columnCount = expanded ? 1 : columns;
      var inGrid = target && target.className === 'cctv-tile';
      var delta = k === 37 ? -1 : k === 39 ? 1 : k === 38 ? -(inGrid ? columnCount : 1) : (inGrid ? columnCount : 1);
      if (at < 0) at = 0;
      if (all.length) all[Math.max(0, Math.min(all.length - 1, at + delta))].focus();
    } else if (k === 13) { if (target && target.click) target.click(); }
    else { e.stopImmediatePropagation(); return; }
    e.preventDefault(); e.stopImmediatePropagation();
  }
  function configure() {
    stop(); root.innerHTML = '';
    node('h2', root, t(profiles[current].title));
    node('p', root, t('Use HLS over LAN/VPN. Raw RTSP is not supported here.'));
    var form = node('div', root); form.className = 'cctv-form';
    var lbl = node('label', form, t('Private HLS gateway URL template'));
    var input = node('input', lbl); input.type = 'text'; input.value = profiles[current].template;
    input.placeholder = 'http://192.168.1.2:8080/camera/{channel}/index.m3u8';
    input.autocomplete = 'off'; input.spellcheck = false;
    var countLabel = node('label', form, t('Channels')), count = node('input', countLabel);
    count.type = 'number'; count.min = '1'; count.max = '64'; count.value = profiles[current].channels;
    var error = node('p', form); error.setAttribute('role', 'alert');
    button(form, t('Save') + ' · ' + t('Session only'), function () {
      try {
        var n = +count.value;
        if (!/^[0-9]+$/.test(count.value) || n < 1 || n > 64) throw new Error('channels');
        CctvPolicy.stream(input.value, 1);
        if (n > 1 && input.value.indexOf('{channel}') < 0) throw new Error('Template needs channel');
        if (profiles[current].channels !== n) orders[current] = '';
        profiles[current].template = input.value; profiles[current].channels = n; saveLayout();
        page = 0; expanded = 0; render();
      } catch (e) { error.textContent = t('Private LAN or VPN only.'); }
    });
    button(form, t('Cancel'), render); input.focus();
  }
  function cell(channel, count) {
    var tile = node('button', tiles); tile.className = 'cctv-tile'; tile.type = 'button';
    tile.style.width = ((100 / (expanded ? 1 : columns)) - 1.1) + '%';
    tile.style.height = ((100 / (expanded ? 1 : rows)) - 2) + '%';
    tile.setAttribute('aria-label', t('Channel ') + channel);
    tile.onclick = function () { expanded = expanded ? 0 : channel; render(); };
    if (!channel) { tile.textContent = t('Empty'); return; }
    var video = node('video', tile); video.muted = true; video.autoplay = true; video.setAttribute('playsinline', '');
    var status = node('span', tile, t('Channel ') + channel + ' · ' + t('Connecting…'));
    video.onerror = function () { status.textContent = t('Stream unavailable. Check VPN, credentials and codec.'); };
    video.onloadeddata = function () { clearTimeout(timer); status.textContent = t('Channel ') + channel; };
    var timer = setTimeout(function () { video.onerror(); try { video.pause(); video.removeAttribute('src'); video.load(); } catch (e) {} }, 20000);
    timeouts.push(timer); videos.push(video);
    try {
      video.src = CctvPolicy.stream(profiles[current].template, channel);
      var play = video.play(); if (play && play.catch) play.catch(function () { video.onerror(); });
    } catch (e) { video.onerror(); }
  }
  function chooseGrid() {
    stop(); root.innerHTML = ''; node('h2', root, t('Grid'));
    var presets = [[1,1],[2,2],[3,3],[3,4],[4,4]];
    for (var i = 0; i < presets.length; i++) (function (p) {
      button(root, (p[0]*p[1]) + ' (' + p[0] + '×' + p[1] + ')', function () {
        rows = p[0]; columns = p[1]; size = rows * columns; page = 0; expanded = 0; saveLayout(); render();
      });
    })(presets[i]);
    var rl = node('label', root, t('Rows')), ri = node('input', rl);
    ri.type = 'number'; ri.min = '1'; ri.max = '4'; ri.value = rows;
    var cl = node('label', root, t('Columns')), ci = node('input', cl);
    ci.type = 'number'; ci.min = '1'; ci.max = '4'; ci.value = columns;
    var err = node('p', root);
    button(root, t('Custom'), function () {
      try { size = CctvPolicy.grid(+ri.value, +ci.value); rows = +ri.value; columns = +ci.value;
        page = 0; expanded = 0; saveLayout(); render();
      } catch (e) { err.textContent = '1–4'; }
    });
    button(root, t('Back'), render); root.querySelector('button').focus();
  }
  function arrange() {
    stop(); root.innerHTML = ''; node('h2', root, t('Arrange'));
    var label = node('label', root, t('Channel order (comma-separated, 0 = empty)')), input = node('input', label);
    input.type = 'text'; input.value = ordered().join(','); input.style.width = '90%';
    var error = node('p', root); error.setAttribute('role','alert');
    button(root, t('Save'), function () {
      try { orders[current] = CctvPolicy.order(input.value, profiles[current].channels).join(',');
        page = 0; expanded = 0; saveLayout(); render();
      } catch (e) { error.textContent = t('Invalid channel order'); }
    });
    button(root, t('Back'), render); input.focus();
  }
  function render() {
    if (!active) return; stop(); root.innerHTML = '';
    toolbar = node('div', root); toolbar.className = 'cctv-toolbar';
    button(toolbar, t(profiles[current].title), function () { current = 1 - current; page = 0; expanded = 0; render(); });
    button(toolbar, t('Configure NVR'), configure);
    button(toolbar, t('Grid') + ' ' + size, chooseGrid);
    button(toolbar, t('Arrange'), arrange);
    button(toolbar, t('Previous'), function () { page = Math.max(0, page - 1); expanded = 0; render(); });
    button(toolbar, t('Next'), function () { page = Math.min(Math.ceil(ordered().length / size) - 1, page + 1); expanded = 0; render(); });
    button(toolbar, t('Close'), close);
    state = node('p', root, t('Private LAN or VPN only.') + ' · ' + t('Page ') + (page + 1) + ' · ' + t('Session only'));
    tiles = node('div', root); tiles.className = 'cctv-tiles';
    if (!profiles[current].template) node('p', tiles, t('Use HLS over LAN/VPN. Raw RTSP is not supported here.'));
    else {
      var count = expanded ? 1 : size;
      for (var i = 0; i < count; i++) {
        var ch = expanded || ordered()[page * size + i] || 0;
        cell(ch, count);
      }
    }
    toolbar.firstChild.focus();
  }
  function open() {
    if (active) return; active = true; previousFocus = document.activeElement;
    root = node('section', document.body); root.id = 'cctv'; root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', t('CCTV')); root.setAttribute('aria-modal', 'true'); render();
  }
  document.addEventListener('keydown', key, true);
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else if (active) render(); });
  return {open: open, close: close, get active() { return active; }};
})();
