// Fixed-source discovery: the model supplies keywords, never an image URL.
const endpoint='https://commons.wikimedia.org/w/api.php';
const agent='Forma/1.0 (https://omoyx.github.io/forma-intelligent-ui/; image search demo)';
export class ImageError extends Error {constructor(message,status=502){super(message);this.status=status;}}
export function normalizeQuery(value){
  if(typeof value!=='string'||value.length>140)throw new ImageError('图片检索词过长或无效。',400);
  const query=value.normalize('NFKC').replace(/[^\p{L}\p{N}\s-]/gu,' ').replace(/\s+/g,' ').trim();
  if(query.length<2)throw new ImageError('请提供更明确的图片检索词。',400);
  return query;
}
function plain(value){return String(value||'').replace(/<[^>]*>/g,' ').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const code=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return code>0&&code<=0x10ffff?String.fromCodePoint(code):'';}).replace(/&(amp|quot|apos|lt|gt|nbsp);/g,(_,n)=>({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '}[n])).replace(/\s+/g,' ').trim().slice(0,220);}
function trustedURL(value,hosts,path){
  try{const u=new URL(value);if(u.protocol!=='https:'||u.port||u.username||u.password||!hosts.includes(u.hostname)||!u.pathname.startsWith(path))return null;u.search='';u.hash='';return u.href;}catch{return null;}
}
export function extractImages(data){
  return Object.values(data?.query?.pages||{}).sort((a,b)=>(a.index||0)-(b.index||0)).flatMap(page=>{
    const info=page.imageinfo?.[0],meta=info?.extmetadata||{};
    if(!info||!['image/jpeg','image/png','image/webp'].includes(info.mime)||info.width<240||info.height<160||/\b(diagram|drawing|icon|map|logo|rendering)\b/i.test(page.title))return [];
    const url=trustedURL(info.thumburl,['thumb.wikimedia.org','upload.wikimedia.org'],'/wikipedia/commons/');
    const source=trustedURL(info.descriptionurl,['commons.wikimedia.org'],'/wiki/File:');
    const license=plain(meta.LicenseShortName?.value);
    if(!url||!source||!license)return [];
    return [{id:page.pageid,title:plain(page.title.replace(/^File:/,'')),url,source,author:plain(meta.Artist?.value)||'署名见来源',license,
      licenseURL:trustedURL(meta.LicenseUrl?.value,['creativecommons.org'],'/')||undefined}];
  }).slice(0,3);
}
export function createImageSearch({fetcher=fetch,timeoutMs=12000,now=Date.now}={}){
  const cache=new Map(),pending=new Map();let active=0;
  return async value=>{
    const query=normalizeQuery(value),key=query.toLowerCase();
    if(cache.get(key)?.expires>now())return cache.get(key).data;
    if(pending.has(key))return pending.get(key);
    if(active>=4)throw new ImageError('图片检索繁忙，请稍后重试。',429);
    const job=(async()=>{
      active++;
      try{
        const url=new URL(endpoint);url.search=new URLSearchParams({action:'query',format:'json',generator:'search',gsrsearch:`${query} filetype:bitmap`,gsrnamespace:'6',gsrlimit:'10',prop:'imageinfo',iiprop:'url|extmetadata|mime|size',iiurlwidth:'700',maxlag:'5'});
        const response=await fetcher(url,{headers:{'User-Agent':agent,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
        if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw new ImageError('图片源暂时不可用，请稍后重试。');
        const data=await response.json();if(data.error)throw new ImageError('图片源暂时繁忙，请稍后重试。');
        const result={query,images:extractImages(data),provider:'Wikimedia Commons'};
        if(cache.size>=100)cache.delete(cache.keys().next().value);
        cache.set(key,{data:result,expires:now()+3600000});return result;
      }catch(e){if(e instanceof ImageError)throw e;throw new ImageError('图片检索未完成，请重试。');}
      finally{active--;}
    })();
    pending.set(key,job);try{return await job;}finally{pending.delete(key);}
  };
}
