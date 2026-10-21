'use strict';
// Test-only fake NVR. Verifies Digest, chunked RTSP/TCP, actual H.264 -> decodable MP4,
// loopback service boundaries and resource shutdown. No production mocks.
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const net = require('node:net'), http = require('node:http'), crypto = require('node:crypto');
const {spawnSync,spawn} = require('node:child_process');
const codec = require('../tizen/nvr-codec');
const service = require('../tizen/nvr-service');
const vm = require('node:vm');
// Node 4.4 has a misleading inherited Buffer.from. It is present but cannot allocate Buffers.
function LegacyBuffer(value){return typeof value==='number'?Buffer.alloc(value):Buffer.from(value);}
LegacyBuffer.from=function(){throw new TypeError('this is not a typed array.');};
const legacy={Buffer:LegacyBuffer,module:{exports:{}}};
vm.runInNewContext(fs.readFileSync('tizen/nvr-codec.js','utf8'),legacy);
assert.equal(legacy.module.exports.bytes([]).length,0);
assert.equal(legacy.module.exports.bytes('H264').toString(),'H264');

const hevc = process.env.NVR_TEST_HEVC === '1';
const Video = hevc ? codec.H265 : codec.H264;
const nalType = n => hevc ? (n[0] >>> 1) & 63 : n[0] & 31;
const base = {host:'192.168.0.200',port:554,channel:1,username:'viewer',password:'test-only-password'};
for (const host of ['8.8.8.8','127.0.0.1','localhost','192.168.0.200.evil','192.168.00.2','10.0.0.256'])
  assert.throws(()=>service.profile({...base,host}));
for (const channel of [-1,65,1.2,'1']) assert.throws(()=>service.profile({...base,channel}));
assert.equal(service.profile({...base,channel:0}).channel,0);
assert.match(new service.Rtsp({...base,channel:0},{}).uri,/\/001$/);
assert.match(new service.Rtsp({...base,stream:1},{}).uri,/\/101$/);
assert.match(new service.Rtsp(base,{}).uri,/\/102$/);
assert.throws(()=>service.profile({...base,stream:3}));
assert.throws(()=>service.streamDescription('m=video 0 RTP/AVP 96\r\na=rtpmap:96 JPEG/90000\r\na=control:track1\r\n','rtsp://192.168.0.200/',base),/NVR advertises: JPEG/);
assert.throws(()=>service.profile({...base,username:'viewer\r\nBad: value'}));
assert.throws(()=>service.parseChallenge('Basic realm="nvr"'));
assert.throws(()=>service.parseChallenge('Digest realm="nvr", nonce="abc", qop="auth-int"'));
const digest = service.parseChallenge('Digest realm="nvr", nonce="abc", qop="auth,auth-int"');
assert.match(service.authorization(digest,base,'DESCRIBE','rtsp://192.168.0.200/',1),/^Digest /);
assert.throws(()=>service.streamDescription('m=video 0 RTP/AVP 96\r\na=rtpmap:96 JPEG/90000\r\na=control:track1\r\n','rtsp://192.168.0.200/',base));
assert.throws(()=>service.streamDescription('m=video 0 RTP/AVP 96\r\na=rtpmap:96 H264/90000\r\na=control:rtsp://8.8.8.8/video\r\n','rtsp://192.168.0.200/',base));

const root = path.resolve(hevc ? 'out/hevc-test' : 'out/nvr-test'); fs.mkdirSync(root,{recursive:true});
const h264File = path.join(root,'source.h264'), mp4File = path.join(root,'result.mp4');
let generated = spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','testsrc2=size=320x180:rate=5',
  '-t','8','-c:v',hevc?'libx265':'libx264','-profile:v',hevc?'main':'baseline','-pix_fmt','yuv420p','-bf','0',hevc?'-x265-params':'-x264-params','keyint=5:aud=1:repeat-headers=1:pools=1:frame-threads=1:log-level=error','-f',hevc?'hevc':'h264',h264File],{encoding:'utf8'});
