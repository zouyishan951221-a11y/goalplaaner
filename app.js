(function(){
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const TEMPLATES={
  retire:{type:'retire',name:'退休金',target:1500,years:25,pv:100,pmt:20000,r:6,inf:2,g:2,age:40},
  edu:{type:'edu',name:'子女教育金',target:300,years:15,pv:20,pmt:8000,r:5,inf:2.5,g:0,age:''},
  house:{type:'house',name:'購屋頭期款',target:400,years:7,pv:80,pmt:25000,r:4,inf:2,g:2,age:''},
  emergency:{type:'emergency',name:'緊急預備金',target:36,years:2,pv:10,pmt:10000,r:1.5,inf:2,g:0,age:''},
  custom:{type:'custom',name:'我的目標',target:100,years:5,pv:0,pmt:10000,r:4,inf:2,g:0,age:''}
};
const TYPES=[['retire','退休'],['edu','子女教育'],['house','購屋'],['emergency','緊急預備金'],['custom','自訂']];
const TYPE_COLOR={retire:'var(--jade)',edu:'var(--gold)',house:'var(--amber)',emergency:'var(--red)',custom:'var(--muted)'};
const KEY='goal-planner-v1';
const uid=()=>Math.random().toString(36).slice(2,9);

let state=null;
try{const s=JSON.parse(localStorage.getItem(KEY)); if(s&&Array.isArray(s.goals)&&s.goals.length) state=s;}catch(e){}
if(!state){const a={...TEMPLATES.retire,id:uid(),sample:true},b={...TEMPLATES.house,id:uid(),sample:true};state={goals:[a,b],active:a.id};}
let saveT;
function save(){clearTimeout(saveT);saveT=setTimeout(()=>{try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){}},300);}
const cur=()=>state.goals.find(g=>g.id===state.active)||state.goals[0];

/* ---------- formatting ---------- */
function money(v){const a=Math.abs(v);if(a>=1e8)return (v/1e8).toFixed(2)+' 億';if(a>=1e4)return (v/1e4).toLocaleString('zh-TW',{maximumFractionDigits:a>=1e6?0:1})+' 萬';return Math.round(v).toLocaleString('zh-TW')+' 元';}
const yuan=v=>Math.round(v).toLocaleString('zh-TW')+' 元';
const pct=(v,d=1)=>(v*100).toFixed(d)+'%';
const fmtYears=y=>{const yy=Math.floor(y+1e-9),m=Math.round((y-yy)*12);return m? `${yy} 年 ${m} 個月`:`${yy} 年`;};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- engine: monthly compounding, end-of-month deposits, deposit steps up each year ---------- */
function project(pv,pmt,r,years,g){
  const i=r/12,N=Math.round(years*12);let bal=pv,pay=pmt,contrib=pv;const rows=[{y:0,bal,contrib,pay}];
  for(let m=1;m<=N;m++){bal=bal*(1+i)+pay;contrib+=pay;if(m%12===0){rows.push({y:m/12,bal,contrib,pay});pay*=(1+g);}}
  return {fv:bal,rows};
}
function solveRate(pv,pmt,years,g,tgt){
  let lo=-0.1,hi=0.5;
  if(project(pv,pmt,lo,years,g).fv>=tgt) return lo;
  if(project(pv,pmt,hi,years,g).fv<tgt) return null;
  for(let k=0;k<60;k++){const mid=(lo+hi)/2; if(project(pv,pmt,mid,years,g).fv>=tgt) hi=mid; else lo=mid;}
  return hi;
}
function solveYears(pv,pmt,r,g,target,inf){
  const i=r/12;let bal=pv,pay=pmt;
  if(bal>=target) return 0;
  for(let m=1;m<=960;m++){bal=bal*(1+i)+pay;if(bal>=target*Math.pow(1+inf,m/12))return m/12;if(m%12===0)pay*=(1+g);}
  return null;
}
function analyze(G){
  const r=G.r/100,inf=G.inf/100,g=G.g/100,n=Math.max(1,Math.round(G.years||1));
  const pv=(G.pv||0)*1e4,pmt=G.pmt||0,target=(G.target||0)*1e4;
  const targetFV=target*Math.pow(1+inf,n);
  const base=project(pv,pmt,r,n,g);
  const fvPV=project(pv,0,r,n,g).fv,unit=project(0,1,r,n,g).fv,fvPMT=base.fv-fvPV;
  const reqPMT=Math.max(0,(targetFV-fvPV)/unit);
  const lumpNeeded=Math.max(0,(targetFV-fvPMT)/Math.pow(1+r/12,n*12));
  const reqRate=solveRate(pv,pmt,n,g,targetFV);
  const reqYears=solveYears(pv,pmt,r,g,target,inf);
  const ratio=targetFV>0?base.fv/targetFV:1;
  return {G,r,inf,g,n,pv,pmt,target,targetFV,base,fvPV,fvPMT,reqPMT,lumpNeeded,extraLump:Math.max(0,lumpNeeded-pv),
    reqRate,reqYears,ratio,realFV:base.fv/Math.pow(1+inf,n),realR:(1+r)/(1+inf)-1,
    status:ratio>=1?'ok':ratio>=0.85?'near':'gap'};
}

/* ---------- goal bar & form ---------- */
function renderGoalbar(){
  const gb=$('#goalbar');
  gb.innerHTML='<span class="lbl">目標</span>'+state.goals.map(g=>{
    const a=analyze(g);
    return `<button class="chip" aria-pressed="${g.id===state.active}" data-id="${g.id}"><span class="dot" style="background:${TYPE_COLOR[g.type]||'var(--muted)'}"></span>${esc(g.name||'未命名')} <span class="num" style="color:var(--muted);font-size:12px">${Math.round(a.ratio*100)}%</span>${g.sample?'<small>範例</small>':''}</button>`;
  }).join('')+'<button class="chip add" id="addgoal">＋ 新增目標</button>';
}
function renderTypes(){
  const G=cur();
  $('#types').innerHTML=TYPES.map(([k,l])=>`<button class="type" data-t="${k}" aria-pressed="${G.type===k}">${l}</button>`).join('');
}
function fillForm(){
  const G=cur();
  $$('[data-k]').forEach(el=>{const v=G[el.dataset.k];el.value=(v===undefined||v===null)?'':v;});
  renderTypes();
  const del=$('#del');del.classList.remove('armed');del.textContent='刪除目標';del.disabled=state.goals.length<2;del.style.opacity=state.goals.length<2?.4:1;
}

/* ---------- results ---------- */
function renderPlan(){
  const a=analyze(cur()),G=a.G;
  const ratioEl=$('#ratio');ratioEl.innerHTML=Math.round(a.ratio*100)+'<span>%</span>';
  ratioEl.style.color=a.status==='ok'?'var(--jade)':a.status==='near'?'var(--amber)':'var(--red)';
  const pill=$('#pill');pill.className='pill '+a.status;
  pill.textContent=a.status==='ok'?'● 可以達標':a.status==='near'?'● 接近目標':'● 有缺口';
  const diff=a.base.fv-a.targetFV;
  $('#verdict').innerHTML= a.status==='ok'
    ? `照目前計畫，${a.n} 年後預估累積 <b class="num">${money(a.base.fv)}</b>，超過通膨調整後的目標 <b class="num">${money(a.targetFV)}</b>，多出 <b class="num">${money(diff)}</b>。`
    : `照目前計畫，${a.n} 年後預估累積 <b class="num">${money(a.base.fv)}</b>；目標「${esc(G.name)}」在通膨後需要 <b class="num">${money(a.targetFV)}</b>，還差 <b class="num">${money(-diff)}</b>。`;
  const scaleMax=Math.max(1.2,Math.min(a.ratio,2)*1.05);
  $('#barfill').style.width=Math.min(a.ratio/scaleMax,1)*100+'%';
  $('#barfill').style.background=a.status==='ok'?'var(--jade)':a.status==='near'?'var(--amber)':'var(--red)';
  const mk=(1/scaleMax)*100;$('#barmark').style.left=mk+'%';$('#barlbl').style.left=mk+'%';

  const i=(G.r/100/12), N=a.n*12;
  const rateTxt=a.reqRate===null?'> 50%':a.reqRate<=-0.1?'不需報酬':pct(a.reqRate,2);
  $('#metrics').innerHTML=[
    {k:'目標終值（通膨後）',v:money(a.targetFV),d:`今日 ${money(a.target)} × (1+${G.inf}%)^${a.n}`,x:`=FV(${G.inf}%,${a.n},0,-${Math.round(a.target)})`},
    {k:'預估終值',v:money(a.base.fv),d:`約等於今日 ${money(a.realFV)}`,x:G.g?'含每年調升，逐月試算':`=FV(${G.r}%/12,${N},-${G.pmt},-${Math.round(a.pv)})`},
    {k:'達標每月需投入',v:yuan(a.reqPMT),d:a.reqPMT>a.pmt?`比現在多 ${yuan(a.reqPMT-a.pmt)}`:`比現在少 ${yuan(a.pmt-a.reqPMT)}`,x:G.g?`首年金額，之後每年 +${G.g}%`:`=PMT(${G.r}%/12,${N},-${Math.round(a.pv)},${Math.round(a.targetFV)})`},
    {k:'達標所需年報酬',v:rateTxt,d:`目前假設 ${G.r}%，實質 ${pct(a.realR)}`,x:G.g?'逐月試算求解':`=RATE(${N},-${G.pmt},-${Math.round(a.pv)},${Math.round(a.targetFV)})*12`}
  ].map(m=>`<div class="metric"><div class="k">${m.k}</div><div class="v">${m.v}</div><div class="d">${m.d}</div><div class="xl">${esc(m.x)}</div></div>`).join('');

  drawChart(a);
  renderAdvice(a);
  renderScen(a);
  renderYearTable(a);
}

function renderAdvice(a){
  const G=a.G,items=[];
  const add=(tag,cls,title,body)=>items.push({tag,cls,title,body});
  if(a.status!=='ok'){
    add('提高 PMT','t-act',`每月投入提高到 ${yuan(a.reqPMT)}`,
      `比現在多 <b>${yuan(a.reqPMT-a.pmt)}</b>，其他條件不變即可在 ${a.n} 年後達標${a.g?`（之後每年再調升 ${G.g}%）`:''}。這是最可控的一條路。`);
    if(a.reqYears!==null) add('延長 n','t-act',`維持現在的存法，約 ${fmtYears(a.reqYears)} 達標`,
      `比原訂多 <b>${fmtYears(Math.max(0,a.reqYears-a.n))}</b>。目標會隨通膨一起變貴，所以延長時間的效果比直覺小。`);
    else add('延長 n','t-warn','只延長時間追不上','以目前的投入與報酬，80 年內都追不上隨通膨上漲的目標，需要先提高投入或報酬。');
    add('補足 PV','t-act',`今天一次再投入 ${money(a.extraLump)}`,
      `適合有年終、獎金或閒置存款時使用。在 ${G.r}% 報酬下，這筆錢 ${a.n} 年後會長成 <b>${money(a.extraLump*Math.pow(1+a.r/12,a.n*12))}</b>。`);
    if(a.reqRate!==null){
      const hi=a.reqRate>0.08;
      add('報酬率',hi?'t-warn':'t-info',`光靠報酬率，需要年化 ${pct(a.reqRate,2)}`,
        hi?`超過 8% 的長期年化報酬需要承擔明顯的波動與回檔，不建議把它當成主要手段，宜搭配提高投入。`
          :`比目前假設高 <b>${pct(a.reqRate-a.r,2)}</b>。提高報酬就要承擔更大波動，建議與提高投入並用。`);
    }
    add('調整目標','t-info',`不改計畫時，可達成約今日 ${money(a.realFV)}`,
      `若期限與每月預算都不能動，可以把目標調整到這個規模，或拆成「必要」與「理想」兩層。`);
  }else{
    const spare=a.pmt-a.reqPMT;
    add('PMT 有餘裕','t-act',`每月投入 ${yuan(a.reqPMT)} 就夠了`,
      `每月可釋出約 <b>${yuan(spare)}</b> 給其他目標，例如緊急預備金或子女教育。`);
    if(a.reqYears!==null&&a.reqYears<a.n) add('提早達標','t-act',`約 ${fmtYears(a.reqYears)} 就能達成`,`比原訂提早 <b>${fmtYears(a.n-a.reqYears)}</b>。`);
    if(a.reqRate!==null) add('降低風險','t-info',`只需年化 ${a.reqRate<=-0.1?'0%':pct(a.reqRate,2)} 報酬`,
      `低於目前假設的 ${G.r}%。可以考慮把部分資產轉向波動較低的配置，鎖住已經走在前面的進度。`);
  }
  // common: inflation & real return
  if(a.realR<=0) add('通膨','t-warn','實質報酬是負的',`預期報酬 ${G.r}% 低於通膨 ${G.inf}%，錢放越久購買力越低。長期目標需要有一部分資產追得上通膨。`);
  // step-up
  if(!a.g && a.n>=5){
    const up=project(a.pv,a.pmt,a.r,a.n,0.03).fv;
    add('加薪效應','t-info','每年把月投入調高 3%',`終值可從 ${money(a.base.fv)} 增加到 <b>${money(up)}</b>，達成率 ${Math.round(a.ratio*100)}% → <b>${Math.round(up/a.targetFV*100)}%</b>。跟著加薪一起調，負擔感最小。`);
  }
  // horizon vs risk
  if(a.n<=3 && G.r>3) add('期限風險','t-warn',`${a.n} 年內要用的錢，${G.r}% 報酬假設偏高`,'短期目標遇到市場下跌時沒有時間等回升，建議以定存、貨幣型或短債等低波動工具為主，並用較低報酬率重新試算。');
  if(a.n>=10 && G.r<3) add('期限優勢','t-info',`距離目標還有 ${a.n} 年，可評估更積極的配置`,'長期目標有較長時間消化波動，報酬率每多 1 個百分點，對終值的影響會隨年數放大。可以在右邊的壓力測試看差距。');
  // type specific
  const T={
    retire:['退休提醒',`勞退自提最高 6%，提繳金額不計入當年度綜合所得，同時有節稅與強迫儲蓄的效果。${G.age?`你預計 ${(+G.age)+a.n} 歲達標，`:''}可以用「PV 工具」估算退休後每月提領需要多少本金。`],
    edu:['教育提醒','教育支出常集中在幾年內一次發生，最後 2–3 年應逐步轉向低波動資產；也可以把通膨調高 1 個百分點做壓力測試。'],
    house:['購屋提醒','頭期款之外，還要預留契稅、代書、仲介、裝潢與搬家費用，以及半年左右的房貸支出。可用「PMT 工具」的貸款攤還模式檢查月付壓力。'],
    emergency:['預備金提醒','一般建議準備 3–6 個月的必要生活費，放在隨時能動用的帳戶，重點是流動性而不是報酬率。']
  };
  if(T[G.type]) add(T[G.type][0],'',T[G.type][0].replace('提醒','目標的細節'),T[G.type][1]);
  $('#advice').innerHTML=items.map(it=>`<div class="adv-item"><span class="adv-tag ${it.cls}">${it.tag}</span><div><h3>${it.title}</h3><p>${it.body}</p></div></div>`).join('');
}

function renderScen(a){
  const G=a.G;
  $('#scen').innerHTML=[[-0.02,'保守'],[0,'基準'],[0.02,'樂觀']].map(([d,l])=>{
    const r=Math.max(-0.05,a.r+d),fv=project(a.pv,a.pmt,r,a.n,a.g).fv,ratio=fv/a.targetFV;
    const c=ratio>=1?'var(--jade)':ratio>=.85?'var(--amber)':'var(--red)';
    return `<div class="sc ${d===0?'mid':''}"><div class="k">${l}・年報酬 ${(r*100).toFixed(1)}%</div><div class="v">${money(fv)}</div><div class="r" style="color:${c}">達成率 ${Math.round(ratio*100)}%</div></div>`;
  }).join('');
}

function renderYearTable(a){
  const G=a.G,hasAge=G.age!==''&&G.age!==null&&!isNaN(+G.age)&&+G.age>0;
  let hit=false;
  const rows=a.base.rows.slice(1).map(r=>{
    const tg=a.target*Math.pow(1+a.inf,r.y),ok=r.bal>=tg,first=ok&&!hit;if(ok)hit=true;
    return `<tr class="${first?'hit':''}"><td>第 ${r.y} 年${first?' ✓':''}</td>${hasAge?`<td>${(+G.age)+r.y}</td>`:''}<td>${Math.round(r.pay).toLocaleString('zh-TW')}</td><td>${money(r.contrib)}</td><td>${money(r.bal-r.contrib)}</td><td>${money(r.bal)}</td><td>${money(tg)}</td><td>${Math.round(r.bal/tg*100)}%</td></tr>`;
  }).join('');
  const last=a.base.rows[a.base.rows.length-1];
  $('#yeartable').innerHTML=`<table><thead><tr><th>年度</th>${hasAge?'<th>年齡</th>':''}<th>當年月投入</th><th>累計本金</th><th>累計報酬</th><th>年末資產</th><th>目標（通膨後）</th><th>達成率</th></tr></thead><tbody>${rows}</tbody>
  <tfoot><tr><td>合計</td>${hasAge?'<td></td>':''}<td></td><td>${money(last.contrib)}</td><td>${money(last.bal-last.contrib)}</td><td>${money(last.bal)}</td><td>${money(a.targetFV)}</td><td>${Math.round(a.ratio*100)}%</td></tr></tfoot></table>`;
}

/* ---------- chart ---------- */
let lastA=null;
function shortMoney(v){if(v>=1e8)return (v/1e8).toFixed(v>=1e9?0:1)+'億';if(v>=1e4)return Math.round(v/1e4).toLocaleString('zh-TW')+'萬';return Math.round(v).toLocaleString('zh-TW');}
function niceStep(max,count){const raw=max/count,p=Math.pow(10,Math.floor(Math.log10(raw))),f=raw/p;return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*p;}
function drawChart(a){
  lastA=a;const box=$('#chart');const W=Math.max(300,box.clientWidth);const H=Math.round(Math.min(330,Math.max(230,W*0.46)));
  const P={l:58,r:18,t:18,b:34},iw=W-P.l-P.r,ih=H-P.t-P.b;
  const rows=a.base.rows,tg=rows.map(r=>a.target*Math.pow(1+a.inf,r.y));
  const maxV=Math.max(...rows.map(r=>r.bal),...tg,1);
  const step=niceStep(maxV,4),top=Math.ceil(maxV*1.04/step)*step;
  const x=y=>P.l+iw*y/a.n,y=v=>P.t+ih*(1-v/top);
  const line=(arr,f)=>arr.map((r,k)=>(k?'L':'M')+x(r.y).toFixed(1)+','+f(r,k).toFixed(1)).join('');
  const balPath=line(rows,r=>y(r.bal)),conPath=line(rows,r=>y(r.contrib)),tgPath=line(rows,(r,k)=>y(tg[k]));
  const base=y(0);
  let grid='';for(let v=0;v<=top+1e-6;v+=step){const yy=y(v);grid+=`<line x1="${P.l}" x2="${W-P.r}" y1="${yy}" y2="${yy}" stroke="var(--line)" stroke-width="1"/><text x="${P.l-8}" y="${yy+4}" text-anchor="end" font-size="11.5" fill="var(--muted)" font-family="IBM Plex Mono,monospace">${shortMoney(v)}</text>`;}
  const xs=Math.max(1,Math.ceil(a.n/Math.max(2,Math.floor(iw/70))));let xt='';
  for(let t=0;t<=a.n;t+=xs){xt+=`<text x="${x(t)}" y="${H-10}" text-anchor="middle" font-size="11.5" fill="var(--muted)" font-family="IBM Plex Mono,monospace">${t===0?'今天':t+'年'}</text>`;}
  const end=rows[rows.length-1];
  box.innerHTML=`<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="資產累積路徑圖">
    ${grid}
    <path d="${conPath}L${x(a.n)},${base}L${x(0)},${base}Z" fill="var(--muted)" fill-opacity=".14"/>
    <path d="${balPath}L${x(a.n)},${base}L${x(0)},${base}Z" fill="var(--jade)" fill-opacity=".12"/>
    <path d="${tgPath}" fill="none" stroke="var(--gold)" stroke-width="2.2" stroke-dasharray="6 5"/>
    <path d="${balPath}" fill="none" stroke="var(--jade)" stroke-width="2.8" stroke-linejoin="round"/>
    <circle cx="${x(a.n)}" cy="${y(end.bal)}" r="5" fill="var(--jade)" stroke="var(--card)" stroke-width="2"/>
    <circle cx="${x(a.n)}" cy="${y(tg[tg.length-1])}" r="5" fill="var(--gold)" stroke="var(--card)" stroke-width="2"/>
    ${xt}
    <line id="hov" x1="0" x2="0" y1="${P.t}" y2="${base}" stroke="var(--ink)" stroke-opacity=".3" stroke-width="1" visibility="hidden"/>
    <rect x="${P.l}" y="${P.t}" width="${iw}" height="${ih}" fill="transparent" id="hit"/>
  </svg><div class="tip" id="tip" hidden></div>`;
  const hit=box.querySelector('#hit'),hov=box.querySelector('#hov'),tip=box.querySelector('#tip');
  const move=e=>{const rc=box.getBoundingClientRect();const px=e.clientX-rc.left;let yr=Math.round((px-P.l)/iw*a.n);yr=Math.max(0,Math.min(a.n,yr));
    const r=rows[yr];hov.setAttribute('x1',x(yr));hov.setAttribute('x2',x(yr));hov.setAttribute('visibility','visible');
    tip.hidden=false;tip.style.left=Math.min(Math.max(x(yr),90),W-90)+'px';tip.style.top=(Math.min(y(r.bal),y(tg[yr]))-8)+'px';
    tip.innerHTML=`${yr===0?'今天':'第 '+yr+' 年'}<br>資產 <b>${money(r.bal)}</b><br>本金 <b>${money(r.contrib)}</b><br>目標 <b>${money(tg[yr])}</b>`;};
  hit.addEventListener('pointermove',move);hit.addEventListener('pointerdown',move);
  hit.addEventListener('pointerleave',()=>{tip.hidden=true;hov.setAttribute('visibility','hidden');});
}
let rz;window.addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{if(lastA&&!$('#view-plan').hidden)drawChart(lastA);},120);});

