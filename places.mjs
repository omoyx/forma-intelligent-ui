const endpoint='https://nominatim.openstreetmap.org/search';
const agent='Forma/1.0 (https://omoyx.github.io/forma-intelligent-ui/; place lookup)';
export class DataError extends Error {constructor(message,status=502){super(message);this.status=status;}}
export function placeQuery(value){
 if(typeof value!=='string'||value.length>120)throw new DataError('地点检索词无效。',400);
 const query=value.normalize('NFKC').replace(/[^\p{L}\p{N}\s.,()-]/gu,' ').replace(/\s+/g,' ').trim();
 if(query.length<2)throw new DataError('请提供城市与地点名称。',400);return query;
}
export function extractPlaces(data){return (Array.isArray(data)?data:[]).slice(0,3).flatMap(p=>{
 const lat=Number(p.lat),lon=Number(p.lon);
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||!['node','way','relation'].includes(p.osm_type)||!/^\d+$/.test(String(p.osm_id)))return [];
 const clean=x=>String(x||'').replace(/<[^>]*>/g,'').slice(0,300);
 return [{id:`${p.osm_type}-${p.osm_id}`,lat,lon,name:clean(p.name||p.display_name?.split(',')[0]),address:clean(p.display_name),source:`https://www.openstreetmap.org/${p.osm_type}/${p.osm_id}`}];
});}
export function createPlaceSearch({fetcher=fetch,now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms)),intervalMs=1100}={}){
 const cache=new Map(),pending=new Map();let tail=Promise.resolve(),queued=0,lastStart=-Infinity;
 return async value=>{
  const query=placeQuery(value),key=query.toLowerCase();
  if(cache.get(key)?.expires>now())return cache.get(key).data;
  if(pending.has(key))return pending.get(key);
  if(queued>=8)throw new DataError('地点检索繁忙，请稍后重试。',429);
  queued++;
  const job=tail.catch(()=>{}).then(async()=>{
   const wait=lastStart+intervalMs-now();if(wait>0)await sleep(wait);lastStart=now();
   try{
    const url=new URL(endpoint);url.search=new URLSearchParams({q:query,format:'jsonv2',limit:'3','accept-language':'zh-CN'});
    const response=await fetcher(url,{headers:{'User-Agent':agent,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(12000)});
    if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw new DataError('地图地点源暂时不可用，请重试。');
    const data={query,places:extractPlaces(await response.json()),provider:'OpenStreetMap / Nominatim'};
    if(cache.size>=200)cache.delete(cache.keys().next().value);cache.set(key,{data,expires:now()+86400000});return data;
   }catch(e){if(e instanceof DataError)throw e;throw new DataError('地点查询未完成，请重试。');}
   finally{queued--;}
  });
  tail=job;pending.set(key,job);try{return await job;}finally{pending.delete(key);}
 };
}
