/* Developer-only replacement of the known FreeMyTV loopback service.
 * Does not inspect socket data or credentials. The TV web form/profile stays in memory.
 */
(function () {
  'use strict';
  var http = require('http'), net = require('net');
  if (typeof process._getActiveHandles !== 'function') throw new Error('Developer service upgrade unsupported');
  var handles = process._getActiveHandles();
  var servers = handles.filter(function (handle) {
    if (!(handle instanceof http.Server)) return false;
    var address = handle.address();
    return address && address.address === '127.0.0.1' && address.port === 8766;
  });
  if (servers.length > 1) throw new Error('Ambiguous FreeMyTV service handle');
  if (servers.length === 1) {
    servers[0].close(startUpdatedService);
    handles.forEach(function (handle) {
      if (handle instanceof net.Socket && handle.localPort === 8766) handle.destroy();
    });
  } else startUpdatedService();
  function startUpdatedService() {
var NvrCodec = (function () { var module = {exports:{}};
'use strict';
// H.264 / HEVC RTP -> fragmented MP4. ES5 / Node 4 for TizenBrew on 2017 TVs.
// No decoding: the TV's MSE decoder handles the original compressed video.
// Node 4.4 exposes an inherited TypedArray.from as Buffer.from, but calling it throws.
// Buffer.alloc identifies the real modern Buffer API; Node 4 needs its constructor.
function bytes(value) { return typeof Buffer.alloc === 'function' ? Buffer.from(value) : new Buffer(value); }
function zero(size) { var b = new Buffer(size); b.fill(0); return b; }
function u16(n) { var b = zero(2); b.writeUInt16BE(n, 0); return b; }
function u32(n) { var b = zero(4); b.writeUInt32BE(n >>> 0, 0); return b; }
function box(type) {
  var parts = Array.prototype.slice.call(arguments, 1), payload = Buffer.concat(parts);
  return Buffer.concat([u32(payload.length + 8), bytes(type), payload]);
}
function full(type, version, flags) {
  return box.apply(null, [type, bytes([version, flags >>> 16, (flags >>> 8) & 255, flags & 255])]
    .concat(Array.prototype.slice.call(arguments, 3)));
}
function rbsp(nal, header) {
  var out = [], i;
  for (i = header || 1; i < nal.length; i++) {
    if (i >= 3 && nal[i] === 3 && nal[i - 1] === 0 && nal[i - 2] === 0) continue;
    out.push(nal[i]);
  }
  return bytes(out);
}
function Bits(data) { this.data = data; this.position = 0; }
Bits.prototype.read = function (length) {
  if (length < 0 || length > 32 || this.position + length > this.data.length * 8) throw new Error('Invalid H.264 bitstream');
  var n = 0;
  while (length--) { n = n * 2 + ((this.data[this.position >>> 3] >>> (7 - (this.position & 7))) & 1); this.position++; }
  return n;
};
Bits.prototype.ue = function () {
  var count = 0;
  while (this.read(1) === 0) { if (++count > 30) throw new Error('Invalid H.264 Golomb code'); }
  return Math.pow(2, count) - 1 + this.read(count);
};
Bits.prototype.se = function () { var n = this.ue(); return n & 1 ? (n + 1) / 2 : -n / 2; };
function dimensions(sps) {
  var r = new Bits(rbsp(sps)), profile = r.read(8), chroma = 1, separate = 0, i, j;
  r.read(8); r.read(8); r.ue();
  if ([100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134, 135].indexOf(profile) !== -1) {
    chroma = r.ue(); if (chroma > 3) throw new Error('Unsupported H.264 chroma');
    if (chroma === 3) separate = r.read(1);
    r.ue(); r.ue(); r.read(1);
    if (r.read(1)) for (i = 0; i < (chroma === 3 ? 12 : 8); i++) if (r.read(1)) {
      var last = 8, next = 8;
      for (j = 0; j < (i < 6 ? 16 : 64); j++) { if (next) next = (last + r.se() + 256) % 256; last = next || last; }
    }
  }
  r.ue(); var poc = r.ue();
  if (poc === 0) r.ue();
  else if (poc === 1) { r.read(1); r.se(); r.se(); var cycles = r.ue(); if (cycles > 256) throw new Error('Invalid H.264 SPS'); for (i = 0; i < cycles; i++) r.se(); }
  else if (poc !== 2) throw new Error('Unsupported H.264 POC');
  r.ue(); r.read(1);
  var width = (r.ue() + 1) * 16, heightMap = r.ue() + 1, frame = r.read(1);
  if (!frame) throw new Error('Interlaced H.264 unsupported; select a progressive substream');
  r.read(1);
  var left = 0, right = 0, top = 0, bottom = 0;
  if (r.read(1)) { left = r.ue(); right = r.ue(); top = r.ue(); bottom = r.ue(); }
  var format = separate ? 0 : chroma, cropX = format === 0 || format === 3 ? 1 : 2;
  var cropY = format === 1 ? 2 : 1;
  var size = {width: width - (left + right) * cropX, height: heightMap * 16 - (top + bottom) * cropY};
  if (size.width < 1 || size.height < 1 || size.width > 4096 || size.height > 2160) throw new Error('Unsupported H.264 dimensions');
  return size;
}
function initialization(sps, pps) {
  var size = dimensions(sps);
  var config = box('avcC', bytes([1, sps[1], sps[2], sps[3], 255, 225]), u16(sps.length), sps, bytes([1]), u16(pps.length), pps);
  return mp4Initialization(size, 'avc1', config, 'avc1.' + sps.slice(1, 4).toString('hex'));
}
function mp4Initialization(size, entry, config, name, timescale) {
  var matrix = Buffer.concat([u32(65536), u32(0), u32(0), u32(0), u32(65536), u32(0), u32(0), u32(0), u32(1073741824)]);
  var mvhd = full('mvhd', 0, 0, zero(8), u32(90000), u32(0), u32(65536), u16(256), zero(10), matrix, zero(24), u32(2));
  var tkhd = full('tkhd', 0, 7, zero(8), u32(1), zero(4), u32(0), zero(8), zero(8), matrix, u32(size.width * 65536), u32(size.height * 65536));
  var mdhd = full('mdhd', 0, 0, zero(8), u32(timescale || 90000), u32(0), u16(21956), u16(0));
  var hdlr = full('hdlr', 0, 0, u32(0), bytes('vide'), zero(12), bytes('Video\0'));
  var avc1 = box(entry, zero(6), u16(1), zero(16), u16(size.width), u16(size.height), u32(4718592), u32(4718592), u32(0), u16(1), zero(32), u16(24), u16(65535), config);
  var stbl = box('stbl', full('stsd', 0, 0, u32(1), avc1), full('stts', 0, 0, u32(0)), full('stsc', 0, 0, u32(0)), full('stsz', 0, 0, u32(0), u32(0)), full('stco', 0, 0, u32(0)));
  var dinf = box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1)));
  var minf = box('minf', full('vmhd', 0, 1, zero(8)), dinf, stbl);
  var trak = box('trak', tkhd, box('mdia', mdhd, hdlr, minf));
  return {data: Buffer.concat([box('ftyp', bytes('isom'), u32(512), bytes('isomiso6avc1mp41')), box('moov', mvhd, trak, box('mvex', full('trex', 0, 0, u32(1), u32(1), zero(12))))]),
    codec: name, width: size.width, height: size.height};
}
function fragment(sequence, time, duration, sample, key) {
  return fragmentSamples(sequence, time, [{duration: duration, data: sample, key: key}]);
}
function fragmentSamples(sequence, time, samples) {
  var tfdt = full('tfdt', 1, 0, u32(Math.floor(time / 4294967296)), u32(time % 4294967296));
  var fields = [], data = [];
  samples.forEach(function (sample) {
    fields.push(u32(sample.duration), u32(sample.data.length)); data.push(sample.data);
  });
  function moof(offset) {
    return box('moof', full('mfhd', 0, 0, u32(sequence)), box('traf', full('tfhd', 0, 131104, u32(1), u32(16842752)), tfdt,
      full('trun', 0, 773, u32(samples.length), u32(offset), u32(samples[0].key ? 33554432 : 16842752), Buffer.concat(fields))));
  }
  var first = moof(0);
  return Buffer.concat([moof(first.length + 8), box('mdat', Buffer.concat(data))]);
}
function H264(options) {
  this.sps = options.sps || null; this.pps = options.pps || null;
  this.onInit = options.onInit; this.onFragment = options.onFragment;
  this.parts = []; this.partBytes = 0; this.fu = null; this.timestamp = null;
  this.lastSequence = null; this.pending = null; this.started = false; this.time = 0; this.sequence = 1;
}
H264.prototype.nal = function (nal) {
  if (!nal.length) throw new Error('Empty H.264 NAL');
  var type = nal[0] & 31;
  if (type === 7 || type === 8) {
    var name = type === 7 ? 'sps' : 'pps';
    if (this.started && this[name] && !this[name].equals(nal)) throw new Error('Stream format changed; reconnect');
    this[name] = bytes(nal); return;
  }
  if (type === 1 || type === 5) {
    var bits = new Bits(rbsp(nal)); bits.ue();
    if (bits.ue() % 5 === 1) throw new Error('B frames unsupported; choose H.264 baseline substream');
  }
  if (type < 1 || type > 23) throw new Error('Unsupported H.264 NAL');
  this.partBytes += nal.length + 4;
  if (this.partBytes > 2 * 1024 * 1024) throw new Error('Video frame exceeds memory limit');
  this.parts.push(bytes(nal));
};
H264.prototype.rtp = function (packet, payloadType) {
  if (packet.length < 12 || packet[0] >>> 6 !== 2) throw new Error('Invalid RTP header');
  if ((packet[1] & 127) !== payloadType) return;
  var sequence = packet.readUInt16BE(2), stamp = packet.readUInt32BE(4), marker = !!(packet[1] & 128);
  if (this.lastSequence !== null && sequence !== ((this.lastSequence + 1) & 65535)) throw new Error('RTP packet loss; reconnect');
  this.lastSequence = sequence;
  var at = 12 + (packet[0] & 15) * 4, end = packet.length;
  if (packet[0] & 16) { if (at + 4 > end) throw new Error('Invalid RTP extension'); at += 4 + packet.readUInt16BE(at + 2) * 4; }
  if (packet[0] & 32) { var pad = packet[end - 1]; if (!pad || pad > end - at) throw new Error('Invalid RTP padding'); end -= pad; }
  if (at >= end) throw new Error('Empty RTP payload');
  if (this.timestamp !== null && stamp !== this.timestamp && (this.parts.length || this.fu)) throw new Error('Incomplete H.264 frame');
  this.timestamp = stamp;
  this.payload(packet.slice(at, end));
  if (marker) {
    if (this.fu) throw new Error('Incomplete video fragment');
    if (this.parts.some(this.isSlice)) this.frame(stamp);
    this.parts = []; this.partBytes = 0;
  }
};
H264.prototype.payload = function (data) {
  var type = data[0] & 31, at;
  if (type >= 1 && type <= 23) { if (this.fu) throw new Error('Incomplete H.264 fragment'); this.nal(data); }
  else if (type === 24) {
    if (this.fu) throw new Error('Incomplete H.264 fragment');
    at = 1;
    while (at < data.length) {
      if (at + 2 > data.length) throw new Error('Invalid H.264 aggregation');
      var length = data.readUInt16BE(at); at += 2;
      if (!length || at + length > data.length) throw new Error('Invalid H.264 aggregation');
      this.nal(data.slice(at, at + length)); at += length;
    }
  } else if (type === 28) {
    if (data.length < 3 || (data[1] & 32) || (data[1] & 192) === 192) throw new Error('Invalid H.264 FU-A');
    if (data[1] & 128) {
      if (this.fu) throw new Error('Overlapping H.264 fragments');
      this.fu = [bytes([(data[0] & 224) | (data[1] & 31)])]; this.fuBytes = 1;
    }
    if (!this.fu) throw new Error('H.264 fragment start missing');
    this.fuBytes += data.length - 2;
    if (this.fuBytes > 2 * 1024 * 1024) throw new Error('Video frame exceeds memory limit');
    this.fu.push(data.slice(2));
    if (data[1] & 64) { var complete = Buffer.concat(this.fu); this.fu = null; this.nal(complete); }
  } else throw new Error('Unsupported H.264 RTP packetization');
};
H264.prototype.isSlice = function (nal) { var t = nal[0] & 31; return t === 1 || t === 5; };
H264.prototype.isKey = function (nal) { return (nal[0] & 31) === 5; };
H264.prototype.makeInit = function () {
  if (!this.sps || !this.pps) throw new Error('H.264 parameter sets missing');
  return initialization(this.sps, this.pps);
};
H264.prototype.frame = function (stamp) {
  var key = this.parts.some(this.isKey);
  if (!this.started) {
    if (!key) return;
    this.onInit(this.makeInit()); this.started = true;
  }
  if (this.pending) {
    var duration = (stamp - this.pending.stamp) >>> 0;
    if (!duration || duration > 900000) throw new Error('Unsupported RTP timestamp discontinuity');
    this.emitSample(duration, this.pending);
    this.time += duration;
  }
  var parts = [];
  this.parts.forEach(function (nal) { parts.push(u32(nal.length), nal); });
  this.pending = {stamp: stamp, data: Buffer.concat(parts), key: key};
};
H264.prototype.emitSample = function (duration, sample) {
  this.onFragment(fragment(this.sequence++, this.time, duration, sample.data, sample.key));
};
// RFC 7798 single-layer HEVC without decoding-order-number fields.
function hevcInfo(sps) {
  var r = new Bits(rbsp(sps, 2)), i, profiles = [], levels = [], constraints = [];
  r.read(4); var layers = r.read(3), nested = r.read(1), profile = r.read(8), compatibility = r.read(32);
  for (i = 0; i < 6; i++) constraints.push(r.read(8));
  var level = r.read(8);
  for (i = 0; i < layers; i++) { profiles.push(r.read(1)); levels.push(r.read(1)); }
  if (layers) for (i = layers; i < 8; i++) r.read(2);
  for (i = 0; i < layers; i++) {
    if (profiles[i]) { r.read(32); r.read(32); r.read(24); }
    if (levels[i]) r.read(8);
  }
  r.ue(); var chroma = r.ue(), separate = 0;
  if (chroma > 3) throw new Error('Invalid HEVC chroma');
  if (chroma === 3) separate = r.read(1);
  var width = r.ue(), height = r.ue(), left = 0, right = 0, top = 0, bottom = 0;
  if (r.read(1)) { left = r.ue(); right = r.ue(); top = r.ue(); bottom = r.ue(); }
  var depthY = r.ue(), depthC = r.ue(); r.ue();
  var all = r.read(1);
  for (i = all ? 0 : layers; i <= layers; i++) {
    r.ue(); if (r.ue() !== 0) throw new Error('HEVC reordered pictures unsupported; disable B frames'); r.ue();
  }
  var format = separate ? 0 : chroma;
  width -= (left + right) * (format === 1 || format === 2 ? 2 : 1);
  height -= (top + bottom) * (format === 1 ? 2 : 1);
  if (width < 1 || height < 1 || width > 4096 || height > 2160 || depthY > 2 || depthC > 2) throw new Error('Unsupported HEVC dimensions or bit depth');
  var reversed = 0;
  for (i = 0; i < 32; i++) reversed = reversed * 2 + ((compatibility >>> i) & 1);
  var suffix = constraints.slice(); while (suffix.length && suffix[suffix.length - 1] === 0) suffix.pop();
  var name = 'hvc1.' + ['', 'A', 'B', 'C'][profile >>> 6] + (profile & 31) + '.' + reversed.toString(16).toUpperCase()
    + '.' + (profile & 32 ? 'H' : 'L') + level + suffix.map(function (n) { return '.' + n.toString(16).toUpperCase(); }).join('');
  return {width: width, height: height, profile: profile, compatibility: compatibility, constraints: constraints,
    level: level, chroma: chroma, depthY: depthY, depthC: depthC, layers: layers, nested: nested, codec: name};
}
function hevcInitialization(vps, sps, pps) {
  var info = hevcInfo(sps), arrays = [];
  [vps, sps, pps].forEach(function (nal, i) {
    if (nal.length > 65535) throw new Error('HEVC parameter set too large');
    arrays.push(bytes([128 | (32 + i)]), u16(1), u16(nal.length), nal);
  });
  var config = box('hvcC', bytes([1, info.profile]), u32(info.compatibility), bytes(info.constraints), bytes([info.level]),
    u16(61440), bytes([252, 252 | info.chroma, 248 | info.depthY, 248 | info.depthC]), u16(0),
    bytes([((info.layers + 1) << 3) | (info.nested << 2) | 3, 3]), Buffer.concat(arrays));
  return mp4Initialization(info, 'hvc1', config, info.codec, 1200000);
}
function H265(options) {
  H264.call(this, options); this.vps = options.vps || null;
  this.samples = []; this.sampleBytes = 0; this.sampleTime = 0;
}
H265.prototype = Object.create(H264.prototype);
H265.prototype.constructor = H265;
// This Samsung generation rejects one-frame HEVC fragments, even FFmpeg-generated ones.
// Group five frames and use the track timescale accepted in the on-device control test.
H265.prototype.emitSample = function (duration, sample) {
  if (!this.samples.length) this.sampleTime = Math.round(this.time * 40 / 3);
  this.samples.push({data: sample.data, key: sample.key,
    duration: Math.round((this.time + duration) * 40 / 3) - Math.round(this.time * 40 / 3)});
  this.sampleBytes += sample.data.length;
  if (this.sampleBytes > 4 * 1024 * 1024) throw new Error('HEVC fragment exceeds memory limit');
  if (this.samples.length === 5) {
    this.onFragment(fragmentSamples(this.sequence++, this.sampleTime, this.samples));
    this.samples = []; this.sampleBytes = 0;
  }
};
H265.prototype.isSlice = function (nal) { return ((nal[0] >>> 1) & 63) < 32; };
H265.prototype.isKey = function (nal) { var t = (nal[0] >>> 1) & 63; return t >= 16 && t <= 21; };
H265.prototype.makeInit = function () {
  if (!this.vps || !this.sps || !this.pps) throw new Error('HEVC parameter sets missing');
  return hevcInitialization(this.vps, this.sps, this.pps);
};
H265.prototype.nal = function (nal) {
  if (nal.length < 2 || (nal[0] & 129) || (nal[1] & 248) || !(nal[1] & 7)) throw new Error('Invalid or multilayer HEVC NAL');
  var type = (nal[0] >>> 1) & 63;
  if (type >= 32 && type <= 34) {
    var name = ['vps', 'sps', 'pps'][type - 32];
    if (this.started && this[name] && !this[name].equals(nal)) throw new Error('Stream format changed; reconnect');
    this[name] = bytes(nal); return;
  }
  if (type > 40) throw new Error('Unsupported HEVC NAL');
  this.partBytes += nal.length + 4;
  if (this.partBytes > 2 * 1024 * 1024) throw new Error('Video frame exceeds memory limit');
  this.parts.push(bytes(nal));
};
H265.prototype.payload = function (data) {
  if (data.length < 2) throw new Error('Invalid HEVC payload');
  var type = (data[0] >>> 1) & 63, at, length;
  if (type < 48) { if (this.fu) throw new Error('Incomplete HEVC fragment'); this.nal(data); }
  else if (type === 48) {
    if (this.fu) throw new Error('Incomplete HEVC fragment');
    at = 2;
    while (at < data.length) {
      if (at + 2 > data.length) throw new Error('Invalid HEVC aggregation');
      length = data.readUInt16BE(at); at += 2;
      if (length < 2 || at + length > data.length) throw new Error('Invalid HEVC aggregation');
      this.nal(data.slice(at, at + length)); at += length;
    }
  } else if (type === 49) {
    if (data.length < 4 || (data[2] & 192) === 192 || (data[2] & 63) >= 48) throw new Error('Invalid HEVC FU');
    if (data[2] & 128) {
      if (this.fu) throw new Error('Overlapping HEVC fragments');
      this.fu = [bytes([(data[0] & 129) | ((data[2] & 63) << 1), data[1]])]; this.fuBytes = 2;
    }
    if (!this.fu) throw new Error('HEVC fragment start missing');
    this.fuBytes += data.length - 3;
    if (this.fuBytes > 2 * 1024 * 1024) throw new Error('Video frame exceeds memory limit');
    this.fu.push(data.slice(3));
    if (data[2] & 64) { var complete = Buffer.concat(this.fu); this.fu = null; this.nal(complete); }
  } else throw new Error('Unsupported HEVC RTP packetization');
};
module.exports = {H264: H264, H265: H265, hevcInfo: hevcInfo, hevcInitialization: hevcInitialization,
  initialization: initialization, dimensions: dimensions, fragment: fragment, bytes: bytes};

return module.exports; }());
'use strict';
// Runs ON THE TV in TizenBrew's Node service. Never bind this server to the LAN.
// Only Node built-ins; compatible with the Node 4 runtime on Tizen 3.
var codec = typeof NvrCodec !== 'undefined' ? NvrCodec : require('./nvr-codec');
var net = require('net'), http = require('http'), crypto = require('crypto'), url = require('url');
var MAX_BUFFER = 4 * 1024 * 1024;
function privateHost(host) {
  if (typeof host !== 'string' || !/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false;
  var p = host.split('.'), i;
  for (i = 0; i < 4; i++) if (+p[i] > 255 || (p[i].length > 1 && p[i][0] === '0')) return false;
  return +p[0] === 10 || +p[0] === 172 && +p[1] >= 16 && +p[1] <= 31 || +p[0] === 192 && +p[1] === 168;
}
function profile(input) {
  if (!input || !privateHost(input.host) || typeof input.port !== 'number' || input.port % 1 || input.port < 1 || input.port > 65535
      || typeof input.channel !== 'number' || input.channel % 1 || input.channel < 0 || input.channel > 64
      || typeof input.username !== 'string' || !input.username || input.username.length > 64
      || typeof input.password !== 'string' || input.password.length > 128
      || input.stream !== undefined && input.stream !== 1 && input.stream !== 2
      || /[\x00-\x1f\x7f]/.test(input.username + input.password)) throw new Error('Invalid private NVR profile');
  return {host: input.host, port: input.port, channel: input.channel, username: input.username, password: input.password, stream: input.stream === 1 ? 1 : 2};
}
function md5(text) { return crypto.createHash('md5').update(text, 'utf8').digest('hex'); }
function parseChallenge(header) {
  if (!header || !/^Digest\s/i.test(header)) throw new Error('NVR must support RTSP Digest authentication');
  var out = {}, expression = /([a-zA-Z]+)\s*=\s*(?:"([^"\r\n]*)"|([^,\s]+))/g, match;
  while ((match = expression.exec(header))) out[match[1].toLowerCase()] = match[2] === undefined ? match[3] : match[2];
  if (!out.realm || !out.nonce || out.algorithm && out.algorithm.toUpperCase() !== 'MD5'
      || out.qop && out.qop.split(/,\s*/).indexOf('auth') === -1) throw new Error('Unsupported RTSP Digest challenge');
  out.qop = out.qop ? 'auth' : ''; return out;
}
function authorization(challenge, credentials, method, uri, count) {
  function quote(s) { return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'; }
  var nc = ('00000000' + count.toString(16)).slice(-8), cnonce = crypto.randomBytes(12).toString('hex');
  var a1 = md5(credentials.username + ':' + challenge.realm + ':' + credentials.password), a2 = md5(method + ':' + uri);
  var response = md5(a1 + ':' + challenge.nonce + ':' + (challenge.qop ? nc + ':' + cnonce + ':auth:' : '') + a2);
  return 'Digest username=' + quote(credentials.username) + ', realm=' + quote(challenge.realm) + ', nonce=' + quote(challenge.nonce)
    + ', uri=' + quote(uri) + ', response=' + quote(response) + ', algorithm=MD5'
    + (challenge.opaque ? ', opaque=' + quote(challenge.opaque) : '')
    + (challenge.qop ? ', qop=auth, nc=' + nc + ', cnonce=' + quote(cnonce) : '');
}
function streamDescription(sdp, base, source) {
  var lines = sdp.split(/\r?\n/), video = false, candidates = [], format = {}, control = '', payloads = [], sessionControl = '', advertised = [];
  lines.forEach(function (line) {
    var match;
    if (/^m=/.test(line)) {
      if (video) candidates.push({format: format, control: control, payloads: payloads});
      video = /^m=video\s/.test(line); format = {}; control = ''; payloads = line.split(/\s+/).slice(3);
    } else if (video && (match = /^a=rtpmap:(\d+) ([A-Za-z0-9_-]{1,32})\/(\d+)\s*$/i.exec(line))) {
      format[match[1]] = format[match[1]] || {};
      format[match[1]].encoding = +match[3] === 90000 && /^(H264|H265)$/i.test(match[2]) ? match[2].toUpperCase() : '';
      if (advertised.indexOf(match[2].toUpperCase()) === -1) advertised.push(match[2].toUpperCase());
    } else if (video && (match = /^a=fmtp:(\d+) (.*)$/.exec(line))) {
      var item = format[match[1]] = format[match[1]] || {};
      item.fmtp = match[2];
    } else if ((match = /^a=control:(.*)$/.exec(line))) {
      if (video) control = match[1]; else if (!candidates.length) sessionControl = match[1];
    }
  });
  if (video) candidates.push({format: format, control: control, payloads: payloads});
  var found;
  candidates.some(function (candidate) {
    return candidate.payloads.some(function (id) {
      if (candidate.format[id] && candidate.format[id].encoding) { found = {id: +id, encoding: candidate.format[id].encoding, fmtp: candidate.format[id].fmtp || '', control: candidate.control}; return true; }
      return false;
    });
  });
  if (!found || !found.control || found.control === '*') throw new Error('No supported video track (NVR advertises: ' + (advertised.join(', ') || 'none') + ')');
  var packetization = /(?:^|;)\s*packetization-mode=(\d+)/.exec(found.fmtp);
  if (packetization && +packetization[1] > 1) throw new Error('Unsupported H.264 packetization mode');
  var sets = /(?:^|;)\s*sprop-parameter-sets=([^;\s]+)/.exec(found.fmtp), sps, pps, vps;
  if (sets) {
    sets[1].split(',').forEach(function (value) {
      if (value.length > 65536 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error('Invalid SDP parameter set');
      var nal = new Buffer(value, 'base64');
      if ((nal[0] & 31) === 7) sps = nal;
      if ((nal[0] & 31) === 8) pps = nal;
    });
  }
  if (found.encoding === 'H265') {
    var don = /(?:^|;)\s*sprop-max-don-diff=(\d+)/.exec(found.fmtp);
    if (don && +don[1]) throw new Error('HEVC decoding-order-number fields unsupported');
    ['vps', 'sps', 'pps'].forEach(function (name, index) {
      var match = new RegExp('(?:^|;)\\s*sprop-' + name + '=([^;\\s]+)').exec(found.fmtp);
      if (!match) return;
      var values = match[1].split(',');
      if (values.length !== 1 || values[0].length > 65536 || !/^[A-Za-z0-9+/]+={0,2}$/.test(values[0])) throw new Error('Invalid HEVC SDP parameter set');
      var nal = new Buffer(values[0], 'base64');
      if (nal.length < 2 || ((nal[0] >>> 1) & 63) !== 32 + index) throw new Error('Invalid HEVC SDP NAL type');
      if (index === 0) vps = nal; else if (index === 1) sps = nal; else pps = nal;
    });
  }
  var resolved = url.resolve(base, found.control), target = url.parse(resolved);
  if (target.protocol !== 'rtsp:' || target.hostname !== source.host || +(target.port || 554) !== source.port || target.auth
      || /[\r\n]/.test(resolved)) throw new Error('Cross-host RTSP track rejected');
  return {payloadType: found.id, encoding: found.encoding, uri: resolved, vps: vps, sps: sps, pps: pps, sessionControl: sessionControl};
}
function Rtsp(input, callbacks) {
  this.profile = profile(input); this.callbacks = callbacks; this.socket = null;
  this.uri = 'rtsp://' + this.profile.host + ':' + this.profile.port + '/Streaming/Channels/'
    + (input.channel === 0 ? '001' : input.channel + (this.profile.stream === 1 ? '01' : '02'));
  this.buffer = codec.bytes([]); this.cseq = 0; this.pending = null; this.session = ''; this.challenge = null; this.authCount = 0;
  this.closed = false; this.ready = false; this.keepalive = null; this.deadline = null;
}
Rtsp.prototype.fail = function (message) { if (!this.closed) { this.close(); this.callbacks.error(message); } };
Rtsp.prototype.start = function () {
  var self = this;
  this.deadline = setTimeout(function () { self.fail('NVR did not produce a video keyframe within 60 seconds'); }, 60000);
  this.socket = net.createConnection({host: this.profile.host, port: this.profile.port});
  this.socket.setTimeout(20000);
  this.socket.on('timeout', function () { self.fail('NVR connection timed out'); });
  this.socket.on('error', function () { self.fail('NVR TCP connection failed'); });
  this.socket.on('close', function () { self.fail('NVR connection closed'); });
  this.socket.on('data', function (data) { try { self.receive(data); } catch (error) { self.fail(error.message); } });
  this.socket.on('connect', function () {
    self.request('DESCRIBE', self.uri, {Accept: 'application/sdp'}, function (response) {
      var base = response.headers['content-base'] || self.uri + '/';
      var track = streamDescription(response.body.toString('utf8'), base, self.profile);
      var Video = track.encoding === 'H265' ? codec.H265 : codec.H264;
      self.video = new Video({vps: track.vps, sps: track.sps, pps: track.pps, onInit: function (init) {
        self.callbacks.init(init);
      }, onFragment: function (fragment) {
        clearTimeout(self.deadline);
        self.deadline = setTimeout(function () { self.fail('NVR video stream timed out'); }, 20000);
        self.callbacks.fragment(fragment);
      }});
      self.payloadType = track.payloadType;
      self.request('SETUP', track.uri, {Transport: 'RTP/AVP/TCP;unicast;interleaved=0-1'}, function (setup) {
        var session = setup.headers.session, transport = setup.headers.transport || '';
        if (!session || !/^[A-Za-z0-9_.-]+(?:;.*)?$/.test(session) || !/RTP\/AVP\/TCP/i.test(transport)
            || !/interleaved=0-1(?:;|$)/i.test(transport)) throw new Error('NVR did not accept RTSP over TCP');
        self.session = session.split(';')[0];
        self.request('PLAY', self.uri, {Range: 'npt=0.000-'}, function () {
          self.ready = true;
          var timeout = /;\s*timeout=(\d+)/i.exec(session), seconds = timeout ? +timeout[1] : 60;
          if (seconds < 4) throw new Error('Unsupported short RTSP session timeout');
          self.keepalive = setInterval(function () {
            if (!self.pending && !self.closed) self.request('OPTIONS', self.uri, {}, function () {});
          }, Math.min(20000, seconds * 500));
        });
      });
    });
  });
};
Rtsp.prototype.request = function (method, uri, extra, callback, retry) {
  if (this.closed) return;
  if (this.pending) throw new Error('Overlapping RTSP request');
  var headers = {CSeq: ++this.cseq, 'User-Agent': 'FreeMyTV-NVR/1.0'}, self = this;
  Object.keys(extra).forEach(function (key) { headers[key] = extra[key]; });
  if (this.session) headers.Session = this.session;
  if (this.challenge) headers.Authorization = authorization(this.challenge, this.profile, method, uri, ++this.authCount);
  var text = method + ' ' + uri + ' RTSP/1.0\r\n';
  Object.keys(headers).forEach(function (key) { text += key + ': ' + headers[key] + '\r\n'; });
  this.pending = {cseq: this.cseq, method: method, uri: uri, extra: extra, callback: callback, retry: !!retry,
    timer: setTimeout(function () { self.fail('NVR RTSP request timed out'); }, 10000)};
  this.socket.write(text + '\r\n');
};
Rtsp.prototype.receive = function (data) {
  if (this.closed) return;
  if (this.buffer.length + data.length > MAX_BUFFER) throw new Error('NVR packet buffer limit exceeded');
  this.buffer = Buffer.concat([this.buffer, data]);
  while (this.buffer.length && !this.closed) {
    if (this.buffer[0] === 36) {
      if (this.buffer.length < 4) return;
      var length = this.buffer.readUInt16BE(2);
      if (this.buffer.length < length + 4) return;
      var packet = this.buffer.slice(4, length + 4), channel = this.buffer[1];
      this.buffer = this.buffer.slice(length + 4);
      if (channel === 0 && this.video) this.video.rtp(packet, this.payloadType);
      else if (channel !== 1) throw new Error('Unexpected RTP interleaved channel');
      continue;
    }
    var end = this.buffer.indexOf('\r\n\r\n');
    if (end < 0) { if (this.buffer.length > 32768) throw new Error('RTSP header limit exceeded'); return; }
    if (end > 32768) throw new Error('RTSP header limit exceeded');
    var lines = this.buffer.slice(0, end).toString('utf8').split('\r\n'), status = /^RTSP\/1\.0 (\d{3}) /.exec(lines.shift()), headers = {};
    if (!status) throw new Error('Invalid RTSP response');
    lines.forEach(function (line) {
      var colon = line.indexOf(':'); if (colon < 1) throw new Error('Invalid RTSP header');
      var key = line.slice(0, colon).toLowerCase();
      if (Object.prototype.hasOwnProperty.call(headers, key)) throw new Error('Duplicate RTSP header');
      headers[key] = line.slice(colon + 1).trim();
    });
    var size = headers['content-length'] || '0';
    if (!/^\d+$/.test(size) || +size > 262144) throw new Error('Invalid RTSP response length');
    if (this.buffer.length < end + 4 + +size) return;
    var body = this.buffer.slice(end + 4, end + 4 + +size); this.buffer = this.buffer.slice(end + 4 + +size);
    var pending = this.pending;
    if (!pending || String(pending.cseq) !== headers.cseq) throw new Error('Unexpected RTSP response sequence');
    clearTimeout(pending.timer); this.pending = null;
    if (+status[1] === 401 && !pending.retry) {
      this.challenge = parseChallenge(headers['www-authenticate']);
      this.request(pending.method, pending.uri, pending.extra, pending.callback, true);
    } else if (+status[1] !== 200) throw new Error(+status[1] === 401 ? 'NVR rejected username or password' : 'NVR RTSP request failed (' + status[1] + ')');
    else pending.callback({headers: headers, body: body});
  }
};
Rtsp.prototype.close = function () {
  if (this.closed) return;
  this.closed = true; clearTimeout(this.deadline); clearInterval(this.keepalive);
  if (this.pending) clearTimeout(this.pending.timer);
  this.pending = null;
  if (this.socket) {
    if (this.session && this.socket.writable) this.socket.write('TEARDOWN ' + this.uri + ' RTSP/1.0\r\nCSeq: ' + (++this.cseq) + '\r\nSession: ' + this.session + '\r\n\r\n');
    this.socket.destroy();
  }
  this.profile.password = ''; this.profile.username = ''; this.buffer = codec.bytes([]); this.video = null;
};
function createService(options) {
  options = options || {};
  var streams = Object.create(null), clients = Object.create(null), origin = 'http://127.0.0.1:8081', allowedHost = '127.0.0.1:' + (options.port || 8766);
  function json(res, status, object) { res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(object)); }
  function remove(id) {
    var stream = streams[id]; if (!stream) return;
    stream.rtsp.close(); if (stream.waiter) { stream.waiter.writeHead(410); stream.waiter.end(); }
    delete streams[id];
  }
  function flush(stream) {
    if (!stream.waiter) return;
    var response = stream.waiter;
    if (stream.error) { stream.waiter = null; json(response, 422, {error: stream.error}); }
    else if (stream.queue.length) {
      stream.waiter = null; var payload = Buffer.concat(stream.queue); stream.queue = []; stream.bytes = 0;
      response.writeHead(200, {'Content-Type': 'video/mp4', 'Cache-Control': 'no-store'}); response.end(payload);
    }
  }
  var server = http.createServer(function (req, res) {
    // Host + Origin + non-simple header prevent other LAN websites opening NVR connections.
    if (req.headers.host !== allowedHost || req.headers.origin !== origin) { json(res, 403, {error: 'TizenBrew module origin required'}); return; }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-FreeMyTV-Client');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS'); res.writeHead(204); res.end(); return;
    }
    if (req.headers['x-freemytv-client'] !== '1') { json(res, 403, {error: 'Module request required'}); return; }
    var parsed = url.parse(req.url, true), path = parsed.pathname, token = parsed.query.client;
    if (req.method === 'POST' && path === '/client') {
      if (Object.keys(clients).length >= 8) { json(res, 429, {error: 'Too many clients; restart TizenBrew'}); return; }
      var client = crypto.randomBytes(24).toString('hex'); clients[client] = Date.now();
      json(res, 200, {client: client}); return;
    }
    if (typeof token !== 'string' || !clients[token]) { json(res, 403, {error: 'Expired local client'}); return; }
    clients[token] = Date.now();
    if (req.method === 'POST' && path === '/stream') {
      var body = '', tooLarge = false;
      req.setEncoding('utf8');
      req.on('data', function (chunk) { body += chunk; if (body.length > 8192) { tooLarge = true; req.destroy(); } });
      req.on('error', function () {});
      req.on('end', function () {
        if (tooLarge) return;
        var stage = 'profile', input, id;
        try {
          input = profile(JSON.parse(body)); body = ''; stage = 'service';
          if (Object.keys(streams).length >= 16) { input.password = ''; json(res, 429, {error: '16-stream service limit reached'}); return; }
          id = crypto.randomBytes(24).toString('hex');
          var stream = {client: token, last: Date.now(), init: null, queue: [], bytes: 0, waiter: null, error: null, rtsp: null};
          stream.rtsp = new Rtsp(input, {init: function (init) { stream.init = init; }, fragment: function (fragment) {
            if (stream.bytes + fragment.length > MAX_BUFFER) { stream.rtsp.fail('Playback cannot keep up; use fewer or smaller substreams'); return; }
            stream.queue.push(fragment); stream.bytes += fragment.length; flush(stream);
          }, error: function (message) { stream.error = message; stream.queue = []; stream.bytes = 0; flush(stream); }});
          input.password = ''; streams[id] = stream;
          stage = 'connection'; stream.rtsp.start(); json(res, 200, {id: id});
        } catch (error) {
          body = ''; if (input) input.password = ''; if (id && streams[id]) remove(id);
          json(res, stage === 'profile' ? 400 : 500, {error: stage === 'profile' ? 'Invalid private NVR profile' : 'TV RTSP initialization failed (' + stage + ')'});
        }
      }); return;
    }
    var id = parsed.query.id, stream = typeof id === 'string' ? streams[id] : null;
    if (!stream || stream.client !== token) { json(res, 404, {error: 'Stream not found'}); return; }
    stream.last = Date.now();
    if (req.method === 'DELETE' && path === '/stream') { remove(id); res.writeHead(204); res.end(); }
    else if (req.method === 'GET' && path === '/info') {
      if (stream.error) json(res, 422, {error: stream.error});
      else if (!stream.init) json(res, 202, {connecting: true});
      else json(res, 200, {codec: stream.init.codec, width: stream.init.width, height: stream.init.height});
    } else if (req.method === 'GET' && path === '/init') {
      if (stream.error) json(res, 422, {error: stream.error});
      else if (!stream.init) json(res, 409, {error: 'Video not ready'});
      else { res.writeHead(200, {'Content-Type': 'video/mp4', 'Cache-Control': 'no-store'}); res.end(stream.init.data); }
    } else if (req.method === 'GET' && path === '/next') {
      if (stream.waiter) { json(res, 409, {error: 'Concurrent fragment request'}); return; }
      stream.waiter = res; flush(stream);
      var timer = setTimeout(function () { if (stream.waiter === res) { stream.waiter = null; res.writeHead(204); res.end(); } }, 5000);
      res.on('close', function () { clearTimeout(timer); if (stream.waiter === res) stream.waiter = null; });
      res.on('finish', function () { clearTimeout(timer); });
    } else json(res, 404, {error: 'Unknown route'});
  });
  var cleanup = setInterval(function () {
    var now = Date.now();
    Object.keys(streams).forEach(function (id) { if (now - streams[id].last > 15000) remove(id); });
    Object.keys(clients).forEach(function (id) { if (now - clients[id] > 300000) delete clients[id]; });
  }, 5000);
  server.on('close', function () { clearInterval(cleanup); Object.keys(streams).forEach(remove); });
  return server;
}
module.exports = {Rtsp: Rtsp, profile: profile, parseChallenge: parseChallenge, authorization: authorization, streamDescription: streamDescription, createService: createService};
if (typeof tizen !== 'undefined' || require.main === module) {
  var server = createService();
  server.on('error', function (error) { console.error('FreeMyTV NVR local service failed: ' + error.code); });
  server.listen(8766, '127.0.0.1');
}

}
})();
