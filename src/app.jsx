import React, { Component, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Renderer } from '@openuidev/react-lang';
import { library, InteractionContext } from './library.jsx';
import { splitReply } from './reply.mjs';
import { ImageContext } from './photos.jsx';
import {PlaceContext} from './maps.jsx';
import {DataContext} from './scenes.jsx';
import {Compare} from './compare.jsx';
import {readGeneration} from './stream.mjs';
import { ArrowUp, Plus, Compass, Columns3, ChartNoAxesCombined, ListChecks, Copy } from 'lucide-react';

const samples=[
 {icon:Compass,label:'看看地图',detail:'查找真实地点',prompt:'在地图上看看杭州断桥和灵隐寺，简单介绍。'},
 {icon:Columns3,label:'查查天气',detail:'真实天气预报',prompt:'看看杭州最近三天的天气'},
 {icon:ChartNoAxesCombined,label:'动手理解复利',detail:'调参数立即计算',prompt:'用一个能调本金、年利率和年数的计算器帮我理解复利，显示随年数变化的曲线。简单一点。'},
 {icon:ListChecks,label:'认识欧标插头',detail:'看懂类型与适配方式',prompt:'我想了解下欧标插头'}
];
function Arrow(){return <ArrowUp size={20} strokeWidth={1.8}/>;}
class RenderBoundary extends Component {
 state={error:false};static getDerivedStateFromError(){return {error:true};}
 componentDidUpdate(prev){if(prev.code!==this.props.code&&this.state.error)this.setState({error:false});}
 render(){return this.state.error?<p className="render-problem">这个界面暂时无法显示，可以继续对话重新生成。</p>:this.props.children;}
}
// Text is React content, never executable model HTML.
function Prose({text}){return <div className="prose">{text.split(/(```[\s\S]*?(?:```|$))/g).map((part,i)=>part.startsWith('```')?<pre key={i}><code>{part.replace(/^```[^\n]*\n?/,'').replace(/```$/,'')}</code></pre>:<ProseParagraphs key={i} text={part}/>)}</div>;}
function ProseParagraphs({text}){return <>{text.trim().split(/\n\s*\n/).filter(Boolean).map((p,i)=>{
 const lines=p.split('\n');const inline=s=>s.split(/(\*\*[^*]+(?:\*\*|$)|`[^`]+(?:`|$))/g).map((v,j)=>v.startsWith('**')?<strong key={j}>{v.endsWith('**')?v.slice(2,-2):v.slice(2)}</strong>:v.startsWith('`')?<code key={j}>{v.endsWith('`')?v.slice(1,-1):v.slice(1)}</code>:v);
 const cells=line=>line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(cell=>cell.trim());
 if(lines.length>1&&lines[0].includes('|')&&cells(lines[1]).every(cell=>/^:?-{3,}:?$/.test(cell))){const headings=cells(lines[0]);return <div className="prose-table" key={i}><table><thead><tr>{headings.map((cell,j)=><th key={j}>{inline(cell)}</th>)}</tr></thead><tbody>{lines.slice(2).map((line,j)=><tr key={j}>{cells(line).map((cell,k)=><td key={k}>{inline(cell)}</td>)}</tr>)}</tbody></table></div>;}
 if(lines.every(l=>/^\s*[-*]\s+/.test(l)))return <ul key={i}>{lines.map((l,j)=><li key={j}>{inline(l.replace(/^\s*[-*]\s+/,''))}</li>)}</ul>;
 if(lines.every(l=>/^\s*\d+[.)]\s+/.test(l)))return <ol key={i}>{lines.map((l,j)=><li key={j}>{inline(l.replace(/^\s*\d+[.)]\s+/,''))}</li>)}</ol>;
 if(/^#{1,3} /.test(p))return <h3 key={i}>{inline(p.replace(/^#{1,3} /,''))}</h3>;
 return <p key={i}>{lines.map((l,j)=><React.Fragment key={j}>{j>0&&<br/>}{inline(l)}</React.Fragment>)}</p>;
 })}</>;}
function Reply({turn,busy,onAction,onValue}){
 const parts=turn.mode==='plain'?[{kind:'text',content:turn.code}]:splitReply(turn.code,turn.state==='streaming');
 return <div className="reply" data-state={turn.state}>
 <div className="assistant-label"><span className="assistant-logo">f</span><span>Forma</span>{turn.state==='streaming'&&<span className="live-label">正在回答<span className="live-dot"/></span>}</div>
 <div className="reply-content"><PlaceContext.Provider value={searchPlaces}><DataContext.Provider value={searchData}><ImageContext.Provider value={searchImages}><InteractionContext.Provider value={{values:turn.values||{},update:(label,value)=>onValue(turn.id,label,value),busy}}>
 {parts.map((part,i)=>part.kind==='text'?<Prose text={part.content} key={i}/>:<div className="inline-ui" key={i} data-streaming={turn.state==='streaming'&&!part.complete}><RenderBoundary code={part.content}><Renderer library={library} response={part.content} isStreaming={turn.state==='streaming'&&!part.complete} onAction={event=>{if(event.type==='continue_conversation')onAction(event.humanFriendlyMessage||'根据我的选择继续。',turn.id);}}/></RenderBoundary></div>)}
 </InteractionContext.Provider></ImageContext.Provider></DataContext.Provider></PlaceContext.Provider>
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
async function searchImages(query,signal){const response=await apiFetch(`/api/images?query=${encodeURIComponent(query)}`,{signal});const data=await response.json();if(!response.ok)throw Error(response.status===401?'访问已过期，请刷新后重新输入密码。':data.error||'图片检索失败。');return data;}
async function dataFetch(path,signal){const response=await apiFetch(path,{signal});const data=await response.json();if(!response.ok)throw Error(response.status===401?'访问已过期，请刷新后重新输入密码。':data.error||'查询失败。');return data;}
const searchPlaces=(query,signal)=>dataFetch(`/api/places?query=${encodeURIComponent(query)}`,signal);
const searchData=(kind,query,signal)=>dataFetch(`/api/data?kind=${encodeURIComponent(kind)}&query=${encodeURIComponent(query)}`,signal);
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
 const [view,setView]=useState(location.hash==='#compare'?'compare':'chat'),[compareBusy,setCompareBusy]=useState(false);
 const request=useRef(null),scroll=useRef(null),follow=useRef(true),textarea=useRef(null);
 function connect(){setConfigError('');apiFetch('/api/config').then(async r=>{if(r.status===401){setLocked(true);return;}if(!r.ok)throw Error();const c=await r.json();setLocked(false);setConfig(c);setModel(m=>c.models.includes(m)?m:c.defaultModel);}).catch(()=>setConfigError('连接失败，请稍后重试。'));}
 useEffect(()=>{connect();return()=>request.current?.controller.abort();},[]);
 useEffect(()=>{const change=()=>{if(!request.current&&!compareBusy)setView(location.hash==='#compare'?'compare':'chat');};window.addEventListener('hashchange',change);change();return()=>window.removeEventListener('hashchange',change);},[compareBusy]);
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
   await readGeneration(response,(type,data)=>{
    if(request.current!==active)return;
    if(type==='delta'){code+=data.text;update({code});}
    if(type==='reset'){code='';update({code,status:'正在校正界面…'});}
    if(type==='status')update({status:data.message});
    if(type==='error')throw Error(data.message);
    if(type==='done'){completed=true;update({...data,state:'done'});}
   });
   if(!completed&&request.current===active)throw Error('连接提前结束，请重试。');
  }catch(e){if(request.current===active)update({state:'error',error:e.message||'网络异常，请重试。'});}
  finally{if(request.current===active){request.current=null;setBusy(false);}}
 }
 function stop(){const active=request.current;if(!active)return;request.current=null;active.controller.abort();setBusy(false);setTurns(all=>all.map(t=>t.id===active.id?{...t,state:'stopped'}:t));setInput(active.prompt);textarea.current?.focus();}
 function newChat(){if(request.current)return;setTurns([]);setInput('');setSelectedSource(null);follow.current=true;textarea.current?.focus();}
 if(locked)return <Login onUnlock={connect}/>;
 return <div className="app"><aside className="rail"><button className="brand" onClick={()=>{newChat();location.hash='';}} disabled={busy||compareBusy} aria-label="Forma 首页">f<span/></button><button className="new-chat" onClick={()=>{newChat();location.hash='';}} disabled={busy||compareBusy} aria-label="新对话" title="新对话"><Plus size={20}/></button><div className="rail-caption">想法<br/>有形</div><div className="avatar">A</div></aside>
 <div className="main-shell"><header className="topbar"><div className="wordmark">forma <span>Intelligent UI</span></div><nav className="view-switch" aria-label="体验模式"><button aria-current={view==='chat'?'page':undefined} disabled={busy||compareBusy} onClick={()=>{location.hash='';}}>对话</button><button aria-current={view==='compare'?'page':undefined} disabled={busy||compareBusy} onClick={()=>{location.hash='compare';}}>对比试验台</button></nav><a className="openui-credit" href="https://www.openui.com" target="_blank" rel="noreferrer">Built with OpenUI <span>↗</span></a></header>
 <Compare hidden={view!=='compare'} config={config} configError={configError} onReconnect={connect} model={model} setModel={setModel} request={apiFetch} Reply={Reply} onAuthRequired={()=>{sessionStorage.removeItem(tokenKey);setLocked(true);}} onBusy={setCompareBusy}/>
 <main hidden={view!=='chat'} className={`chat ${turns.length?'has-messages':''}`}><div className="chat-scroll" ref={scroll} onScroll={()=>{const el=scroll.current;follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<100;}}><div className="thread">
 {!turns.length&&<section className="welcome"><h1>今天，想一起做点什么？</h1><div className="suggestions">{samples.map(s=><button key={s.label} disabled={!config?.configured} onClick={()=>send(s.prompt,null)}><span className="sample-icon"><s.icon size={21} strokeWidth={1.5}/></span><strong>{s.label}</strong><span className="sample-arrow">↗</span></button>)}</div></section>}
 {turns.map(t=><section className="turn" key={t.id}><div className="user-row"><div className="user-message">{t.prompt}</div></div><Reply turn={t} busy={busy} onAction={send} onValue={updateValue}/></section>)}
 </div></div>
 <div className="composer-area"><div className="composer-width">{configError&&<div className="config-error" role="alert">{configError}<button onClick={connect}>重新连接</button></div>}{config&&!config.configured&&<div className="config-error">请在根目录 .env 配置模型后重启服务。</div>}
 {!!preferenceCount&&<div className="preference-note"><span/>下次回复将带上你调整的 {preferenceCount} 项选择<button onClick={()=>{setTurns(all=>all.map(t=>t.id===source.id?{...t,values:{}}:t));}}>清除</button></div>}
 <form className="composer" onSubmit={e=>{e.preventDefault();send(input);}}><label className="sr-only" htmlFor="prompt">发送消息</label><textarea id="prompt" ref={textarea} rows={2} maxLength={6000} value={input} onChange={e=>setInput(e.target.value)} placeholder={turns.length?'继续聊聊，或调整上面的界面…':'说说你想做什么…'} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();if(!busy)send(input);}}}/><div className="composer-bottom"><div className="model-picker"><span className={`connection-dot ${config?.configured?'':'offline'}`}/><select aria-label="选择模型" value={model} disabled={busy||!config} onChange={e=>setModel(e.target.value)}><option value="" disabled>连接模型…</option>{config?.models.map(m=><option value={m} key={m}>{m}</option>)}</select></div>{busy?<button className="send-button stop" type="button" aria-label="停止生成" onClick={e=>{e.preventDefault();stop();}}><span/></button>:<button className="send-button" type="submit" aria-label="发送消息" disabled={!input.trim()||!config?.configured}><Arrow/></button>}</div></form>
 </div></div></main></div></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