/* ---------- overview ---------- */
function renderOverview(){
  const list=state.goals.map(analyze);
  const sumNow=list.reduce((s,a)=>s+a.pmt,0),sumReq=list.reduce((s,a)=>s+a.reqPMT,0),okN=list.filter(a=>a.status==='ok').length;
  $('#ovsum').innerHTML=`<div class="ov-tile"><div class="eyebrow">目前每月總投入</div><div class="v">${yuan(sumNow)}</div></div>
  <div class="ov-tile"><div class="eyebrow">全部達標每月需要</div><div class="v" style="color:${sumReq>sumNow?'var(--red)':'var(--jade)'}">${yuan(sumReq)}</div><div class="note">${sumReq>sumNow?'每月缺 '+yuan(sumReq-sumNow):'每月有 '+yuan(sumNow-sumReq)+' 餘裕'}</div></div>
  <div class="ov-tile"><div class="eyebrow">可達標目標</div><div class="v">${okN} / ${list.length}</div></div>`;
  $('#ovtable').innerHTML=`<table><thead><tr><th>目標</th><th>年數</th><th>目標（通膨後）</th><th>預估終值</th><th>目前月投入</th><th>達標月投入</th><th>達成率</th><th>狀態</th></tr></thead><tbody>${
    list.map(a=>`<tr><td class="name"><button class="btn" data-open="${a.G.id}" style="padding:3px 10px">${esc(a.G.name)}</button></td><td>${a.n}</td><td>${money(a.targetFV)}</td><td>${money(a.base.fv)}</td><td>${Math.round(a.pmt).toLocaleString('zh-TW')}</td><td>${Math.round(a.reqPMT).toLocaleString('zh-TW')}</td><td>${Math.round(a.ratio*100)}%</td><td><span class="pill ${a.status}">${a.status==='ok'?'可達標':a.status==='near'?'接近':'有缺口'}</span></td></tr>`).join('')
  }</tbody></table>`;
}

