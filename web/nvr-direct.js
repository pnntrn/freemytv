/* Direct RTSP via the TizenBrew Node service ON THIS TV. ES5, no WASM or external libraries. */
var NvrDirect = (function () {
  'use strict';
  var base = 'http://127.0.0.1:8766', client = '', waiting = null;
  function request(method, path, body, binary, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, base + path, true); xhr.timeout = 12000;
    xhr.setRequestHeader('X-FreeMyTV-Client', '1');
    if (body) xhr.setRequestHeader('Content-Type', 'application/json');
    if (binary) xhr.responseType = 'arraybuffer';
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        var data;
        try { data = binary ? xhr.response : JSON.parse(xhr.responseText || '{}'); }
        catch (error) { callback(new Error('Invalid response from TV RTSP service')); return; }
        callback(null, data, xhr.status);
      } else {
        var message = 'TV RTSP service request failed (' + xhr.status + ')';
        try {
          var text = binary ? String.fromCharCode.apply(null, new Uint8Array(xhr.response)) : xhr.responseText;
          message = JSON.parse(text).error || message;
        } catch (ignore) {}
        callback(new Error(message));
      }
    };
    xhr.onerror = xhr.ontimeout = function () { callback(new Error('TV RTSP service unavailable. Open FreeMyTV through TizenBrew.')); };
    xhr.send(body ? JSON.stringify(body) : null); return xhr;
  }
  function getClient(callback) {
    if (client) { callback(null, client); return; }
    if (waiting) { waiting.push(callback); return; }
    waiting = [callback];
    request('POST', '/client', null, false, function (error, data) {
      var listeners = waiting; waiting = null;
      if (!error && (!data || !/^[a-f0-9]{48}$/.test(data.client))) error = new Error('Invalid response from TV RTSP service');
      if (!error) client = data.client;
      listeners.forEach(function (listener) { listener(error, client); });
    });
  }
  function play(video, profile, channel, report) {
    var active = true, id = '', token = '', xhr = null, timer = null, media = null, buffer = null, objectURL = '';
    var pending = null, removing = false, started = false, queueBytes = 0;
    function path(route) { return route + '?client=' + token + '&id=' + id; }
    function close() {
      if (!active) return;
      active = false; clearTimeout(timer);
      if (xhr) { xhr.onload = xhr.onerror = xhr.ontimeout = null; xhr.abort(); }
      if (id) request('DELETE', path('/stream'), null, false, function () {});
      if (buffer) buffer.removeEventListener('updateend', update);
      video.onplaying = video.onerror = null;
      video.pause(); video.removeAttribute('src'); video.load();
      if (objectURL) window.URL.revokeObjectURL(objectURL);
      pending = null; media = null; buffer = null;
    }
    function fail(error) { if (active) { close(); report(error.message, true); } }
    function append(data) {
      if (!active || !buffer) return;
      queueBytes = data.byteLength;
      if (queueBytes > 4 * 1024 * 1024) { fail(new Error('Video fragment exceeds TV memory limit')); return; }
      try {
        if (buffer.buffered.length && video.currentTime - buffer.buffered.start(0) > 20) {
          pending = data; removing = true; buffer.remove(0, video.currentTime - 10);
        } else buffer.appendBuffer(data);
      } catch (error) { fail(new Error('TV decoder rejected this stream. Use H.264 substream or fewer cameras.')); }
    }
    function next() {
      if (!active) return;
      xhr = request('GET', path('/next'), null, true, function (error, data, status) {
        if (!active) return;
        if (error) { fail(error); return; }
        if (status === 204 || !data.byteLength) { timer = setTimeout(next, 100); return; }
        append(data);
      });
    }
    function update() {
      if (!active) return;
      if (removing) { var data = pending; pending = null; removing = false; append(data); return; }
      if (!started) {
        started = true;
        var result = video.play(); if (result && result.catch) result.catch(function () { fail(new Error('TV could not start video playback')); });
      }
      if (buffer.buffered.length) {
        var end = buffer.buffered.end(buffer.buffered.length - 1);
        if (end - video.currentTime > 3) video.currentTime = Math.max(0, end - 0.5);
      }
      queueBytes = 0; next();
    }
    function connectDecoder(info) {
      if (!info || typeof info.codec !== 'string' || !/^(avc1\.[a-f0-9]{6}|hvc1\.[ABC]?\d{1,2}\.[A-F0-9]{1,8}\.[LH]\d{1,3}(?:\.[A-F0-9]{1,2}){0,6})$/.test(info.codec)) { fail(new Error('Invalid video codec')); return; }
      var type = 'video/mp4; codecs="' + info.codec + '"';
      if (!window.MediaSource || !window.MediaSource.isTypeSupported(type)) { fail(new Error('TV does not support this video profile')); return; }
      media = new window.MediaSource(); objectURL = window.URL.createObjectURL(media); video.src = objectURL;
      media.addEventListener('sourceopen', function () {
        if (!active || buffer) return;
        try {
          buffer = media.addSourceBuffer(type); buffer.addEventListener('updateend', update);
          buffer.addEventListener('error', function () { fail(new Error('TV decoder rejected this stream. Use H.264 substream or fewer cameras.')); });
          xhr = request('GET', path('/init'), null, true, function (error, data) { if (!active) return; if (error) fail(error); else append(data); });
        } catch (error) { fail(new Error('TV decoder could not be allocated. Use fewer cameras.')); }
      });
    }
    function info() {
      if (!active) return;
      xhr = request('GET', path('/info'), null, false, function (error, data, status) {
        if (!active) return;
        if (error) fail(error);
        else if (status === 202) timer = setTimeout(info, 500);
        else connectDecoder(data);
      });
    }
    video.onplaying = function () { if (active) report('', false); };
    video.onerror = function () { fail(new Error('TV decoder rejected this stream. Use H.264 substream or fewer cameras.')); };
    if (!window.MediaSource) { fail(new Error('TV Media Source Extensions unavailable')); return {close: close}; }
    function createStream(retried) { getClient(function (error, value) {
      if (!active) return;
      if (error) { fail(error); return; }
      token = value;
      xhr = request('POST', '/stream?client=' + token,
        {host: profile.host, port: profile.port, username: profile.username, password: profile.password, channel: channel, stream: profile.stream === 1 ? 1 : 2}, false,
        function (error, data) {
          if (active && error && error.message === 'Expired local client' && !retried) {
            if (client === token) client = '';
            createStream(true); return;
          }
          if (!error && data && /^[a-f0-9]{48}$/.test(data.id)) {
            id = data.id;
            if (!active) { request('DELETE', path('/stream'), null, false, function () {}); return; }
            info();
          } else if (active) fail(error || new Error('Invalid response from TV RTSP service'));
        });
    }); }
    createStream(false);
    return {close: close};
  }
  function resilientPlay(video, profile, channel, report) {
    var closed = false, current = null, timer = null, attempts = 0;
    function start() {
      if (closed) return;
      current = play(video, profile, channel, function (message, failed) {
        if (closed) return;
        if (!failed) attempts = 0;
        report(message, failed);
        if (failed && attempts < 3 && /^NVR (TCP connection failed|connection timed out|connection closed|video stream timed out|RTSP request timed out)$/.test(message)) {
          attempts++;
          timer = setTimeout(start, attempts * 3000);
        }
      });
    }
    start();
    return {close: function () { closed = true; clearTimeout(timer); if (current) current.close(); }};
  }
  return {play: resilientPlay};
})();
