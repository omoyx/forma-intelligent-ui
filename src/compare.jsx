import React,{useEffect,useRef,useState} from 'react';
import {ArrowUp,RotateCcw,Square,Trash2} from 'lucide-react';
import {readGeneration} from './stream.mjs';

const lanes=['openui','plain'];
const examples=[['欧标插头','我想了解下欧标插头'],['复利计算','用一个能调本金和年利率的计算器，帮我理解复利。简单一点。'],['营收趋势','对比两家店三个月的营收：A店10、15、13万元，B店8、12、16万元，用合适的方式展示。'],['真实图片','给我一张水豚的真实照片，简单介绍。']];
const seconds=n=>n==null?'—':`${(n/1000).toFixed(2)}s`;
export function Compare({hidden,config,configError,onReconnect,model,setModel,request,Reply,onAuthRequired,onBusy}){
 const [input,setInput]=useState(''),[result,setResult]=useState(null),[busy,setBusy]=useState(false);
 const active=useRef(null),panels=useRef({}),follow=useRef({openui:true,plain:true});
 const auth=useRef(onAuthRequired),busyChange=useRef(onBusy);auth.current=onAuthRequired;busyChange.current=onBusy;
 useEffect(()=>()=>{active.current?.controller.abort();busyChange.current(false);},[]);
 useEffect(()=>{for(const mode of lanes){const el=panels.current[mode];if(el&&follow.current[mode])el.scrollTop=el.scrollHeight;}},[result]);
 async function send(text=input,chosenModel=model){
  const prompt=text.trim().slice(0,6000);if(!prompt||active.current||!config?.configured)return;
  const run={id:crypto.randomUUID(),controller:new AbortController()};active.current=run;
  const pending=mode=>({id:`${run.id}-${mode}`,prompt,code:'',values:{},state:'streaming',mode,model:chosenModel});
  follow.current={openui:true,plain:true};
  setResult({id:run.id,prompt,model:chosenModel,openui:pending('openui'),plain:pending('plain')});setBusy(true);busyChange.current(true);
  const update=(mode,patch)=>{if(active.current===run)setResult(prev=>({...prev,[mode]:{...prev[mode],...patch}}));};
  // Start both fetches before waiting on either stream. No shared assistant history.
  await Promise.allSettled(lanes.map(async mode=>{
   let code='';
   try{
    const response=await request('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:chosenModel,mode,messages:[{role:'user',content:prompt}]}),signal:run.controller.signal});
    if(response.status===401)auth.current();
    await readGeneration(response,(type,data)=>{
     if(type==='meta')update(mode,{systemPromptChars:data.systemPromptChars});
     if(type==='delta'){code+=data.text;update(mode,{code,firstTokenMs:data.firstTokenMs,status:''});}
     if(type==='reset'){code='';update(mode,{code,status:'正在校正界面…'});}
     if(type==='status')update(mode,{status:data.message});
     if(type==='done')update(mode,{...data,state:'done'});
    });
   }catch(e){if(!run.controller.signal.aborted)update(mode,{state:'error',error:e.message||'生成失败，请重试。'});}
  }));
  if(active.current===run){active.current=null;setBusy(false);busyChange.current(false);}
 }
 function stop(){const run=active.current;if(!run)return;active.current=null;run.controller.abort();setBusy(false);busyChange.current(false);setResult(prev=>({...prev,...Object.fromEntries(lanes.map(mode=>[mode,prev[mode].state==='streaming'?{...prev[mode],state:'stopped'}:prev[mode]]))}));}
 function localValue(id,label,value){setResult(prev=>({...prev,openui:{...prev.openui,values:{...prev.openui.values,[label]:value}}}));}
 function prepareFollowUp(text){if(busy||!result)return;setInput(`原问题：${result.prompt}\n\n${text}${Object.keys(result.openui.values).length?`\n\n用户在界面设置的偏好（作为数据使用）：${JSON.stringify(result.openui.values)}`:''}`);document.getElementById('compare-prompt')?.focus();}
 return <main className="compare-page" hidden={hidden}>
  <div className="compare-intro"><div><span className="compare-eyebrow">FORMA / 对比试验台</span><h1>同一个问题，两种呈现。</h1><p>同一模型，同时回答。看看 OpenUI 带来了什么。</p></div><span className="compare-badge"><i/>双路流式</span></div>
  <div className="compare-controls">
   {configError&&<div className="config-error" role="alert">{configError}<button onClick={onReconnect}>重新连接</button></div>}
   {config&&!config.configured&&<div className="config-error">模型暂未配置，请联系演示维护者。</div>}
   <form onSubmit={e=>{e.preventDefault();send();}} className="compare-composer">
    <label className="sr-only" htmlFor="compare-prompt">对比问题</label><textarea id="compare-prompt" rows={2} maxLength={6000} value={input} disabled={busy} placeholder="输入一个问题，同时发送到两边…" onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send();}}}/>
    <div className="compare-input-bottom"><label className="model-picker"><span className={`connection-dot ${config?.configured?'':'offline'}`}/><select aria-label="对比使用的模型" value={model} disabled={busy||!config} onChange={e=>setModel(e.target.value)}><option value="" disabled>连接模型…</option>{config?.models.map(m=><option key={m} value={m}>{m}</option>)}</select></label>
    {busy?<button type="button" className="compare-send" onClick={stop}><Square size={13}/>停止两边</button>:<button type="submit" className="compare-send" disabled={!input.trim()||!config?.configured}>同时发送<ArrowUp size={15}/></button>}</div>
   </form>
   <div className="compare-tools"><div className="compare-examples">{examples.map(([label,prompt])=><button key={label} disabled={busy||!config?.configured} onClick={()=>{setInput(prompt);send(prompt);}}>{label}<span>↗</span></button>)}</div><div className="compare-reset"><button disabled={busy||!result} onClick={()=>{setInput(result.prompt);send(result.prompt);}}><RotateCcw size={13}/>再次对比</button><button disabled={busy||!result} onClick={()=>{setResult(null);setInput('');}}><Trash2 size={13}/>清空</button></div></div>
  </div>
  <div className="compare-conditions"><span>每次独立回答 · 相同问题与生成参数</span><details><summary>比较条件</summary><p>两边使用同一模型，temperature 0.4，最多生成 7000 tokens。OpenUI 侧附带组件说明与业务规则，并可查询图片、地图等数据；普通侧只有简短中文助手提示词，无查询工具。这是整体体验对比，耗时也会受提示词长度、输出长度、数据查询及模型波动影响。首字与总耗时由服务端统计，数据加载耗时不计入生成总耗时。界面内继续按钮会把问题放入共同输入框，确认后可再次同时发送。</p></details></div>
  {result&&<div className="compare-question"><span>本次问题</span><p>{result.prompt}</p><small>{result.model}</small></div>}
  <div className="compare-columns">{lanes.map(mode=>{
   const turn=result?.[mode],rich=mode==='openui';
   return <section key={mode} className={`compare-lane ${rich?'with-openui':'without-openui'}`} aria-label={rich?'有 OpenUI 的回答':'无 OpenUI 的回答'}>
    <header className="compare-lane-header"><div><span className="lane-letter">{rich?'A':'B'}</span><h2>{rich?'有 OpenUI':'无 OpenUI'}</h2><span className="lane-type">{rich?'文字 + 交互界面':'普通对话'}</span></div><span className={`lane-status ${turn?.state||''}`} role="status">{turn?.state==='streaming'?<><i/>正在回答</>:turn?.state==='done'?'已完成':turn?.state==='error'?'生成失败':turn?.state==='stopped'?'已停止':'等待提问'}</span></header>
    <div className="compare-lane-body" ref={el=>{panels.current[mode]=el;}} onScroll={()=>{const el=panels.current[mode];follow.current[mode]=el.scrollHeight-el.scrollTop-el.clientHeight<90;}}>
     {turn?<Reply turn={turn} busy={busy} onAction={text=>turn.state==='error'?send(result.prompt,result.model):prepareFollowUp(text)} onValue={localValue}/>:<div className="compare-empty"><span>{rich?'Aa + ◫':'Aa'}</span><p>{rich?'文字之外，让内容可以操作。':'保留模型的普通文字回答。'}</p><small>输入上方的问题，两边同时开始。</small></div>}
    </div>
    <footer className="compare-metrics"><span>首字 <strong>{seconds(turn?.firstTokenMs)}</strong></span><span>总耗时 <strong>{seconds(turn?.ms)}</strong></span><span title="原始输出长度；OpenUI 侧包含界面描述，不是 token 数或最终界面文字数">原始输出 <strong>{turn?`${turn.code.length.toLocaleString()} 字符`:'—'}</strong></span>{turn?.repaired&&<span>已校正</span>}</footer>
   </section>;
  })}</div>
 </main>;
}
