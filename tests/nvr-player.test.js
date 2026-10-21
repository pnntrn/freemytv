'use strict';
// Browser lifecycle contract; all simulated browser/service objects stay in test code.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function harness(){
  const requests=[],timers=new Map(),sources=[],revoked=[];let timer=0;
  class XHR{
    open(method,path){this.method=method;this.path=path;this.headers={};}
    setRequestHeader(name,value){this.headers[name]=value;}
    send(body){this.body=body;requests.push(this);}
    abort(){this.aborted=true;}
    respond(status,data){this.status=status;if(this.responseType==='arraybuffer')this.response=data;else this.responseText=JSON.stringify(data);if(this.onload)this.onload();}
  }
  class SourceBuffer{
    constructor(){this.listeners={};this.appended=[];this.buffered={length:0};}
    addEventListener(name,fn){this.listeners[name]=fn;}
    removeEventListener(name){delete this.listeners[name];}
    appendBuffer(data){this.appended.push(data);}
    done(){if(this.listeners.updateend)this.listeners.updateend();}
  }
  class MediaSource{
    static isTypeSupported(){return true;}
    constructor(){this.listeners={};sources.push(this);}
    addEventListener(name,fn){this.listeners[name]=fn;}
    addSourceBuffer(type){this.type=type;this.buffer=new SourceBuffer();return this.buffer;}
  }
  const context={XMLHttpRequest:XHR,Uint8Array,ArrayBuffer,Error,JSON,console,
    setTimeout(fn){const id=++timer;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);},
    window:{MediaSource,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:value=>revoked.push(value)}}};
  vm.createContext(context);vm.runInContext(fs.readFileSync('web/nvr-direct.js','utf8'),context);
  function video(){return {currentTime:0,play(){this.playing=true;return {catch(){}};},pause(){this.playing=false;},removeAttribute(name){delete this[name];},load(){this.loaded=true;}};}
  return {requests,timers,sources,revoked,context,video,player:context.NvrDirect};
}
const profile={host:'192.168.0.200',port:554,username:'viewer',password:'test-only-password'};
const client='a'.repeat(48),id='b'.repeat(48);
{
  const h=harness(),videos=Array.from({length:16},()=>h.video());
  const players=videos.map((v,i)=>h.player.play(v,profile,i+1,()=>{}));
  assert.equal(h.requests.length,1,'Concurrent tiles share a single local-client handshake');
  players[0].close();h.requests[0].respond(200,{client});
  assert.equal(h.requests.length,16,'Closed tile never sends credentials or opens an RTSP stream');
  for(const request of h.requests.slice(1)){
    assert.equal(request.headers['X-FreeMyTV-Client'],'1');
    assert.ok(!request.path.includes(profile.password));assert.equal(JSON.parse(request.body).password,profile.password);
  }
  players.forEach(p=>p.close());assert.ok(h.requests.slice(1).every(r=>r.aborted));
}
{
  const h=harness(),v=h.video(),reported=[];
  const player=h.player.play(v,profile,1,(...args)=>reported.push(args));
  h.requests[0].respond(200,{client});h.requests[1].respond(200,{id});
  h.requests[2].respond(200,{codec:'avc1.42c00b',width:320,height:180});
  assert.equal(v.src,'blob:test');h.sources[0].listeners.sourceopen();
  const init=new ArrayBuffer(20);h.requests[3].respond(200,init);
  assert.equal(h.sources[0].buffer.appended[0],init);
  h.sources[0].buffer.done();assert.equal(v.playing,true);
  const fragment=new ArrayBuffer(30);h.requests[4].respond(200,fragment);
  assert.equal(h.sources[0].buffer.appended[1],fragment);
  v.onplaying();assert.deepEqual(reported.at(-1),['',false]);
  player.close();assert.equal(v.playing,false);assert.equal(v.src,undefined);
  assert.deepEqual(h.revoked,['blob:test']);assert.ok(h.requests.some(r=>r.method==='DELETE'));
  assert.equal(h.timers.size,0);
}
{
  const h=harness(),reported=[];h.player.play(h.video(),profile,1,(...args)=>reported.push(args));
  h.requests[0].respond(200,{client});h.requests[1].respond(200,{id});
  h.requests[2].respond(422,{error:'NVR rejected username or password'});
  assert.equal(h.timers.size,0,'Wrong password is not retried and cannot cause a repeated-login loop');
  assert.equal(reported.at(-1)[0],'NVR rejected username or password');
}
{
  const h=harness(),p=h.player.play(h.video(),profile,1,()=>{});
  h.requests[0].respond(200,{client});h.requests[1].respond(200,{id});
  h.requests[2].respond(422,{error:'NVR TCP connection failed'});
  assert.equal(h.timers.size,1,'Network errors schedule bounded reconnect');
  p.close();assert.equal(h.timers.size,0,'Leaving CCTV cancels reconnect');
}
{
  const h=harness(),reported=[];h.context.window.MediaSource=null;
  h.player.play(h.video(),profile,1,(...args)=>reported.push(args));
  assert.equal(h.requests.length,0);assert.match(reported[0][0],/Media Source/);
}
{
  const h=harness(),p=h.player.play(h.video(),profile,1,()=>{});
  h.requests[0].respond(200,{client});
  h.requests[1].respond(403,{error:'Expired local client'});
  assert.equal(h.requests[2].path,'/client','Expired service capabilities are renewed once');
  h.requests[2].respond(200,{client:'c'.repeat(48)});
  assert.ok(h.requests[3].path.includes('c'.repeat(48)));p.close();
}
console.log('Direct player shared startup, MSE append, cancellation, credential boundaries and safe retry tests passed');
