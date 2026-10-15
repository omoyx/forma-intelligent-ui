import {DataError} from './places.mjs';
const leagues={nba:'basketball/nba',wnba:'basketball/wnba',epl:'soccer/eng.1',laliga:'soccer/esp.1',nfl:'football/nfl'};
const currencies=new Set(['EUR','USD','CNY','GBP','JPY','CHF','AUD','CAD','HKD','SGD','KRW','NZD','SEK','NOK','DKK','INR']);
export function createLiveData({fetcher=fetch,placeSearch,now=Date.now}={}){
 const cache=new Map(),pending=new Map();let active=0;
 async function json(url){const r=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(12000),headers:{Accept:'application/json','User-Agent':'Mozilla/5.0 Forma/1.0 (https://omoyx.github.io/forma-intelligent-ui/)'}});if(!r.ok||!r.headers.get('content-type')?.includes('application/json'))throw new DataError('数据源暂时不可用，请重试。');return r.json();}
 return async (kind,value)=>{
  if(!['weather','currency','market','sports'].includes(kind))throw new DataError('此实时服务尚未接入。',400);
  let query=String(value||'').trim();
  if(!query||query.length>120)throw new DataError('查询参数无效。',400);
  if(kind==='currency'){query=query.toUpperCase();const pair=query.split('/');if(pair.length!==2||pair.some(x=>!currencies.has(x)))throw new DataError('请选择受支持的货币对，例如 EUR/CNY。',400);}
  if(kind==='market'){query=query.toUpperCase();if(!/^[A-Z0-9^][A-Z0-9.^=-]{0,19}$/.test(query))throw new DataError('请输入有效的交易代码，例如 AAPL、0700.HK。',400);}
  if(kind==='sports'){query=query.toLowerCase();if(!Object.hasOwn(leagues,query))throw new DataError('支持 NBA、WNBA、英超、西甲和 NFL。',400);}
  const key=kind+':'+query;
  if(cache.get(key)?.expires>now())return cache.get(key).data;if(pending.has(key))return pending.get(key);
  if(active>=4)throw new DataError('查询繁忙，请稍后重试。',429);
  const job=(async()=>{active++;try{
   let data;
   if(kind==='weather'){
    const place=(await placeSearch(query)).places[0];if(!place)throw new DataError('没有找到这个城市，请补充国家或地区。',404);
    const url=new URL('https://api.open-meteo.com/v1/forecast');url.search=new URLSearchParams({latitude:String(place.lat),longitude:String(place.lon),current:'temperature_2m,weather_code',daily:'temperature_2m_max,temperature_2m_min,precipitation_probability_max',forecast_days:'3',timezone:'auto'});
    const d=await json(url),c=d.current,days=d.daily;
    if(!Number.isFinite(c?.temperature_2m)||!Number.isFinite(c.weather_code)||!Array.isArray(days?.time)||!days.time.length||typeof c.time!=='string'||typeof d.timezone!=='string')throw new DataError('天气数据不完整。');
    const forecast=days.time.slice(0,3).map((date,i)=>({date,high:days.temperature_2m_max?.[i],low:days.temperature_2m_min?.[i],rain:days.precipitation_probability_max?.[i]}));
    if(forecast.some(x=>typeof x.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x.date)||![x.high,x.low,x.rain].every(Number.isFinite)))throw new DataError('天气数据不完整。');
    data={kind,query,place:place.name,address:place.address,temperature:c.temperature_2m,code:c.weather_code,time:c.time,timezone:d.timezone,days:forecast,source:'https://open-meteo.com/',provider:'Open-Meteo'};
   }else if(kind==='market'){
    const url=new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(query)}`);url.search=new URLSearchParams({interval:'1d',range:'1mo'});
    const d=await json(url),row=d.chart?.result?.[0],meta=row?.meta;
    if(!Number.isFinite(meta?.regularMarketPrice)||!Number.isFinite(meta.regularMarketTime)||typeof meta.currency!=='string')throw new DataError('没有可用行情，请核对交易代码。',404);
    const prices=row.indicators?.quote?.[0]?.close||[];
    data={kind,symbol:query,name:String(meta.shortName||meta.longName||query).slice(0,120),price:meta.regularMarketPrice,currency:meta.currency,time:new Date(meta.regularMarketTime*1000).toISOString(),exchange:String(meta.exchangeName||''),history:(row.timestamp||[]).flatMap((t,i)=>Number.isFinite(t)&&Number.isFinite(prices[i])?[{x:t,y:prices[i]}]:[]).slice(-35),source:`https://finance.yahoo.com/quote/${encodeURIComponent(query)}/`,provider:'Yahoo Finance',note:'最近可用行情，可能延迟；非交易报价'};
   }else if(kind==='sports'){
    const d=await json(new URL(`https://site.api.espn.com/apis/site/v2/sports/${leagues[query]}/scoreboard`));
    if(!Array.isArray(d.events))throw new DataError('赛程数据不完整。');
    const games=d.events.slice(0,10).flatMap(e=>{const teams=e.competitions?.[0]?.competitors;if(!Array.isArray(teams)||teams.length!==2||!/^\d+$/.test(String(e.id))||!Number.isFinite(Date.parse(e.date)))return [];
     return [{id:String(e.id),time:e.date,status:String(e.status?.type?.detail||'').slice(0,100),state:String(e.status?.type?.state||''),teams:teams.map(t=>({name:String(t.team?.displayName||'').slice(0,100),score:/^\d+(\.\d+)?$/.test(String(t.score))?String(t.score):'—'})),source:`https://www.espn.com/${query==='epl'||query==='laliga'?'soccer':query}/game/_/gameId/${e.id}`}];});
    data={kind,league:query.toUpperCase(),games,source:`https://www.espn.com/${query==='epl'||query==='laliga'?'soccer':query}/scoreboard`,provider:'ESPN',note:'源站当前提供的赛程/比分，可能延迟'};
   }else{
    const [base,quote]=query.split('/');const url=new URL('https://api.frankfurter.dev/v2/rates');url.search=new URLSearchParams({base,quotes:quote});
    const d=base===quote?[{base,quote,rate:1,date:new Date(now()).toISOString().slice(0,10)}]:await json(url),row=Array.isArray(d)?d.find(x=>x.base===base&&x.quote===quote):null;
    if(!row||!Number.isFinite(row.rate)||row.rate<=0||!/^\d{4}-\d{2}-\d{2}$/.test(row.date))throw new DataError('汇率数据不完整。');
    data={kind,base,quote,rate:row.rate,date:row.date,source:'https://frankfurter.dev/',provider:'Frankfurter',note:'参考汇率，非银行成交价'};
   }
   data.fetchedAt=new Date(now()).toISOString();if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(key,{data,expires:now()+(kind==='weather'?600000:kind==='currency'?3600000:60000)});return data;
  }catch(e){if(e instanceof DataError)throw e;throw new DataError('数据查询未完成，请重试。');}finally{active--;}})();
  pending.set(key,job);try{return await job;}finally{pending.delete(key);}
 };
}
