// Minimal, explicit SDB deployment utility. No external runtime dependencies.
// Uses Samsung's developer port; does not change developer settings or remove apps.
import net from 'node:net';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const commands={CNXN:0x4e584e43,OPEN:0x4e45504f,OKAY:0x59414b4f,WRTE:0x45545257,CLSE:0x45534c43,AUTH:0x48545541};
export function connect(host) {
  if(!/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)||host.split('.').some(p=>+p>255))throw Error('Use an explicit 192.168.x.x TV address');
  return new Promise((resolve,reject)=>{
    const socket=net.createConnection({host,port:26101});
    let received=Buffer.alloc(0),ready=false,current=null,ended=false;
    const timeout=setTimeout(()=>fail(Error('SDB handshake timed out')),5000);
    function packet(command,a=0,b=0,data=Buffer.alloc(0)){
      const header=Buffer.alloc(24);header.writeUInt32LE(command,0);header.writeUInt32LE(a>>>0,4);header.writeUInt32LE(b>>>0,8);
      header.writeUInt32LE(data.length,12);header.writeUInt32LE(data.reduce((sum,byte)=>(sum+byte)>>>0,0),16);header.writeUInt32LE((command^0xffffffff)>>>0,20);
      socket.write(Buffer.concat([header,data]));
    }
    function fail(error){if(ended)return;ended=true;clearTimeout(timeout);if(current){clearTimeout(current.timeout);current.reject(error);}socket.destroy();if(!ready)reject(error);}
    socket.on('error',fail);socket.on('close',()=>{if(!ended)fail(Error('SDB connection closed'));});
    socket.on('connect',()=>packet(commands.CNXN,0x01000000,4096,Buffer.from('host::\0')));
    function flush(){if(current&&current.remote&&current.writable&&current.queue.length){current.writable=false;packet(commands.WRTE,1,current.remote,current.queue.shift());}}
    socket.on('data',chunk=>{
      received=Buffer.concat([received,chunk]);
      while(received.length>=24){
        const command=received.readUInt32LE(0),a=received.readUInt32LE(4),b=received.readUInt32LE(8),length=received.readUInt32LE(12),checksum=received.readUInt32LE(16),magic=received.readUInt32LE(20);
        if(length>1024*1024||magic!==((command^0xffffffff)>>>0)){fail(Error('Invalid SDB packet'));return;}
        if(received.length<24+length)return;
        const data=received.subarray(24,24+length);received=received.subarray(24+length);
        if(data.reduce((sum,byte)=>(sum+byte)>>>0,0)!==checksum){fail(Error('Invalid SDB checksum'));return;}
        if(command===commands.CNXN&&!ready){ready=true;clearTimeout(timeout);resolve({
          stream(destination,onData,initial=[]){
            if(current)return Promise.reject(Error('An SDB stream is already active'));
            return new Promise((resolveStream,rejectStream)=>{
              current={remote:0,writable:false,queue:initial,resolve:resolveStream,reject:rejectStream,
                data:onData,output:[],timeout:setTimeout(()=>fail(Error('SDB operation timed out')),120000)};
              packet(commands.OPEN,1,0,Buffer.from(destination+'\0'));
            });
          },
          send(data){if(!current)throw Error('SDB stream is closed');current.queue.push(data);flush();},
          finish(){if(current&&current.remote)packet(commands.CLSE,1,current.remote);},
          close(){ended=true;clearTimeout(timeout);if(current){clearTimeout(current.timeout);current.reject(Error('SDB closed'));current=null;}socket.end();}
        });}
        else if(command===commands.AUTH){fail(Error('TV requires SDB authentication; use Samsung tools'));return;}
        else if(current&&command===commands.OKAY&&b===1){current.remote=a;current.writable=true;flush();}
        else if(current&&command===commands.WRTE&&b===1){
          packet(commands.OKAY,1,a);current.output.push(data);
          if(current.data)current.data(data);
        }else if(current&&command===commands.CLSE&&b===1){
          packet(commands.CLSE,1,a);const finished=current;current=null;clearTimeout(finished.timeout);finished.resolve(Buffer.concat(finished.output));
        }
      }
    });
  });
}
export async function push(client,local,remote){
  if(!/^\/home\/owner\/share\/tmp\/sdk_tools\/[A-Za-z0-9_.-]+$/.test(remote))throw Error('Deployment target must be an SDK temporary file');
  const data=await fs.readFile(local),name=Buffer.from(remote+',33261');
  function frame(type,payload){const header=Buffer.alloc(8);header.write(type);header.writeUInt32LE(payload.length,4);return Buffer.concat([header,payload]);}
  const queue=[frame('SEND',name)];
  for(let at=0;at<data.length;at+=1400)queue.push(frame('DATA',data.subarray(at,at+1400)));
  const done=Buffer.alloc(8);done.write('DONE');done.writeUInt32LE(Math.floor(Date.now()/1000),4);queue.push(done);
  let received=Buffer.alloc(0),success=false;
  const result=await client.stream('sync:',chunk=>{
    received=Buffer.concat([received,chunk]);
    if(received.length>=8&&received.subarray(0,4).toString()==='OKAY'){
      success=true;const quit=Buffer.alloc(8);quit.write('QUIT');client.send(quit);client.finish();
    }else if(received.length>=8&&received.subarray(0,4).toString()==='FAIL')client.finish();
  },queue);
  if(!success)throw Error('SDB file transfer failed: '+result.toString().slice(0,300));
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const [host,action,...args]=process.argv.slice(2);let client;
  try{
    client=await connect(host);
    if(action==='sysinfo')console.log((await client.stream('sysinfo:')).toString().replace(/\0/g,' '));
    else if(action==='capability')console.log((await client.stream('capability:')).toString());
    else if(action==='push')await push(client,args[0],args[1]);
    else if(action==='install'){
      if(!/^[A-Za-z0-9.]+$/.test(args[0])||!/^\/home\/owner\/share\/tmp\/sdk_tools\/[A-Za-z0-9_.-]+\.wgt$/.test(args[1]))throw Error('Invalid package target');
      const result=(await client.stream('shell:0 vd_appinstall '+args[0]+' '+args[1])).toString();console.log(result);
      if(!/install.*(?:success|complete)|spend time/i.test(result)||/fail|error|denied/i.test(result))process.exitCode=1;
    }else if(action==='debug'){
      if(!/^[A-Za-z0-9.]+$/.test(args[0]))throw Error('Invalid application ID');
      console.log((await client.stream('shell:0 debug '+args[0]+' 0')).toString());
    }else throw Error('Use sysinfo, capability, push, install or debug');
  }catch(error){console.error(error.message);process.exitCode=1;}finally{if(client)client.close();}
}
