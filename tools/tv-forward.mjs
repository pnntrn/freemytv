// Temporary developer/control tunnel only. Not used for camera playback.
import net from 'node:net';
import {connect} from './tv-sdb.mjs';
const [host,remoteText,localText]=process.argv.slice(2);
const remote=Number(remoteText),local=Number(localText);
if(![remote,local].every(n=>Number.isInteger(n)&&n>1024&&n<=65535))throw Error('Explicit non-privileged ports required');
const clients=new Set();
const server=net.createServer(async socket=>{
  socket.pause();let client;
  try{
    client=await connect(host);clients.add(client);
    client.stream('tcp:'+remote,data=>socket.write(data)).then(()=>socket.end()).catch(()=>socket.destroy());
    socket.on('data',data=>{for(let at=0;at<data.length;at+=4096)client.send(data.subarray(at,at+4096));});
    socket.on('error',()=>socket.destroy());
    socket.on('close',()=>{clients.delete(client);client.close();});
    socket.resume();
  }catch(error){console.error('Developer tunnel failed: '+error.message);socket.destroy();if(client)client.close();}
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(local,'127.0.0.1',()=>console.log('Developer control tunnel: 127.0.0.1:'+local+' -> TV:'+remote));
process.on('SIGINT',()=>{for(const client of clients)client.close();server.close();});
