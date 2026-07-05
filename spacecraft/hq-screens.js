/* ============================================================ CorpHQ HUD screens
   Faithful recreation of the fleet-command design, wired to real data
   (GAME / market / galaxy / Supabase) with illustrative sample fallback. */

/* ---- sample fallback (illustrative, from the design spec) ---- */
const SAMPLE={
  resources:[
    {name:'Iron ore',rate:'6,200',pct:'100%',color:'#66e0fa',color2:'#04aad6'},
    {name:'Copper ore',rate:'4,800',pct:'77%',color:'#5fe9ce',color2:'#15b79f'},
    {name:'Titanium',rate:'3,100',pct:'50%',color:'#ff7b66',color2:'#fd563c'},
    {name:'Silicon',rate:'2,400',pct:'39%',color:'#ffd049',color2:'#fb9c0c'},
    {name:'Deuterium',rate:'1,900',pct:'31%',color:'#66e0fa',color2:'#04aad6'},
  ],
  bases:[
    {name:'Anvil Station',loc:'Q07 · Vega III · Rift Basin',icon:'ph-factory',iconFg:'#66e0fa',iconBg:'rgba(102,224,250,.08)',iconBd:'rgba(102,224,250,.22)',statusDot:'#5fe9ce',output:'Alloy · Circuits',outFg:'#66e0fa',deposits:'4 deposits'},
    {name:'Deep Vein Rig',loc:'Q12 · Kryos · South Shelf',icon:'ph-mountains',iconFg:'#5fe9ce',iconBg:'rgba(95,233,206,.08)',iconBd:'rgba(95,233,206,.22)',statusDot:'#5fe9ce',output:'Iron · Copper',outFg:'#5fe9ce',deposits:'6 deposits'},
    {name:'Halcyon Forge',loc:'Q07 · Vega I · Crater 9',icon:'ph-rocket-launch',iconFg:'#ff7b66',iconBg:'rgba(253,86,60,.08)',iconBd:'rgba(253,86,60,.22)',statusDot:'#ffd049',output:'Thrusters',outFg:'#ff9d8a',deposits:'2 deposits'},
    {name:'Solace Outpost',loc:'Q23 · Nix · Ice Flats',icon:'ph-snowflake',iconFg:'#66e0fa',iconBg:'rgba(102,224,250,.08)',iconBd:'rgba(102,224,250,.22)',statusDot:'#5fe9ce',output:'Deuterium',outFg:'#66e0fa',deposits:'3 geysers'},
    {name:'Meridian Depot',loc:'Q05 · Hub · Trade Ring',icon:'ph-warehouse',iconFg:'#ffd049',iconBg:'rgba(255,208,73,.08)',iconBd:'rgba(255,208,73,.22)',statusDot:'#7d8ba1',output:'Storage hub',outFg:'#9fb0c4',deposits:'idle'},
  ],
};
const COLORWHEEL=[['#66e0fa','#04aad6'],['#5fe9ce','#15b79f'],['#ff7b66','#fd563c'],['#ffd049','#fb9c0c'],['#66e0fa','#04aad6'],['#5fe9ce','#15b79f']];

/* ---- real-data derivations ---- */
function hasCorpData(){ return !!(STATE_BASES && STATE_BASES.length); }
function baseLoc(b){ return [b.quadrant?('Q'+String(b.quadrant).slice(0,3)):null, b.system, b.planet].filter(Boolean).join(' · ')||'—'; }
function resName(slug){ const r=GAME&&GAME.resources.find(x=>x.slug===slug); if(r)return r.name; const it=GAME&&GAME.items.find(x=>x.slug===slug); return it?it.name:slug; }
function resRate(slug){ const r=GAME&&GAME.resources.find(x=>x.slug===slug); if(r&&r.extraction_rate)return parseFloat(String(r.extraction_rate))||0; return 0; }
function itemName(slug){ const it=GAME&&GAME.items.find(x=>x.slug===slug); return it?it.name:slug; }

function corpMiningAgg(){ // {slug:rate/hr}
  const agg={};
  for(const b of (STATE_BASES||[])){
    for(const m of (b.mining||[])){ const id=typeof m==='string'?m:m.id; const n=typeof m==='string'?1:(+m.n||1); const rate=resRate(id)||60; agg[id]=(agg[id]||0)+rate*n; }
  }
  return agg;
}
function miningRows(){
  if(!hasCorpData()) return SAMPLE.resources;
  const agg=corpMiningAgg(); const arr=Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,5);
  if(!arr.length) return SAMPLE.resources;
  const max=arr[0][1]||1;
  return arr.map(([slug,rate],i)=>({name:resName(slug),rate:fmtN(Math.round(rate)),pct:Math.max(8,Math.round(rate/max*100))+'%',color:COLORWHEEL[i%6][0],color2:COLORWHEEL[i%6][1]}));
}
function totalExtraction(){ const agg=corpMiningAgg(); const t=Object.values(agg).reduce((a,b)=>a+b,0); return t||18400; }

function basesRows(){
  if(!hasCorpData()) return SAMPLE.bases;
  return STATE_BASES.slice(0,6).map(b=>{
    const prod=(b.production||[]).map(p=>itemName(p.slug)).slice(0,2).join(' · ')||'Extraction';
    const dep=(b.mining||[]).length+(b.deposits||[]).length;
    const isForge=(b.production||[]).length>0;
    return {name:b.name||'Base',loc:baseLoc(b),icon:isForge?'ph-factory':'ph-mountains',iconFg:isForge?'#66e0fa':'#5fe9ce',iconBg:isForge?'rgba(102,224,250,.08)':'rgba(95,233,206,.08)',iconBd:isForge?'rgba(102,224,250,.22)':'rgba(95,233,206,.22)',statusDot:isForge?'#ffd049':'#5fe9ce',output:prod,outFg:isForge?'#66e0fa':'#5fe9ce',deposits:dep?dep+' deposits':'idle'};
  });
}

function profitRows(){
  if(!GAME||!MARKET) return SAMPLE_PROFIT();
  const rows=[];
  for(const it of GAME.items){
    const info=priceInfo(it.slug);
    if(!info||info.price<10) continue;
    if(info.listings<3||info.vol<100) continue;       // liquidity gate: real, tradeable market only
    const sell=info.price;
    const cost=buildCost(it.slug); if(cost==null||cost<5)continue;
    const margin=(sell-cost)/cost;
    if(margin<=0)continue;
    const pct=Math.min(9999,Math.round(margin*100));
    rows.push({name:it.name,sell:fmtK(sell),cost:fmtK(cost),marginPct:margin,margin:'+'+pct+'%'});
  }
  rows.sort((a,b)=>b.marginPct-a.marginPct);
  const top=rows.slice(0,5); const max=top.length?top[0].marginPct:1;
  return top.map((r,i)=>({rank:String(i+1).padStart(2,'0'),name:r.name,sell:r.sell,cost:r.cost,margin:r.margin,bar:Math.max(20,Math.round(r.marginPct/max*100))+'%'}));
}
function SAMPLE_PROFIT(){ return [
  {rank:'01',name:'Ion Thruster',sell:'12.4K',cost:'6.1K',margin:'+103%',bar:'100%'},
  {rank:'02',name:'Alloy plate',sell:'2.1K',cost:'1.2K',margin:'+75%',bar:'74%'},
  {rank:'03',name:'Circuit board',sell:'3.6K',cost:'2.3K',margin:'+56%',bar:'56%'},
  {rank:'04',name:'Fuel cell',sell:'900',cost:'640',margin:'+41%',bar:'42%'},
  {rank:'05',name:'Hull panel',sell:'1.8K',cost:'1.4K',margin:'+28%',bar:'29%'},
];}

function corpSuppliesSet(){ const s=new Set(); for(const b of (STATE_BASES||[])){ for(const p of (b.production||[]))s.add(p.slug); for(const m of (b.mining||[])){const id=typeof m==='string'?m:m.id; s.add(id);} } return s; }
function coverageRows(filter){
  if(!GAME) return [];
  const supplied=corpSuppliesSet();
  let items=GAME.items.filter(it=>it.name&&it.name!=='???');
  if(filter&&filter!=='All categories'){ items=items.filter(it=>{ const c=catOf(it); if(filter==='Ores')return c==='Raw'; if(filter==='Crafted')return recipeFor(it.slug)&&c!=='Raw'; if(filter==='Ships')return c==='Propulsion'; return true; }); }
  // prefer items with a market price for a richer table
  items.sort((a,b)=>{ const pa=priceOf(a.slug)!=null?1:0, pb=priceOf(b.slug)!=null?1:0; return pb-pa; });
  return items.slice(0,8).map(it=>{
    const price=priceOf(it.slug); const rec=recipeFor(it.slug); const cat=catOf(it);
    let cov='Buy',covFg='#ffd049',covBg='rgba(255,208,73,.12)';
    if(supplied.has(it.slug)){ cov='Supplied';covFg='#5fe9ce';covBg='rgba(21,183,159,.14)'; }
    else if(rec){ cov='Craftable';covFg='#66e0fa';covBg='rgba(102,224,250,.14)'; }
    return {name:it.name,icon:itemIcon(it),ic:cat==='Raw'?'#9fb0c4':(cat==='Propulsion'?'#ff7b66':'#66e0fa'),cat,lvl:it.level&&it.level!=='—'?it.level:'T1',storage:it.storage||'—',price:price!=null?fmtN(Math.round(price)):'—',cov,covFg,covBg};
  });
}

