// Developer telemetry only: reads playback counters, never images or input values.
const [host,portText]=process.argv.slice(2),port=Number(portText);
if(!/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)||!Number.isInteger(port)||port<1024||port>65535)throw Error('Explicit TV developer address required');
const response=await fetch('http://'+host+':'+port+'/json',{signal:AbortSignal.timeout(5000)});
if(!response.ok)throw Error('TV developer target unavailable');
const pages=await response.json();
const page=pages.find(p=>p.title==='Free My TV'&&p.url.indexOf('http://127.0.0.1:8081/module/')===0);
if(!page||!page.webSocketDebuggerUrl.startsWith('ws://'+host+':'+port+'/'))throw Error('FreeMyTV developer target not found');
const expression="(function(){var root=document.getElementById('cctv');if(!root)return JSON.stringify({cctv:false});var videos=root.querySelectorAll('video'),states=[],labels=root.querySelectorAll('.cctv-tile span'),status=[];for(var i=0;i<videos.length;i++){var v=videos[i];states.push({ready:v.readyState,paused:v.paused,time:v.currentTime,width:v.videoWidth,height:v.videoHeight,decoded:v.webkitDecodedFrameCount||0,dropped:v.webkitDroppedFrameCount||0,error:v.error?v.error.code:null});}for(i=0;i<labels.length;i++)status.push(labels[i].textContent);return JSON.stringify({cctv:true,timestamp:Date.now(),formFields:root.querySelectorAll('input').length,videos:states,status:status});}())";
const result=await new Promise((resolve,reject)=>{
  const ws=new WebSocket(page.webSocketDebuggerUrl),timer=setTimeout(()=>{ws.close();reject(Error('TV playback status timed out'));},6000);
  ws.onopen=()=>ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression,returnByValue:true}}));
  ws.onmessage=event=>{
    const message=JSON.parse(event.data);
    if(message.id!==1)return;
    clearTimeout(timer);ws.close();
    if(message.error||!message.result||!message.result.result||typeof message.result.result.value!=='string')reject(Error('Playback inspection failed'));
    else resolve(JSON.parse(message.result.result.value));
  };
  ws.onerror=()=>{clearTimeout(timer);reject(Error('TV developer connection failed'));};
});
console.log(JSON.stringify(result));
