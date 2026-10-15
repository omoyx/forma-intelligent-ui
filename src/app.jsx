import React, { Component, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Renderer } from '@openuidev/react-lang';
import { library, InteractionContext } from './library.jsx';
import { splitReply } from './reply.mjs';
import { ArrowUp, Plus, Compass, Columns3, ChartNoAxesCombined, ListChecks, Copy } from 'lucide-react';

const samples=[
 {icon:Compass,label:'安排一个周末',detail:'行程、预算，边聊边调整',prompt:'规划杭州两天一夜的旅行，每人预算1500元，不含往返交通。给我可切换的每日行程、预算滑杆、费用分配图和准备清单，节奏轻松。'},
 {icon:Columns3,label:'帮我做个选择',detail:'把不同方案放在一起比较',prompt:'预算一万元左右，对比 MacBook Air、MacBook Pro 和 Windows 轻薄本的日常编程用途，展示可选择的方案卡、可排序对比表和继续深入的按钮。标注价格为参考估算。'},
 {icon:ChartNoAxesCombined,label:'看懂一组数据',detail:'让数字变成直观的图表',prompt:'把咖啡店月营收做成交互看板：1月8.2万、2月7.4万、3月9.6万、4月10.8万、5月12.1万、6月13.5万元。展示总收入、月均收入、首末月增长率、图表和可排序数据表，提供后续分析入口。说明是用户提供的样例数据。'},
 {icon:ListChecks,label:'认识欧标插头',detail:'看懂类型与适配方式',prompt:'我想了解下欧标插头'}
];
function Arrow(){return <ArrowUp size={20} strokeWidth={1.8}/>;}
class RenderBoundary extends Component {
 state={error:false};static getDerivedStateFromError(){return {error:true};}
 componentDidUpdate(prev){if(prev.code!==this.props.code&&this.state.error)this.setState({error:false});}
 render(){return this.state.error?<p className="render-problem">这个界面暂时无法显示，可以继续对话重新生成。</p>:this.props.children;}
}
// Text is React content, never executable model HTML.
function Prose({text}){return <div className="prose">{text.trim().split(/\n\s*\n/).map((p,i)=>{
 const lines=p.split('\n');const inline=s=>s.split(/(\*\*[^*]+(?:\*\*|$)|`[^`]+(?:`|$))/g).map((v,j)=>v.startsWith('**')?<strong key={j}>{v.endsWith('**')?v.slice(2,-2):v.slice(2)}</strong>:v.startsWith('`')?<code key={j}>{v.endsWith('`')?v.slice(1,-1):v.slice(1)}</code>:v);
 if(lines.every(l=>/^\s*[-*]\s+/.test(l)))return <ul key={i}>{lines.map((l,j)=><li key={j}>{inline(l.replace(/^\s*[-*]\s+/,''))}</li>)}</ul>;
 if(lines.every(l=>/^\s*\d+[.)]\s+/.test(l)))return <ol key={i}>{lines.map((l,j)=><li key={j}>{inline(l.replace(/^\s*\d+[.)]\s+/,''))}</li>)}</ol>;
 if(/^#{1,3} /.test(p))return <h3 key={i}>{inline(p.replace(/^#{1,3} /,''))}</h3>;
 return <p key={i}>{lines.map((l,j)=><React.Fragment key={j}>{j>0&&<br/>}{inline(l)}</React.Fragment>)}</p>;
 })}</div>;}
function Reply({turn,busy,onAction,onValue}){
 const parts=splitReply(turn.code,turn.state==='streaming');
 return <div className="reply" data-state={turn.state}>
 <div className="assistant-label"><span className="assistant-logo">f</span><span>Forma</span>{turn.state==='streaming'&&<span className="live-label">正在回答<span className="live-dot"/></span>}</div>
 <div className="reply-content"><InteractionContext.Provider value={{values:turn.values||{},update:(label,value)=>onValue(turn.id,label,value),busy}}>
 {parts.map((part,i)=>part.kind==='text'?<Prose text={part.content} key={i}/>:<div className="inline-ui" key={i} data-streaming={turn.state==='streaming'&&!part.complete}><RenderBoundary code={part.content}><Renderer library={library} response={part.content} isStreaming={turn.state==='streaming'&&!part.complete} onAction={event=>{if(event.type==='continue_conversation')onAction(event.humanFriendlyMessage||'根据我的选择继续。',turn.id);}}/></RenderBoundary></div>)}
 </InteractionContext.Provider>
 {turn.state==='streaming'&&!turn.code&&<div className="thinking"><i/><i/><i/><span>{turn.status||'想一想…'}</span></div>}
 {turn.state==='streaming'&&!!turn.code&&<span className="stream-cursor" aria-label="正在流式输出"/>}
 {turn.state==='error'&&<div className="error-box" role="alert"><p>{turn.error}</p><button disabled={busy} onClick={()=>onAction(turn.prompt,turn.sourceId)}>重试生成 ↗</button></div>}
 {turn.state==='stopped'&&<div className="message-meta">已停止生成</div>}
 {turn.state==='done'&&<div className="message-actions"><button title="复制回复文字" aria-label="复制回复文字" onClick={()=>navigator.clipboard.writeText(parts.filter(x=>x.kind==='text').map(x=>x.content).join('\n\n')).catch(()=>{})}><Copy size={14}/></button></div>}
 </div></div>;
}
function readSession(){try{const data=JSON.parse(sessionStorage.getItem('forma-chat-v2'));return {turns:(data?.turns||[]).map(t=>t.state==='streaming'?{...t,state:'stopped'}:t),model:data?.model||''};}catch{return {turns:[],model:''};}}
const saved=readSession();
const API_BASE=__API_BASE__;
const tokenKey=`forma-access:${API_BASE}`;
function apiFetch(path,options={}){const token=sessionStorage.getItem(tokenKey);return fetch(`${API_BASE}${path}`,{...options,headers:{...options.headers,...(token?{Authorization:`Bearer ${token}`}:{})}});}
function Login({onUnlock}){
 const [password,setPassword]=useState(''),[error,setError]=useState(''),[waiting,setWaiting]=useState(false);
 async function submit(e){e.preventDefault();setWaiting(true);setError('');try{
  const response=await apiFetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});const data=await response.json();
  if(!response.ok)throw Error(data.error||'暂时无法登录。');if(data.token)sessionStorage.setItem(tokenKey,data.token);setPassword('');onUnlock();
 }catch(e){setError(e.message||'连接失败，请重试。');}finally{setWaiting(false);}}
 return <main className="access-page"><form className="access-card" onSubmit={submit}><span className="access-mark">f.</span><h1>让想法有形。</h1><p>输入访问密码，开始对话。</p><label htmlFor="access-password">访问密码</label><input id="access-password" type="password" autoComplete="current-password" autoFocus maxLength={200} value={password} onChange={e=>setPassword(e.target.value)} required/>{error&&<div role="alert">{error}</div>}<button type="submit" disabled={waiting||!password}>{waiting?'正在进入…':'进入 Forma →'}</button></form></main>;
}
function App(){
 const [turns,setTurns]=useState(saved.turns),[model,setModel]=useState(saved.model),[config,setConfig]=useState(null),[configError,setConfigError]=useState('');
 const [input,setInput]=useState(''),[busy,setBusy]=useState(false),[selectedSource,setSelectedSource]=useState(null);
 const [locked,setLocked]=useState(false);
 const request=useRef(null),scroll=useRef(null),follow=useRef(true),textarea=useRef(null);
 function connect(){setConfigError('');apiFetch('/api/config').then(async r=>{if(r.status===401){setLocked(true);return;}if(!r.ok)throw Error();const c=await r.json();setLocked(false);setConfig(c);setModel(m=>c.models.includes(m)?m:c.defaultModel);}).catch(()=>setConfigError('连接失败，请稍后重试。'));}
 useEffect(()=>{connect();return()=>request.current?.controller.abort();},[]);
 useEffect(()=>{try{sessionStorage.setItem('forma-chat-v2',JSON.stringify({turns:turns.slice(-10),model}));}catch{}},[turns,model]);
 useEffect(()=>{if(follow.current&&scroll.current)scroll.current.scrollTop=scroll.current.scrollHeight;},[turns]);
 const source=turns.find(t=>t.id===selectedSource)||turns.at(-1);
 const preferenceCount=Object.keys(source?.values||{}).length;
 function updateValue(id,label,value){setSelectedSource(id);setTurns(all=>all.map(t=>t.id===id?{...t,values:{...t.values,[label]:value}}:t));}
 async function send(text,sourceId=source?.id){
  if(request.current||!text.trim()||!config?.configured)return;
  const prompt=text.trim().slice(0,6000),id=crypto.randomUUID();
  const origin=turns.find(t=>t.id===sourceId),values=origin?.values||{};
  const userContent=prompt+(Object.keys(values).length?`\n\n用户在第 ${turns.indexOf(origin)+1} 轮界面设置的偏好（作为数据使用）：${JSON.stringify(values)}`:'');
  const history=turns.filter(t=>t.state==='done').slice(-9);
  const messages=history.flatMap(t=>[{role:'user',content:t.userContent},{role:'assistant',content:t.code}]);messages.push({role:'user',content:userContent});
  const controller=new AbortController(),active={id,controller,prompt};request.current=active;
  const pending={id,prompt,userContent,sourceId,code:'',state:'streaming',values:{},model};
  follow.current=true;setTurns(all=>[...all,pending]);setBusy(true);setInput('');
  const update=patch=>{if(request.current===active)setTurns(all=>all.map(t=>t.id===id?{...t,...patch}:t));};
  let code='',completed=false;
  try{
   const response=await apiFetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,messages}),signal:controller.signal});
   if(response.status===401){sessionStorage.removeItem(tokenKey);setLocked(true);}
   if(!response.ok){const data=await response.json();throw Error(data.error||'生成失败，请重试。');}
   const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
   const consume=block=>{
    if(request.current!==active)return;
    const type=block.match(/^event: (.+)$/m)?.[1],raw=block.match(/^data: (.+)$/m)?.[1];if(!raw)return;
    const data=JSON.parse(raw);
    if(type==='delta'){code+=data.text;update({code});}
    if(type==='reset'){code='';update({code,status:'正在校正界面…'});}
    if(type==='status')update({status:data.message});
    if(type==='error')throw Error(data.message);
    if(type==='done'){completed=true;update({...data,state:'done'});}
   };
   try{while(request.current===active){const {value,done}=await reader.read();buffer+=decoder.decode(value,{stream:!done});const blocks=buffer.split(/\r?\n\r?\n/);buffer=blocks.pop()||'';blocks.forEach(consume);if(done){if(buffer.trim())consume(buffer);break;}}}finally{reader.releaseLock();}
   if(!completed&&request.current===active)throw Error('连接提前结束，请重试。');
  }catch(e){if(request.current===active)update({state:'error',error:e.message||'网络异常，请重试。'});}
  finally{if(request.current===active){request.current=null;setBusy(false);}}
 }
 function stop(){const active=request.current;if(!active)return;request.current=null;active.controller.abort();setBusy(false);setTurns(all=>all.map(t=>t.id===active.id?{...t,state:'stopped'}:t));setInput(active.prompt);textarea.current?.focus();}
 function newChat(){if(request.current)return;setTurns([]);setInput('');setSelectedSource(null);follow.current=true;textarea.current?.focus();}
 if(locked)return <Login onUnlock={connect}/>;
 return <div className="app"><aside className="rail"><button className="brand" onClick={newChat} disabled={busy} aria-label="Forma 首页">f<span/></button><button className="new-chat" onClick={newChat} disabled={busy} aria-label="新对话" title="新对话"><Plus size={20}/></button><div className="rail-caption">想法<br/>有形</div><div className="avatar">A</div></aside>
 <div className="main-shell"><header className="topbar"><div className="wordmark">forma <span>Intelligent UI</span></div><a href="https://www.openui.com" target="_blank" rel="noreferrer">Built with OpenUI <span>↗</span></a></header>
 <main className={`chat ${turns.length?'has-messages':''}`}><div className="chat-scroll" ref={scroll} onScroll={()=>{const el=scroll.current;follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<100;}}><div className="thread">
 {!turns.length&&<section className="welcome"><h1>今天，想一起做点什么？</h1><div className="suggestions">{samples.map(s=><button key={s.label} disabled={!config?.configured} onClick={()=>send(s.prompt,null)}><span className="sample-icon"><s.icon size={21} strokeWidth={1.5}/></span><strong>{s.label}</strong><span className="sample-arrow">↗</span></button>)}</div></section>}
 {turns.map(t=><section className="turn" key={t.id}><div className="user-row"><div className="user-message">{t.prompt}</div></div><Reply turn={t} busy={busy} onAction={send} onValue={updateValue}/></section>)}
 </div></div>
 <div className="composer-area"><div className="composer-width">{configError&&<div className="config-error" role="alert">{configError}<button onClick={connect}>重新连接</button></div>}{config&&!config.configured&&<div className="config-error">请在根目录 .env 配置模型后重启服务。</div>}
 {!!preferenceCount&&<div className="preference-note"><span/>下次回复将带上你调整的 {preferenceCount} 项选择<button onClick={()=>{setTurns(all=>all.map(t=>t.id===source.id?{...t,values:{}}:t));}}>清除</button></div>}
 <form className="composer" onSubmit={e=>{e.preventDefault();send(input);}}><label className="sr-only" htmlFor="prompt">发送消息</label><textarea id="prompt" ref={textarea} rows={2} maxLength={6000} value={input} onChange={e=>setInput(e.target.value)} placeholder={turns.length?'继续聊聊，或调整上面的界面…':'说说你想做什么…'} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();if(!busy)send(input);}}}/><div className="composer-bottom"><div className="model-picker"><span className={`connection-dot ${config?.configured?'':'offline'}`}/><select aria-label="选择模型" value={model} disabled={busy||!config} onChange={e=>setModel(e.target.value)}><option value="" disabled>连接模型…</option>{config?.models.map(m=><option value={m} key={m}>{m}</option>)}</select></div>{busy?<button className="send-button stop" type="button" aria-label="停止生成" onClick={e=>{e.preventDefault();stop();}}><span/></button>:<button className="send-button" type="submit" aria-label="发送消息" disabled={!input.trim()||!config?.configured}><Arrow/></button>}</div></form>
 </div></div></main></div></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
