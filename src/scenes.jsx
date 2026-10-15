import React,{createContext,useContext,useEffect,useId,useMemo,useState} from 'react';
import {useTriggerAction} from '@openuidev/react-lang';
import {calculate,safeLink} from './expressions.mjs';
export const DataContext=createContext(null);
const palette=['#426b55','#8baf96','#c5d8a4','#cea370','#8fa8bd','#b49baa'];
export function PlotView({props}){
 const [hidden,setHidden]=useState([]),[active,setActive]=useState(-1);
 const series=(props.series||[]).filter((_,i)=>!hidden.includes(i)),all=series.flatMap(s=>s.values||[]).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
 if(!all.length)return <div className="scene-status">正在准备图表…</div>;
 const xmin=Math.min(...all.map(p=>p.x)),xmax=Math.max(...all.map(p=>p.x)),ymin=Math.min(0,...all.map(p=>p.y)),ymax=Math.max(...all.map(p=>p.y));
 const x=v=>48+(v-xmin)/(xmax-xmin||1)*480,y=v=>220-(v-ymin)/(ymax-ymin||1)*185;
 const tooltip=active>=0?series.flatMap(s=>{const p=s.values?.[active];return p?[`${s.name}: ${p.x}, ${Number(p.y.toFixed(4))}`]:[];}).join(' · '):'';
 return <div className="scene-plot"><div className="scene-heading"><strong>{props.title}</strong><small>{props.xLabel} / {props.yLabel}</small></div>
 <svg viewBox="0 0 560 260" role="img" aria-label={props.title}>
 {[0,1,2,3,4].map(i=>{const value=ymin+(ymax-ymin)*i/4;return <g key={i}><line x1="48" y1={y(value)} x2="528" y2={y(value)} stroke="#e5ebe4"/><text x="42" y={y(value)+4} textAnchor="end">{Number(value.toPrecision(3))}</text></g>;})}
 {series.map((s,i)=>{const color=palette[(props.series||[]).indexOf(s)%6];const points=(s.values||[]).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));const coords=points.map(p=>`${x(p.x)},${y(p.y)}`).join(' ');return <g key={s.name}>
 {props.kind==='area'&&<polygon points={`${x(points[0]?.x||0)},220 ${coords} ${x(points.at(-1)?.x||0)},220`} fill={color} opacity=".15"/>}
 {props.kind!=='scatter'&&<polyline points={coords} fill="none" stroke={color} strokeWidth="2.5"/>}
 {points.map((p,j)=><circle key={j} cx={x(p.x)} cy={y(p.y)} r={props.kind==='scatter'?4:3} fill={color} tabIndex="0" role="button" aria-label={`${s.name} ${p.x}: ${p.y}`} onFocus={()=>setActive(j)} onMouseEnter={()=>setActive(j)}><title>{`${s.name}: ${p.x}, ${p.y}`}</title></circle>)}</g>;})}
 <text x="48" y="245">{xmin}</text><text x="528" y="245" textAnchor="end">{xmax}</text></svg>
 <div className="plot-legend">{props.series?.map((s,i)=><button type="button" key={i} aria-pressed={!hidden.includes(i)} style={{opacity:hidden.includes(i)?.45:1}} onClick={()=>setHidden(h=>h.includes(i)?h.filter(v=>v!==i):h.length<(props.series.length-1)?[...h,i]:h)}><i style={{background:palette[i%6]}}/>{s.name}</button>)}</div>
 <small className="plot-readout" role="status">{tooltip||'触碰数据点查看数值 · 点击图例切换系列'}</small></div>;
}
export function DonutView({props}){
 const [selected,setSelected]=useState(-1),items=props.items||[],total=items.reduce((n,p)=>n+Math.max(0,p.value||0),0);let offset=0;
 return <div className="scene-donut"><strong>{props.title}</strong><div className="donut-layout"><svg viewBox="0 0 160 160" role="img" aria-label={props.title}>{items.map((p,i)=>{const value=Math.max(0,p.value||0),fraction=total?value/total:0,start=offset;offset+=fraction;return <circle key={i} cx="80" cy="80" r="59" fill="none" stroke={palette[i%6]} strokeWidth={selected===i?24:18} strokeDasharray={`${fraction*370.7} 370.7`} strokeDashoffset={-start*370.7} transform="rotate(-90 80 80)"/>;})}<text x="80" y="77" textAnchor="middle">{selected<0?'合计':items[selected]?.label}</text><text x="80" y="98" textAnchor="middle">{selected<0?total:items[selected]?.value}{props.unit}</text></svg><div>{items.map((p,i)=><button key={i} type="button" aria-pressed={selected===i} onClick={()=>setSelected(selected===i?-1:i)}><i style={{background:palette[i%6]}}/>{p.label}<strong>{total?(p.value/total*100).toFixed(1):0}%</strong></button>)}</div></div></div>;
}
export function DiagramView({props}){
 const [selected,setSelected]=useState(''),nodes=(props.nodes||[]).filter(n=>n?.id&&n?.label),edges=(props.edges||[]).filter(e=>e?.from&&e?.to),cols=props.direction==='horizontal'?Math.min(nodes.length,4):1;
 const positions=new Map(nodes.map((n,i)=>[n.id,{x:cols===1?155:20+i%cols*190,y:45+Math.floor(i/cols)*120}]));
 const width=cols===1?450:cols*190+5,height=Math.max(130,Math.ceil(nodes.length/Math.max(1,cols))*120+25);
 const marker=useId().replace(/:/g,'');
 return <div className="scene-diagram"><strong>{props.title}</strong><svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label={props.title}><defs><marker id={marker} markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#8a9e8b"/></marker></defs>
 {edges.map((e,i)=>{const a=positions.get(e.from),b=positions.get(e.to);if(!a||!b)return null;const sameRow=a.y===b.y,forward=b.x>a.x;
 let path,lx,ly;
 if(sameRow&&forward){const x1=a.x+125,y1=a.y+24,x2=b.x,y2=b.y+24;path=`M${x1} ${y1} C${x1+20} ${y1}, ${x2-20} ${y2}, ${x2} ${y2}`;lx=(x1+x2)/2;ly=y1-9;}
 else if(sameRow){const x1=a.x+62,y1=a.y,x2=b.x+62,y2=b.y;path=`M${x1} ${y1} C${x1} ${y1-42}, ${x2} ${y2-42}, ${x2} ${y2}`;lx=(x1+x2)/2;ly=y1-29;}
 else {const x1=a.x+62,y1=a.y+48,x2=b.x+62,y2=b.y;path=`M${x1} ${y1} C${x1} ${y1+25}, ${x2} ${y2-25}, ${x2} ${y2}`;lx=(x1+x2)/2+32;ly=(y1+y2)/2+4;}
 return <g key={i}><path d={path} fill="none" stroke="#8a9e8b" strokeWidth="1.5" markerEnd={`url(#${marker})`}/><text x={lx} y={ly} textAnchor="middle">{e.label}</text></g>;})}
 {nodes.map(n=>{const p=positions.get(n.id);return <g key={n.id} tabIndex="0" role="button" aria-label={n.label} onClick={()=>setSelected(n.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(n.id);}}}><rect x={p.x} y={p.y} width="125" height="48" rx="10" fill={selected===n.id?'#deebdc':'#f4f7f1'} stroke="#b8cbb5"/><text x={p.x+62.5} y={p.y+29} textAnchor="middle">{n.label}</text></g>;})}</svg><p role="status">{nodes.find(n=>n.id===selected)?.detail||'点击节点查看说明'}</p></div>;
}
function clamp(v,input){return Math.min(input.max,Math.max(input.min,Number(v)));}
export function CalculatorView({props}){
 const [values,setValues]=useState({}),[invalid,setInvalid]=useState(''),[playing,setPlaying]=useState(false);
 const inputs=props.inputs||[],vars=Object.fromEntries(inputs.map(p=>[p.key,Object.hasOwn(values,p.key)?values[p.key]:p.value]));
 useEffect(()=>{
  if(!playing)return;const input=inputs.find(p=>p.key===props.plotVariable);if(!input){setPlaying(false);return;}
  const timer=setInterval(()=>setValues(old=>{const current=Object.hasOwn(old,input.key)?old[input.key]:input.value;return {...old,[input.key]:current>=input.max?input.min:Math.min(input.max,current+(input.max-input.min)/100)};}),100);
  return()=>clearInterval(timer);
 },[playing,props.plotVariable,JSON.stringify(inputs)]);
 const outputs=(props.outputs||[]).map(p=>{try{return {...p,result:calculate(p.formula,vars)};}catch{return {...p,result:null};}});
 const curve=useMemo(()=>{if(!props.plotFormula||!props.plotVariable)return null;const input=inputs.find(p=>p.key===props.plotVariable);if(!input||input.min>=input.max)return null;const values=[];for(let i=0;i<=40;i++){const x=input.min+(input.max-input.min)*i/40;try{values.push({x,y:calculate(props.plotFormula,{...vars,[input.key]:x})});}catch{}}return values.length>1?values:null;},[props.plotFormula,props.plotVariable,JSON.stringify(vars),JSON.stringify(inputs)]);
 return <section className="scene-calculator"><div className="scene-heading"><strong>{props.title}</strong><div>{curve&&<button type="button" aria-pressed={playing} onClick={()=>setPlaying(p=>!p)}>{playing?'暂停演示':'播放变化'}</button>}<button type="button" onClick={()=>{setValues({});setInvalid('');setPlaying(false);}}>重置</button></div></div>
 <div className="calc-inputs">{inputs.map(p=><label key={p.key}><span>{p.label}<small>{p.unit}</small></span><input type="number" aria-label={p.label} min={p.min} max={p.max} step={p.step} value={vars[p.key]} onChange={e=>{if(e.target.value===''){setInvalid(p.label+'不能为空');return;}setInvalid('');setValues(v=>({...v,[p.key]:clamp(e.target.value,p)}));}}/><input type="range" aria-label={`${p.label}滑杆`} min={p.min} max={p.max} step={p.step} value={vars[p.key]} onChange={e=>setValues(v=>({...v,[p.key]:Number(e.target.value)}))}/></label>)}</div>
 <div className="calc-outputs" aria-live="polite">{outputs.map((p,i)=><div key={i}><small>{p.label}</small><strong>{p.result===null?'暂无法计算':Number(p.result.toFixed(4)).toLocaleString()}{p.result!==null&&<small>{p.unit}</small>}</strong></div>)}</div>
 {invalid&&<p role="status">{invalid}</p>}{curve&&<PlotView props={{title:props.plotTitle||'参数变化',xLabel:inputs.find(p=>p.key===props.plotVariable)?.label||'',yLabel:props.outputs?.[0]?.unit||'',kind:'line',series:[{name:props.plotTitle||'模拟结果',values:curve}]}}/>}
 <small className="scene-source">{props.note||'按给定公式计算，调整参数立即更新。'}</small></section>;
}
export function QuizView({props}){
 const [answer,setAnswer]=useState(-1),[checked,setChecked]=useState(false);return <section className="scene-quiz"><strong>{props.question}</strong><div>{props.choices?.map((x,i)=><button type="button" key={i} aria-pressed={answer===i} disabled={checked} className={answer===i?'selected':''} onClick={()=>setAnswer(i)}>{String.fromCharCode(65+i)}. {x}</button>)}</div><button type="button" className="scene-primary" disabled={answer<0} onClick={()=>checked?(setChecked(false),setAnswer(-1)):setChecked(true)}>{checked?'再试一次':'查看答案'}</button>{checked&&<p role="status">{answer===props.answer?'✓ 答对了。':'再想一想。'} {props.explanation}</p>}</section>;
}
export function FormView({props,busy=false}){
 const [values,setValues]=useState({}),trigger=useTriggerAction(),[sent,setSent]=useState(false);
 return <form className="scene-form" onSubmit={e=>{e.preventDefault();if(busy)return;trigger(`${props.prompt}\n用户填写的信息：${JSON.stringify(values)}`);setSent(true);}}><strong>{props.title}</strong>{props.fields?.map(p=><label key={p.key}>{p.label}{p.kind==='select'?<select aria-label={p.label} required value={values[p.key]||''} onChange={e=>setValues(v=>({...v,[p.key]:e.target.value}))}><option value="">请选择</option>{p.options?.map(x=><option key={x}>{x}</option>)}</select>:<input type={p.kind} aria-label={p.label} required maxLength={300} value={values[p.key]||''} placeholder={p.placeholder} onChange={e=>setValues(v=>({...v,[p.key]:e.target.value}))}/>}</label>)}<button className="scene-primary" type="submit" disabled={busy}>{props.button||'按填写内容继续'} ↗</button>{sent&&<small>已用于继续对话</small>}</form>;
}
export function ResourceView({props}){
 const link=safeLink(props.url);return <article className="resource-card"><small>{props.kind}</small><strong>{props.title}</strong><p>{props.summary}</p>{props.meta&&<span>{props.meta}</span>}{link&&<a href={link} target="_blank" rel="noopener noreferrer">{props.action||'查看来源'} ↗<small>{new URL(link).hostname}</small></a>}</article>;
}
const weatherLabel=code=>code===0?'晴':code<=3?'多云':code<=48?'雾':code<=67?'雨':code<=77?'雪':code<=82?'阵雨':code<=86?'阵雪':'雷雨';
export function LiveView({props}){
 const search=useContext(DataContext),query=props.query?.trim()||'',complete=!!props.title;
 const [data,setData]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[amount,setAmount]=useState(100);
 useEffect(()=>{setData(null);setError('');if(!query||!complete||!search)return;const c=new AbortController();search(props.kind,query,c.signal).then(d=>{if(!c.signal.aborted)setData(d);}).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>c.abort();},[props.kind,query,complete,search,attempt]);
 return <section className="scene-live" data-live-kind={props.kind}><div className="scene-heading"><strong>{props.title||'实时查询'}</strong><button type="button" onClick={()=>setAttempt(n=>n+1)}>刷新</button></div>
 {!data?<div className="scene-status" role="status">{error||'正在查询真实数据…'}</div>:data.kind==='weather'?<><div className="weather-current"><strong>{data.temperature}°</strong><span>{weatherLabel(data.code)}<small>{data.place} · {data.time.replace('T',' ')} {data.timezone}</small></span></div><div className="weather-days">{data.days.map(d=><div key={d.date}><small>{d.date.slice(5)}</small><strong>{d.low}° — {d.high}°</strong><small>降水概率 {d.rain}%</small></div>)}</div></>:data.kind==='market'?<><div className="market-price"><strong>{data.price.toLocaleString()}</strong> {data.currency}<small>{data.name} · {data.exchange}<br/>{new Date(data.time).toLocaleString()} · {data.note}</small></div>{data.history.length>1&&<PlotView props={{title:'近一个月',kind:'line',xLabel:'交易日序号',yLabel:data.currency,series:[{name:data.symbol,values:data.history.map((p,i)=>({x:i+1,y:p.y}))}]}}/>}</>:data.kind==='sports'?<div className="sports-games">{data.games.length?data.games.map(g=><a key={g.id} href={g.source} target="_blank" rel="noopener noreferrer"><small>{new Date(g.time).toLocaleString()} · {g.status}</small>{g.teams.map((t,i)=><div key={i}><span>{t.name}</span><strong>{g.state==='pre'?'—':t.score}</strong></div>)}</a>):<p>数据源当前没有提供比赛。</p>}<small>{data.note}</small></div>:<><label className="currency-input">{data.base}<input type="number" aria-label="换算金额" min="0" max="1000000000" value={amount} onChange={e=>setAmount(Math.max(0,Math.min(1e9,Number(e.target.value))))}/></label><div className="currency-result" aria-live="polite">≈ {(amount*data.rate).toLocaleString(undefined,{maximumFractionDigits:2})} {data.quote}</div><small>1 {data.base} = {data.rate} {data.quote} · {data.date}<br/>{data.note}</small></>}
 {data&&<a className="scene-source" href={data.source} target="_blank" rel="noopener noreferrer">{data.provider} ↗ · {data.kind==='weather'?'模型预报，非现场测量':data.kind==='currency'?'最近可用参考日':`查询于 ${new Date(data.fetchedAt).toLocaleTimeString()}`}</a>}</section>;
}