assert.equal(generated.status,0,generated.stderr || 'FFmpeg is required for media verification');
function nals(data) {
  const positions=[];
  for(let i=0;i+3<data.length;i++) if(data[i]===0&&data[i+1]===0&&(data[i+2]===1||data[i+2]===0&&data[i+3]===1)) {
    const prefix=data[i+2]===1?3:4;positions.push([i,i+prefix]);i+=prefix-1;
  }
  return positions.map((p,i)=>data.subarray(p[1],i+1<positions.length?positions[i+1][0]:data.length));
}
const source=nals(fs.readFileSync(h264File));
const sps=source.find(n=>nalType(n)===(hevc?33:7)),pps=source.find(n=>nalType(n)===(hevc?34:8)),vps=source.find(n=>nalType(n)===32);
const parameterTypes=hevc?[32,33,34]:[7,8];
const size=hevc?codec.hevcInfo(sps):codec.dimensions(sps);assert.equal(size.width,320);assert.equal(size.height,180);
const frames=[];let current=[];
for(const nal of source) { if(nalType(nal)===(hevc?35:9)&&current.length){frames.push(current);current=[];}current.push(nal); }
if(current.length)frames.push(current);
let sequence=65520;
function packets(frame,index) {
  const payloads=[];
  // Test STAP-A parameter aggregation plus FU-A slices, RTP extension and sequence wrap.
  const sets=frame.filter(n=>parameterTypes.includes(nalType(n)));
  if(sets.length){const parts=[Buffer.from(hevc?[96,1]:[24])];for(const nal of sets){const length=Buffer.alloc(2);length.writeUInt16BE(nal.length);parts.push(length,nal);}payloads.push(Buffer.concat(parts));}
  for(const nal of frame.filter(n=>!parameterTypes.includes(nalType(n)))) {
    if(nal.length<=500)payloads.push(nal);
    else for(let at=hevc?2:1;at<nal.length;at+=400){
      const flags=(at===(hevc?2:1)?128:0)|(at+400>=nal.length?64:0);
      const header=hevc?[(nal[0]&129)|98,nal[1],nalType(nal)|flags]:[(nal[0]&224)|28,nalType(nal)|flags];
      payloads.push(Buffer.concat([Buffer.from(header),nal.subarray(at,at+400)]));
    }
  }
  return payloads.map((payload,i)=>{
    const header=Buffer.alloc(20);header[0]=0x90;header[1]=96|(i===payloads.length-1?128:0);
    header.writeUInt16BE(sequence++&65535,2);header.writeUInt32BE((0xffff0000+index*18000)>>>0,4);
    header.writeUInt32BE(42,8);header.writeUInt16BE(0xbeef,12);header.writeUInt16BE(1,14);
    return Buffer.concat([header,payload]);
  });
}
const allPackets=frames.map(packets);
const fragments=[];const demux=new Video({onInit:init=>fragments.push(init.data),onFragment:data=>fragments.push(data)});
for(const frame of allPackets)for(const packet of frame)demux.rtp(packet,96);
fs.writeFileSync(mp4File,Buffer.concat(fragments));
const probe=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-count_frames','-show_entries','stream=codec_name,width,height,nb_read_frames','-of','json',mp4File],{encoding:'utf8'});
assert.equal(probe.status,0,probe.stderr);
const stream=JSON.parse(probe.stdout).streams[0];
assert.equal(stream.codec_name,hevc?'hevc':'h264');assert.equal(stream.width,320);assert.equal(stream.height,180);
assert.equal(+stream.nb_read_frames,hevc?Math.floor((frames.length-1)/5)*5:frames.length-1,'Pending frames wait for duration and a complete HEVC fragment');
const decode=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-i',mp4File,'-f','null','-'],{encoding:'utf8'});
assert.equal(decode.status,0,decode.stderr);assert.equal(decode.stderr,'');
assert.throws(()=>new Video({}).rtp(Buffer.from([0]),96));
const broken=new Video({onInit(){},onFragment(){}});broken.rtp(allPackets[0][0],96);
const lost=Buffer.from(allPackets[0][1]);lost.writeUInt16BE((lost.readUInt16BE(2)+1)&65535,2);
assert.throws(()=>broken.rtp(lost,96),/loss/);