/* ---------- toolbox ---------- */
const freq={pv:12,fv:12};let pmtMode='save';
const num=id=>parseFloat($('#'+id).value)||0;
const fx=v=>{const s=(+v.toFixed(6)).toString();return s;};
function tools(){
  // PV
  {const f=freq.pv,i=num('pv-rate')/100/f,N=Math.round(num('pv-years')*f),p=num('pv-pmt'),F=num('pv-fv');
   const pv=i? p*(1-Math.pow(1+i,-N))/i + F*Math.pow(1+i,-N) : p*N+F;
   $('#pv-out').textContent=yuan(pv);$('#pv-note').textContent=`共領取 ${N} 期、合計 ${money(p*N)}，其中 ${money(Math.max(0,p*N+F-pv))} 來自投資報酬`;
   $('#pv-xl').textContent=`=PV(${num('pv-rate')}%${f===12?'/12':''},${N},-${p},-${F})`;
   $('#pv-use').dataset.v=pv;}
  // FV
  {const f=freq.fv,i=num('fv-rate')/100/f,N=Math.round(num('fv-years')*f),p=num('fv-pmt'),P0=num('fv-pv');
   const fv=i? P0*Math.pow(1+i,N)+p*(Math.pow(1+i,N)-1)/i : P0+p*N;const prin=P0+p*N,int=fv-prin;
   $('#fv-out').textContent=yuan(fv);
   const pp=fv>0?Math.max(0,prin/fv*100):100;
   $('#fv-split').innerHTML=`<i style="width:${pp}%;background:var(--muted);opacity:.55"></i><i style="width:${100-pp}%;background:var(--jade)"></i>`;
   $('#fv-splitlbl').innerHTML=`<span>投入本金 ${money(prin)}（${Math.round(pp)}%）</span><span style="color:var(--jade)">複利報酬 ${money(int)}（${Math.round(100-pp)}%）</span>`;
   $('#fv-xl').textContent=`=FV(${num('fv-rate')}%${f===12?'/12':''},${N},-${p},-${P0})`;}
  // PMT
  {const i=num('pmt-rate')/100/12,N=Math.round(num('pmt-years')*12),A=num('pmt-a'),B=num('pmt-b');
   if(pmtMode==='save'){
     const k=Math.pow(1+i,N),pm=i?(A-B*k)*i/(k-1):(A-B)/N;
     $('#pmt-out').textContent=yuan(Math.max(0,pm));
     $('#pmt-note').textContent=pm<=0?'目前已有的錢，靠報酬就能達標':`共存 ${N} 期、本金 ${money(B+Math.max(0,pm)*N)}，其餘 ${money(A-B-Math.max(0,pm)*N)} 來自報酬`;
     $('#pmt-xl').textContent=`=PMT(${num('pmt-rate')}%/12,${N},-${B},${A})`;
   }else{
     const pm=i?A*i/(1-Math.pow(1+i,-N)):A/N;
     $('#pmt-out').textContent=yuan(pm);
     $('#pmt-note').textContent=`總繳 ${money(pm*N)}，其中利息 ${money(pm*N-A)}（本息平均攤還）`;
     $('#pmt-xl').textContent=`=PMT(${num('pmt-rate')}%/12,${N},${A})`;
   }}
}
function setPmtMode(m){
  pmtMode=m;$$('[data-mode] button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.m===m));
  if(m==='loan'){$('#pmt-a-lbl').textContent='貸款金額';$('#pmt-b-wrap').hidden=true;$('#pmt-eye').textContent='每月應繳';
    $('#pmt-sub').textContent='例：房貸 800 萬、利率 2.2%、30 年，每月要繳多少';$('#pmt-rate').value=2.2;$('#pmt-years').value=30;$('#pmt-a').value=8000000;}
  else{$('#pmt-a-lbl').textContent='目標金額';$('#pmt-b-wrap').hidden=false;$('#pmt-eye').textContent='每月需存';
    $('#pmt-sub').textContent='例：10 年後要存到 300 萬，每月該存多少';$('#pmt-rate').value=4;$('#pmt-years').value=10;$('#pmt-a').value=3000000;}
  tools();
}

/* ---------- events ---------- */
function renderAll(){renderGoalbar();renderPlan();renderOverview();}
document.addEventListener('input',e=>{
  const k=e.target.dataset&&e.target.dataset.k;
  if(k){const G=cur();G[k]=k==='name'?e.target.value:(e.target.value===''?'':parseFloat(e.target.value));
    if(k==='years'||k==='r'){$$(`[data-k="${k}"]`).forEach(el=>{if(el!==e.target)el.value=e.target.value;});}
    if(k==='years'&&(!G.years||G.years<1))G.years=1;
    G.sample=false;save();renderAll();return;}
  if(e.target.closest('.tool'))tools();
});
document.addEventListener('click',e=>{
  const t=e.target.closest('button');if(!t)return;
  if(t.classList.contains('tab')){$$('.tab').forEach(b=>b.setAttribute('aria-selected',b===t));
    ['plan','tools','all'].forEach(v=>$('#view-'+v).hidden=v!==t.dataset.view);
    if(t.dataset.view==='plan')renderPlan();if(t.dataset.view==='all')renderOverview();return;}
  if(t.dataset.id){state.active=t.dataset.id;save();fillForm();renderAll();return;}
  if(t.id==='addgoal'){const g={...TEMPLATES.custom,id:uid()};state.goals.push(g);state.active=g.id;save();fillForm();renderAll();$('#f-name').focus();return;}
  if(t.dataset.t){const G=cur(),T=TEMPLATES[t.dataset.t];Object.assign(G,{...T,id:G.id,sample:false});save();fillForm();renderAll();return;}
  if(t.id==='del'){if(state.goals.length<2)return;
    if(!t.classList.contains('armed')){t.classList.add('armed');t.textContent='再按一次確認刪除';setTimeout(()=>{t.classList.remove('armed');t.textContent='刪除目標';},3500);return;}
    state.goals=state.goals.filter(g=>g.id!==state.active);state.active=state.goals[0].id;save();fillForm();renderAll();return;}
  if(t.dataset.open){state.active=t.dataset.open;save();fillForm();$('#tab-plan').click();renderAll();window.scrollTo({top:0,behavior:'smooth'});return;}
  const seg=t.closest('.seg');
  if(seg&&seg.dataset.tool){freq[seg.dataset.tool]=+t.dataset.f;seg.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b===t));tools();return;}
  if(seg&&seg.hasAttribute('data-mode')){setPmtMode(t.dataset.m);return;}
  if(t.dataset.copy){const txt=$('#'+t.dataset.copy).textContent;const done=()=>{t.textContent='已複製';setTimeout(()=>t.textContent='複製',1400);};
    try{navigator.clipboard.writeText(txt).then(done,()=>{selectText(t.dataset.copy);});}catch(err){selectText(t.dataset.copy);}return;}
  if(t.id==='pv-use'){const G=cur();G.target=Math.round(+t.dataset.v/1e4);G.sample=false;save();fillForm();$('#tab-plan').click();renderAll();return;}
});
function selectText(id){const r=document.createRange();r.selectNodeContents($('#'+id));const s=getSelection();s.removeAllRanges();s.addRange(r);}

fillForm();renderAll();tools();
})();
