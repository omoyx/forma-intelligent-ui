import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createParser } from '@openuidev/react-lang';
import { library, promptOptions } from './dist/library.mjs';
import { splitReply } from './src/reply.mjs';
import { createAccess } from './auth.mjs';
import { createImageSearch } from './images.mjs';
import {createImageVerifier} from './image-verifier.mjs';
import {createPlaceSearch} from './places.mjs';
import {createLiveData} from './data.mjs';

const here = dirname(fileURLToPath(import.meta.url));
// Only server code reads credentials. They never enter the build or API payloads.
for (const file of [join(here, '../../.env'), join(here, '../.env')]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2');
  }
}
const base = process.env.HUOSHAN_BASE_URL?.replace(/\/$/, '');
const key = process.env.HUOSHAN_API_KEY;
const defaultModel = process.env.INTELLIGENT_UI_MODEL || 'deepseek-v4.1-flash';
const allowedModels = [...new Set([defaultModel, 'deepseek-v4-pro', 'doubao-seed-2.1-pro', 'qwen3.8-flash'])];
const parser = createParser(library.toJSONSchema(), library.root);
const systemPrompt = library.prompt(promptOptions);
export const plainSystemPrompt = '你是一个中文对话助手。使用简体中文，自然、准确、简短地回答当前问题，用户追问后再展开。默认总计不超过200个汉字，不主动扩展话题或重复总结，可以用普通 Markdown 表格、列表和代码表达。你没有联网搜索、图片检索、地图或实时数据工具；无法核实的信息请明确说明，不编造实时数据、来源或已执行的动作。';
const json = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
class RequestError extends Error { constructor(message, status=400) { super(message); this.status=status; } }

