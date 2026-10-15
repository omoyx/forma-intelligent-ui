import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function createAccess({hash=process.env.DEMO_PASSWORD_HASH,origin=process.env.DEMO_ALLOWED_ORIGIN}={}) {
  const sessions=new Map(),attempts=new Map();
  const required=!!hash;
  function prune(){const now=Date.now();for(const [k,v] of sessions)if(v<now)sessions.delete(k);for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);}
  return {
    required, origin,
    allowedOrigin(value,host){return !value||value===origin||(!origin&&value===`http://${host}`);},
    authorized(req){if(!required)return true;prune();return (sessions.get(req.headers.authorization?.replace(/^Bearer /,''))||0)>Date.now();},
    login(password,ip){
      prune();const attempt=attempts.get(ip)||{count:0,until:Date.now()+15*60*1000};
      if(attempt.count>=10)return {status:429,error:'尝试次数较多，请稍后再试。'};
      const [salt,expected]=String(hash||'').split(':');
      const valid=typeof password==='string'&&password.length<=200&&salt&&/^[a-f0-9]{64}$/.test(expected||'')&&timingSafeEqual(scryptSync(password,salt,32),Buffer.from(expected,'hex'));
      if(!valid){attempt.count++;attempts.set(ip,attempt);return {status:401,error:'密码不正确。'};}
      attempts.delete(ip);if(sessions.size>=200)sessions.delete(sessions.keys().next().value);
      const token=randomBytes(32).toString('base64url');sessions.set(token,Date.now()+12*60*60*1000);
      return {status:200,token};
    }
  };
}