/* ---- chain graph builder (from real recipes) ---- */
function wsBuilding(ws){
  if(!ws||ws==='No workstation'||!GAME) return null;
  let b=GAME.buildings.find(x=>x.slug===ws); if(b)return b;
  b=GAME.buildings.find(x=>x.name.toLowerCase()===String(ws).toLowerCase()); if(b)return b;
  const kw=String(ws).replace(/^b-/,'').replace(/-\d+$/,'').replace(/[^a-z]/gi,'').toLowerCase().slice(0,4);
  if(kw.length>=3){ b=GAME.buildings.find(x=>x.name.toLowerCase().replace(/[^a-z]/g,'').startsWith(kw)); if(b)return b; }
  return null;
}
function outQty(r,slug){ const o=(r.outputs||[]).find(x=>x.slug===slug); return o?(+o.qty||1):1; }
function fmtPower(ma){ ma=Math.round(ma); return ma>=1000?(ma/1000).toFixed(1)+' GW':ma+' MA'; }
// Real capacity model: expand the recipe tree, sum workstation power/footprint, and build an item Δ/hr table.
function computeCapacity(targetSlug, rate){
  rate=rate||20;
  const need={}, made={}, used={}; let power=0, foot=0, steps=0; const craftSeen=new Set();
  (function expand(slug, perHour, depth){
    need[slug]=(need[slug]||0)+perHour;
    const r=recipeFor(slug); if(!r||depth>5) return;
    const oq=outQty(r,slug)||1; const crafts=perHour/oq;
    made[slug]=(made[slug]||0)+crafts*oq;
    if(!craftSeen.has(slug)){ craftSeen.add(slug); steps++;
      const b=wsBuilding(r.workstation);
      if(b){ const pw=parseFloat(b.power); if(!isNaN(pw)&&pw<0) power+=Math.abs(pw); const fp=parseFloat(b.footprint); if(!isNaN(fp)) foot+=fp; }
    }
    for(const ing of r.ingredients){ const q=+ing.qty||1; const inNeed=crafts*q; used[ing.slug]=(used[ing.slug]||0)+inNeed; expand(ing.slug, inNeed, depth+1); }
  })(targetSlug, rate, 0);
  const supplied=corpSuppliesSet();
  const slugs=[...new Set([...Object.keys(need),...Object.keys(made),...Object.keys(used)])];
  const rows=slugs.map(s=>{ const m=made[s]||0, u=used[s]||0, net=Math.max(0,(u|| (s===targetSlug?rate:0))-m); const raw=!recipeFor(s);
    return {item:itemName(s), slug:s, made:m, used:u, needed:net, raw, corp:supplied.has(s)}; })
    .filter(x=>x.made||x.used)
    .sort((a,b)=>(b.made+b.used)-(a.made+a.used));
  return {power, foot:Math.round(foot), wsCount:steps, rows};
}

