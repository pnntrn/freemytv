'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ctx = {document: {addEventListener() {}}, window: {}, console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('web/cctv.js', 'utf8'), ctx);
const policy = ctx.CctvPolicy;
for (const address of ['10.0.0.1','172.16.0.1','172.31.255.254','192.168.1.1'])
  assert.equal(policy.privateAddress(address), true, address);
for (const address of ['8.8.8.8','127.0.0.1','localhost','example.com','172.32.1.1','10.1','010.0.0.1','10.0.0.256'])
  assert.equal(policy.privateAddress(address), false, address);
assert.equal(policy.stream('https://10.2.3.4:8080/camera/{channel}/index.m3u8',21),
  'https://10.2.3.4:8080/camera/21/index.m3u8');
for (const url of ['rtsp://10.0.0.1/ch{channel}', 'http://viewer:secret@10.0.0.1/{channel}.m3u8',
  'http://8.8.8.8/{channel}.m3u8', 'http://10.0.0.1:0/{channel}.m3u8',
  'http://10.0.0.1/{channel}.m3u8?token=secret', 'http://10.0.0.1/../{channel}.m3u8',
  'http://10.0.0.1//evil/{channel}.m3u8', 
  'https://192.168.1.1.evil/{channel}.m3u8'])
  assert.throws(() => policy.stream(url,1), /private|Private|Invalid/, url);
for (const ch of [0,65,1.5,'21/evil']) assert.throws(() => policy.stream('http://10.0.0.1/{channel}.m3u8',ch));
const dictionary = JSON.parse(fs.readFileSync('shared/th.json','utf8'));
const locale = {document:{documentElement:{}}, navigator:{language:'th-TH'}, window:{THAI:dictionary}};
vm.createContext(locale); vm.runInContext(fs.readFileSync('web/strings.js','utf8'), locale);
locale.I18N.set('auto');
assert.equal(locale.I18N.lang,'th');
assert.equal(locale.I18N.locale(),'th-TH');
assert.equal(locale.I18N.tr('Settings','Settings'),'การตั้งค่า');
locale.I18N.set('en');
assert.equal(locale.I18N.tr('Settings','Settings'),'Settings');
locale.window.CONFIG={latitude:'14.8818',longitude:'103.4936',city:'Mueang Surin, Surin, Thailand',language:'th',temperature:'C'};
locale.TV={zone:()=> 'Asia/Bangkok'};
locale.localStorage={getItem:()=>null,setItem(){}};
locale.I18N.set('th');
vm.runInContext(fs.readFileSync('web/data.js','utf8'),locale);
assert.equal(locale.Data.city,'Mueang Surin, Surin, Thailand');
assert.equal(locale.Data.hour(new Date(2026,9,22,0).getTime()),'00:00');
assert.equal(locale.Data.hour(new Date(2026,9,22,23).getTime()),'23:00');
assert.equal(locale.Data.degrees(25.9),'26°');
assert.equal(locale.Data.condition(0,true),'ท้องฟ้าแจ่มใส');
console.log('CCTV private URL/channel and Thai language tests passed');

assert.equal(policy.grid(3,4),12); assert.equal(policy.grid(4,4),16);
for (const shape of [[0,4],[4,5],[1.5,2],[undefined,undefined],[NaN,1]])
  assert.throws(() => policy.grid(...shape));
assert.deepEqual(Array.from(policy.order('3,1,0,2',32)),[3,1,0,2]);
assert.equal(policy.order('',32).length,32);
for (const value of ['1,1','33','1,','-1']) assert.throws(() => policy.order(value,32));
assert.equal(policy.stream('http://10.0.0.1/index.m3u8',1),'http://10.0.0.1/index.m3u8');
console.log('12/16/custom grid and camera order tests passed');
