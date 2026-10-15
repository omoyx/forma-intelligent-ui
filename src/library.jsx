import React, { createContext, useContext, useEffect, useState, useId } from 'react';
import { createLibrary, defineComponent, useTriggerAction } from '@openuidev/react-lang';
import { z } from 'zod/v4';
import { PhotoView } from './photos.jsx';

// Same component definitions produce the model prompt and render its response.
export const InteractionContext = createContext({ values: {}, update: () => {}, busy: false });
function useField(label, initial) {
  const { values, update, busy } = useContext(InteractionContext);
  return [Object.hasOwn(values, label) ? values[label] : initial, value => update(label, value), busy];
}
const Text = defineComponent({ name: 'Text', description: 'A plain-text paragraph. No HTML or Markdown.',
  props: z.object({ content: z.string() }), component: ({ props }) => <p className="ui-text">{props.content}</p> });
const Notice = defineComponent({ name: 'Notice', description: 'Short contextual note; use to label estimates and sample data.',
  props: z.object({ content: z.string() }), component: ({ props }) => <aside className="ui-notice"><span>ⓘ</span>{props.content}</aside> });
const Metrics = defineComponent({ name: 'Metrics', description: 'Two to four summary metrics with value and a short note.',
  props: z.object({ items: z.array(z.object({ label: z.string(), value: z.string(), note: z.string() })) }),
  component: ({ props }) => <div className="ui-metrics">{props.items?.map((m, i) => <div className="ui-metric" key={i}><span>{m.label}</span><strong>{m.value}</strong><small>{m.note}</small></div>)}</div> });
const Timeline = defineComponent({ name: 'Timeline', description: 'An itinerary or ordered plan. Each item has time, title, detail, tag.',
  props: z.object({ items: z.array(z.object({ time: z.string(), title: z.string(), detail: z.string(), tag: z.string() })) }),
  component: ({ props }) => <div className="ui-timeline">{props.items?.map((item, i) => <div className="timeline-row" key={i}><span className="timeline-time">{item.time}</span><i/><div><div className="timeline-title">{item.title}<small>{item.tag}</small></div><p>{item.detail}</p></div></div>)}</div> });
const BarChart = defineComponent({ name: 'BarChart', description: 'Horizontal bar chart. Values must be non-negative numbers. Label the unit and whether data is estimated.',
  props: z.object({ title: z.string(), unit: z.string(), items: z.array(z.object({ label: z.string(), value: z.number().nonnegative() })) }),
  component: ({ props }) => { const max = Math.max(...(props.items || []).map(x => x.value), 1); return <div className="ui-chart"><div className="chart-heading"><strong>{props.title}</strong><span>{props.unit}</span></div>{props.items?.map((x,i) => <div className="bar-row" key={i}><span>{x.label}</span><div className="bar-track"><i style={{width:`${Math.max(1, x.value / max * 100)}%`}}/></div><strong>{x.value.toLocaleString()}</strong></div>)}</div>; } });
const Checklist = defineComponent({ name: 'Checklist', description: 'Interactive checklist. User can check and uncheck items locally.',
  props: z.object({ title: z.string(), items: z.array(z.string()) }),
  component: ({ props }) => { const [checked, setChecked] = useField(props.title, []); return <div className="ui-checklist"><div className="block-heading"><strong>{props.title}</strong><small>{checked.length} / {props.items?.length || 0}</small></div>{props.items?.map((item, i) => <label key={i} className={checked.includes(item) ? 'checked' : ''}><input type="checkbox" checked={checked.includes(item)} onChange={() => setChecked(checked.includes(item) ? checked.filter(x=>x!==item) : [...checked,item])}/><span>{item}</span></label>)}</div>; } });