async function readBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > 240000) throw new RequestError('对话过长，请开始新对话。',413);
  }
  try { return JSON.parse(body); } catch { throw new RequestError('请求格式错误。'); }
}
function validateRequest(body) {
  const {messages, model=defaultModel, mode='openui'} = body || {};
  if(!['openui','plain'].includes(mode))throw new RequestError('请选择有效的回答模式。');
  if (!allowedModels.includes(model)) throw new RequestError('请选择列表中的模型。');
  if (!Array.isArray(messages) || !messages.length || messages.length>21 || messages.length%2!==1) throw new RequestError('请发送有效对话，最多保留 10 轮上下文。');
  const clean = messages.map((m,i)=>{
    if (m?.role !== (i%2===0?'user':'assistant') || typeof m.content!=='string' || !m.content.trim() || m.content.length>45000) throw new RequestError('消息为空或过长，请缩短后重试。');
    return {role:m.role,content:m.content};
  });
  return {messages:clean,model,mode};
}
export function validateProgram(code) {
  const parts=splitReply(code),issues=[];let statementCount=0;
  for(const [i,part] of parts.entries()) {
    if(part.kind!=='ui'){if(part.content.includes('```'))issues.push('存在无法识别的代码围栏，请只使用 openui-lang 围栏。');continue;}
    const result=parser.parse(part.content);statementCount+=result.meta.statementCount;
    if (!part.complete || result.meta.incomplete) issues.push(`界面块 ${i+1} 输出未完成。`);
    if (!result.root) issues.push('缺少 Workspace 根节点。');
    if (!/^\s*root\s*=\s*Workspace\s*\(/m.test(part.content)) issues.push('每个代码块必须定义 root = Workspace(...)。');
    if (result.meta.unresolved.length) issues.push(`未定义引用：${result.meta.unresolved.join(', ')}`);
    for (const e of result.meta.errors) issues.push(JSON.stringify(e));
  }
  if(!parts.length)issues.push('回复为空。');
  return {result:{meta:{statementCount}},issues};
}
async function modelStream(messages,model,signal,onDelta,prompt=systemPrompt) {
  const response=await fetch(`${base}/chat/completions`,{
    method:'POST',redirect:'error',signal,
    headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify({model,messages:[{role:'system',content:prompt},...messages],stream:true,temperature:0.4,max_tokens:7000,enable_thinking:false})
  });
  if(!response.ok) { await response.body?.cancel(); throw new Error(response.status===429?'模型请求较多，请稍后再试。':`模型接口返回 ${response.status}，请检查模型配置。`); }
  const reader=response.body.getReader(), decoder=new TextDecoder();
  let buffer='',code='',finishReason=null,ended=false;
  const consume=line=>{
    if(!line.startsWith('data:')) return;
    const value=line.slice(5).trim();
    if(value==='[DONE]') {ended=true;return;}
    if(!value) return;
    let data;
    try {data=JSON.parse(value);} catch {throw new Error('模型流数据不完整，请重试。');}
    if(data.error) throw new Error('模型生成失败，请重试或切换模型。');
    const choice=data.choices?.[0];
    const text=choice?.delta?.content;
    if(typeof text==='string') { code+=text; onDelta(text); }
    if(choice?.finish_reason) finishReason=choice.finish_reason;
  };
  try {
    while(true) {
      const {value,done}=await reader.read();
      buffer+=decoder.decode(value,{stream:!done});
      const lines=buffer.split(/\r?\n/);buffer=lines.pop()||'';lines.forEach(consume);
      if(code.length>60000) throw new Error('生成内容过长，请缩小需求范围。');
      if(done) {if(buffer) consume(buffer);break;}
    }
  } finally {reader.releaseLock();}
  if(finishReason==='length') throw new Error('生成达到长度上限，请缩小需求后重试。');
  if(!ended && finishReason!=='stop') throw new Error('模型连接中断，请重试。');
  if(!code.trim()) throw new Error('模型没有返回界面，请重试或切换模型。');
  return code.trim();
}
async function generate(req,res,body) {
  const {messages,model,mode}=validateRequest(body);
  if(!base || !key) throw new RequestError('请在仓库根目录 .env 配置 HUOSHAN_BASE_URL 和 HUOSHAN_API_KEY。',503);
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(new Error('timeout')),150000);
  const abort=()=>controller.abort();
  req.on('aborted',abort);res.on('close',abort);
  res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
  res.flushHeaders();
  const emit=(event,data)=>{if(!res.destroyed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);};
  const start=Date.now();let firstTokenMs=null;
  const heartbeat=setInterval(()=>{if(!res.destroyed)res.write(': keepalive\n\n');},15000);
  try {
    emit('meta',{model,mode,systemPromptChars:(mode==='plain'?plainSystemPrompt:systemPrompt).length});
    let code=await modelStream(messages,model,controller.signal,text=>{firstTokenMs??=Date.now()-start;emit('delta',{text,firstTokenMs});},mode==='plain'?plainSystemPrompt:systemPrompt);
    let {result,issues}=mode==='plain'?{result:{meta:{statementCount:0}},issues:[]}:validateProgram(code),repaired=false;
    if(issues.length) {
      emit('status',{message:'正在校正界面结构…'});
      emit('reset',{});
      code=await modelStream([...messages,{role:'assistant',content:code},{role:'user',content:`修正以下解析错误，完整重写合法 OpenUI Lang，保留用户需求：\n${issues.join('\n').slice(0,5000)}`}],model,controller.signal,text=>emit('delta',{text}));
      ({result,issues}=validateProgram(code));repaired=true;
    }
    if(issues.length) throw new Error('生成的界面结构未通过校验，请重试或换一个模型。');
    emit('done',{code,model,mode,ms:Date.now()-start,firstTokenMs,statements:result.meta.statementCount,repaired});
  } catch(e) {
    if(!res.destroyed) emit('error',{message:controller.signal.aborted?'生成已超时，请缩短需求后重试。':e.message || '生成失败，请重试。'});
  } finally {
    clearTimeout(timer);clearInterval(heartbeat);req.off('aborted',abort);res.off('close',abort);res.end();
  }
}

