'use strict';
// Component-level DOM harness: verifies routing, resources and persisted-data boundaries.
// This does not emulate Samsung media decoders, CSS rendering or a real TV remote.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const events = {}, saved = {}, timers = new Map(), directCalls = []; let timerID = 0;
let document;
class Element {
  constructor(tag) {
    this.tagName = tag.toUpperCase(); this.children = []; this.style = {};
    this.attributes = {}; this.className = ''; this.value = ''; this._text = '';
  }
  set innerHTML(value) { this.children = []; this._text = value; }
  get innerHTML() { return this._text; }
  set textContent(value) { this._text = String(value); }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  get firstChild() { return this.children[0]; }
  appendChild(child) { this.children.push(child); child.parentNode = this; return child; }
  removeChild(child) { this.children.splice(this.children.indexOf(child),1); child.parentNode = null; }
  setAttribute(name,value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; if (name === 'src') this.src = ''; }
  focus() { document.activeElement = this; }
  click() { if (this.onclick) this.onclick(); }
  play() { this.playing = true; return {catch() {}}; }
  pause() { this.playing = false; }
  load() { this.loaded = true; }
  querySelectorAll(selector) {
    const tags = selector.toUpperCase().split(/,\s*/); const out = [];
    function visit(node) { for (const child of node.children) { if (tags.includes(child.tagName)) out.push(child); visit(child); } }
    visit(this); return out;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}
document = {createElement: tag => new Element(tag), activeElement:null, hidden:false,
  addEventListener(name,listener) { events[name] = listener; }};
document.body = new Element('body');
const ctx = {document, window:{}, console, I18N:{tr:(pt,en)=>en},
  NvrDirect:{play(video,profile,channel,report){
    const call={profile:{...profile},channel,closed:false};directCalls.push(call);
    report('',false);return {close(){call.closed=true;}};
  }},
  Prefs:{cctvLayout:()=>({rows:2,columns:2,orders:['','']}),set:(key,value)=>{saved[key]=value;}},
  setTimeout(fn) { const id = ++timerID; timers.set(id,fn); return id; },
  clearTimeout(id) { timers.delete(id); }};
vm.createContext(ctx); vm.runInContext(fs.readFileSync('web/cctv.js','utf8'),ctx);
function root() { return document.body.children[0]; }
function button(text) {
  const found = root().querySelectorAll('button').find(b => b.textContent === text);
  assert.ok(found, 'Button exists: ' + text); return found;
}
function key(code) {
  events.keydown({keyCode:code,target:document.activeElement,preventDefault(){},stopImmediatePropagation(){}});
}
ctx.CCTV.open(); assert.equal(ctx.CCTV.active,true);
button('Grid 4').click(); button('12 (3×4)').click();
assert.equal(saved.cctvLayout.rows,3); assert.equal(saved.cctvLayout.columns,4);
button('Configure NVR').click();
let inputs = root().querySelectorAll('input'); inputs[0].value = 'http://10.8.0.2:8080/cam/{channel}.m3u8'; inputs[1].value='32';
button('Save · Session only').click();
assert.equal(root().querySelectorAll('video').length,12);
button('Arrange').click(); root().querySelector('input').value='3,1,0,2'; button('Save').click();
assert.equal(root().querySelectorAll('video').length,3);
assert.equal(saved.cctvLayout.orders[0],'3,1,0,2');
assert.ok(!JSON.stringify(saved).includes('10.8.0.2'),'Stream address must not enter persisted preferences');
let tiles = root().querySelectorAll('button').filter(b => b.className==='cctv-tile');
tiles[0].click(); assert.equal(root().querySelectorAll('video').length,1);
key(10009); assert.equal(root().querySelectorAll('video').length,3);
let videos = root().querySelectorAll('video'); document.hidden=true; events.visibilitychange();
assert.ok(videos.every(v=>v.src==='' && !v.playing),'Background stops/releases streams');
document.hidden=false; events.visibilitychange();
button('Hikvision LAN').click(); assert.equal(root().querySelectorAll('video').length,0);
button('Close').click(); assert.equal(ctx.CCTV.active,false); assert.equal(document.body.children.length,0);
assert.equal(timers.size,0,'Close clears outstanding connection timers');
ctx.CCTV.open(); button('VIGI via VPN').click(); button('Configure NVR').click();
button('Direct RTSP on TV (TizenBrew)').click();
inputs=root().querySelectorAll('input');
inputs[0].value='192.168.0.200';inputs[1].value='554';inputs[2].value='viewer';inputs[3].value='test-only-password';inputs[4].value='16';
button('Save · Session only').click();
assert.equal(directCalls.length,1,'Direct mode starts with a single substream');
assert.equal(directCalls[0].channel,1);
button('NVR mosaic (Channel Zero)').click();assert.equal(directCalls[0].closed,true);assert.equal(directCalls.at(-1).channel,0);
button('Grid 1').click();button('16 (4×4)').click();
assert.equal(root().querySelectorAll('video').length,16);
assert.deepEqual(directCalls.slice(-16).map(c=>c.channel),Array.from({length:16},(_,i)=>i+1));
button('Close').click();assert.ok(directCalls.every(c=>c.closed));
assert.ok(!JSON.stringify(saved).includes('test-only-password'));
assert.ok(!JSON.stringify(saved).includes('192.168.0.200'));
ctx.CCTV.open();assert.equal(root().querySelectorAll('video').length,0,'Closing CCTV forgets direct connection credentials');
button('Close').click();
console.log('CCTV component navigation, custom layout, lifecycle and session-data tests passed');