const Slider = defineComponent({ name: 'Slider', description: 'Interactive numeric preference. User changes it locally, then can ask assistant to apply the preference.',
  props: z.object({ label: z.string(), min: z.number(), max: z.number(), step: z.number().positive(), value: z.number(), unit: z.string() }),
  component: ({ props }) => { const [value, setValue] = useField(props.label, props.value); const id=useId(); return <div className="ui-slider"><div className="block-heading"><label htmlFor={id}>{props.label}</label><strong>{Number(value).toLocaleString()}<small>{props.unit}</small></strong></div><input id={id} aria-label={props.label} type="range" min={props.min} max={props.max} step={props.step} value={value} onChange={e=>setValue(Number(e.target.value))}/><div className="range-labels"><span>{props.min.toLocaleString()}{props.unit}</span><span>{props.max.toLocaleString()}{props.unit}</span></div></div>; } });
const Options = defineComponent({ name: 'Options', description: 'Interactive single-choice preference shown as pill buttons.',
  props: z.object({ label: z.string(), choices: z.array(z.string()), selected: z.string() }),
  component: ({ props }) => { const [value,setValue] = useField(props.label,props.selected); return <div className="ui-options"><strong>{props.label}</strong><div>{props.choices?.map(x=><button type="button" key={x} aria-pressed={value===x} className={value===x?'selected':''} onClick={()=>setValue(x)}>{x}</button>)}</div></div>; } });
const Comparison = defineComponent({ name: 'Comparison', description: 'Selectable comparison cards, each with title, price, summary, features and badge. Never claim current live prices.',
  props: z.object({ title: z.string(), items: z.array(z.object({ title: z.string(), price: z.string(), summary: z.string(), features: z.array(z.string()), badge: z.string() })) }),
  component: ({ props }) => { const [value,setValue] = useField(props.title, ''); return <div className="ui-comparison"><strong>{props.title}</strong><div className="comparison-grid">{props.items?.map((item,i)=><button type="button" aria-pressed={value===item.title} className={`comparison-card ${value===item.title?'selected':''}`} key={i} onClick={()=>setValue(item.title)}><span className="comparison-top"><b>{item.title}</b><small>{item.badge}</small></span><strong>{item.price}</strong><p>{item.summary}</p><ul>{item.features?.map(f=><li key={f}>{f}</li>)}</ul><span className="comparison-select">{value===item.title?'✓ 已选择':'选择这个方案 →'}</span></button>)}</div></div>; } });
const DataTable = defineComponent({ name: 'DataTable', description: 'Sortable data table. Rows must have the same number of cells as columns.',
  props: z.object({ columns: z.array(z.string()), rows: z.array(z.array(z.string())) }),
  component: ({ props }) => { const [sort,setSort]=useState({index:-1,asc:true}); const rows=[...(props.rows||[])]; if(sort.index>=0) rows.sort((a,b)=>String(a[sort.index]).localeCompare(String(b[sort.index]),'zh-CN',{numeric:true})*(sort.asc?1:-1)); return <div className="ui-table"><table><thead><tr>{props.columns?.map((c,i)=><th key={i}><button type="button" onClick={()=>setSort({index:i,asc:sort.index===i?!sort.asc:true})}>{c}<span>{sort.index===i?(sort.asc?'↑':'↓'):'↕'}</span></button></th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j}>{c}</td>)}</tr>)}</tbody></table></div>; } });
const FollowUp = defineComponent({ name: 'FollowUp', description: 'Button to ask the model to revise or extend the interface. Prompt is sent with current user preferences.',
  props: z.object({ label: z.string(), prompt: z.string() }),
  component: ({ props }) => { const trigger=useTriggerAction(); const {busy}=useContext(InteractionContext); return <button type="button" className="ui-followup" disabled={busy} onClick={()=>trigger(props.prompt)}>{props.label}<span>↗</span></button>; } });
