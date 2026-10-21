'use strict';
// Component-level DOM harness: verifies routing, resources and persisted-data boundaries.
// This does not emulate Samsung media decoders, CSS rendering or a real TV remote.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const events = {}, saved = {}, timers = new Map(); let timerID = 0;
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
console.log('CCTV component navigation, custom layout, lifecycle and session-data tests passed');
