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