const plugFacts={
  C:{name:'Type C · Europlug',standard:'CEE 7/16 · 2.5 A',detail:'两根细圆脚，无保护接地。适用于额定范围内的双重绝缘小功率设备。'},
  E:{name:'Type E · 法式',standard:'插头 CEE 7/6',detail:'两根圆脚，正面接地孔与 E 型插座的凸出接地针配合。'},
  F:{name:'Type F · Schuko',standard:'插头 CEE 7/4',detail:'两根圆脚，两侧金属触点提供保护接地。纯 F 型不能直接用于带凸针的 E 型插座。'},
  EF:{name:'E/F 通用插头',standard:'CEE 7/7 · 常见 16 A',detail:'同时具备接地孔与侧面接地触点，按设计兼容 E、F 两类插座。'}
};
function PlugDrawing({type}){return <svg className="plug-drawing" viewBox="0 0 160 116" role="img" aria-label={`${plugFacts[type].name}插头正面示意，非尺寸图`}>
 <rect x="1" y="1" width="158" height="114" rx="10" fill="#f3f5f3"/>
 {type==='C'?<rect x="32" y="36" width="96" height="44" rx="22" fill="#fff" stroke="#8e9b94" strokeWidth="2"/>:<circle cx="80" cy="58" r="40" fill="#fff" stroke="#8e9b94" strokeWidth="2"/>}
 {(type==='F'||type==='EF')&&<><rect x="69" y="18" width="22" height="8" rx="2" fill="#728a7d"/><rect x="69" y="90" width="22" height="8" rx="2" fill="#728a7d"/></>}
 {(type==='E'||type==='EF')&&<circle cx="80" cy="34" r="7" fill="#e2e8e3" stroke="#728a7d" strokeWidth="2"/>}
 <circle cx="59" cy="62" r={type==='C'?5:6} fill="#909b98"/><circle cx="101" cy="62" r={type==='C'?5:6} fill="#909b98"/>
 </svg>;}
const PlugTypes=defineComponent({name:'PlugTypes',description:'Legacy component for saved conversations only. Do not generate this component; use PlugGallery and independent PlugCard nodes.',props:z.object({types:z.array(z.enum(['C','E','F','EF']))}),component:({props})=>{const [value,setValue]=useField('想了解的插头类型','');return <div className="plug-types"><div className="plug-caption">插头正面示意 · 非尺寸图</div><div className="plug-grid">{props.types?.map(type=><button type="button" key={type} aria-pressed={value===type} className={`plug-card ${value===type?'selected':''}`} onClick={()=>setValue(type)}><PlugDrawing type={type}/><strong>{plugFacts[type].name}</strong><small>{plugFacts[type].standard}</small><p>{plugFacts[type].detail}</p><span>{value===type?'✓ 已选中':'进一步了解 →'}</span></button>)}</div></div>;}});
// Each card is a separate OpenUI node: its text can render while the next
// referenced card has not arrived. Keep PlugTypes for saved conversations.
const PlugCard=defineComponent({name:'PlugCard',description:'One European plug card. Supply type first, then a concise Chinese explanation tailored to the question. The illustration and standard label are supplied locally; detail streams from the model.',props:z.object({type:z.enum(['C','E','F','EF']),detail:z.string()}),component:({props})=>{
 const [value,setValue]=useField('想了解的插头类型','');const fact=plugFacts[props.type];if(!fact)return null;
 return <button type="button" data-plug-type={props.type} aria-pressed={value===props.type} className={`plug-card ${value===props.type?'selected':''}`} onClick={()=>setValue(props.type)}><PlugDrawing type={props.type}/><strong>{fact.name}</strong><small>{fact.standard}</small><p>{props.detail}</p><span>{value===props.type?'✓ 已选中':'进一步了解 →'}</span></button>;
}});
const PlugGallery=defineComponent({name:'PlugGallery',description:'Progressive gallery of independently streamed PlugCard references. Define this gallery before the named card statements. Never inline all cards in a single expression.',props:z.object({cards:z.array(PlugCard.ref)}),component:({props,renderNode})=><div className="plug-types"><div className="plug-caption">插头正面示意 · 非尺寸图</div><div className="plug-grid">{renderNode(props.cards)}</div></div>});
const PhotoCard=defineComponent({name:'PhotoCard',description:'Search Wikimedia Commons for a real reference photograph. query is a precise English subject keyword (not a URL); caption is a short Chinese label. Supply query first. Loading, actual image, source and license are provided automatically. Search may return no result; do not claim you verified the image or rely on it for safety-critical identification.',props:z.object({query:z.string(),caption:z.string()}),component:PhotoView});
const PhotoGallery=defineComponent({name:'PhotoGallery',description:'Gallery of independently streamed named PhotoCard references. Usually one or two photos are enough. Define the gallery first, then each card on a separate line.',props:z.object({cards:z.array(PhotoCard.ref)}),component:({props,renderNode})=><div className="photo-gallery">{renderNode(props.cards)}</div>});
const leaf=[Text,Notice,Metrics,Timeline,BarChart,Checklist,Slider,Options,Comparison,DataTable,FollowUp,PlugTypes,PlugGallery,PlugCard,PhotoCard,PhotoGallery];
const children=z.array(z.union(leaf.map(c=>c.ref)));
const Section = defineComponent({ name:'Section', description:'A bordered panel with heading, optionally tinted. Contains leaf components.',
  props:z.object({title:z.string(),children,tinted:z.boolean().optional()}),
  component:({props,renderNode})=><section className={`ui-section ${props.tinted?'tinted':''}`}><h3>{props.title}</h3><div className="section-content">{renderNode(props.children)}</div></section> });
