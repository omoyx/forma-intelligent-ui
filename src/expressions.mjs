// Bounded arithmetic grammar. No eval, Function, properties, loops or model code.
const functions={sin:Math.sin,cos:Math.cos,tan:Math.tan,sqrt:Math.sqrt,abs:Math.abs,log:Math.log,exp:Math.exp,round:Math.round,floor:Math.floor,ceil:Math.ceil,min:Math.min,max:Math.max,pow:Math.pow};
export function calculate(source,values={}){
 if(typeof source!=='string'||source.length>500)throw Error('公式过长');
 const tokens=source.match(/(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?|[a-zA-Z_][a-zA-Z_0-9]*|[^\s]/g)||[];let at=0,depth=0;
 if(tokens.length>200)throw Error('公式过长');
 const pop=()=>tokens[at++];
 function expr(min=0){if(++depth>30)throw Error('公式过深');let token=pop(),left;
  if(token==='-'||token==='+')left=(token==='-'?-1:1)*expr(3);
  else if(token==='('){left=expr();if(pop()!==')')throw Error('括号不完整');}
  else if(/^(?:\d|\.)/.test(token||'')){left=Number(token);}
  else if(/^[a-zA-Z_]\w*$/.test(token||'')){
   if(tokens[at]==='('){if(!Object.hasOwn(functions,token))throw Error('不支持的函数');pop();const args=[expr()];while(tokens[at]===','){pop();args.push(expr());if(args.length>6)throw Error('参数过多');}if(pop()!==')')throw Error('括号不完整');left=functions[token](...args);}
   else if(token==='pi')left=Math.PI;else if(token==='e')left=Math.E;
   else if(Object.hasOwn(values,token)&&typeof values[token]==='number')left=values[token];else throw Error('未知变量');
  }else throw Error('公式不完整');
  while(at<tokens.length){const op=tokens[at],precedence={'+':1,'-':1,'*':2,'/':2,'^':4}[op];if(!precedence||precedence<min)break;pop();const right=expr(op==='^'?precedence:precedence+1);left=op==='+'?left+right:op==='-'?left-right:op==='*'?left*right:op==='/'?left/right:left**right;}
  depth--;if(!Number.isFinite(left)||Math.abs(left)>1e100)throw Error('结果超出范围');return left;
 }
 const result=expr();if(at!==tokens.length)throw Error('不支持的公式');return result;
}
export function safeLink(raw){try{const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password)return null;return u.href;}catch{return null;}}
