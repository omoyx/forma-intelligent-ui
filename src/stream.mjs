// Consume the same SSE contract for chat and both independent comparison lanes.
export async function readGeneration(response,onEvent){
 if(!response.ok){let data;try{data=await response.json();}catch{}throw Error(data?.error||`生成失败（${response.status}），请重试。`);}
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',completed=false;
 const consume=block=>{
  const type=block.match(/^event: (.+)$/m)?.[1];
  const raw=block.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
  if(!raw)return;const data=JSON.parse(raw);
  if(type==='error')throw Error(data.message||'生成失败，请重试。');
  if(type==='done')completed=true;
  onEvent(type,data);
 };
 try{while(true){const {value,done}=await reader.read();buffer+=decoder.decode(value,{stream:!done});const blocks=buffer.split(/\r?\n\r?\n/);buffer=blocks.pop()||'';blocks.forEach(consume);if(done){if(buffer.trim())consume(buffer);break;}}}
 finally{try{await reader.cancel();}catch{}reader.releaseLock();}
 if(!completed)throw Error('连接提前结束，请重试。');
}