function TabView({props,renderNode}) { const [active,setActive]=useState(0); useEffect(()=>setActive(0),[props.title]); return <section className="ui-tabs"><h3>{props.title}</h3><div role="tablist" aria-label={props.title}>{props.items?.map((item,i)=><button type="button" role="tab" aria-selected={i===active} key={i} onClick={()=>setActive(i)}>{item.label}</button>)}</div><div role="tabpanel">{renderNode(props.items?.[active]?.content || [])}</div></section>; }
const Tabs=defineComponent({name:'Tabs',description:'Switchable tabs for days, categories or scenarios. Each content is an array of leaf components.',props:z.object({title:z.string(),items:z.array(z.object({label:z.string(),content:children}))}),component:TabView});
const Grid=defineComponent({name:'Grid',description:'Two-column responsive layout of leaf components or Sections.',props:z.object({children:z.array(z.union([...leaf,Section].map(c=>c.ref)))}),component:({props,renderNode})=><div className="ui-grid">{renderNode(props.children)}</div>});
const Workspace=defineComponent({name:'Workspace',description:'Required root of one inline UI block. Title and description may be empty when explained in surrounding prose.',props:z.object({title:z.string(),description:z.string(),children:z.array(z.union([...leaf,Section,Tabs,Grid].map(c=>c.ref)))}),component:({props,renderNode})=><article className="ui-workspace">{(props.title||props.description)&&<div className="workspace-heading">{props.title&&<h3>{props.title}</h3>}{props.description&&<p>{props.description}</p>}</div>}<div className="workspace-blocks">{renderNode(props.children)}</div></article>});
export const library=createLibrary({root:'Workspace',components:[Workspace,...leaf,Section,Tabs,Grid]});

