// Segment a streaming assistant response without evaluating model-generated code.
// Every fenced UI block has its own OpenUI root and is rendered in message order.
export function splitReply(raw, streaming=false) {
  if (/^\s*root\s*=/.test(raw)) return [{kind:'ui',content:raw,complete:!streaming}];
  const parts=[];
  const opening=/```(?:openui-lang|openui)[ \t]*\r?\n/g;
  let cursor=0,match;
  while((match=opening.exec(raw))) {
    const text=raw.slice(cursor,match.index);
    if(text.trim())parts.push({kind:'text',content:text});
    const start=opening.lastIndex;
    const close=/^```[ \t]*(?:\r?\n|$)/gm;
    close.lastIndex=start;
    const end=close.exec(raw);
    if(!end){parts.push({kind:'ui',content:raw.slice(start),complete:false});return parts;}
    parts.push({kind:'ui',content:raw.slice(start,end.index),complete:true});
    cursor=close.lastIndex;opening.lastIndex=cursor;
  }
  let text=raw.slice(cursor);
  if(streaming)text=text.replace(/`{1,3}([a-z-]*)[ \t]*$/, (all,lang)=>'openui-lang'.startsWith(lang)?'':all);
  if(text.trim())parts.push({kind:'text',content:text});
  return parts;
}