function listen(server,host,port=0){return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>resolve(server.address().port));});}
function close(server){return new Promise(resolve=>server.close(resolve));}
function fetchLocal(port,method,route,body,origin='http://127.0.0.1:8081') {
  return new Promise((resolve,reject)=>{
    const request=http.request({hostname:'127.0.0.1',port,method,path:route,headers:{Origin:origin,'X-FreeMyTV-Client':'1','Content-Type':'application/json'}},response=>{
      const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve({status:response.statusCode,body:Buffer.concat(chunks)}));
    });request.on('error',reject);request.end(body?JSON.stringify(body):undefined);
  });
}
async function main(){
  const network=Object.values(os.networkInterfaces()).flat().find(i=>i.family==='IPv4'&&!i.internal&&service.profile&&/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(i.address));
  assert.ok(network,'A private IPv4 interface is required for the RTSP integration fixture');
  const sockets=new Set();let authenticated=0,setup=0,playing=0;
  const fixture=net.createServer(socket=>{
    sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.on('error',()=>{});
    let incoming=Buffer.alloc(0),timer;
    socket.on('close',()=>clearInterval(timer));
    socket.on('data',data=>{
      incoming=Buffer.concat([incoming,data]);let end;
      while((end=incoming.indexOf('\r\n\r\n'))!==-1){
        const text=incoming.subarray(0,end).toString();incoming=incoming.subarray(end+4);
        const [method,uri]=text.split('\r\n')[0].split(' '),headers={};
        for(const line of text.split('\r\n').slice(1)){const at=line.indexOf(':');headers[line.slice(0,at).toLowerCase()]=line.slice(at+1).trim();}
        const respond=(status,extra={},body='')=>{
          const head='RTSP/1.0 '+status+'\r\nCSeq: '+headers.cseq+'\r\n'+Object.entries({...extra,'Content-Length':Buffer.byteLength(body)}).map(([key,value])=>key+': '+value+'\r\n').join('')+'\r\n';
          const output=Buffer.from(head+body);socket.write(output.subarray(0,13));socket.write(output.subarray(13));
        };
        if(method==='TEARDOWN'){socket.end();continue;}
        if(!headers.authorization){respond('401 Unauthorized',{'WWW-Authenticate':'Digest realm="fixture", nonce="fixture-nonce", qop="auth"'});continue;}
        const fields={};headers.authorization.replace(/(\w+)=(?:"([^"]*)"|([^,\s]+))/g,(_,key,quoted,value)=>{fields[key]=quoted===undefined?value:quoted;return '';});
        const hash=s=>crypto.createHash('md5').update(s).digest('hex');
        const expected=hash(hash(base.username+':fixture:'+base.password)+':fixture-nonce:'+fields.nc+':'+fields.cnonce+':auth:'+hash(method+':'+uri));
        assert.equal(fields.response,expected);authenticated++;
        if(method==='DESCRIBE')respond('200 OK',{'Content-Type':'application/sdp','Content-Base':uri+'/'},'v=0\r\nm=video 0 RTP/AVP 96\r\na=rtpmap:96 '+(hevc?'H265':'H264')+'/90000\r\na=fmtp:96 '+(hevc?'sprop-vps='+vps.toString('base64')+';sprop-sps='+sps.toString('base64')+';sprop-pps='+pps.toString('base64'):'packetization-mode=1;sprop-parameter-sets='+sps.toString('base64')+','+pps.toString('base64'))+'\r\na=control:trackID=1\r\n');
        else if(method==='SETUP'){setup++;respond('200 OK',{Session:'test-session;timeout=60',Transport:'RTP/AVP/TCP;unicast;interleaved=0-1'});}
        else if(method==='PLAY'){
          playing++;respond('200 OK',{Session:'test-session'});let index=0;
          timer=setInterval(()=>{
            if(index>=allPackets.length){clearInterval(timer);return;}
            for(const packet of allPackets[index++]){const header=Buffer.from([36,0,packet.length>>>8,packet.length&255]);socket.write(Buffer.concat([header,packet]));}
          },25);
        }else respond('200 OK',{Session:'test-session'});
      }
    });
  });
  const fixturePort=await listen(fixture,network.address);
  const httpPort=18766;let api,child;
  try{
    if(process.env.NVR_NODE4){
      child=spawn(process.env.NVR_NODE4,['-e',"var s=require('./tizen/nvr-service').createService({port:18766});s.on('error',function(e){console.error(e.code);process.exit(1)});s.listen(18766,'127.0.0.1',function(){console.log('ready')});"],{cwd:path.resolve('.')});
      await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('Node 4 fixture service startup timed out')),5000);
        child.once('error',error=>{clearTimeout(timer);reject(error);});
        child.once('exit',code=>{clearTimeout(timer);reject(Error('Node 4 service exited: '+code));});
        child.stdout.on('data',data=>{if(data.toString().includes('ready')){clearTimeout(timer);resolve();}});
      });
    }else{api=service.createService({port:httpPort});await listen(api,'127.0.0.1',httpPort);}
    assert.equal((await fetchLocal(httpPort,'POST','/client',null,'http://evil.example')).status,403);
    const registration=await fetchLocal(httpPort,'POST','/client');assert.equal(registration.status,200);
    const client=JSON.parse(registration.body).client;
    assert.equal((await fetchLocal(httpPort,'GET','/info?client=__proto__&id=__proto__')).status,403);
    const created=await fetchLocal(httpPort,'POST','/stream?client='+client,{...base,host:network.address,port:fixturePort});
    assert.equal(created.status,200,created.body.toString());const id=JSON.parse(created.body).id;
    const query='?client='+client+'&id='+id;
    let info;
    for(let i=0;i<50;i++){info=await fetchLocal(httpPort,'GET','/info'+query);if(info.status!==202)break;await new Promise(r=>setTimeout(r,20));}
    assert.equal(info.status,200,info.body.toString());assert.match(JSON.parse(info.body).codec,hevc?/^hvc1\./:/^avc1\./);
    const init=await fetchLocal(httpPort,'GET','/init'+query);assert.equal(init.status,200);
    const media=await fetchLocal(httpPort,'GET','/next'+query);assert.equal(media.status,200);assert.ok(media.body.includes(Buffer.from('moof')));
    assert.ok(authenticated>=3);assert.equal(setup,1);assert.equal(playing,1);
    assert.equal((await fetchLocal(httpPort,'DELETE','/stream'+query)).status,204);
    assert.equal((await fetchLocal(httpPort,'GET','/info'+query)).status,404);
    console.log('Digest RTSP/TCP, RTP fragmentation/wrap, real FFmpeg decode, local service origin and cleanup tests passed');
  }finally{
    for(const socket of sockets)socket.destroy();
    if(api)await close(api);
    if(child&&child.exitCode===null){const exited=new Promise(resolve=>child.once('exit',resolve));child.kill();await exited;}
    await close(fixture);
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