export const example = `root = Workspace("把周末，交给杭州。", "两天一夜，湖边散步与山间喝茶。留一点时间，什么都不赶。", [stats, layout, days, note])
stats = Metrics([{label:"旅行时长",value:"2 天 1 夜",note:"周六出发 · 周日返程"},{label:"参考预算",value:"¥ 1,500",note:"每人 · 不含往返大交通"},{label:"旅行节奏",value:"慢一点",note:"每天 2—3 个主要停留点"}])
layout = Grid([preferences, costs])
preferences = Section("按你的方式出发", [budget, pace, apply], true)
budget = Slider("每人预算", 800, 3000, 100, 1500, "元")
pace = Options("想怎么度过周末", ["自然与散步", "人文与展览", "咖啡与美食"], "自然与散步")
apply = FollowUp("按我的偏好重新安排", "根据我在界面选择的预算和兴趣，重新安排杭州两天一夜行程，更新费用和每天安排。")
costs = Section("预算花在哪里", [chart])
chart = BarChart("每人费用估算", "元 / 人", [{label:"住宿",value:550},{label:"餐饮",value:350},{label:"市内交通",value:200},{label:"体验与弹性",value:400}])
days = Tabs("把时间留给喜欢的事", [{label:"Day 01 · 湖边慢游",content:[day1]},{label:"Day 02 · 山间寻茶",content:[day2]},{label:"出发前",content:[check]}])
day1 = Timeline([{time:"10:00",title:"从北山街开始，沿湖走走",detail:"避开打卡路线，走到哪儿就在哪里停一会。",tag:"西湖 · 免费"},{time:"13:00",title:"一顿江南午饭",detail:"在青芝坞附近找一家家常菜馆，午后留给咖啡和闲逛。",tag:"慢慢吃"},{time:"16:30",title:"等一场湖边日落",detail:"走到杨公堤，找个安静的角落。晚餐后早些休息。",tag:"今日高光"}])
day2 = Timeline([{time:"09:30",title:"在龙井村喝一杯茶",detail:"沿茶园小路散步，挑一家明码标价的茶室休息。",tag:"山间"},{time:"13:30",title:"九溪的树影与流水",detail:"穿一双舒服的鞋，雨后留意路滑；下午从容返程。",tag:"自然"}])
check = Checklist("出发清单", ["确认住宿与往返车票", "带上舒适的步行鞋", "查看天气，备好雨具", "把时间留松一点"])
note = Notice("这是交互示例预览，费用与行程仅作演示。发送左侧消息后，将由你的模型实时生成新界面。")`;