function pickTarget(){
  // a craftable item with a market price and a recipe, decent margin
  const p=profitRows(); if(p&&p.length){ const it=GAME.items.find(x=>x.name===p[0].name); if(it&&recipeFor(it.slug))return it.slug; }
  const cand=GAME.items.find(x=>recipeFor(x.slug)&&priceOf(x.slug)); return cand?cand.slug:(GAME.items.find(x=>recipeFor(x.slug))||{}).slug;
}
function buildGraph(targetSlug,rate){
  rate=rate||20; const supplied=corpSuppliesSet();
  // BFS one level of intermediates; leaves = raws
  const tRec=recipeFor(targetSlug);
  const target={slug:targetSlug,name:itemName(targetSlug),kind:'target'};
  const mids=[], raws=[]; const seen=new Set();
  if(tRec){
    for(const ing of tRec.ingredients){
      if(seen.has(ing.slug))continue; seen.add(ing.slug);
      const r=recipeFor(ing.slug);
      if(r){ mids.push({slug:ing.slug,name:itemName(ing.slug)}); for(const i2 of r.ingredients){ if(!seen.has(i2.slug)){seen.add(i2.slug); raws.push({slug:i2.slug,name:itemName(i2.slug)});} } }
      else raws.push({slug:ing.slug,name:itemName(ing.slug)});
    }
  }
  const rawsC=raws.slice(0,3), midsC=mids.slice(0,2);
  return {target,mids:midsC,raws:rawsC.length?rawsC:[{slug:'iron-ore',name:'Iron ore'},{slug:'copper-ore',name:'Copper ore'}],supplied,rate};
}
function graphHTML(g,w,h){
  w=w||760; h=h||322;
  const rawYs=g.raws.map((_,i)=>({1:[161],2:[110,240],3:[72,150,240]}[g.raws.length]||[72,150,240])[i]);
  const midYs=g.mids.map((_,i)=>({0:[],1:[161],2:[150,210]}[g.mids.length]||[150,210])[i]);
  const scaleY=y=>Math.round(y/322*h);
  const rawX=18, midX=300, tgtX=610, nodeW=132;
  let edges='';
  // raw->mid or raw->target
  g.raws.forEach((r,i)=>{ const y1=scaleY(rawYs[i]); const ty=g.mids.length?scaleY(midYs[Math.min(i,midYs.length-1)]||161):scaleY(161); edges+=`<path d="M${rawX+nodeW},${y1} C${rawX+nodeW+80},${y1} ${midX-80},${ty} ${midX},${ty}"/>`; });
  g.mids.forEach((m,i)=>{ const y1=scaleY(midYs[i]); const ty=scaleY(161); edges+=`<path d="M${midX+nodeW},${y1} C${midX+nodeW+70},${y1} ${tgtX-70},${ty} ${tgtX},${ty}"/>`; });
  if(!g.mids.length){ g.raws.forEach((r,i)=>{ const y1=scaleY(rawYs[i]); edges+=`<path d="M${rawX+nodeW},${y1} C${400},${y1} ${480},${scaleY(161)} ${tgtX},${scaleY(161)}"/>`; }); }
  function node(x,y,n,kind){
    let bd,glow,ic,icc,tag,tagFg,tagBg;
    if(kind==='target'){bd='rgba(253,86,60,.55)';glow='0 0 22px rgba(253,86,60,.4)';ic='ph-rocket-launch';icc='#ff7b66';tag='TARGET';tagFg='#ff9d8a';tagBg='rgba(253,86,60,.16)';}
    else if(kind==='craft'){bd='rgba(102,224,250,.45)';glow='0 0 18px rgba(102,224,250,.28)';ic=itemIcon({name:n.name,slug:n.slug});icc='#66e0fa';tag='CRAFT';tagFg='#66e0fa';tagBg='rgba(102,224,250,.14)';}
    else { const corp=g.supplied.has(n.slug); bd=corp?'rgba(95,233,206,.4)':'rgba(255,208,73,.4)';glow=corp?'0 0 16px rgba(21,183,159,.25)':'0 0 16px rgba(255,208,73,.18)';ic='ph-mountains';icc='#9fb0c4';tag=corp?'CORP':'BUY';tagFg=corp?'#5fe9ce':'#ffd049';tagBg=corp?'rgba(21,183,159,.14)':'rgba(255,208,73,.12)';}
    const rate=(kind==='target'?g.rate:Math.round(g.rate*(kind==='craft'?1.25:2)))+'/hr';
    return `<div class="gnode" style="left:${x}px;top:${y}px;border:1px solid ${bd};box-shadow:${glow}"><div class="nm"><i class="ph-fill ${ic}" style="color:${icc}"></i><span>${esc(n.name)}</span></div><div class="meta"><span>${rate}</span><span class="tag" style="color:${tagFg};background:${tagBg}">${tag}</span></div></div>`;
  }
  let nodes='';
  g.raws.forEach((r,i)=>nodes+=node(rawX,scaleY(rawYs[i]),r,'raw'));
  g.mids.forEach((m,i)=>nodes+=node(midX,scaleY(midYs[i]),m,'craft'));
  nodes+=node(tgtX,scaleY(161),g.target,'target');
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%"><defs><linearGradient id="edge" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#66e0fa" stop-opacity="0"/><stop offset="1" stop-color="#66e0fa" stop-opacity=".8"/></linearGradient></defs><g fill="none" stroke="url(#edge)" stroke-width="1.6" stroke-dasharray="4 6" style="animation:hud-flow 1.2s linear infinite">${edges}</g></svg>${nodes}`;
}

/* ============================================================ SCREEN 1: COMMAND */
function renderCommand(){
  const corpNm=CORP?CORP.name:'Nebula Freight Co.';
  const pilots=MEMBERS.length||14;
  const baseCount=hasCorpData()?STATE_BASES.length:6;
  const kpis=[
    {label:'Extraction',icon:'ph-mountains',accent:'#66e0fa',value:fmtK(totalExtraction()),unit:'u/hr',delta:'12%',deltaIcon:'ph-arrow-up',deltaBg:'rgba(21,183,159,.14)',deltaFg:'#5fe9ce',note:'vs last cycle'},
    {label:'Active bases',icon:'ph-planet',accent:'#ff7b66',value:String(baseCount),unit:'/ '+(baseCount+2)+' slots',delta:'+2',deltaIcon:'ph-arrow-up',deltaBg:'rgba(21,183,159,.14)',deltaFg:'#5fe9ce',note:'2 planned'},
    {label:'Chain coverage',icon:'ph-flow-arrow',accent:'#5fe9ce',value:'82',unit:'%',delta:'4%',deltaIcon:'ph-arrow-up',deltaBg:'rgba(21,183,159,.14)',deltaFg:'#5fe9ce',note:'corp-supplied'},
    {label:'Corp balance',icon:'ph-coins',accent:'#ffd049',value:'1.8M',unit:'cr',delta:'3%',deltaIcon:'ph-arrow-down',deltaBg:'rgba(240,68,56,.14)',deltaFg:'#fdaaa4',note:'net 7d'},
  ];
  const _tgt=GAME?pickTarget():null;
  const g=GAME?buildGraph(_tgt,20):null;
  const _cap=GAME?computeCapacity(_tgt,20):null;
  const gStats=[{k:'Workstations',v:_cap?String(_cap.wsCount):'7',c:'#66e0fa'},{k:'Power draw',v:_cap?fmtPower(_cap.power):'2.4 GW',c:'#ffd049'},{k:'To build',v:(_cap?_cap.rows.filter(r=>r.made>0).length:3)+' items',c:'#ff7b66'},{k:'Corp-supplied',v:(_cap?_cap.rows.filter(r=>r.corp).length:5)+' items',c:'#5fe9ce'}];
  const gName=g?itemName(g.target.slug):'Ion Thruster';
  return head('◍ FLEET COMMAND · SECTOR OVERVIEW','Corp operations at a glance',
    `Shared bases, mining assignments and capacity-aware production — live-synced across all ${pilots} pilots in ${esc(corpNm)}.`,
    `<button class="btn btn-ghost" onclick="go('bases')"><i class="ph-fill ph-plus"></i> Add base</button><button class="btn btn-primary" onclick="go('chain')"><i class="ph-fill ph-flow-arrow"></i> Chain designer</button>`)
  +`<div class="kpi-strip">`+kpis.map(k=>`<div class="kpi"><div class="accent" style="background:linear-gradient(90deg,transparent,${k.accent},transparent)"></div><div style="display:flex;align-items:center;justify-content:space-between"><span class="lbl">${k.label}</span><i class="ph-fill ${k.icon}" style="font-size:17px;color:${k.accent}"></i></div><div style="display:flex;align-items:baseline;gap:5px;margin-top:12px"><span class="val">${k.value}</span><span class="unit">${k.unit}</span></div><div style="display:flex;align-items:center;gap:8px;margin-top:11px"><span class="delta" style="background:${k.deltaBg};color:${k.deltaFg}"><i class="ph-fill ${k.deltaIcon}"></i>${k.delta}</span><span class="mono" style="font-size:10.5px;color:var(--dim2)">${k.note}</span></div></div>`).join('')+`</div>`
  +`<div style="display:grid;grid-template-columns:1.55fr 1fr;gap:16px;margin-bottom:16px">
    <section class="panel"><div class="corner-tab">CHAIN&nbsp;DESIGNER</div>
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px"><div><h2 class="hud">Production graph — ${esc(gName)} ×20/hr</h2><p class="mono" style="font-size:12px;color:#8a94a6;margin-top:4px">Nets out corp supply · <span style="color:#5fe9ce">green</span> = corp already makes it</p></div><div style="display:flex;gap:6px"><span class="chip-ghost" onclick="go('chain')">⤢ Open</span></div></div>
      <div class="graph" style="height:322px;margin-top:8px">${g?graphHTML(g,760,322):''}</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px">${gStats.map(s=>`<div class="mini"><div class="k">${s.k}</div><div class="v" style="color:${s.c}">${s.v}</div></div>`).join('')}</div>
    </section>
    <section class="panel" style="padding-bottom:12px"><div class="panel-head"><div><div class="panel-eyebrow">EXTRACTION · PER HOUR</div><h2 class="hud">Corp mining yield</h2></div><i class="ph-fill ph-mountains" style="font-size:20px;color:#8a94a6"></i></div>
      <div style="display:flex;flex-direction:column;gap:14px">${miningRows().map(r=>`<div><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><span style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--txt)"><span style="width:9px;height:9px;border-radius:2px;background:${r.color};box-shadow:0 0 7px ${r.color}"></span>${esc(r.name)}</span><span class="mono" style="font-size:12px;color:var(--txt-hi)">${r.rate} <span style="color:var(--dim2)">/hr</span></span></div><div class="bar-track"><div class="bar-fill" style="width:${r.pct};background:linear-gradient(90deg,${r.color},${r.color2});box-shadow:0 0 10px ${r.color}"></div></div></div>`).join('')}</div>
    </section></div>`
  +`<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
    <section class="panel" style="padding-bottom:16px"><div class="panel-head"><div><div class="panel-eyebrow">CORP BASES · ${baseCount} ACTIVE</div><h2 class="hud">Bases overview</h2></div><span class="chip-ghost" onclick="go('bases')">＋ Add base</span></div>
      <div style="display:flex;flex-direction:column;gap:9px">${basesRows().map(b=>`<div class="listrow"><div class="icontile" style="width:38px;height:38px;background:${b.iconBg};border:1px solid ${b.iconBd}"><i class="ph-fill ${b.icon}" style="font-size:19px;color:${b.iconFg}"></i></div><div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:13.5px;font-weight:600;color:var(--txt-hi)">${esc(b.name)}</span><span style="width:6px;height:6px;border-radius:50%;background:${b.statusDot};box-shadow:0 0 6px ${b.statusDot}"></span></div><div class="mono" style="font-size:10.5px;color:var(--dim);margin-top:2px">${esc(b.loc)}</div></div><div style="text-align:right"><div class="mono" style="font-size:12px;color:${b.outFg}">${esc(b.output)}</div><div class="mono" style="font-size:10px;color:var(--dim2);margin-top:2px">${esc(b.deposits)}</div></div></div>`).join('')}</div>
    </section>
    <section class="panel" style="padding-bottom:16px"><div class="panel-head"><div><div class="panel-eyebrow" style="color:#ffd049">◆ PROFIT ADVISOR · LIVE MARKET</div><h2 class="hud">What's worth building</h2></div><i class="ph-fill ph-trend-up" style="font-size:20px;color:#5fe9ce"></i></div>
      <div style="display:flex;flex-direction:column;gap:8px">${profitRows().map(p=>`<div class="listrow" style="padding:10px 13px"><span class="mono" style="font-size:11px;color:var(--dim2);width:16px">${p.rank}</span><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:var(--txt-hi)">${esc(p.name)}</div><div class="mono" style="font-size:10px;color:var(--dim);margin-top:2px">sell ${p.sell} · cost ${p.cost}</div></div><div style="text-align:right"><div class="mono" style="font-size:13px;font-weight:600;color:#5fe9ce">${p.margin}</div><div style="width:64px;height:5px;border-radius:99px;background:rgba(96,165,215,.12);overflow:hidden;margin-top:5px"><div style="height:100%;width:${p.bar};background:linear-gradient(90deg,#15b79f,#5fe9ce);border-radius:99px"></div></div></div></div>`).join('')}</div>
    </section></div>`
  +`<section class="panel" style="padding:0">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid rgba(96,165,215,.12)"><div><div class="panel-eyebrow">ITEM DATABASE · CORP COVERAGE</div><h2 class="hud">Crafting & coverage</h2></div><div style="display:flex;gap:6px" id="covFilters">${['All categories','Ores','Crafted','Ships'].map((f,i)=>`<span class="filterchip${i===0?' active':''}" onclick="covFilter('${f}',this)">${f}</span>`).join('')}</div></div>
    <table class="hud"><thead><tr><th style="text-align:left">Item</th><th style="text-align:left">Category</th><th style="text-align:left">Lvl</th><th style="text-align:right">Storage</th><th style="text-align:right">Price</th><th style="text-align:left">Corp coverage</th></tr></thead><tbody id="covBody">${coverageBody('All categories')}</tbody></table>
  </section>`;
}
function coverageBody(filter){ return coverageRows(filter).map(it=>`<tr><td><div style="display:flex;align-items:center;gap:10px"><i class="ph-fill ${it.icon}" style="font-size:17px;color:${it.ic}"></i><span style="font-size:13px;font-weight:500;color:var(--txt-hi)">${esc(it.name)}</span></div></td><td><span class="mono" style="font-size:10px;color:#9fb0c4;background:rgba(96,165,215,.08);padding:2px 8px;border-radius:6px">${it.cat}</span></td><td class="mono" style="font-size:12px;color:#9fb0c4">${it.lvl}</td><td style="text-align:right" class="mono" style="font-size:12px;color:#c7d4e2">${it.storage}</td><td style="text-align:right" class="mono" style="font-size:12px;color:#ffd049">${it.price}</td><td><span class="covpill" style="background:${it.covBg};color:${it.covFg}"><span class="d"></span>${it.cov}</span></td></tr>`).join(''); }
function covFilter(f,elm){ document.querySelectorAll('#covFilters .filterchip').forEach(c=>c.classList.remove('active')); elm.classList.add('active'); el('covBody').innerHTML=coverageBody(f); }
window.covFilter=covFilter;
function afterCommand(){}

/* ============================================================ SCREEN 2: BASES */
function renderBases(){
  const list=hasCorpData()?STATE_BASES:null;
  const stats=(()=>{
    if(!list) return [{label:'Registered bases',value:'6',unit:'',accent:'#66e0fa',icon:'ph-planet'},{label:'Deposits worked',value:'18',unit:'nodes',accent:'#5fe9ce',icon:'ph-mountains'},{label:'Extractors',value:'27',unit:'online',accent:'#ffd049',icon:'ph-gear-six'},{label:'Corp output',value:'18.4K',unit:'u/hr',accent:'#ff7b66',icon:'ph-stack'}];
    const dep=list.reduce((a,b)=>a+((b.mining||[]).length+(b.deposits||[]).length),0);
    const ext=list.reduce((a,b)=>a+((b.mining||[]).reduce((x,m)=>x+(typeof m==='string'?1:(+m.n||1)),0)),0);
    return [{label:'Registered bases',value:String(list.length),unit:'',accent:'#66e0fa',icon:'ph-planet'},{label:'Deposits worked',value:String(dep),unit:'nodes',accent:'#5fe9ce',icon:'ph-mountains'},{label:'Extractors',value:String(ext),unit:'online',accent:'#ffd049',icon:'ph-gear-six'},{label:'Corp output',value:fmtK(totalExtraction()),unit:'u/hr',accent:'#ff7b66',icon:'ph-stack'}];
  })();
  const cards=list?list.map(b=>{
    const forge=(b.production||[]).length>0; const mining=(b.mining||[]).map(m=>({n:resName(typeof m==='string'?m:m.id)})).slice(0,4);
    const produces=(b.production||[]).map(p=>({n:itemName(p.slug),r:(p.rate?fmtN(p.rate)+'/hr':'—')})).slice(0,3);
    const status=forge?{t:'FORGING',fg:'#ffd049',bg:'rgba(255,208,73,.14)'}:((b.mining||[]).length?{t:'ONLINE',fg:'#5fe9ce',bg:'rgba(21,183,159,.14)'}:{t:'STORAGE',fg:'#9fb0c4',bg:'rgba(96,165,215,.12)'});
    return {name:b.name||'Base',loc:baseLoc(b),owner:b.owner||'—',rate:produces.length?produces[0].r:'—',icon:forge?'ph-factory':'ph-mountains',iconFg:forge?'#66e0fa':'#5fe9ce',iconBg:forge?'rgba(102,224,250,.08)':'rgba(95,233,206,.08)',iconBd:forge?'rgba(102,224,250,.22)':'rgba(95,233,206,.22)',status:status.t,statusFg:status.fg,statusBg:status.bg,mining,produces:produces.length?produces:[{n:'Extraction',r:'active'}]};
  }):SAMPLE_BASES_FULL();
  return head('◍ CORP BASES · '+(list?list.length:6)+' REGISTERED','Bases & mining assignments','Every base, its deposits, extractors and production — one shared picture the whole corp edits live.',
    `<button class="btn btn-primary" onclick="location.href='./classic.html'"><i class="ph-fill ph-plus"></i> Register base</button>`)
  +`<div class="kpi-strip">`+stats.map(s=>`<div class="kpi" style="display:flex;align-items:center;gap:13px;padding:15px 17px"><div class="icontile" style="width:40px;height:40px;background:rgba(102,224,250,.06);border:1px solid rgba(102,224,250,.16)"><i class="ph-fill ${s.icon}" style="font-size:20px;color:${s.accent}"></i></div><div><div class="lbl">${s.label}</div><div style="display:flex;align-items:baseline;gap:4px;margin-top:3px"><span class="val" style="font-size:24px">${s.value}</span><span class="unit">${s.unit}</span></div></div></div>`).join('')+`</div>`
  +`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">`+cards.map(b=>`<div class="panel" style="border-radius:14px;padding:16px 17px;display:flex;flex-direction:column;gap:13px">
    <div style="display:flex;align-items:center;gap:12px"><div class="icontile" style="width:42px;height:42px;background:${b.iconBg};border:1px solid ${b.iconBd}"><i class="ph-fill ${b.icon}" style="font-size:21px;color:${b.iconFg}"></i></div><div style="flex:1;min-width:0"><div style="font-size:14.5px;font-weight:600;color:var(--txt-hi)">${esc(b.name)}</div><div class="mono" style="font-size:10px;color:var(--dim);margin-top:2px">${esc(b.loc)}</div></div><span class="mono" style="font-size:9px;font-weight:600;padding:3px 8px;border-radius:99px;background:${b.statusBg};color:${b.statusFg};letter-spacing:.05em">${b.status}</span></div>
    <div style="height:1px;background:rgba(96,165,215,.12)"></div>
    <div><div class="mono" style="font-size:9px;letter-spacing:.12em;color:var(--dim);margin-bottom:7px">MINING</div><div style="display:flex;gap:6px;flex-wrap:wrap">${b.mining.length?b.mining.map(m=>`<span class="mono" style="display:inline-flex;align-items:center;gap:5px;font-size:10.5px;color:#c7d4e2;background:rgba(96,165,215,.08);border:1px solid rgba(96,165,215,.14);padding:3px 9px;border-radius:99px"><i class="ph-fill ph-mountains" style="font-size:11px;color:#5fe9ce"></i>${esc(m.n)}</span>`).join(''):'<span class="mono" style="font-size:10.5px;color:var(--dim2)">—</span>'}</div></div>
    <div><div class="mono" style="font-size:9px;letter-spacing:.12em;color:var(--dim);margin-bottom:7px">PRODUCES</div><div style="display:flex;flex-direction:column;gap:6px">${b.produces.map(p=>`<div style="display:flex;align-items:center;justify-content:space-between;font-size:12px"><span style="color:var(--txt)">${esc(p.n)}</span><span class="mono" style="font-size:11px;color:#66e0fa">${esc(p.r)}</span></div>`).join('')}</div></div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding-top:11px;border-top:1px solid rgba(96,165,215,.1)"><span class="mono" style="font-size:10px;color:var(--dim)">◍ ${esc(b.owner)}</span><span class="mono" style="font-size:12px;font-weight:600;color:#5fe9ce">${esc(b.rate)}</span></div>
  </div>`).join('')+`</div>`;
}
function SAMPLE_BASES_FULL(){ return [
  {name:'Anvil Station',icon:'ph-factory',iconFg:'#66e0fa',iconBg:'rgba(102,224,250,.08)',iconBd:'rgba(102,224,250,.22)',status:'ONLINE',statusFg:'#5fe9ce',statusBg:'rgba(21,183,159,.14)',loc:'Q07 · Vega III · Rift Basin',owner:'Rukh',rate:'4.2K u/hr',mining:[{n:'Iron'},{n:'Copper'},{n:'Titanium'}],produces:[{n:'Alloy plate',r:'25/hr'},{n:'Circuit board',r:'15/hr'}]},
  {name:'Deep Vein Rig',icon:'ph-mountains',iconFg:'#5fe9ce',iconBg:'rgba(95,233,206,.08)',iconBd:'rgba(95,233,206,.22)',status:'ONLINE',statusFg:'#5fe9ce',statusBg:'rgba(21,183,159,.14)',loc:'Q12 · Kryos · South Shelf',owner:'Jax Vantor',rate:'5.6K u/hr',mining:[{n:'Iron'},{n:'Copper'}],produces:[{n:'Iron ore',r:'6.2K/hr'},{n:'Copper ore',r:'4.8K/hr'}]},
  {name:'Halcyon Forge',icon:'ph-rocket-launch',iconFg:'#ff7b66',iconBg:'rgba(253,86,60,.08)',iconBd:'rgba(253,86,60,.22)',status:'FORGING',statusFg:'#ffd049',statusBg:'rgba(255,208,73,.14)',loc:'Q07 · Vega I · Crater 9',owner:'Mira Osei',rate:'2.0K u/hr',mining:[{n:'Titanium'}],produces:[{n:'Ion Thruster',r:'20/hr'}]},
  {name:'Solace Outpost',icon:'ph-snowflake',iconFg:'#66e0fa',iconBg:'rgba(102,224,250,.08)',iconBd:'rgba(102,224,250,.22)',status:'ONLINE',statusFg:'#5fe9ce',statusBg:'rgba(21,183,159,.14)',loc:'Q23 · Nix · Ice Flats',owner:'Rukh',rate:'1.9K u/hr',mining:[{n:'Deuterium'}],produces:[{n:'Fuel cell',r:'40/hr'}]},
  {name:'Meridian Depot',icon:'ph-warehouse',iconFg:'#ffd049',iconBg:'rgba(255,208,73,.08)',iconBd:'rgba(255,208,73,.22)',status:'STORAGE',statusFg:'#9fb0c4',statusBg:'rgba(96,165,215,.12)',loc:'Q05 · Hub · Trade Ring',owner:'Suri Kade',rate:'—',mining:[],produces:[{n:'Corp warehouse',r:'2.4M'}]},
  {name:'Redshift Yard',icon:'ph-wrench',iconFg:'#66e0fa',iconBg:'rgba(102,224,250,.08)',iconBd:'rgba(102,224,250,.22)',status:'ONLINE',statusFg:'#5fe9ce',statusBg:'rgba(21,183,159,.14)',loc:'Q18 · Ceres · North Rim',owner:'Deacon Lir',rate:'3.1K u/hr',mining:[{n:'Copper'},{n:'Silicon'}],produces:[{n:'Circuit board',r:'22/hr'}]},
];}

/* ============================================================ SCREEN 3: CHAIN DESIGNER */
let CHAIN_TARGET=null;
function renderChainScreen(){
  if(!CHAIN_TARGET&&GAME)CHAIN_TARGET=pickTarget();
  const g=GAME?buildGraph(CHAIN_TARGET,20):null;
  const gName=g?itemName(g.target.slug):'Ion Thruster';
  const buildings=(GAME?GAME.buildings.slice(0,6):[]).map(b=>({name:b.name,power:(b.power?Math.abs(+b.power)+' MW':'—'),icon:bIcon(b),fg:bColor(b)}));
  const bds=buildings.length?buildings:[{name:'Ore Extractor',icon:'ph-mountains',fg:'#66e0fa',power:'120 MW'},{name:'Smelter',icon:'ph-fire',fg:'#ff7b66',power:'340 MW'},{name:'Assembler',icon:'ph-stack',fg:'#66e0fa',power:'260 MW'},{name:'Circuit Lab',icon:'ph-cpu',fg:'#5fe9ce',power:'180 MW'},{name:'Refinery',icon:'ph-flask',fg:'#ffd049',power:'420 MW'},{name:'Shipyard',icon:'ph-rocket-launch',fg:'#ff7b66',power:'900 MW'}];
  const cap=GAME?computeCapacity(CHAIN_TARGET,20):null;
  const raws=g?g.raws.map(r=>({n:r.name,q:'20/hr',corp:g.supplied.has(r.slug)})):[{n:'Iron ore',q:'40/hr',corp:true},{n:'Copper ore',q:'30/hr',corp:true},{n:'Silicon',q:'20/hr',corp:false}];
  const toBuild=cap?cap.rows.filter(r=>r.made>0).length:3;
  const corpN=cap?cap.rows.filter(r=>r.corp).length:5;
  const summary=[{k:'Workstations',v:(cap?cap.wsCount:7)+'',c:'#66e0fa'},{k:'Power draw',v:cap?fmtPower(cap.power):'2.4 GW',c:'#ffd049'},{k:'Footprint',v:(cap?cap.foot:60)+' FP',c:'#ff9d8a'},{k:'To build',v:toBuild+' items',c:'#ff7b66'},{k:'Corp-supplied',v:corpN+' items',c:'#5fe9ce'}];
  const deltaRows=cap?cap.rows.slice(0,10):[];
  return head('◍ CHAIN DESIGNER · CAPACITY-AWARE','Production chain planner','')
  +`<div class="panel" style="border-radius:14px;padding:14px 16px;margin-bottom:14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
    <span class="mono" style="font-size:9px;letter-spacing:.14em;color:var(--dim)">TARGETS</span>
    <span style="display:inline-flex;align-items:center;gap:8px;font-size:12.5px;color:var(--txt-hi);background:rgba(253,86,60,.1);border:1px solid rgba(253,86,60,.3);padding:6px 12px;border-radius:99px"><i class="ph-fill ph-rocket-launch" style="font-size:14px;color:#ff7b66"></i>${esc(gName)} <span class="mono" style="color:#ff9d8a">×20/hr</span></span>
    <span class="mono" style="display:inline-flex;align-items:center;gap:7px;font-size:11px;color:var(--dim);border:1px dashed rgba(96,165,215,.28);padding:6px 12px;border-radius:99px;cursor:pointer" onclick="pickChainTarget()"><i class="ph-fill ph-plus" style="font-size:12px"></i>Change target</span>
    <button class="btn btn-cyan" style="margin-left:auto" onclick="recompute()"><i class="ph-fill ph-lightning"></i>Compute chain</button>
  </div>
  <div style="display:grid;grid-template-columns:220px 1fr 260px;gap:14px">
    <section class="panel" style="border-radius:14px;padding:16px 15px"><div class="mono" style="font-size:9px;letter-spacing:.14em;color:var(--cyan);margin-bottom:12px">＋ BUILDINGS</div><div style="display:flex;flex-direction:column;gap:8px">${bds.map(bd=>`<div class="listrow" style="cursor:grab;padding:9px 11px"><i class="ph-fill ${bd.icon}" style="font-size:18px;color:${bd.fg}"></i><div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:500;color:var(--txt-hi)">${esc(bd.name)}</div><div class="mono" style="font-size:9.5px;color:var(--dim)">${bd.power}</div></div></div>`).join('')}</div></section>
    <section class="panel" style="border-radius:14px;padding:16px"><div class="graph" style="height:480px" id="chainGraph">${g?graphHTML(g,760,480):''}</div></section>
    <section class="panel" style="border-radius:14px;padding:16px 15px;display:flex;flex-direction:column;gap:16px">
      <div><div class="mono" style="font-size:9px;letter-spacing:.14em;color:var(--cyan);margin-bottom:10px">RAW MATERIALS</div><div style="display:flex;flex-direction:column;gap:8px">${raws.map(rw=>`<div style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:12.5px;color:var(--txt)">${esc(rw.n)}</span><span style="display:flex;align-items:center;gap:8px"><span class="mono" style="font-size:11px;color:#c7d4e2">${rw.q}</span><span class="mono" style="font-size:9px;font-weight:600;padding:2px 7px;border-radius:5px;background:${rw.corp?'rgba(21,183,159,.14)':'rgba(255,208,73,.12)'};color:${rw.corp?'#5fe9ce':'#ffd049'}">${rw.corp?'CORP':'BUY'}</span></span></div>`).join('')}</div></div>
      <div style="height:1px;background:rgba(96,165,215,.12)"></div>
      <div style="display:flex;flex-direction:column;gap:10px">${summary.map(cs=>`<div style="display:flex;align-items:center;justify-content:space-between"><span class="mono" style="font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--dim)">${cs.k}</span><span style="font-family:var(--font-display);font-size:16px;font-weight:600;color:${cs.c}">${cs.v}</span></div>`).join('')}</div>
      <div style="height:1px;background:rgba(96,165,215,.12)"></div>
      <div><div class="mono" style="font-size:9px;letter-spacing:.14em;color:var(--cyan);margin-bottom:8px">ITEM Δ / HOUR</div>
        <div style="display:grid;grid-template-columns:1fr auto auto auto;gap:4px 10px;font-family:var(--font-mono);font-size:10px;max-height:200px;overflow-y:auto">
          <span style="color:var(--dim2);text-transform:uppercase;letter-spacing:.06em">Item</span><span style="color:var(--dim2);text-align:right">Made</span><span style="color:var(--dim2);text-align:right">Used</span><span style="color:var(--dim2);text-align:right">Need</span>
          ${deltaRows.length?deltaRows.map(d=>`<span style="color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:118px">${esc(d.item)}</span><span style="text-align:right;color:#5fe9ce">${d.made?Math.round(d.made):'·'}</span><span style="text-align:right;color:#9fb0c4">${d.used?Math.round(d.used):'·'}</span><span style="text-align:right;color:${d.needed>0?(d.corp?'#5fe9ce':'#ffd049'):'#566072'}">${d.needed>0?Math.round(d.needed):'✓'}</span>`).join(''):'<span style="grid-column:1/-1;color:var(--dim)">Compute a chain to see the balance.</span>'}
        </div></div>
      <button class="btn btn-ghost" style="margin-top:auto;justify-content:center;padding:11px" onclick="location.href='./classic.html'"><i class="ph-fill ph-floppy-disk"></i>Save to corp</button>
    </section>
  </div>`;
}
function bIcon(b){ const n=(b.name||'').toLowerCase(); if(/extract|drill|miner/.test(n))return 'ph-mountains'; if(/smelt|furnace|forge/.test(n))return 'ph-fire'; if(/assembl|fabric|work/.test(n))return 'ph-stack'; if(/circuit|lab|electro/.test(n))return 'ph-cpu'; if(/refin|chem|distill/.test(n))return 'ph-flask'; if(/ship|yard|rocket/.test(n))return 'ph-rocket-launch'; if(/power|reactor|generat/.test(n))return 'ph-lightning'; return 'ph-cube'; }
function bColor(b){ const n=(b.name||'').toLowerCase(); if(/smelt|forge|ship|rocket/.test(n))return '#ff7b66'; if(/refin|chem/.test(n))return '#ffd049'; if(/circuit|lab/.test(n))return '#5fe9ce'; return '#66e0fa'; }
function recompute(){ toast('⚡ Chain recomputed'); render(); }
window.recompute=recompute;
function pickChainTarget(){ const opts=GAME.items.filter(x=>recipeFor(x.slug)&&priceOf(x.slug)); const cur=opts.findIndex(o=>o.slug===CHAIN_TARGET); CHAIN_TARGET=opts[(cur+1)%opts.length].slug; toast('🎯 Target → '+itemName(CHAIN_TARGET)); render(); }
window.pickChainTarget=pickChainTarget;
function afterChain(){}

/* ============================================================ SCREEN 4: GALAXY MAP */
let MAP_GALAXY=null;
function renderMapScreen(){
  const qname=CORP&&CORP.quadrant?CORP.quadrant:QUADKEY;
  return head('◍ GALAXY MAP · 47 QUADRANTS','Galaxy map & FTL routes','',
    `<div style="display:flex;gap:6px;font-family:var(--font-mono);font-size:10px"><span style="display:inline-flex;align-items:center;gap:6px;color:#66e0fa;border:1px solid rgba(102,224,250,.3);border-radius:8px;padding:7px 11px"><span style="width:8px;height:8px;border-radius:50%;border:1.5px solid #66e0fa"></span>Corp base</span><span style="display:inline-flex;align-items:center;gap:6px;color:#5fe9ce;border:1px solid rgba(96,165,215,.18);border-radius:8px;padding:7px 11px"><span style="width:8px;height:8px;border-radius:50%;background:#5fe9ce"></span>Rich deposit</span><span style="display:inline-flex;align-items:center;gap:6px;color:#ffd049;border:1px solid rgba(96,165,215,.18);border-radius:8px;padding:7px 11px"><span style="width:8px;height:8px;border-radius:50%;background:#ffd049"></span>Trade hub</span></div>`)
  +`<div style="display:grid;grid-template-columns:1fr 300px;gap:14px">
    <section style="position:relative;background:radial-gradient(700px 460px at 60% 30%, rgba(6,40,80,.4), rgba(4,10,22,.9));border:1px solid rgba(96,165,215,.18);border-radius:14px;height:560px;overflow:hidden">
      <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(96,180,240,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(96,180,240,.05) 1px,transparent 1px);background-size:44px 44px"></div>
      <div class="mono" style="position:absolute;top:12px;left:14px;font-size:9px;letter-spacing:.16em;color:var(--cyan)">◍ SECTOR CHART · ${esc(String(qname)).toUpperCase()} · LIVE</div>
      <div id="mapNodes"><div class="mono" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:var(--dim);font-size:12px">Loading sector chart…</div></div>
    </section>
    <div style="display:flex;flex-direction:column;gap:14px">
      <section class="panel" style="border-radius:14px;padding:16px 16px 14px"><div class="mono" style="font-size:9px;letter-spacing:.14em;color:var(--cyan);margin-bottom:13px">◍ ROUTE PLANNER</div><div id="routeHops" style="display:flex;flex-direction:column;gap:0"></div><div id="routeMeta" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid rgba(96,165,215,.12)"></div></section>
      <section class="panel" style="border-radius:14px;padding:16px 16px 14px;flex:1"><div class="mono" style="font-size:9px;letter-spacing:.14em;color:#5fe9ce;margin-bottom:13px">◆ NEARBY DEPOSITS</div><div id="nearbyDep" style="display:flex;flex-direction:column;gap:9px"></div></section>
    </div>
  </div>`;
}
async function afterMap(){
  // load galaxy quadrant + render systems, corp bases, route, deposits
  try{
    if(!MAP_GALAXY){ MAP_GALAXY=await fetch('./data/galaxy-'+QUADKEY+'.json').then(r=>r.json()).catch(()=>null); }
  }catch(e){ MAP_GALAXY=null; }
  const host=el('mapNodes'); if(!host)return;
  if(!MAP_GALAXY||!MAP_GALAXY.systems){ renderMapSample(); return; }
  const sys=MAP_GALAXY.systems;
  // choose interesting systems: corp-base systems + richest-deposit systems, capped
  const corpSysNames=new Set((STATE_BASES||[]).map(b=>String(b.system||'').toLowerCase()));
  const scored=sys.map(s=>{ let best=0; for(const p of (s.planets||[])){ for(const arr of [p.res,p.dep,p.gey]){ for(const r of (arr||[])){ if(r.d>best)best=r.d; } } } return {s,best,corp:corpSysNames.has(String(s.name).toLowerCase())}; });
  const corpOnes=scored.filter(x=>x.corp);
  const rich=scored.filter(x=>!x.corp).sort((a,b)=>b.best-a.best).slice(0,corpOnes.length?20:26);
  let pool=corpOnes.concat(rich).slice(0,34);
  if(!pool.length) pool=scored.slice(0,26);
  const xs=pool.map(p=>p.s.x), ys=pool.map(p=>p.s.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const nx=v=>8+((v-minX)/((maxX-minX)||1))*84, ny=v=>10+((v-minY)/((maxY-minY)||1))*80;
  // lanes from galaxy edges among pool (light) — sample a few
  let laneSvg='';
  const idset=new Map(pool.map(p=>[p.s.id,p.s]));
  const edges=(MAP_GALAXY.edges||[]).filter(e=>idset.has(e[0])&&idset.has(e[1])).slice(0,40);
  for(const e of edges){ const a=idset.get(e[0]),b=idset.get(e[1]); laneSvg+=`<path d="M${nx(a.x)},${ny(a.y)} L${nx(b.x)},${ny(b.y)}"/>`; }
  // FTL route: corp base -> richest, 2 hops
  const origin=corpOnes[0]||pool[0]; const dest=rich[0]||pool[Math.min(1,pool.length-1)];
  let routeSvg='';
  if(origin&&dest&&origin.s.id!==dest.s.id){ routeSvg=`<path d="M${nx(origin.s.x)},${ny(origin.s.y)} L${nx(dest.s.x)},${ny(dest.s.y)}"/>`; }
  const dots=pool.map(p=>{ const s=p.s; const corp=p.corp; const rich=p.best>=10; const color=corp?'#66e0fa':(rich?'#5fe9ce':'#9fb0c4'); const d=corp?16:(rich?14:11); const dotBg=corp?'rgba(102,224,250,.15)':(rich?'#5fe9ce':'#7d8ba1'); const ring=corp?'2px solid #66e0fa':(rich?'2px solid #5fe9ce':'1px solid #9fb0c4'); const sub=corp?'corp base':(rich?('rich '+Math.round(p.best*10)+'%'):''); return `<div style="position:absolute;left:${nx(s.x)}%;top:${ny(s.y)}%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:5px"><span style="width:${d}px;height:${d}px;border-radius:50%;background:${dotBg};border:${ring};box-shadow:0 0 12px ${color}"></span><span class="mono" style="font-size:9.5px;color:var(--txt);white-space:nowrap">${esc(s.name)} <span style="color:var(--dim2)">${esc(s.sector||'')}</span></span>${sub?`<span class="mono" style="font-size:8.5px;color:${color};white-space:nowrap">${sub}</span>`:''}</div>`; }).join('');
  host.innerHTML=`<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%"><g stroke="rgba(102,224,250,.16)" stroke-width="0.25" fill="none">${laneSvg}</g><g stroke="#ff7b66" stroke-width="0.55" fill="none" stroke-dasharray="1.4 1.6" style="animation:hud-flow 1.2s linear infinite;filter:drop-shadow(0 0 3px rgba(253,86,60,.6))">${routeSvg}</g></svg>${dots}`;
  // route planner + deposits
  const hops=[{n:(origin?origin.s.name:'Origin'),sub:(origin?(origin.s.sector||'')+' · origin':''),tag:'ORIGIN',fg:'#66e0fa'},{n:(dest?dest.s.name:'Target'),sub:(dest?(dest.s.sector||'')+' · deposit':''),tag:'JUMP 1',fg:'#5fe9ce'}];
  el('routeHops').innerHTML=hops.map(h=>`<div style="display:flex;align-items:center;gap:11px;padding:7px 0"><span style="width:11px;height:11px;border-radius:50%;background:${h.fg};box-shadow:0 0 8px ${h.fg};flex-shrink:0"></span><div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:600;color:var(--txt-hi)">${esc(h.n)}</div><div class="mono" style="font-size:9.5px;color:var(--dim)">${esc(h.sub)}</div></div><span class="mono" style="font-size:9px;font-weight:600;color:${h.fg}">${h.tag}</span></div>`).join('');
  const dist=(origin&&dest)?Math.round(Math.hypot(origin.s.x-dest.s.x,origin.s.y-dest.s.y)/50):34;
  el('routeMeta').innerHTML=[{k:'Distance',v:dist+' ly',c:'#eaf3fb'},{k:'FTL fuel',v:String(dist*10),c:'#ffd049'},{k:'Jumps',v:'1',c:'#66e0fa'}].map(rm=>`<div><div class="mono" style="font-size:8.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--dim)">${rm.k}</div><div style="font-family:var(--font-display);font-size:15px;font-weight:600;color:${rm.c};margin-top:2px">${rm.v}</div></div>`).join('');
  const deps=rich.slice(0,4).map((p,i)=>{ let bestRes='',bestD=0; for(const pl of (p.s.planets||[])){ for(const r of (pl.res||[])){ if(r.d>bestD){bestD=r.d;bestRes=r.id;} } } return {n:prettyRes(bestRes),where:(p.s.name)+' · '+(p.s.sector||''),density:Math.round(bestD*10)+'%',jumps:i+1}; });
  el('nearbyDep').innerHTML=(deps.length?deps:[{n:'Copper',where:'Ceres · Q18',density:'92%',jumps:2}]).map(d=>`<div class="listrow" style="padding:9px 11px"><i class="ph-fill ph-mountains" style="font-size:17px;color:#5fe9ce"></i><div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:600;color:var(--txt-hi)">${esc(d.n)}</div><div class="mono" style="font-size:9.5px;color:var(--dim)">${esc(d.where)}</div></div><div style="text-align:right"><div class="mono" style="font-size:12px;color:#5fe9ce">${d.density}</div><div class="mono" style="font-size:9px;color:var(--dim2)">${d.jumps} jumps</div></div></div>`).join('');
}
function prettyRes(id){ if(!id)return 'Deposit'; return String(id).replace(/^[A-Za-z]+Cluster_/,'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' '); }
function renderMapSample(){
  const host=el('mapNodes'); if(!host)return;
  const sys=[{x:'33%',y:'16%',name:'Halcyon',label:'Q07',d:'12px',dotBg:'#7d8ba1',ring:'1px solid #9fb0c4',color:'#9fb0c4',sub:''},{x:'22%',y:'34%',name:'Vega',label:'Q07',d:'16px',dotBg:'rgba(102,224,250,.15)',ring:'2px solid #66e0fa',color:'#66e0fa',sub:'Anvil Station'},{x:'58%',y:'30%',name:'Hub Prime',label:'Q05',d:'18px',dotBg:'rgba(255,208,73,.2)',ring:'2px solid #ffd049',color:'#ffd049',sub:'Trade Ring'},{x:'84%',y:'34%',name:'Onyx',label:'Q31',d:'14px',dotBg:'rgba(253,86,60,.2)',ring:'2px solid #ff7b66',color:'#ff9d8a',sub:'unclaimed'},{x:'40%',y:'58%',name:'Kryos',label:'Q12',d:'15px',dotBg:'rgba(95,233,206,.2)',ring:'2px solid #5fe9ce',color:'#5fe9ce',sub:'Deep Vein Rig'},{x:'72%',y:'52%',name:'Ceres',label:'Q18',d:'14px',dotBg:'#5fe9ce',ring:'2px solid #5fe9ce',color:'#5fe9ce',sub:'Copper 92%'},{x:'15%',y:'70%',name:'Nix',label:'Q23',d:'13px',dotBg:'rgba(102,224,250,.15)',ring:'2px solid #66e0fa',color:'#66e0fa',sub:'Solace'},{x:'50%',y:'78%',name:'Tharsis',label:'Q14',d:'11px',dotBg:'#7d8ba1',ring:'1px solid #9fb0c4',color:'#9fb0c4',sub:''},{x:'68%',y:'74%',name:'Lethe',label:'Q26',d:'11px',dotBg:'#7d8ba1',ring:'1px solid #9fb0c4',color:'#9fb0c4',sub:''}];
  host.innerHTML=`<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%"><g stroke="rgba(102,224,250,.16)" stroke-width="0.25" fill="none"><path d="M33,16 L22,34"/><path d="M22,34 L40,58"/><path d="M40,58 L15,70"/><path d="M40,58 L50,78"/><path d="M58,30 L84,34"/><path d="M72,52 L84,34"/><path d="M72,52 L68,74"/><path d="M50,78 L68,74"/><path d="M33,16 L58,30"/></g><g stroke="#ff7b66" stroke-width="0.55" fill="none" stroke-dasharray="1.4 1.6" style="animation:hud-flow 1.2s linear infinite;filter:drop-shadow(0 0 3px rgba(253,86,60,.6))"><path d="M22,34 L58,30"/><path d="M58,30 L72,52"/></g></svg>`
    +sys.map(s=>`<div style="position:absolute;left:${s.x};top:${s.y};transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:5px"><span style="width:${s.d};height:${s.d};border-radius:50%;background:${s.dotBg};border:${s.ring};box-shadow:0 0 12px ${s.color}"></span><span class="mono" style="font-size:9.5px;color:var(--txt);white-space:nowrap">${s.name} <span style="color:var(--dim2)">${s.label}</span></span>${s.sub?`<span class="mono" style="font-size:8.5px;color:${s.color};white-space:nowrap">${s.sub}</span>`:''}</div>`).join('');
  el('routeHops').innerHTML=[{n:'Anvil Station',sub:'Vega · Q07',tag:'ORIGIN',fg:'#66e0fa'},{n:'Hub Prime',sub:'Q05 · refuel',tag:'JUMP 1',fg:'#ffd049'},{n:'Ceres b',sub:'Q18 · copper',tag:'JUMP 2',fg:'#5fe9ce'}].map(h=>`<div style="display:flex;align-items:center;gap:11px;padding:7px 0"><span style="width:11px;height:11px;border-radius:50%;background:${h.fg};box-shadow:0 0 8px ${h.fg};flex-shrink:0"></span><div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:600;color:var(--txt-hi)">${h.n}</div><div class="mono" style="font-size:9.5px;color:var(--dim)">${h.sub}</div></div><span class="mono" style="font-size:9px;font-weight:600;color:${h.fg}">${h.tag}</span></div>`).join('');
  el('routeMeta').innerHTML=[{k:'Distance',v:'34 ly',c:'#eaf3fb'},{k:'FTL fuel',v:'340',c:'#ffd049'},{k:'Jumps',v:'2',c:'#66e0fa'}].map(rm=>`<div><div class="mono" style="font-size:8.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--dim)">${rm.k}</div><div style="font-family:var(--font-display);font-size:15px;font-weight:600;color:${rm.c};margin-top:2px">${rm.v}</div></div>`).join('');
  el('nearbyDep').innerHTML=[{n:'Copper',where:'Ceres · Q18',density:'92%',jumps:2},{n:'Titanium',where:'Onyx · Q31',density:'78%',jumps:3},{n:'Deuterium',where:'Nix · Q23',density:'64%',jumps:1},{n:'Silicon',where:'Lethe · Q26',density:'55%',jumps:4}].map(d=>`<div class="listrow" style="padding:9px 11px"><i class="ph-fill ph-mountains" style="font-size:17px;color:#5fe9ce"></i><div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:600;color:var(--txt-hi)">${d.n}</div><div class="mono" style="font-size:9.5px;color:var(--dim)">${d.where}</div></div><div style="text-align:right"><div class="mono" style="font-size:12px;color:#5fe9ce">${d.density}</div><div class="mono" style="font-size:9px;color:var(--dim2)">${d.jumps} jumps</div></div></div>`).join('');
}

/* ============================================================ SCREEN 5: RESOURCE FINDER */
let FINDER_RES='Copper';
const FINDER_CHIPS=['Iron','Copper','Titanium','Silicon','Deuterium'];
function renderFinder(){
  return head('◍ RESOURCE FINDER · RANKED BY DENSITY','Where’s the best '+FINDER_RES.toLowerCase()+'?','Planets ranked by node density, with jump count and FTL fuel cost from your home base.')
  +`<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap" id="finderChips">${FINDER_CHIPS.map(c=>`<span class="filterchip${c===FINDER_RES?' active':''}" style="border-radius:99px;padding:8px 14px;display:inline-flex;align-items:center;gap:7px" onclick="finderPick('${c}',this)"><i class="ph-fill ph-mountains" style="font-size:13px"></i>${c}</span>`).join('')}</div>
  <section class="panel" style="padding:0"><table class="hud"><thead><tr><th style="text-align:left">Rank</th><th style="text-align:left">Planet</th><th style="text-align:left">System · Quadrant</th><th style="text-align:left">Node density</th><th style="text-align:right">Nodes</th><th style="text-align:right">Jumps</th><th style="text-align:right">FTL cost</th></tr></thead><tbody id="finderBody"><tr><td colspan="7" style="text-align:center;color:var(--dim);padding:22px" class="mono">Scanning sector…</td></tr></tbody></table></section>`;
}
async function afterFinder(){
  try{ if(!MAP_GALAXY){ MAP_GALAXY=await fetch('./data/galaxy-'+QUADKEY+'.json').then(r=>r.json()).catch(()=>null); } }catch(e){}
  const body=el('finderBody'); if(!body)return;
  const rows=finderRank(FINDER_RES);
  if(!rows.length){ body.innerHTML=finderSampleRows(); return; }
  body.innerHTML=rows.map((r,i)=>`<tr><td class="mono" style="font-size:13px;font-weight:600;color:${i===0?'#5fe9ce':(i===1?'#66e0fa':'#7d8ba1')}">${String(i+1).padStart(2,'0')}</td><td style="font-size:13.5px;font-weight:600;color:var(--txt-hi)">${esc(r.planet)}</td><td class="mono" style="font-size:11.5px;color:#9fb0c4">${esc(r.sys)}</td><td><div style="display:flex;align-items:center;gap:9px"><div class="bar-track" style="flex:1;min-width:70px"><div class="bar-fill" style="width:${r.density}%;background:linear-gradient(90deg,#15b79f,#5fe9ce);box-shadow:0 0 8px rgba(21,183,159,.5)"></div></div><span class="mono" style="font-size:11px;color:#5fe9ce">${r.density}%</span></div></td><td style="text-align:right" class="mono" style="font-size:12px;color:#c7d4e2">${r.nodes}</td><td style="text-align:right" class="mono" style="font-size:12px;color:#c7d4e2">${r.jumps}</td><td style="text-align:right" class="mono" style="font-size:12px;color:${r.jumps===0?'#5fe9ce':(r.jumps>=4?'#ff9d8a':'#c7d4e2')}">${r.jumps===0?'home':(r.jumps*180+' fuel')}</td></tr>`).join('');
}
function finderRank(resWord){
  if(!MAP_GALAXY||!MAP_GALAXY.systems)return [];
  const re=new RegExp(resWord,'i'); const out=[];
  for(const s of MAP_GALAXY.systems){ for(const p of (s.planets||[])){ let best=0,nodes=0; for(const arr of [p.res,p.dep,p.gey]){ for(const r of (arr||[])){ if(re.test(r.id)){ if(r.d>best)best=r.d; nodes+=r.n||0; } } } if(best>0){ out.push({planet:s.name+' '+toRoman((p.i||0)+1),sys:(s.name)+' · '+(s.sector||''),densityRaw:best,nodes:fmtN(nodes)}); } } }
  out.sort((a,b)=>b.densityRaw-a.densityRaw);
  const top=out.slice(0,8); const max=top.length?top[0].densityRaw:1;
  return top.map((r,i)=>({planet:r.planet,sys:r.sys,density:Math.min(99,Math.round(r.densityRaw/max*99)),nodes:r.nodes,jumps:i}));
}
function toRoman(n){ return ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][n-1]||n; }
function finderSampleRows(){ return [
  {rank:'01',rankFg:'#5fe9ce',planet:'Ceres b',sys:'Ceres · Q18',density:92,nodes:'14',jumps:'2',ftl:'340 fuel',ftlFg:'#ffd049'},
  {rank:'02',rankFg:'#66e0fa',planet:'Vega III',sys:'Vega · Q07',density:81,nodes:'9',jumps:'0',ftl:'home',ftlFg:'#5fe9ce'},
  {rank:'03',rankFg:'#7d8ba1',planet:'Kryos II',sys:'Kryos · Q12',density:73,nodes:'11',jumps:'1',ftl:'160 fuel',ftlFg:'#c7d4e2'},
  {rank:'04',rankFg:'#7d8ba1',planet:'Lethe a',sys:'Lethe · Q26',density:66,nodes:'7',jumps:'4',ftl:'720 fuel',ftlFg:'#ff9d8a'},
  {rank:'05',rankFg:'#7d8ba1',planet:'Tharsis',sys:'Tharsis · Q14',density:58,nodes:'6',jumps:'3',ftl:'540 fuel',ftlFg:'#c7d4e2'},
].map(r=>`<tr><td class="mono" style="font-size:13px;font-weight:600;color:${r.rankFg}">${r.rank}</td><td style="font-size:13.5px;font-weight:600;color:var(--txt-hi)">${r.planet}</td><td class="mono" style="font-size:11.5px;color:#9fb0c4">${r.sys}</td><td><div style="display:flex;align-items:center;gap:9px"><div class="bar-track" style="flex:1;min-width:70px"><div class="bar-fill" style="width:${r.density}%;background:linear-gradient(90deg,#15b79f,#5fe9ce);box-shadow:0 0 8px rgba(21,183,159,.5)"></div></div><span class="mono" style="font-size:11px;color:#5fe9ce">${r.density}%</span></div></td><td style="text-align:right" class="mono" style="font-size:12px;color:#c7d4e2">${r.nodes}</td><td style="text-align:right" class="mono" style="font-size:12px;color:#c7d4e2">${r.jumps}</td><td style="text-align:right" class="mono" style="font-size:12px;color:${r.ftlFg}">${r.ftl}</td></tr>`).join(''); }
function finderPick(r,elm){ FINDER_RES=r; document.querySelectorAll('#finderChips .filterchip').forEach(c=>c.classList.remove('active')); elm.classList.add('active'); const hs=$main().querySelector('h1.hud'); if(hs)hs.textContent='Where’s the best '+r.toLowerCase()+'?'; afterFinder(); }
window.finderPick=finderPick;

/* ============================================================ SCREEN 6: CORP */
function renderCorp(){
  const corpNm=CORP?CORP.name:'Nebula Freight Co.';
  const code=CORP&&CORP.join_code?CORP.join_code:'NF-7F2A-9KX';
  const mem=(MEMBERS&&MEMBERS.length)?MEMBERS.map(m=>{ const nm=m.name||m.pilot_name||(m.email?m.email.split('@')[0]:'Pilot'); const role=(m.role||'pilot').toUpperCase(); const rc=role==='ADMIN'||role==='OWNER'?{fg:'#ff9d8a',bg:'rgba(253,86,60,.14)'}:(role==='OFFICER'?{fg:'#66e0fa',bg:'rgba(102,224,250,.14)'}:{fg:'#9fb0c4',bg:'rgba(96,165,215,.12)'}); return {init:nm.slice(0,2).toUpperCase(),name:nm,avatar:'linear-gradient(150deg,#04aad6,#0d6d91)',role:role==='OWNER'?'ADMIN':role,roleFg:rc.fg,roleBg:rc.bg,bases:String(m.bases||0),seen:m.seen||'—',dot:'#5fe9ce'}; }):SAMPLE_MEMBERS();
  const acts=SAMPLE_ACTIVITY();
  const stats=[{k:'Corp balance',v:'1.8M cr',c:'#ffd049'},{k:'Bases',v:String(hasCorpData()?STATE_BASES.length:6),c:'#66e0fa'},{k:'Output / hr',v:fmtK(totalExtraction()),c:'#5fe9ce'},{k:'Founded',v:'Cycle 214',c:'#eaf3fb'}];
  return head('◍ CORP · '+esc(String(corpNm).toUpperCase()),'Corp & crew','')
  +`<div style="display:grid;grid-template-columns:1fr 320px;gap:14px;align-items:start">
    <div style="display:flex;flex-direction:column;gap:14px">
      <section class="panel" style="padding:0"><div style="padding:16px 20px;border-bottom:1px solid rgba(96,165,215,.12)" class="mono" style="font-size:9px;letter-spacing:.14em;color:var(--cyan)">CREW · ${mem.length} PILOTS</div><table class="hud"><tbody>${mem.map(m=>`<tr><td style="width:1%"><span style="width:34px;height:34px;border-radius:50%;background:${m.avatar};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;color:#04121c">${esc(m.init)}</span></td><td style="padding-left:8px"><div style="font-size:13px;font-weight:600;color:var(--txt-hi)">${esc(m.name)}</div></td><td><span class="mono" style="font-size:9.5px;font-weight:600;padding:3px 9px;border-radius:99px;background:${m.roleBg};color:${m.roleFg};letter-spacing:.05em">${m.role}</span></td><td class="mono" style="font-size:11.5px;color:#9fb0c4">${m.bases} bases</td><td style="text-align:right"><span class="mono" style="display:inline-flex;align-items:center;gap:6px;font-size:10.5px;color:var(--dim)"><span style="width:6px;height:6px;border-radius:50%;background:${m.dot}"></span>${esc(m.seen)}</span></td></tr>`).join('')}</tbody></table></section>
      <section class="panel"><div class="mono" style="font-size:9px;letter-spacing:.14em;color:var(--cyan);margin-bottom:14px">◍ RECENT ACTIVITY</div><div style="display:flex;flex-direction:column;gap:13px">${acts.map(a=>`<div style="display:flex;align-items:flex-start;gap:12px"><span class="icontile" style="width:30px;height:30px;background:rgba(102,224,250,.06);border:1px solid rgba(102,224,250,.14)"><i class="ph-fill ${a.icon}" style="font-size:15px;color:${a.fg}"></i></span><div style="flex:1"><div style="font-size:12.5px;color:var(--txt)"><span style="font-weight:600;color:var(--txt-hi)">${esc(a.who)}</span> ${esc(a.what)}</div></div><span class="mono" style="font-size:10px;color:var(--dim2);white-space:nowrap">${a.when}</span></div>`).join('')}</div></section>
    </div>
    <div style="display:flex;flex-direction:column;gap:14px">
      <section style="position:relative;background:radial-gradient(300px 200px at 70% 0%, rgba(6,48,92,.5), rgba(4,10,22,.92));border:1px solid rgba(102,224,250,.3);border-radius:15px;padding:20px;overflow:hidden"><div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#66e0fa,transparent)"></div><div class="mono" style="font-size:9px;letter-spacing:.14em;color:var(--cyan);margin-bottom:10px">◍ ONE INVITE CODE</div><p style="font-size:12.5px;color:#8a94a6;margin:0 0 14px;line-height:1.5">Share this code — new pilots enter with an email 6-digit code, no passwords. One corp per pilot.</p><div style="display:flex;align-items:center;gap:10px;background:rgba(4,10,20,.7);border:1px solid rgba(102,224,250,.28);border-radius:11px;padding:13px 15px;margin-bottom:12px"><span class="mono" id="inviteCode" style="flex:1;font-size:19px;font-weight:600;letter-spacing:.12em;color:#66e0fa">${esc(code)}</span><i class="ph-fill ph-copy" style="font-size:18px;color:var(--dim);cursor:pointer" onclick="copyCode()"></i></div><button class="btn btn-primary" style="width:100%;justify-content:center;padding:11px" onclick="copyCode()"><i class="ph-fill ph-share-network"></i>Share invite</button></section>
      <section class="panel"><div class="mono" style="font-size:9px;letter-spacing:.14em;color:var(--cyan);margin-bottom:14px">CORP STATS</div><div style="display:flex;flex-direction:column;gap:12px">${stats.map(s=>`<div style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:12.5px;color:#9fb0c4">${s.k}</span><span style="font-family:var(--font-display);font-size:17px;font-weight:600;color:${s.c}">${s.v}</span></div>`).join('')}</div></section>
    </div>
  </div>`;
}
function copyCode(){ const c=el('inviteCode').textContent.trim(); if(navigator.clipboard)navigator.clipboard.writeText(c); toast('📋 Invite code copied: '+c); }
window.copyCode=copyCode;
function SAMPLE_MEMBERS(){ return [
  {init:'RK',name:'Cmdr. Rukh',avatar:'linear-gradient(150deg,#fd563c,#872415)',role:'ADMIN',roleFg:'#ff9d8a',roleBg:'rgba(253,86,60,.14)',bases:'3',seen:'now',dot:'#5fe9ce'},
  {init:'JV',name:'Jax Vantor',avatar:'linear-gradient(150deg,#04aad6,#0d6d91)',role:'OFFICER',roleFg:'#66e0fa',roleBg:'rgba(102,224,250,.14)',bases:'2',seen:'4m',dot:'#5fe9ce'},
  {init:'MO',name:'Mira Osei',avatar:'linear-gradient(150deg,#15b79f,#107569)',role:'OFFICER',roleFg:'#66e0fa',roleBg:'rgba(102,224,250,.14)',bases:'1',seen:'22m',dot:'#5fe9ce'},
  {init:'DL',name:'Deacon Lir',avatar:'linear-gradient(150deg,#fb9c0c,#b84d05)',role:'PILOT',roleFg:'#9fb0c4',roleBg:'rgba(96,165,215,.12)',bases:'1',seen:'3h',dot:'#ffd049'},
  {init:'SK',name:'Suri Kade',avatar:'linear-gradient(150deg,#667085,#313749)',role:'PILOT',roleFg:'#9fb0c4',roleBg:'rgba(96,165,215,.12)',bases:'1',seen:'1d',dot:'#7d8ba1'},
  {init:'TN',name:'Torren Nix',avatar:'linear-gradient(150deg,#667085,#313749)',role:'PILOT',roleFg:'#9fb0c4',roleBg:'rgba(96,165,215,.12)',bases:'0',seen:'2d',dot:'#7d8ba1'},
];}
function SAMPLE_ACTIVITY(){ return [
  {who:'Jax Vantor',what:'added deposit Copper ×3 at Kryos II',when:'4m',icon:'ph-mountains',fg:'#5fe9ce'},
  {who:'Mira Osei',what:'updated the Ion Thruster chain target',when:'31m',icon:'ph-flow-arrow',fg:'#66e0fa'},
  {who:'Cmdr. Rukh',what:'registered base Redshift Yard',when:'2h',icon:'ph-planet',fg:'#ff7b66'},
  {who:'Deacon Lir',what:'joined the corp',when:'1d',icon:'ph-users-three',fg:'#ffd049'},
];}
