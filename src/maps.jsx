import React,{createContext,useContext,useEffect,useRef,useState,useCallback} from 'react';
export const PlaceContext=createContext(null);
const MapScope=createContext(null);
export function PlaceView({props}){
 const search=useContext(PlaceContext),scope=useContext(MapScope),id=useRef(Symbol('place')).current,query=props.query?.trim()||'',label=props.label?.trim()||'';
 const [result,setResult]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[choice,setChoice]=useState(0);
 // label starts only after the query string has closed: never geocode streamed prefixes.
 useEffect(()=>{setResult(null);setError('');setChoice(0);if(!query||!label||!search)return;const c=new AbortController();search(query,c.signal).then(d=>{if(!c.signal.aborted)setResult(d);}).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>c.abort();},[query,!!label,search,attempt]);
 const place=result?.places?.[choice];
 useEffect(()=>{scope?.register(id,place?{...place,label}:null);return()=>scope?.register(id,null);},[id,place,label,scope?.register]);
 const selected=scope?.selected===id;
 return <div className={`map-place ${selected?'selected':''}`} data-place-query={query}>
 <button type="button" className="place-select" disabled={!place} aria-pressed={selected} onClick={()=>scope?.select(id)}><span className="place-dot">●</span><span><strong>{label||'正在查找地点…'}</strong><small>{props.detail}</small></span>{place&&<span>↗</span>}</button>
 {place?<div className="place-meta"><a href={place.source} target="_blank" rel="noopener noreferrer">{place.address} ↗</a>{result.places.length>1&&<select aria-label={`选择${label}的匹配地点`} value={choice} onChange={e=>setChoice(Number(e.target.value))}>{result.places.map((p,i)=><option key={p.id} value={i}>{p.address}</option>)}</select>}</div>:<div className="place-meta" role="status">{error||(result?'没有找到匹配地点。':'正在查询真实地点…')}{(error||result)&&<button type="button" onClick={()=>setAttempt(n=>n+1)}>重试</button>}</div>}
 </div>;
}
export function MapView({props,renderNode}){
 const host=useRef(null),mapRef=useRef(null),markers=useRef(null),LRef=useRef(null),pointsRef=useRef([]);
 const [points,setPoints]=useState([]),[selected,setSelected]=useState(null),[ready,setReady]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[expanded,setExpanded]=useState(false);
 const register=useCallback((id,p)=>setPoints(all=>{const next=all.filter(x=>x.id!==id);if(p)next.push({id,place:p});return next;}),[]);
 const select=useCallback(id=>setSelected(id),[]);
 pointsRef.current=points;
 useEffect(()=>{
  let dead=false,map,observer;setReady(false);setError('');
  import('leaflet').then(module=>{
   if(dead)return;const L=module.default||module;LRef.current=L;
   map=L.map(host.current,{scrollWheelZoom:false,attributionControl:true}).setView([30,110],3);mapRef.current=map;
   const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',referrerPolicy:'strict-origin-when-cross-origin'}).addTo(map);
   let failed=0;tiles.on('tileerror',()=>{if(++failed>=2&&!dead)setError('底图暂时未能加载，地点列表仍可使用。');});
   markers.current=L.layerGroup().addTo(map);observer=new ResizeObserver(()=>map.invalidateSize({pan:false}));observer.observe(host.current);setReady(true);
  }).catch(()=>{if(!dead)setError('地图未能加载，请重试。');});
  return()=>{dead=true;observer?.disconnect();map?.remove();mapRef.current=null;};
 },[attempt]);
 function fit(){const map=mapRef.current,L=LRef.current;if(!map||!points.length)return;map.fitBounds(L.latLngBounds(points.map(x=>[x.place.lat,x.place.lon])),{padding:[35,35],maxZoom:14,animate:false});}
 useEffect(()=>{
  if(!ready||!markers.current)return;const L=LRef.current;markers.current.clearLayers();
  points.forEach(({id,place},i)=>L.marker([place.lat,place.lon],{icon:L.divIcon({className:'forma-pin',html:`<span>${i+1}</span>`,iconSize:[30,36],iconAnchor:[15,36]}),title:place.label,keyboard:true}).addTo(markers.current).on('click',()=>select(id)));
  fit();
 },[ready,points]);
 useEffect(()=>{const p=points.find(x=>x.id===selected)?.place;if(p&&mapRef.current)mapRef.current.setView([p.lat,p.lon],15,{animate:false});},[selected]);
 useEffect(()=>{if(!expanded)return;const close=e=>{if(e.key==='Escape')setExpanded(false);};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close);},[expanded]);
 return <section className={`location-map ${expanded?'map-expanded':''}`} aria-label={props.title||'地点地图'}>
 <div className="scene-heading"><strong>{props.title||'地点地图'}</strong><div><button type="button" onClick={fit} disabled={!points.length}>查看全部</button><button type="button" onClick={()=>setExpanded(x=>!x)}>{expanded?'收起地图':'放大地图'}</button></div></div>
 <div className="map-canvas" ref={host} aria-label="可拖动、缩放的地图"/>
 {error&&<div className="scene-status" role="status">{error}<button type="button" onClick={()=>setAttempt(n=>n+1)}>重试地图</button></div>}
 <MapScope.Provider value={{register,selected,select}}><div className="map-places">{renderNode(props.places)}</div></MapScope.Provider>
 <small className="scene-source">地点来自 OpenStreetMap / Nominatim · 请核对匹配地址</small>
 </section>;
}