export const promptOptions={
  inlineMode:true,
  preamble:'你是一个中文 Intelligent UI 对话助手。像 ChatGPT 一样自然回答，在文字之间直接嵌入有用的可交互界面。回复会逐字流式出现在同一条聊天消息中。',
  additionalRules:[
    '所有可见文字使用简体中文。先用一句简短自然语言回应用户，再用 ```openui-lang 换行代码换行``` 嵌入界面，必要时在界面后继续解释；一条回复可包含 1—3 个独立界面块。普通解释、问候、追问直接输出文字，不必生成界面。',
    '每个界面块必须独立完整定义 root = Workspace(...)，root 语句最先，子组件用命名引用独立成行，保证渐进流式渲染。容器先写，叶子组件后写，禁止把多个卡片内联在一个巨大表达式中。不要输出补丁。界面是消息内容的一部分，不是独立网站、画布或网页预览。',
    '围绕实际需求自由组合组件，不能总套旅行模板。默认简短，直接回答当前问题，不延伸成百科文章。简单科普只需一句开场、一个直观界面和一个简短追问；不要附加表格、指标、清单、长篇注意事项或重复总结，用户追问后再展开。通常 1—2 个主要模块，不超过 20 个语句。Workspace 的 title/description 通常填空字符串，解释写在围栏外的自然语言里，避免界面内重复大标题。',
    '界面代码只使用库中已有的组件。禁止 HTML、JSX、JavaScript、Query、Mutation 或链接。只允许 openui-lang 代码围栏。',
    '计划类可用 Tabs + Timeline，比较类用 Comparison + DataTable，数据分析用 Metrics + BarChart + DataTable。按需加入一个有意义的交互控件和 FollowUp；不要每次都加预算或通用偏好面板，不强制网格布局。',
    'PhotoCard 可按检索词实时检索 Wikimedia Commons 参考图片，来源/作者/许可由组件展示，不用你编写。其他组件没有外部数据工具，无法得知实时天气、库存或价格。旅行费用必须标注估算；自行编造的数据必须用 Notice 清楚标为演示数据。不要声称已预订、支付、发送或执行外部动作。',
    '用户想看真实外观、实物照片，或动物、植物、景点等适合照片的内容时，用 PhotoCard 或 PhotoGallery。图片必须通过组件检索，不要编造网址，不把绘图称作实拍。query 用简短准确的英文实体词（如 Type C Europlug、Schuko plug、Capybara），不要加网址或检索语法；caption 用中文，一般一至两张即可。示例：root = Workspace("", "", [photos])；photos = PhotoGallery([c, f])；c = PhotoCard("Type C Europlug", "C 型 · 两根细圆脚")；f = PhotoCard("Schuko plug", "F 型 · 两侧接地触点")。每条语句单独成行。图片异步检索，可能失败或不完全匹配；不要声称已经看过检索结果、逐图认证类型或保证安全适配。讲解结构或精确触点时可选用插头示意组件。',
    '遵循追问和界面偏好，保留尚未要求改变的内容。Slider 只改变界面偏好值，必须配一个 FollowUp 把新偏好用于重新生成，不要声称移动滑杆会自动更新模型内容。',
    '关于欧洲插头：用户要实物/真实照片时优先使用 PhotoGallery + PhotoCard，只展示所问类型；一般认识类型或讲解触点结构时用 PlugGallery + 独立的 PlugCard 展示 C/E/F/EF，不再使用旧的 PlugTypes。顺序示例：root = Workspace("", "", [plugs, next])；plugs = PlugGallery([c, e, f, ef])；然后逐行 c = PlugCard("C", "此处生成约20—35字的针对性说明")、e = PlugCard("E", "...")、f = PlugCard("F", "...")、ef = PlugCard("EF", "...")，最后定义 next。每张卡片的说明由你实时生成，严格控制在20—35个汉字，只写一句关键区别，不重复卡片已有的名称和标准编号，不能省略或只写类型代号。一般认识插头的请求仅输出四卡片，末尾仅用一句自然语言问目的地或设备，不要再总结卡片内容，不加 Options、表格、清单或长篇提醒；需要适配判断时再展开。区分插头与插座标准：E 插头 CEE 7/6、E 插座 CEE 7/5；F 插头 CEE 7/4、F 插座 CEE 7/3。旧式纯 E/F 插头不能笼统保证互插或保护接地，不要断言纯 E 一定插不进 F，避免将物理插入与接地兼容混为一谈；现代常见 CEE 7/7 同时具备两种接地结构。用一两句解释这个区别即可。Type C Europlug CEE 7/16 通常 2.5A，适合双重绝缘小功率设备；欧洲还有 G/J/L/K 等，英国常用 G，不能说欧洲通用。转换头不变压，须核对设备铭牌电压/频率与额定电流，需接地设备必须保留保护接地。不能按设备名称或功率断定保护类别：I 类需接地，II 类双重绝缘不依靠保护接地；不可说所有吹风机/电水壶必须接地，也不可说所有笔记本充电器可以用无地 Type C。高功率双重绝缘设备也不能用额定 2.5A 的 Europlug。',
    '照片类回答保持极简：一句开场加图片；若用户问区别，末尾只补一句关键区别，围栏外总计不超过80个汉字。不重复图片下方已有的来源和许可，不主动附加设备建议、追问或长篇免责声明。',
    '组件参数按库中位置顺序填写；字符串用双引号、JSON对象键可用引号。数组对象必须满足全部字段。'
  ],
  examples:[`可以。先看这六个月的核心数字，再看每个月的变化。\n\n\`\`\`openui-lang\nroot = Workspace("", "", [metrics, chart])\nmetrics = Metrics([{label:"总营收",value:"61.6 万",note:"用户提供的六个月数据"},{label:"月均营收",value:"10.27 万",note:"简单平均"},{label:"首末月增长",value:"64.63%",note:"1 月至 6 月"}])\nchart = BarChart("月度营收", "万元", [{label:"1月",value:8.2},{label:"2月",value:7.4},{label:"3月",value:9.6},{label:"4月",value:10.8},{label:"5月",value:12.1},{label:"6月",value:13.5}])\n\`\`\`\n\n2 月短暂回落，之后连续四个月增长。你可以选择接下来关注的方向。\n\n\`\`\`openui-lang\nroot = Workspace("", "", [focus, next])\nfocus = Options("关注方向", ["营收趋势", "成本与利润", "下半年预测"], "营收趋势")\nnext = FollowUp("继续分析", "根据我选择的方向继续分析，缺少的数据请明确说明。")\n\`\`\``]
};