const assets=new Map([['/',['index.html','text/html; charset=utf-8']],['/app.js',['app.js','text/javascript; charset=utf-8']],['/styles.css',['styles.css','text/css; charset=utf-8']]]);
export function createDemoServer({imageSearch=createImageSearch({verifyImages:createImageVerifier({base,key,model:process.env.INTELLIGENT_UI_VISION_MODEL||'doubao-seed-2.1-pro'})}),placeSearch=createPlaceSearch(),liveData}={}) {
  liveData ||= createLiveData({placeSearch});
  const access=createAccess();let active=0;
  return createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://thumb.wikimedia.org https://upload.wikimedia.org https://tile.openstreetmap.org; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const path=new URL(req.url,'http://localhost').pathname;
      const origin=req.headers.origin;
      if(!access.allowedOrigin(origin,req.headers.host))throw new RequestError('请求来源无效。',403);
      if(origin&&access.origin){res.setHeader('Access-Control-Allow-Origin',access.origin);res.setHeader('Vary','Origin');}
      if(req.method==='OPTIONS'){
        res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600'});return res.end();
      }
      if(path==='/api/login'&&req.method==='POST'){
        if(!access.required)return json(res,200,{required:false});
        const result=access.login((await readBody(req)).password,req.headers['x-forwarded-for']?.split(',')[0]?.trim()||req.socket.remoteAddress);
        return json(res,result.status,result.token?{token:result.token}:{error:result.error});
      }
      if(path.startsWith('/api/')&&!access.authorized(req))return json(res,401,{authRequired:true,error:'请先输入访问密码。'});
      if(req.method==='POST') {
        if(path!=='/api/generate') throw new RequestError('接口不存在。',404);
        if(!req.headers['content-type']?.startsWith('application/json')) throw new RequestError('请使用 JSON 请求。',415);
        if(access.required&&active>=3)throw new RequestError('正在回答的请求较多，请稍后再试。',429);
        const body=await readBody(req);active++;
        try{return await generate(req,res,body);}finally{active--;}
      }
      if(req.method!=='GET') throw new RequestError('不支持此请求方式。',405);
      if(path==='/api/images'){
        const params=new URL(req.url,'http://localhost').searchParams;
        try{return json(res,200,await imageSearch(params.get('query'),{matchTitle:params.get('match')==='title'}));}
        catch(e){return json(res,e.status||502,{error:e.message||'图片检索失败，请重试。'});}
      }
      if(path==='/api/places'||path==='/api/data'){
        const params=new URL(req.url,'http://localhost').searchParams;
        try{return json(res,200,await (path==='/api/places'?placeSearch(params.get('query')):liveData(params.get('kind'),params.get('query'))));}
        catch(e){return json(res,e.status||502,{error:e.message||'查询失败，请重试。'});}
      }
      if(path==='/api/config') return json(res,200,{configured:!!(base&&key),defaultModel,models:allowedModels,engine:'OpenUI Lang 1.0.1'});
      const asset=assets.get(path);
      if(!asset) throw new RequestError('页面不存在。',404);
      const file=join(here,'dist',asset[0]);
      await stat(file);
      res.writeHead(200,{'Content-Type':asset[1],'Cache-Control':'no-cache'});res.end(await readFile(file));
    } catch(e) {if(!res.headersSent) json(res,e.status||500,{error:e.status?e.message:'服务暂时不可用，请重试。'});else res.end();}
  });
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const server=createDemoServer();let port=Number(process.env.PORT || 8780);
  server.on('error',e=>{if(e.code==='EADDRINUSE') server.listen(++port,'127.0.0.1');else throw e;});
  server.on('listening',()=>console.log(`Intelligent UI: http://127.0.0.1:${server.address().port} (${defaultModel})`));
  server.listen(port,'127.0.0.1');
}
