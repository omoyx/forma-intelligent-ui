import React,{createContext,useContext,useEffect,useState} from 'react';

export const ImageContext=createContext(null);
// A short debounce coalesces changes to an unfinished streamed search keyword.
// It does not delay or replay model output. Each card fetches independently.
export function PhotoView({props}){
  const search=useContext(ImageContext),query=props.query?.trim()||'';
  const [result,setResult]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[index,setIndex]=useState(0),[loaded,setLoaded]=useState(false),[failed,setFailed]=useState(false);
  useEffect(()=>{
    setResult(null);setError('');setIndex(0);setLoaded(false);setFailed(false);
    if(query.length<2||!search)return;
    const controller=new AbortController();
    const timer=setTimeout(async()=>{try{const data=await search(query,controller.signal,{matchTitle:!!props.recommendation});if(!controller.signal.aborted)setResult(data);}catch(e){if(!controller.signal.aborted)setError(e.message||'图片检索失败。');}},400);
    return()=>{clearTimeout(timer);controller.abort();};
  },[query,search,attempt,props.recommendation]);
  const image=result?.images?.[index];
  function next(){setLoaded(false);setFailed(false);setIndex(n=>(n+1)%result.images.length);}
  const retry=()=>{setLoaded(false);setFailed(false);setAttempt(n=>n+1);};
  const problem=error||(result&&!image?'暂未找到匹配的实拍图片。':failed?'这张图片未能加载。':'');
  return <figure className={`photo-card${props.recommendation?' visual-card':''}`} data-image-query={query}>
    <div className="photo-frame" aria-busy={!loaded&&!problem}>
      {image&&!failed&&<a href={image.source} target="_blank" rel="noopener noreferrer" aria-label={`查看图片来源：${image.title}`}><img key={image.url} src={image.url} alt={image.title} referrerPolicy="no-referrer" decoding="async" onLoad={()=>setLoaded(true)} onError={()=>setFailed(true)} className={loaded?'loaded':''}/></a>}
      {(!loaded||problem)&&<div className="photo-placeholder" role="status">{problem||'正在寻找真实图片…'}{problem&&<div><button type="button" onClick={retry}>重试</button>{result?.images?.length>1&&<button type="button" onClick={next}>换一张</button>}</div>}</div>}
    </div>
    <figcaption><strong>{props.caption||query}</strong>{props.summary&&<p className="visual-summary">{props.summary}</p>}{props.meta&&<span className="visual-meta">{props.meta}</span>}{props.recommendation&&<span className="visual-reference">参考图片 · 以来源为准</span>}{image&&<><div className="photo-credit"><a href={image.source} target="_blank" rel="noopener noreferrer">Wikimedia Commons ↗</a>{result.images.length>1&&<button type="button" onClick={next} aria-label={`换一张${props.caption||query}图片`}>换一张</button>}</div><small>{image.author} · {image.licenseURL?<a href={image.licenseURL} target="_blank" rel="noopener noreferrer">{image.license}</a>:image.license}</small></>}</figcaption>
  </figure>;
}
