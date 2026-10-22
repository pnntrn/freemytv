'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const id='9Ur5IzDKqV.TizenYouTube';
function harness(cached='',apps=[{id,title:'YouTube'}]){
  const events={},saved={},launches=[];let scans=0,reloads=0,backs=0;
  class Element{
    constructor(tag){this.tagName=tag;this.children=[];this.style={};this.attributes={};this.textContent='';}
    set innerHTML(value){this.children=[];}
    appendChild(child){this.children.push(child);return child;}
    setAttribute(name,value){this.attributes[name]=value;}
    focus(){document.activeElement=this;}
  }
  const document={body:new Element('body'),hidden:false,createElement:tag=>new Element(tag),
    addEventListener(name,callback){events[name]=callback;}};
  const context={document,window:{location:{reload(){reloads++;}}},
    Prefs:{language:()=> 'th',youtubeApp:()=>cached,set(name,value){saved[name]=value;}},
    I18N:{set(){},tr:(pt,en)=>en},
    TV:{keys:{ok:13,back:10009},apps(done){scans++;done(apps);},launch(app,params,done){launches.push({id:app,done});},back(){backs++;}},
    setInterval(){throw Error('Minimal home must not create refresh timers');},
    XMLHttpRequest:function(){throw Error('Minimal home must not request feeds');}};
  vm.createContext(context);vm.runInContext(fs.readFileSync('web/youtube-home.js','utf8'),context);
  context.YouTubeHome.start();
  const main=document.body.children[0],button=main.children[0],status=main.children[1];
  function key(code){let prevented=false;events.keydown({keyCode:code,preventDefault(){prevented=true;}});return prevented;}
  return {context,main,button,status,events,saved,launches,key,scans:()=>scans,reloads:()=>reloads,backs:()=>backs};
}
{
  const h=harness(id);
  assert.equal(h.main.id,'youtube-home');assert.equal(h.scans(),0,'Cached YouTube avoids installed-app discovery');
  assert.equal(h.main.children.filter(e=>e.tagName==='button').length,1);
  assert.equal(h.button.attributes['aria-label'],'YouTube');
  assert.equal(h.key(13),true);assert.equal(h.launches[0].id,id);
  h.key(13);assert.equal(h.launches.length,1,'Repeated OK does not start overlapping launches');
  h.launches[0].done(true);assert.equal(h.status.textContent,'Press OK to open YouTube');
  h.key(10009);assert.equal(h.backs(),1);
  h.key(406);assert.equal(h.saved.youtubeOnly,false);assert.equal(h.reloads(),1,'Blue restores the existing full home');
}
{
  const h=harness();assert.equal(h.scans(),1);assert.equal(h.saved.youtubeApp,id);
  h.button.onclick();h.launches[0].done(false);
  assert.equal(h.status.textContent,'Could not open YouTube.');
  h.button.onclick();assert.equal(h.launches.length,2,'A failed launch can be retried explicitly');
}
{
  const h=harness('',[{id:'another.app',title:'YouTube Kids'}]);
  h.key(13);assert.equal(h.launches.length,0);assert.equal(h.status.textContent,'YouTube is not installed on this TV.');
}
{
  let starts=0;
  vm.runInNewContext(fs.readFileSync('web/home.js','utf8'),{
    Prefs:{youtubeOnly:()=>true},YouTubeHome:{start(){starts++;}},
    setInterval(){throw Error('Full home refresh timer must not start');},
    Data:new Proxy({},{get(){throw Error('Full home feeds must not initialize');}})
  });
  assert.equal(starts,1,'Minimal mode bypasses the full home startup');
}
console.log('YouTube-only startup, native launch, remote navigation, retry and full-home restore tests passed');
