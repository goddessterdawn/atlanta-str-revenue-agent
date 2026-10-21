/* Atlanta STR Revenue Agent — lead-generation & outreach dashboard.
   Persistent storage: artifact shared database when available, localStorage fallback.
   The agent NEVER sends outreach — it drafts, and a human approves. */
"use strict";

/* ===================== 1. Constants ===================== */
const STAGES = ["New","Researching","Qualified","Draft Ready","Awaiting Approval","Approved to Contact","Contacted","Follow-Up Due","Responded","Meeting Requested","Meeting Scheduled","Proposal Sent","Won","Lost","Not Qualified","Do Not Contact"];
const OPEN_STAGES = STAGES.filter(s => !["Won","Lost","Not Qualified","Do Not Contact"].includes(s));
const LEAD_TYPES = ["Airbnb host","Short-term-rental host","Co-host","Vacation-rental property manager","STR management company","Furnished-rental operator","Real-estate operator (STR)","Owner with multiple STR properties","Expanding portfolio operator","Other"];
const CHANNELS = ["Email","LinkedIn","Facebook","Instagram","Phone","Text","Other"];
const SENTIMENTS = ["Positive","Neutral","Negative"];
const MGMT_TYPES = ["Vacation-rental property manager","STR management company","Real-estate operator (STR)","Expanding portfolio operator"];
const INTEGRATIONS = [
  ["email","Email sending","Send approved emails directly from the dashboard"],
  ["crm","CRM sync","Mirror leads into your CRM"],
  ["calendar","Calendar","Create meeting events automatically"],
  ["linkedin","LinkedIn","Send approved LinkedIn messages"],
  ["facebook","Facebook","Send approved Facebook messages"],
  ["instagram","Instagram","Send approved Instagram messages"],
  ["research","Lead-research sources","Paid data sources for lead discovery"],
  ["export","Data export (CSV)","Always available — export any filtered view"]
];
const DEFAULT_SETTINGS = {
  companyName: "[CLEANING COMPANY NAME]",
  serviceArea: "[SERVICE AREA] — Atlanta and approved surrounding metro",
  phone: "[BUSINESS PHONE]", email: "[BUSINESS EMAIL]",
  bookingLink: "[BOOKING LINK]", primaryOffer: "[PRIMARY OFFER]",
  dailyGoal: 20, followupDays: [3,5,7], maxAttempts: 4,
  owners: ["You"],
  approvedCities: "Atlanta, Decatur, Marietta, Smyrna, Sandy Springs, Brookhaven, Dunwoody, Chamblee, Doraville, Tucker, East Point, College Park, Hapeville, Avondale Estates, Scottdale, Stone Mountain, Vinings, Mableton, Roswell, Alpharetta, Kennesaw, Norcross, Duluth, Forest Park, Union City, Kirkwood, Grant Park, Midtown, Buckhead, Old Fourth Ward, West Midtown, Cascade Heights, Sweet Auburn",
  zipLow: 30002, zipHigh: 30364,
  integrations: { email:"not_connected", crm:"not_connected", calendar:"not_connected", linkedin:"not_connected", facebook:"not_connected", instagram:"not_connected", research:"not_connected", export:"available" }
};

/* ===================== 2. Utilities ===================== */
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad2 = n => String(n).padStart(2, "0");
function isoOf(d){ return d.getFullYear()+"-"+pad2(d.getMonth()+1)+"-"+pad2(d.getDate()); }
function todayStr(){ return isoOf(new Date()); }
function parseISO(s){ const [y,m,d] = String(s).split("-").map(Number); return new Date(y, (m||1)-1, d||1); }
function fmtDate(s){ if(!s) return "—"; const d = parseISO(s); return d.toLocaleDateString(undefined,{month:"short",day:"numeric"}) + (d.getFullYear()!==new Date().getFullYear() ? " "+d.getFullYear() : ""); }
function fmtMoney(n){ n = Number(n)||0; return "$" + n.toLocaleString(undefined,{maximumFractionDigits:0}); }
function pct(a,b){ return b>0 ? Math.round(a/b*100)+"%" : "—"; }
function uid(prefix){ return prefix + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function addBusinessDays(fromISO, n){
  const d = parseISO(fromISO || todayStr()); let left = n;
  while(left > 0){ d.setDate(d.getDate()+1); const w=d.getDay(); if(w!==0 && w!==6) left--; }
  return isoOf(d);
}
function nowTime(){ const d=new Date(); return pad2(d.getHours())+":"+pad2(d.getMinutes()); }
function toast(msg){
  const t = document.createElement("div"); t.className="toast"; t.textContent = msg;
  $("#toasts").appendChild(t); setTimeout(()=>t.remove(), 3800);
}
function normKey(s){ return String(s||"").toLowerCase().replace(/[^a-z0-9]/g,""); }
function normPhone(s){ return String(s||"").replace(/\D/g,""); }
function normHost(s){ try{ return new URL(/^https?:/.test(s)?s:"https://"+s).host.replace(/^www\./,""); }catch(e){ return normKey(s); } }
function clip(s, n){ s = String(s||""); if(s.length<=n) return s; const cut = s.slice(0,n-1); const sp = cut.lastIndexOf(" "); return (sp>n*0.6?cut.slice(0,sp):cut)+"…"; }

/* ===================== 3. State ===================== */
let cache = { leads:{}, drafts:{}, activities:{}, settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) };
let scope = "real";            // 'real' | 'sample'
let backend = "connecting";    // 'db' | 'local'
let db = null, aiSample = null, dl = null;
let currentView = "dashboard";
let filters = { q:"", score:"", type:"", stage:"", owner:"", channel:"", fstatus:"", astatus:"", rstatus:"", from:"", to:"", loc:"" };
let sortState = { key:"score", dir:-1 };
let LOCAL = null;

/* ===================== 4. Storage adapter ===================== */
const LS_KEY = "strAgent.v1";
function loadLocal(){
  try{ LOCAL = JSON.parse(localStorage.getItem(LS_KEY)) || null; }catch(e){ LOCAL = null; }
  if(!LOCAL) LOCAL = { leads:{}, drafts:{}, activities:{}, settings:null };
  cache.leads = LOCAL.leads||{}; cache.drafts = LOCAL.drafts||{}; cache.activities = LOCAL.activities||{};
  cache.settings = mergeSettings(LOCAL.settings);
}
function saveLocal(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(LOCAL)); }catch(e){} }
function mergeSettings(stored){
  const s = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  if(stored && typeof stored === "object"){
    Object.assign(s, stored);
    s.integrations = Object.assign({}, DEFAULT_SETTINGS.integrations, stored.integrations||{});
    if(!Array.isArray(s.followupDays)) s.followupDays = DEFAULT_SETTINGS.followupDays.slice();
    if(!Array.isArray(s.owners) || !s.owners.length) s.owners = ["You"];
  }
  return s;
}
async function putDoc(col, id, data){
  if(db){
    try{ await db.collection(col).doc(id).set(data); }
    catch(e){ toast("Save failed: " + (e && e.message || e)); throw e; }
  } else {
    LOCAL[col][id] = data; saveLocal();
    cache[col][id] = data; renderAll();
  }
}
async function delDoc(col, id){
  if(db){
    try{ await db.collection(col).doc(id).delete(); }
    catch(e){ toast("Delete failed: " + (e && e.message || e)); throw e; }
  } else {
    delete LOCAL[col][id]; saveLocal();
    delete cache[col][id]; renderAll();
  }
}
async function saveSettings(){
  if(db){
    try{ await db.doc("meta/settings").set(cache.settings); }
    catch(e){ toast("Settings save failed: " + (e && e.message || e)); }
  } else { LOCAL.settings = cache.settings; saveLocal(); }
  renderAll();
}

/* ===================== 5. Scoring engine ===================== */
function inServiceArea(lead){
  const s = cache.settings;
  const zip = parseInt(String(lead.zip||"").slice(0,5), 10);
  if(!isNaN(zip) && zip >= (s.zipLow||30002) && zip <= (s.zipHigh||30364)) return true;
  const loc = normKey(lead.location);
  if(!loc) return false;
  return String(s.approvedCities||"").split(",").some(c => { c = normKey(c); return c && loc.includes(c); });
}
function hasContact(lead){ return !!(String(lead.email||"").trim() || String(lead.phone||"").trim()); }
function verifiedRecently(lead){
  if(!lead.verified) return false;
  const days = (parseISO(todayStr()) - parseISO(lead.verified)) / 86400000;
  return days <= 30;
}
function computeScore(lead){
  const rows = []; const missing = [];
  const add = (label, pts, max, evidence) => rows.push({label, pts, max, evidence});

  const area = inServiceArea(lead);
  add("Atlanta service area", area?2:0, 2, area ? `${lead.location||""} ${lead.zip||""} is inside the approved area`.trim() : (lead.zip||lead.location ? "Location is outside the approved area" : "No location on record"));
  if(!lead.location && !lead.zip) missing.push("Location / ZIP");

  const ev = String(lead.strEvidence||"").trim(), src = String(lead.sourceLinks||"").trim();
  let evPts = ev && src ? 2 : (ev || src ? 1 : 0);
  add("Active STR operations", evPts, 2, ev ? clip(ev,110) : "No evidence of active short-term-rental activity");
  if(!ev) missing.push("STR activity evidence");
  if(!src) missing.push("Source link");

  const props = Number(lead.propertiesEst)||0;
  const mgmt = MGMT_TYPES.includes(lead.type);
  const multiPts = (mgmt || props>=4) ? 2 : (props>=2 ? 1 : 0);
  add("Multiple properties / mgmt co.", multiPts, 2, mgmt ? `${lead.type}` : (props ? `~${props} properties` : "Door count unknown"));
  if(!props && !mgmt) missing.push("Estimated property count");

  const dm = !!String(lead.decisionMaker||"").trim();
  add("Decision-maker identified", dm?1:0, 1, dm ? `${lead.decisionMaker}${lead.role? " — "+lead.role:""}` : "No decision-maker found yet");
  if(!dm) missing.push("Decision-maker");

  const contact = hasContact(lead), fresh = verifiedRecently(lead);
  add("Verified business contact", (contact && fresh)?1:0, 1, contact ? (fresh ? "Public business contact verified "+fmtDate(lead.verified) : "Contact on file but verification is stale (>30 days)") : "No public business contact method");
  if(!contact) missing.push("Business email or phone");
  else if(!fresh) missing.push("Fresh verification (re-verify)");

  const growth = !!String(lead.growthSignal||"").trim();
  add("Growth / activity signal", growth?1:0, 1, growth ? clip(lead.growthSignal,110) : "No recent growth signal found");

  const need = !!String(lead.needSignal||"").trim();
  add("Visible cleaning/turnover need", need?1:0, 1, need ? clip(lead.needSignal,110) : "No explicit need signal found");

  const total = rows.reduce((a,r)=>a+r.pts,0);
  let disqual = null;
  if(lead.dupStatus === "duplicate") disqual = "Duplicate of an existing lead" + (lead.dupOf ? ` (${lead.dupOf})` : "");
  else if(lead.dnc) disqual = "Opted out — on the do-not-contact list";
  else if(!area && (lead.zip || lead.location)) disqual = "Outside the approved service area";
  else if(!ev) disqual = "No evidence of active short-term-rental operations";
  else if(!contact) disqual = "No verifiable business contact method";
  return { total, rows, missing, disqual };
}
function scoreLabel(n){ return n>=8 ? ["High Priority","hi"] : n>=6 ? ["Qualified","qual"] : n>=4 ? ["Needs More Research","research"] : ["Low Priority","low"]; }
function scoreChip(n){ const cls = n>=8?"s-hi":n>=6?"s-qual":n>=4?"s-research":"s-low"; return `<span class="scorechip ${cls}" title="Lead score ${n}/10">${n}</span>`; }
function countsTowardGoal(lead, sc){
  sc = sc || computeScore(lead);
  return !sc.disqual && lead.dupStatus !== "duplicate";
}
function findDuplicate(lead, excludeId){
  const mine = scopedLeads().filter(l => l.id !== excludeId);
  const em = normKey(lead.email), ph = normPhone(lead.phone), nm = normKey(lead.name), co = normKey(lead.company), ws = lead.website ? normHost(lead.website) : "";
  for(const l of mine){
    if(l.dupStatus === "duplicate") continue;
    if(em && normKey(l.email) === em) return {lead:l, on:"email"};
    if(ph && ph.length>=10 && normPhone(l.phone) === ph) return {lead:l, on:"phone"};
    if(ws && l.website && normHost(l.website) === ws) return {lead:l, on:"website"};
    if(nm && (normKey(l.name) === nm || (co && normKey(l.company) === co))) return {lead:l, on:"name/company"};
  }
  return null;
}

/* ===================== 6. Derived data ===================== */
function isSample(x){ return !!x.sample; }
function scopedLeads(){ return Object.entries(cache.leads).map(([id,l])=>Object.assign({id},l)).filter(l => isSample(l) === (scope==="sample")); }
function scopedDrafts(){ return Object.entries(cache.drafts).map(([id,d])=>Object.assign({id},d)).filter(d => isSample(d) === (scope==="sample")); }
function scopedActs(){ return Object.entries(cache.activities).map(([id,a])=>Object.assign({id},a)).filter(a => isSample(a) === (scope==="sample")); }
function leadById(id){ const l = cache.leads[id]; return l ? Object.assign({id}, l) : null; }
function draftForLead(leadId){ return scopedDrafts().find(d => d.leadId === leadId) || null; }

function isOpen(l){ return !["Won","Lost","Not Qualified","Do Not Contact"].includes(l.stage) && !l.dnc; }
function followupStatus(l){
  if(!l.nextFollowUp || !isOpen(l)) return "";
  const t = todayStr();
  return l.nextFollowUp < t ? "overdue" : l.nextFollowUp === t ? "due" : "scheduled";
}
function computeKPIs(){
  const t = todayStr();
  const leads = scopedLeads(), drafts = scopedDrafts(), acts = scopedActs();
  const withScore = leads.map(l => ({l, sc: computeScore(l)}));
  const newToday = withScore.filter(x => x.l.discovered === t && countsTowardGoal(x.l, x.sc));
  const goal = Number(cache.settings.dailyGoal)||20;
  const hi = withScore.filter(x => x.sc.total >= 8 && !x.sc.disqual);
  const awaiting = drafts.filter(d => d.status==="awaiting" || d.status==="revision");
  const approved = drafts.filter(d => d.status==="approved");
  const dueToday = leads.filter(l => followupStatus(l)==="due");
  const overdue = leads.filter(l => followupStatus(l)==="overdue");
  const replies = acts.filter(a => a.type==="reply");
  const contacted = leads.filter(l => (Number(l.attempts)||0) > 0);
  const replied = leads.filter(l => !!l.responseDate);
  const meetReq = leads.filter(l => l.stage==="Meeting Requested");
  const meetSch = leads.filter(l => l.meetingDate || l.stage==="Meeting Scheduled");
  const proposals = leads.filter(l => Number(l.proposalAmount)>0 || l.stage==="Proposal Sent" || l.proposalStatus);
  const won = leads.filter(l => l.wonLost==="won");
  const pipeline = leads.filter(isOpen).reduce((a,l)=>a + (Number(l.oppValue)||Number(l.proposalAmount)||0), 0);
  const revenue = leads.reduce((a,l)=>a + (Number(l.revenueCollected)||0), 0);
  return { t, leads, drafts, acts, withScore, newToday, goal, hi, awaiting, approved, dueToday, overdue, replies, contacted, replied, meetReq, meetSch, proposals, won, pipeline, revenue };
}

/* ===================== 7. Chart helpers ===================== */
function svgVBar(pts, opts){
  opts = opts||{};
  const W=340, H=opts.h||150, padL=34, padR=6, padT=12, padB=22;
  const max = Math.max(1, ...pts.map(p=>p.value));
  const iw = (W-padL-padR)/Math.max(1,pts.length);
  const y = v => padT + (H-padT-padB) * (1 - v/max);
  let g = "";
  [0, max/2, max].forEach(v=>{
    g += `<line x1="${padL}" y1="${y(v)}" x2="${W-padR}" y2="${y(v)}" stroke="var(--chart-grid)" stroke-width="1"/>`;
    g += `<text x="${padL-5}" y="${y(v)+3}" text-anchor="end" font-size="9" fill="var(--muted)">${v%1?v.toFixed(1):v}</text>`;
  });
  let bars = "";
  pts.forEach((p,i)=>{
    const bw = Math.min(26, iw*0.64), x = padL + iw*i + (iw-bw)/2;
    const by = y(p.value), bh = Math.max(p.value>0?2:0, H-padB-by);
    bars += `<rect x="${x.toFixed(1)}" y="${(p.value>0?by:H-padB-0).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="${p.color||opts.color||"var(--series-1)"}"><title>${esc(p.label)}: ${p.title!=null?esc(p.title):p.value}</title></rect>`;
    if(pts.length<=16 && (pts.length<=10 || i%2===0)){
      bars += `<text x="${(padL+iw*i+iw/2).toFixed(1)}" y="${H-7}" text-anchor="middle" font-size="8.5" fill="var(--muted)">${esc(p.label)}</text>`;
    }
  });
  g += `<line x1="${padL}" y1="${H-padB}" x2="${W-padR}" y2="${H-padB}" stroke="var(--chart-axis)" stroke-width="1"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Bar chart">${g}${bars}</svg>`;
}
function svgGrouped(groups, series, colors){
  const W=340, H=160, padL=34, padR=6, padT=12, padB=22;
  const max = Math.max(1, ...groups.flatMap(gp=>gp.values));
  const gw = (W-padL-padR)/Math.max(1,groups.length);
  const y = v => padT + (H-padT-padB)*(1-v/max);
  let g = "";
  [0, max/2, max].forEach(v=>{
    g += `<line x1="${padL}" y1="${y(v)}" x2="${W-padR}" y2="${y(v)}" stroke="var(--chart-grid)"/>`;
    g += `<text x="${padL-5}" y="${y(v)+3}" text-anchor="end" font-size="9" fill="var(--muted)">${Math.round(v)}</text>`;
  });
  groups.forEach((gp,i)=>{
    const bw = Math.min(14, gw/(series.length+1));
    gp.values.forEach((v,si)=>{
      const x = padL + gw*i + gw/2 - (bw*series.length)/2 + bw*si;
      g += `<rect x="${x.toFixed(1)}" y="${y(v).toFixed(1)}" width="${(bw-2).toFixed(1)}" height="${Math.max(v>0?2:0,(H-padB-y(v))).toFixed(1)}" rx="2.5" fill="${colors[si]}"><title>${esc(gp.label)} — ${esc(series[si])}: ${v}</title></rect>`;
    });
    g += `<text x="${(padL+gw*i+gw/2).toFixed(1)}" y="${H-7}" text-anchor="middle" font-size="8.5" fill="var(--muted)">${esc(gp.label)}</text>`;
  });
  g += `<line x1="${padL}" y1="${H-padB}" x2="${W-padR}" y2="${H-padB}" stroke="var(--chart-axis)"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Grouped bar chart">${g}</svg>`;
}
function hbarHTML(pts, opts){
  opts = opts||{};
  const max = Math.max(1, ...pts.map(p=>p.value));
  if(!pts.length) return `<div class="chart-note">No data yet in this scope.</div>`;
  return pts.map(p=>`
    <div style="display:flex;align-items:center;gap:8px;margin:5px 0" title="${esc(p.label)}: ${p.title!=null?esc(p.title):p.value}">
      <span style="width:118px;font-size:11.5px;color:var(--ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(p.label)}">${esc(p.label)}</span>
      <span style="flex:1;background:var(--surface-2);border-radius:4px;height:14px;overflow:hidden"><i style="display:block;height:100%;border-radius:4px;width:${Math.max(2,p.value/max*100)}%;background:${p.color||opts.color||"var(--series-1)"}"></i></span>
      <span class="num" style="width:58px;text-align:right;font-size:11.5px;font-weight:600">${p.title!=null?esc(p.title):p.value}</span>
    </div>`).join("");
}
function chartCard(title, body, note){
  return `<div class="card"><h3>${esc(title)}</h3>${body}${note?`<div class="chart-note">${esc(note)}</div>`:""}</div>`;
}

/* ===================== 8. Rendering ===================== */
function renderAll(){
  const s = cache.settings;
  $("#brandCompany").textContent = s.companyName + " · Airbnb & STR turnover cleaning · " + s.serviceArea;
  $("#sampBanner").hidden = scope !== "sample";
  $("#scopeReal").classList.toggle("on", scope==="real");
  const sb = $("#scopeSample");
  sb.classList.toggle("on", scope==="sample"); sb.classList.toggle("sample-on", scope==="sample");
  const q = scopedDrafts().filter(d=>d.status==="awaiting"||d.status==="revision").length;
  $("#queueBadge").hidden = q===0; $("#queueBadge").textContent = q;
  const fns = { dashboard: renderDashboard, leads: renderLeads, pipeline: renderPipeline, queue: renderQueue, reports: renderReport, revenue: renderRevenue, settings: renderSettings };
  (fns[currentView]||renderDashboard)();
}
function switchView(v){
  currentView = v;
  $$(".nav button").forEach(b => b.classList.toggle("on", b.dataset.view===v));
  $$(".view").forEach(el => el.classList.toggle("on", el.id === "view-"+v));
  renderAll();
  window.scrollTo({top:0});
}

/* ---------- Dashboard ---------- */
function renderDashboard(){
  const k = computeKPIs();
  const goalPct = Math.min(100, Math.round(k.newToday.length / k.goal * 100));
  const kpis = [
    {v:k.newToday.length, l:"New qualified leads today", cls:"goal", extra:`<div class="goalbar"><i style="width:${goalPct}%"></i></div><div class="sub num">${goalPct}% of daily goal (${k.goal})</div>`},
    {v:k.hi.length, l:"Leads scoring 8+", sub:"High Priority"},
    {v:k.awaiting.length, l:"Drafts awaiting approval"},
    {v:k.approved.length, l:"Approved — ready to send"},
    {v:k.dueToday.length, l:"Follow-ups due today"},
    {v:k.overdue.length, l:"Overdue follow-ups", cls:k.overdue.length?"alert":""},
    {v:k.replies.length, l:"Replies received"},
    {v:k.meetReq.length, l:"Meetings requested"},
    {v:k.meetSch.length, l:"Meetings scheduled"},
    {v:k.proposals.length, l:"Proposals sent"},
    {v:k.won.length, l:"Opportunities won"},
    {v:fmtMoney(k.pipeline), l:"Estimated pipeline", sub:"never counted as revenue"},
    {v:fmtMoney(k.revenue), l:"Revenue collected"},
    {v:pct(k.replied.length, k.contacted.length), l:"Reply rate", sub:`${k.replied.length}/${k.contacted.length} contacted`},
    {v:pct(k.meetSch.length, k.replied.length), l:"Meeting conversion", sub:"of replies"},
    {v:pct(k.won.length, k.contacted.length), l:"Lead → customer", sub:"of contacted"}
  ];
  $("#kpis").innerHTML = kpis.map(x=>`<div class="kpi ${x.cls||""}"><div class="v num">${x.v}</div><div class="l">${esc(x.l)}</div>${x.sub?`<div class="sub">${esc(x.sub)}</div>`:""}${x.extra||""}</div>`).join("");

  // priorities
  const t = todayStr();
  const review = k.withScore.filter(x => ["New","Researching"].includes(x.l.stage) && !x.l.dnc);
  const needReply = k.leads.filter(l => l.stage==="Responded");
  const meetPrep = k.leads.filter(l => l.meetingDate && l.meetingDate >= t && parseISO(l.meetingDate) - parseISO(t) <= 3*86400000);
  const missing = k.withScore.filter(x => x.sc.missing.length && isOpen(x.l) && x.l.dupStatus!=="duplicate");
  const item = (l, sub, badge) => `<li><span>${esc(l.name)}</span>${badge||""}<span class="sub" style="color:var(--muted);font-size:11px">${esc(sub||"")}</span><button class="btn small" data-open-lead="${esc(l.id)}">Open</button></li>`;
  const plist = (arr, fn) => arr.length ? `<ul>${arr.slice(0,6).map(fn).join("")}</ul>${arr.length>6?`<div class="sub" style="color:var(--muted);font-size:11px;margin-top:4px">+${arr.length-6} more</div>`:""}` : `<div class="empty">Nothing here — all clear.</div>`;
  const cardsHTML = [
    ["Leads requiring review", plist(review.map(x=>x.l), l=>item(l, l.stage))],
    ["Drafts awaiting approval", k.awaiting.length ? `<ul>${k.awaiting.slice(0,6).map(d=>{const l=leadById(d.leadId);return `<li><span>${esc(l?l.name:d.leadId)}</span><button class="btn small" data-goto-queue="1">Review</button></li>`;}).join("")}</ul>` : `<div class="empty">Queue is empty.</div>`],
    ["Follow-ups due today", plist(k.dueToday, l=>item(l, l.lastContactChannel?("last: "+l.lastContactChannel):"", `<span class="badge due">due</span>`))],
    ["Overdue actions", plist(k.overdue, l=>item(l, "was due "+fmtDate(l.nextFollowUp), `<span class="badge overdue">overdue</span>`))],
    ["Replies needing a response", plist(needReply, l=>item(l, clip(l.responseSummary,40)))],
    ["Meetings to prepare", plist(meetPrep, l=>item(l, fmtDate(l.meetingDate)))],
    ["Leads missing information", plist(missing.map(x=>x.l), l=>{const sc=computeScore(l);return item(l, sc.missing.slice(0,2).join(", "), `<span class="badge miss">gap</span>`);})]
  ];
  $("#priorities").innerHTML = cardsHTML.map(([title, body])=>`<div class="card"><h3>${esc(title)}</h3>${body}</div>`).join("");

  renderCharts(k);
}
function renderCharts(k){
  // 1 leads by day
  const days = []; for(let i=13;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); days.push(isoOf(d)); }
  const byDay = days.map(d=>({label: d.slice(5).replace("-","/"), value: k.leads.filter(l=>l.discovered===d).length}));
  // 2 by score
  const byScore = []; for(let s=1;s<=10;s++) byScore.push({label:String(s), value: k.withScore.filter(x=>x.sc.total===s).length});
  // 3 by type / 4 stage / 5 source
  const countBy = (arr, key) => { const m={}; arr.forEach(x=>{const v=x[key]||"—"; m[v]=(m[v]||0)+1;}); return Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([label,value])=>({label,value})); };
  const byType = countBy(k.leads,"type"), bySource = countBy(k.leads,"source");
  const byStage = STAGES.map(s=>({label:s, value:k.leads.filter(l=>l.stage===s).length})).filter(p=>p.value>0);
  // 6/7 outreach & replies by channel
  const outCh = countBy(k.acts.filter(a=>a.type==="contact"),"channel");
  const repCh = countBy(k.acts.filter(a=>a.type==="reply"),"channel");
  // 8 meetings & sales by month (6 months)
  const months = []; for(let i=5;i>=0;i--){ const d=new Date(); d.setMonth(d.getMonth()-i,1); months.push({key:d.getFullYear()+"-"+pad2(d.getMonth()+1), label:d.toLocaleDateString(undefined,{month:"short"})}); }
  const meetByM = months.map(m=>({label:m.label, values:[
    k.leads.filter(l=>(l.meetingDate||"").startsWith(m.key)).length,
    k.leads.filter(l=>l.wonLost==="won" && (l.wonLostDate||"").startsWith(m.key)).length
  ]}));
  // 9 money
  const money = [
    {label:"Pipeline (est.)", value:k.pipeline, title:fmtMoney(k.pipeline), color:"var(--series-1)"},
    {label:"Collected revenue", value:k.revenue, title:fmtMoney(k.revenue), color:"var(--series-3)"}
  ];
  $("#charts").innerHTML = [
    chartCard("Leads generated by day", svgVBar(byDay), "Last 14 days"),
    chartCard("Leads by score", svgVBar(byScore, {color:"var(--series-1)"}), "Score 8+ enters outreach drafting"),
    chartCard("Leads by type", hbarHTML(byType)),
    chartCard("Leads by pipeline stage", hbarHTML(byStage)),
    chartCard("Leads by source", hbarHTML(bySource)),
    chartCard("Outreach sent by channel", hbarHTML(outCh)),
    chartCard("Replies by channel", hbarHTML(repCh, {color:"var(--series-3)"})),
    `<div class="card"><h3>Meetings &amp; wins by month</h3><div class="legend"><span><i style="background:var(--series-1)"></i>Meetings</span><span><i style="background:var(--series-2)"></i>Opportunities won</span></div>${svgGrouped(meetByM, ["Meetings","Won"], ["var(--series-1)","var(--series-2)"])}</div>`,
    chartCard("Pipeline vs collected revenue", hbarHTML(money), "Estimated pipeline is never counted as collected revenue")
  ].join("");
}

/* ---------- Leads table ---------- */
const LEAD_COLS = [
  ["score","Score"],["name","Lead"],["type","Type"],["location","Location"],["stage","Stage"],["owner","Owner"],["nextFollowUp","Follow-up"],["attempts","Att."],["oppValue","Est. value"],["flags","Flags"]
];
function leadMatches(l, sc){
  const f = filters, t = todayStr();
  if(f.q){
    const hay = [l.name,l.company,l.decisionMaker,l.location,l.email,l.notes,l.type,l.fitReason].join(" ").toLowerCase();
    if(!hay.includes(f.q.toLowerCase())) return false;
  }
  if(f.score==="8" && sc.total<8) return false;
  if(f.score==="6" && sc.total<6) return false;
  if(f.score==="lt6" && sc.total>=6) return false;
  if(f.type && l.type!==f.type) return false;
  if(f.stage && l.stage!==f.stage) return false;
  if(f.owner && (l.owner||"Unassigned")!==f.owner) return false;
  if(f.channel && l.recChannel!==f.channel) return false;
  if(f.fstatus){
    const st = followupStatus(l) || "none";
    if(f.fstatus!==st) return false;
  }
  if(f.astatus){
    const d = draftForLead(l.id);
    const st = d ? d.status : "none";
    if(f.astatus==="awaiting" && !(st==="awaiting"||st==="revision")) return false;
    if(f.astatus==="approved" && st!=="approved") return false;
    if(f.astatus==="sent" && st!=="sent") return false;
    if(f.astatus==="none" && d) return false;
  }
  if(f.rstatus==="won" && l.wonLost!=="won") return false;
  if(f.rstatus==="lost" && l.wonLost!=="lost") return false;
  if(f.rstatus==="pipeline" && !(isOpen(l) && (Number(l.oppValue)||Number(l.proposalAmount)))) return false;
  if(f.from && (l.discovered||"") < f.from) return false;
  if(f.to && (l.discovered||"") > f.to) return false;
  if(f.loc && !String(l.location+" "+l.zip).toLowerCase().includes(f.loc.toLowerCase())) return false;
  return true;
}
function renderLeads(){
  const owners = Array.from(new Set(scopedLeads().map(l=>l.owner||"Unassigned")));
  const sel = (id,label,opts,val) => `<div class="f"><label for="${id}">${label}</label><select id="${id}">${opts.map(o=>`<option value="${esc(o[0])}" ${o[0]===val?"selected":""}>${esc(o[1])}</option>`).join("")}</select></div>`;
  $("#leadFilters").innerHTML = [
    sel("f-score","Score",[["","Any"],["8","8+ High"],["6","6+"],["lt6","Below 6"]],filters.score),
    sel("f-type","Type",[["","All types"]].concat(LEAD_TYPES.map(t=>[t,t])),filters.type),
    sel("f-stage","Stage",[["","All stages"]].concat(STAGES.map(s=>[s,s])),filters.stage),
    sel("f-owner","Owner",[["","Anyone"]].concat(owners.map(o=>[o,o])),filters.owner),
    sel("f-channel","Channel",[["","Any"]].concat(CHANNELS.map(c=>[c,c])),filters.channel),
    sel("f-fstatus","Follow-up",[["","Any"],["due","Due today"],["overdue","Overdue"],["scheduled","Scheduled"],["none","None"]],filters.fstatus),
    sel("f-astatus","Outreach",[["","Any"],["awaiting","Awaiting approval"],["approved","Approved"],["sent","Sent"],["none","No draft"]],filters.astatus),
    sel("f-rstatus","Revenue",[["","Any"],["won","Won"],["lost","Lost"],["pipeline","Has pipeline value"]],filters.rstatus),
    `<div class="f"><label for="f-from">Discovered from</label><input type="date" id="f-from" value="${esc(filters.from)}"></div>`,
    `<div class="f"><label for="f-to">to</label><input type="date" id="f-to" value="${esc(filters.to)}"></div>`,
    `<div class="f"><label for="f-loc">Location</label><input id="f-loc" placeholder="City or ZIP" value="${esc(filters.loc)}" style="width:110px"></div>`,
    `<button class="btn small" id="f-clear">Clear</button>`
  ].join("");
  $$("#leadFilters select, #leadFilters input").forEach(el=>{
    el.addEventListener("change", ()=>{ filters[el.id.replace("f-","")] = el.value; renderLeads(); });
  });
  $("#f-clear").onclick = ()=>{ filters = { q:filters.q, score:"",type:"",stage:"",owner:"",channel:"",fstatus:"",astatus:"",rstatus:"",from:"",to:"",loc:"" }; renderLeads(); };

  let rows = scopedLeads().map(l=>({l, sc:computeScore(l)})).filter(x=>leadMatches(x.l,x.sc));
  const key = sortState.key, dir = sortState.dir;
  rows.sort((a,b)=>{
    const va = key==="score"?a.sc.total : key==="flags"?0 : (a.l[key] ?? "");
    const vb = key==="score"?b.sc.total : key==="flags"?0 : (b.l[key] ?? "");
    if(typeof va==="number"||typeof vb==="number") return ((Number(va)||0)-(Number(vb)||0))*dir;
    return String(va).localeCompare(String(vb))*dir;
  });
  $("#leadTable thead").innerHTML = "<tr>" + LEAD_COLS.map(([k2,lab])=>`<th data-sort="${k2}">${lab}${sortState.key===k2?(dir>0?" ▲":" ▼"):""}</th>`).join("") + "</tr>";
  $$("#leadTable th").forEach(th=>th.onclick=()=>{
    const k2 = th.dataset.sort;
    if(sortState.key===k2) sortState.dir*=-1; else sortState={key:k2,dir:k2==="score"?-1:1};
    renderLeads();
  });
  $("#leadTable tbody").innerHTML = rows.map(({l,sc})=>{
    const fs = followupStatus(l);
    const flags = [
      l.sample?`<span class="badge sample">Sample Data</span>`:"",
      l.dupStatus==="duplicate"?`<span class="badge dup">duplicate</span>`:"",
      l.dnc?`<span class="badge dnc">do not contact</span>`:"",
      sc.missing.length&&isOpen(l)?`<span class="badge miss" title="${esc(sc.missing.join(", "))}">missing info</span>`:"",
      l.wonLost==="won"?`<span class="badge won">won</span>`:"",
      l.wonLost==="lost"?`<span class="badge lost">lost</span>`:"",
      (draftForLead(l.id)||{}).status==="awaiting"?`<span class="badge await">awaiting approval</span>`:"",
      (draftForLead(l.id)||{}).status==="approved"?`<span class="badge approved">approved</span>`:""
    ].filter(Boolean).join(" ");
    return `<tr data-open-lead="${esc(l.id)}">
      <td>${scoreChip(sc.total)}</td>
      <td><b>${esc(l.name)}</b><div class="sub">${esc(l.decisionMaker||"")}${l.decisionMaker&&l.company&&l.company!==l.name?" · ":""}${esc(l.company&&l.company!==l.name?l.company:"")}</div></td>
      <td>${esc(l.type||"—")}</td>
      <td>${esc(l.location||"—")}<div class="sub">${esc(l.zip||"")}</div></td>
      <td><span class="badge stage">${esc(l.stage)}</span></td>
      <td>${esc(l.owner||"Unassigned")}</td>
      <td class="num">${fs==="due"?`<span class="badge due">today</span>`:fs==="overdue"?`<span class="badge overdue">${fmtDate(l.nextFollowUp)}</span>`:fmtDate(l.nextFollowUp)}</td>
      <td class="num">${l.attempts||0}</td>
      <td class="num">${(Number(l.oppValue)||Number(l.proposalAmount))?fmtMoney(l.oppValue||l.proposalAmount):"—"}</td>
      <td>${flags}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="10" style="color:var(--muted);padding:24px;text-align:center">No leads match. ${scope==="sample"?"Click “Reset sample data” in the banner above to load the demo dataset.":"Add a lead or import a CSV to get started."}</td></tr>`;
  $("#leadCount").textContent = rows.length + " lead" + (rows.length===1?"":"s") + (filters.q?` matching “${filters.q}”`:"");
}

/* ---------- Pipeline (kanban) ---------- */
function renderPipeline(){
  const leads = scopedLeads();
  $("#kanban").innerHTML = STAGES.map(st=>{
    const ls = leads.filter(l=>l.stage===st);
    return `<div class="kcol" data-stage="${esc(st)}"><h4>${esc(st)} <span class="num">${ls.length}</span></h4>
      ${ls.map(l=>{
        const sc = computeScore(l); const fs = followupStatus(l);
        return `<div class="kcard" draggable="true" data-lead="${esc(l.id)}">
          <div class="n">${esc(l.name)}</div>
          <div class="m">${scoreChip(sc.total)} ${l.sample?'<span class="badge sample">Sample</span>':""} ${fs==="due"?'<span class="badge due">due</span>':fs==="overdue"?'<span class="badge overdue">overdue</span>':""} ${l.dnc?'<span class="badge dnc">DNC</span>':""}</div>
        </div>`;
      }).join("")}
    </div>`;
  }).join("");
  $$("#kanban .kcard").forEach(c=>{
    c.addEventListener("dragstart", e=>{ e.dataTransfer.setData("text/plain", c.dataset.lead); });
    c.addEventListener("click", ()=>openLead(c.dataset.lead));
  });
  $$("#kanban .kcol").forEach(col=>{
    col.addEventListener("dragover", e=>{ e.preventDefault(); col.classList.add("dragover"); });
    col.addEventListener("dragleave", ()=>col.classList.remove("dragover"));
    col.addEventListener("drop", async e=>{
      e.preventDefault(); col.classList.remove("dragover");
      const id = e.dataTransfer.getData("text/plain"); const l = leadById(id);
      if(!l || l.stage===col.dataset.stage) return;
      await setStage(l, col.dataset.stage, "drag-and-drop");
    });
  });
}
async function setStage(l, stage, how){
  const from = l.stage; l.stage = stage;
  if(stage==="Do Not Contact") { l.dnc = true; l.nextFollowUp=""; }
  await putDoc("leads", l.id, stripId(l));
  await logAudit(l.id, `Stage changed ${from} → ${stage}` + (how?` (${how})`:""), l.sample);
  toast(`${l.name}: ${from} → ${stage}`);
}

/* ---------- Approval Queue ---------- */
function renderQueue(){
  const drafts = scopedDrafts().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  const groups = [
    ["Awaiting approval", drafts.filter(d=>d.status==="awaiting"||d.status==="revision")],
    ["On hold", drafts.filter(d=>d.status==="hold")],
    ["Approved — ready to send", drafts.filter(d=>d.status==="approved")],
    ["Recently sent", drafts.filter(d=>d.status==="sent").slice(0,5)],
    ["Rejected", drafts.filter(d=>d.status==="rejected").slice(0,3)]
  ];
  const connected = Object.values(cache.settings.integrations).some(v=>v==="connected");
  $("#queueList").innerHTML = `
    <div class="notice">Sending integrations are ${connected?"partially configured":"<b>Not Connected</b>"} — approved messages can be <b>copied</b> and sent manually, then marked as sent. The agent never sends anything on its own, and it never pretends a message was sent.</div>
    ${groups.map(([title, ds])=> ds.length ? `<h3 style="margin:16px 0 8px">${title} (${ds.length})</h3>` + ds.map(renderQCard).join("") : "").join("") || ""}
    ${drafts.length? "" : `<div class="card" style="text-align:center;color:var(--muted)">No drafts yet. Open a lead scoring 8 or higher and choose “Generate outreach drafts”.</div>`}`;
  bindQueueActions();
}
function renderQCard(d){
  const l = leadById(d.leadId); if(!l) return "";
  const sc = computeScore(l);
  const chans = [["email","Email"],["linkedin","LinkedIn"],["facebook","Facebook"],["instagram","Instagram"],["followup1","Follow-up 1"],["followup2","Follow-up 2"],["call","Call opening"]];
  const statusBadge = {awaiting:'<span class="badge await">awaiting approval</span>', revision:'<span class="badge await">revision requested</span>', hold:'<span class="badge stage">on hold</span>', approved:'<span class="badge approved">approved</span>', sent:'<span class="badge sent">sent</span>', rejected:'<span class="badge lost">rejected</span>'}[d.status]||"";
  const actions = {
    awaiting: `<button class="btn primary" data-q="approve">✓ Approve</button><button class="btn" data-q="edit">Edit</button><button class="btn" data-q="revise">Request revision</button><button class="btn" data-q="hold">Hold</button><button class="btn danger" data-q="reject">Reject</button><button class="btn danger" data-q="dnc">Do not contact</button>`,
    revision: `<button class="btn primary" data-q="edit">Edit &amp; resubmit</button><button class="btn danger" data-q="reject">Reject</button>`,
    hold: `<button class="btn primary" data-q="resume">Resume review</button><button class="btn" data-q="edit">Edit</button><button class="btn danger" data-q="reject">Reject</button>`,
    approved: `<button class="btn primary" data-q="sent">Mark as sent…</button><button class="btn" data-q="copy">Copy message</button><button class="btn" data-q="edit">Edit (returns to queue)</button><button class="btn" data-q="hold">Hold</button>`,
    sent: `<button class="btn" data-q="copy">Copy message</button>`,
    rejected: `<button class="btn" data-q="resume">Reopen</button>`
  }[d.status]||"";
  return `<div class="card qcard" data-draft="${esc(d.id)}">
    <div class="qhead">${scoreChip(sc.total)}<span class="n">${esc(l.name)}</span>${statusBadge}${l.sample?'<span class="badge sample">Sample Data</span>':""}${d.editedAfterApproval?'<span class="badge await" title="This draft was edited after approval and must be re-approved">re-approval needed</span>':""}</div>
    <div class="qmeta">
      <span><b>Fit:</b> ${esc(l.fitReason||"—")}</span>
      <span><b>Score:</b> ${sc.rows.filter(r=>r.pts>0).map(r=>r.label+" +"+r.pts).join(" · ")}</span>
    </div>
    <div class="qmeta">
      <span><b>Channel:</b> ${esc(l.recChannel||"Email")}</span>
      <span><b>Send:</b> ${fmtDate(d.recommendedSend)}</span>
      <span><b>Follow-up:</b> ${fmtDate(d.recommendedFollowUp)}</span>
      ${d.supportingSource?`<span><b>Source:</b> <a href="${esc(d.supportingSource)}" target="_blank" rel="noopener">${esc(clip(d.supportingSource,40))}</a></span>`:""}
      ${d.approvedBy?`<span><b>Approved by:</b> ${esc(d.approvedBy)}</span>`:""}
      ${d.revisionNote?`<span style="color:var(--serious-text)"><b>Revision note:</b> ${esc(d.revisionNote)}</span>`:""}
    </div>
    <div class="chantabs">${chans.map(([k2,lab],i)=>`<button data-chan="${k2}" class="${i===0?"on":""}">${lab}</button>`).join("")}</div>
    <div class="draftbody" data-body>${draftBodyHTML(d,"email")}</div>
    <div class="qactions">${actions}</div>
  </div>`;
}
function draftBodyHTML(d, chan){
  const c = (d.channels||{})[chan];
  if(!c || (typeof c==="object" && !c.body && !c.subject) || c==="") return `<span style="color:var(--muted)">No draft for this channel.</span>`;
  if(typeof c === "object") return (c.subject?`<div class="subj">Subject: ${esc(c.subject)}</div>`:"") + esc(c.body||"");
  return esc(c);
}
function draftPlain(d, chan){
  const c = (d.channels||{})[chan];
  if(!c) return "";
  return typeof c==="object" ? (c.subject?("Subject: "+c.subject+"\n\n"):"")+(c.body||"") : c;
}
function bindQueueActions(){
  $$("#queueList .qcard").forEach(card=>{
    const d = Object.assign({id:card.dataset.draft}, cache.drafts[card.dataset.draft]);
    let activeChan = "email";
    $$(".chantabs button", card).forEach(b=>b.onclick=()=>{
      activeChan = b.dataset.chan;
      $$(".chantabs button", card).forEach(x=>x.classList.toggle("on",x===b));
      $("[data-body]", card).innerHTML = draftBodyHTML(d, activeChan);
    });
    $$("[data-q]", card).forEach(b=>b.onclick=()=>queueAction(d.id, b.dataset.q, ()=>activeChan));
  });
}
async function queueAction(draftId, action, getChan){
  const d = Object.assign({id:draftId}, cache.drafts[draftId]);
  const l = leadById(d.leadId);
  if(action==="approve"){
    d.status="approved"; d.approvedBy="Owner"; d.approvedAt=todayStr(); d.editedAfterApproval=false;
    if(l && ["New","Researching","Qualified","Draft Ready","Awaiting Approval"].includes(l.stage)){ l.stage="Approved to Contact"; await putDoc("leads",l.id,stripId(l)); }
    await putDoc("drafts", d.id, stripId(d));
    await logAudit(d.leadId, "Outreach approved by Owner", d.sample);
    toast("Approved — ready to send.");
  } else if(action==="reject"){
    d.status="rejected"; await putDoc("drafts", d.id, stripId(d));
    await logAudit(d.leadId, "Outreach draft rejected", d.sample);
    toast("Draft rejected.");
  } else if(action==="revise"){
    openPrompt("Request revision", "What should change?", async note=>{
      d.status="revision"; d.revisionNote=note; await putDoc("drafts", d.id, stripId(d));
      await logAudit(d.leadId, "Revision requested: "+note, d.sample);
    });
  } else if(action==="hold"){
    d.status="hold"; await putDoc("drafts", d.id, stripId(d)); toast("Placed on hold.");
  } else if(action==="resume"){
    d.status="awaiting"; await putDoc("drafts", d.id, stripId(d)); toast("Back in the approval queue.");
  } else if(action==="edit"){
    openDraftEditor(d);
  } else if(action==="copy"){
    const chan = getChan ? getChan() : "email";
    const txt = fillPlaceholders(draftPlain(d, chan), cache.settings);
    try{ await navigator.clipboard.writeText(txt); toast("Copied "+chan+" message."); }
    catch(e){ openCopyModal("Copy message", txt); }
  } else if(action==="sent"){
    openMarkSent(d);
  } else if(action==="dnc"){
    if(l) await markDNC(l);
    d.status="rejected"; await putDoc("drafts", d.id, stripId(d));
  }
}

/* ---------- Daily report ---------- */
function renderReport(){
  const inp = $("#reportDate"); if(!inp.value) inp.value = todayStr();
  const date = inp.value;
  const leads = scopedLeads(), drafts = scopedDrafts(), acts = scopedActs();
  const found = leads.filter(l=>l.discovered===date);
  const scored = found.map(l=>({l, sc:computeScore(l)}));
  const accepted = scored.filter(x=>countsTowardGoal(x.l,x.sc));
  const rejected = scored.filter(x=>!countsTowardGoal(x.l,x.sc));
  const dupPrevented = found.filter(l=>l.dupStatus==="duplicate");
  const draftsCreated = drafts.filter(d=>isoOf(new Date(d.createdAt||0))===date);
  const sentToday = acts.filter(a=>a.type==="contact" && a.date===date);
  const repliesToday = acts.filter(a=>a.type==="reply" && a.date===date);
  const posReplies = leads.filter(l=>l.responseDate===date && l.sentiment==="Positive");
  const meetsToday = acts.filter(a=>a.type==="meeting" && a.date===date);
  const propsToday = acts.filter(a=>a.type==="proposal" && a.date===date);
  const wonToday = leads.filter(l=>l.wonLostDate===date && l.wonLost==="won");
  const k = computeKPIs();
  const problems = [];
  k.overdue.forEach(l=>problems.push(`Overdue follow-up: ${l.name} (was due ${fmtDate(l.nextFollowUp)})`));
  scopedLeads().filter(l=>isOpen(l)&&computeScore(l).missing.length&&l.dupStatus!=="duplicate").forEach(l=>problems.push(`Missing info: ${l.name} — ${computeScore(l).missing.join(", ")}`));
  leads.filter(l=>l.stage==="Responded").forEach(l=>problems.push(`Reply needs a human response: ${l.name}`));
  if(k.approved.length && cache.settings.integrations.email!=="connected") problems.push(`${k.approved.length} approved message(s) ready — email integration is Not Connected, so copy & send manually, then mark as sent.`);

  const ri = (l,v)=>`<div class="ri"><span>${esc(l)}</span><b class="num">${v}</b></div>`;
  $("#reportBody").innerHTML = `
    <div class="card">
      <h3>Agent report — ${fmtDate(date)} ${scope==="sample"?'<span class="badge sample">Sample Data</span>':""}</h3>
      <div class="rpt-grid">
        ${ri("Leads researched (added)", found.length)}
        ${ri("Accepted as qualified", accepted.length)}
        ${ri("Rejected / disqualified", rejected.length)}
        ${ri("Duplicates prevented", dupPrevented.length)}
        ${ri("New qualified leads", accepted.length)}
        ${ri("Scoring 8 or higher", scored.filter(x=>x.sc.total>=8&&!x.sc.disqual).length)}
        ${ri("Drafts created", draftsCreated.length)}
        ${ri("Drafts awaiting approval (now)", k.awaiting.length)}
        ${ri("Messages approved (now ready)", k.approved.length)}
        ${ri("Messages marked as sent", sentToday.length)}
        ${ri("Follow-ups due", k.dueToday.length)}
        ${ri("Overdue follow-ups", k.overdue.length)}
        ${ri("Replies received", repliesToday.length)}
        ${ri("Positive replies", posReplies.length)}
        ${ri("Meetings requested", leads.filter(l=>l.stage==="Meeting Requested").length)}
        ${ri("Meetings scheduled", meetsToday.length)}
        ${ri("Proposals sent", propsToday.length)}
        ${ri("Opportunities won", wonToday.length)}
        ${ri("Estimated pipeline", fmtMoney(k.pipeline))}
        ${ri("Revenue collected (total)", fmtMoney(k.revenue))}
      </div>
      ${rejected.length?`<h3 style="margin:12px 0 6px">Why records were rejected</h3><ul style="margin:0;padding-left:18px;font-size:13px">${rejected.map(x=>`<li><b>${esc(x.l.name)}</b> — ${esc(x.sc.disqual||"did not meet the quality bar")}</li>`).join("")}</ul>`:""}
      <h3 style="margin:14px 0 6px">Problems requiring human attention (${problems.length})</h3>
      ${problems.length?`<ul style="margin:0;padding-left:18px;font-size:13px">${problems.map(p=>`<li>${esc(p)}</li>`).join("")}</ul>`:`<div style="color:var(--muted);font-size:13px">None — all clear.</div>`}
    </div>`;
}
function reportText(){
  const tmp = $("#reportBody").innerText;
  return "ATLANTA STR REVENUE AGENT — DAILY REPORT\nScope: " + (scope==="sample"?"SAMPLE DATA":"Real data") + "\n\n" + tmp;
}

/* ---------- Revenue ---------- */
function renderRevenue(){
  const leads = scopedLeads();
  const opps = leads.filter(l=>Number(l.oppValue)||Number(l.proposalAmount)||l.wonLost||Number(l.revenueCollected));
  const k = computeKPIs();
  const wonLeads = leads.filter(l=>l.wonLost==="won");
  const avgDays = wonLeads.length ? Math.round(wonLeads.reduce((a,l)=>a+((parseISO(l.wonLostDate||todayStr())-parseISO(l.discovered||todayStr()))/86400000),0)/wonLeads.length) : null;
  const tile = (v,l,sub)=>`<div class="kpi"><div class="v num">${v}</div><div class="l">${esc(l)}</div>${sub?`<div class="sub">${esc(sub)}</div>`:""}</div>`;
  $("#revenueBody").innerHTML = `
    <div class="kpis">
      ${tile(fmtMoney(k.pipeline),"Estimated pipeline value","open opportunities — not revenue")}
      ${tile(fmtMoney(wonLeads.reduce((a,l)=>a+(Number(l.contractValue)||0),0)),"Won contract value")}
      ${tile(fmtMoney(k.revenue),"Collected revenue","agent-assisted workflow")}
      ${tile(avgDays==null?"—":avgDays+"d","Avg. discovery → win")}
    </div>
    <div class="notice">Pipeline is an estimate and is <b>never</b> counted as collected revenue. Revenue appears here only after you record a collected amount on a won lead.</div>
    <div class="tablewrap"><table><thead><tr><th>Lead</th><th>Source</th><th>Discovered</th><th>First contact</th><th>Replied</th><th>Meeting</th><th>Proposal</th><th>Monthly</th><th>Annual</th><th>Won/Lost</th><th>Contract</th><th>Collected</th><th>Days to convert</th></tr></thead><tbody>
      ${opps.map(l=>{
        const days = l.wonLost==="won" && l.wonLostDate && l.discovered ? Math.round((parseISO(l.wonLostDate)-parseISO(l.discovered))/86400000)+"d" : "—";
        return `<tr data-open-lead="${esc(l.id)}">
          <td><b>${esc(l.name)}</b> ${l.sample?'<span class="badge sample">Sample</span>':""}</td>
          <td>${esc(l.source||"—")}</td><td>${fmtDate(l.discovered)}</td><td>${fmtDate(l.firstContactDate)}</td>
          <td>${fmtDate(l.responseDate)}</td><td>${fmtDate(l.meetingDate)}</td>
          <td class="num">${l.proposalAmount?fmtMoney(l.proposalAmount):"—"}</td>
          <td class="num">${l.expectedMonthly?fmtMoney(l.expectedMonthly):"—"}</td>
          <td class="num">${l.expectedMonthly?fmtMoney(l.expectedMonthly*12):"—"}</td>
          <td>${l.wonLost?`<span class="badge ${l.wonLost}">${l.wonLost} ${fmtDate(l.wonLostDate)}</span>`:"—"}</td>
          <td class="num">${l.contractValue?fmtMoney(l.contractValue):"—"}</td>
          <td class="num">${l.revenueCollected?fmtMoney(l.revenueCollected):"—"}</td>
          <td class="num">${days}</td>
        </tr>`;
      }).join("") || `<tr><td colspan="13" style="color:var(--muted);text-align:center;padding:20px">No opportunities yet in this scope.</td></tr>`}
    </tbody></table></div>`;
}

/* ---------- Settings ---------- */
function renderSettings(){
  const s = cache.settings;
  const intStatus = key => s.integrations[key]==="connected" ? `<span class="badge approved">Connected (verified by you)</span>` : key==="export" ? `<span class="badge approved">Available</span>` : `<span class="badge stage">Not Connected</span>`;
  $("#settingsBody").innerHTML = `
    <div class="grid2">
      <div class="card">
        <h3>Business settings</h3>
        <div class="formgrid">
          <div><label>Cleaning company name</label><input id="s-companyName" value="${esc(s.companyName)}"></div>
          <div><label>Service area label</label><input id="s-serviceArea" value="${esc(s.serviceArea)}"></div>
          <div><label>Business phone</label><input id="s-phone" value="${esc(s.phone)}"></div>
          <div><label>Business email</label><input id="s-email" value="${esc(s.email)}"></div>
          <div><label>Booking link</label><input id="s-bookingLink" value="${esc(s.bookingLink)}"></div>
          <div><label>Primary offer</label><input id="s-primaryOffer" value="${esc(s.primaryOffer)}"></div>
          <div><label>Daily lead goal</label><input id="s-dailyGoal" type="number" min="1" value="${esc(s.dailyGoal)}"></div>
          <div><label>Lead owners (comma-separated)</label><input id="s-owners" value="${esc(s.owners.join(", "))}"></div>
          <div><label>Follow-up cadence (business days, comma-separated)</label><input id="s-followupDays" value="${esc(s.followupDays.join(", "))}"></div>
          <div><label>Max contact attempts</label><input id="s-maxAttempts" type="number" min="1" value="${esc(s.maxAttempts)}"></div>
          <div class="wide"><label>Approved service-area cities / neighborhoods</label><textarea id="s-approvedCities" rows="3">${esc(s.approvedCities)}</textarea></div>
          <div><label>ZIP range low</label><input id="s-zipLow" type="number" value="${esc(s.zipLow)}"></div>
          <div><label>ZIP range high</label><input id="s-zipHigh" type="number" value="${esc(s.zipHigh)}"></div>
        </div>
        <div class="modalfoot"><button class="btn primary" id="saveSettings">Save settings</button></div>
      </div>
      <div>
        <div class="card" style="margin-bottom:14px">
          <h3>Integrations</h3>
          <div class="help" style="margin-bottom:6px">An integration is only marked Connected after <b>you</b> have connected and tested it. Until then everything works through the manual flow: copy the approved message, send it yourself, and mark it as sent.</div>
          ${INTEGRATIONS.map(([key,nm,desc])=>`
            <div class="introw">
              <span class="nm">${esc(nm)}</span>
              <span class="desc">${esc(desc)}</span>
              ${intStatus(key)}
              ${key!=="export"?`<button class="btn small" data-int="${key}">${s.integrations[key]==="connected"?"Mark Not Connected":"I connected & tested this"}</button>`:""}
            </div>`).join("")}
        </div>
        <div class="card" style="margin-bottom:14px">
          <h3>Storage</h3>
          <p style="font-size:13px;margin:0">${backend==="db" ? "✅ Connected to this dashboard's <b>shared persistent database</b>. Data survives refreshes, devices, and sessions." : backend==="local" ? "⚠ Using <b>this browser's local storage</b> (you may be signed out or previewing). Data persists in this browser only." : "Connecting…"}</p>
        </div>
        <div class="card" style="margin-bottom:14px">
          <h3>Safety &amp; compliance</h3>
          <ul style="font-size:12.5px;margin:0;padding-left:18px;color:var(--ink-2)">
            <li>Public business information only; no logins bypassed, no restricted scraping.</li>
            <li>No outreach is ever sent without explicit human approval.</li>
            <li>Contact details and personalization are never invented — unknown fields stay empty and lower the score.</li>
            <li>Opt-outs are honored permanently via the do-not-contact flag.</li>
            <li>Every stage change, approval, and edit is written to the audit timeline.</li>
            <li>Sample data is labeled and stored separately from real leads.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Data tools</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" id="exportAllBtn">Export ALL leads (CSV)</button>
            <button class="btn danger" id="wipeSample">Delete all sample data</button>
            <button class="btn danger" id="wipeReal">Delete all real data</button>
          </div>
        </div>
      </div>
    </div>`;
  $("#saveSettings").onclick = async ()=>{
    const g = id=>$("#s-"+id).value.trim();
    Object.assign(cache.settings, {
      companyName:g("companyName")||DEFAULT_SETTINGS.companyName, serviceArea:g("serviceArea"),
      phone:g("phone"), email:g("email"), bookingLink:g("bookingLink"), primaryOffer:g("primaryOffer"),
      dailyGoal:Number(g("dailyGoal"))||20,
      owners:g("owners").split(",").map(x=>x.trim()).filter(Boolean),
      followupDays:g("followupDays").split(",").map(x=>Number(x.trim())).filter(n=>n>0),
      maxAttempts:Number(g("maxAttempts"))||4,
      approvedCities:g("approvedCities"), zipLow:Number(g("zipLow"))||30002, zipHigh:Number(g("zipHigh"))||30364
    });
    await saveSettings(); toast("Settings saved.");
  };
  $$("[data-int]").forEach(b=>b.onclick=async ()=>{
    const key = b.dataset.int;
    const cur = cache.settings.integrations[key];
    if(cur!=="connected" && !confirm("Only mark this Connected if you have actually connected AND tested it outside this dashboard. Continue?")) return;
    cache.settings.integrations[key] = cur==="connected" ? "not_connected" : "connected";
    await saveSettings();
  });
  $("#exportAllBtn").onclick = ()=>exportCSV(scopedLeads(), "all-leads");
  $("#wipeSample").onclick = ()=>wipeScope(true);
  $("#wipeReal").onclick = ()=>wipeScope(false);
}
async function wipeScope(sample){
  const label = sample?"SAMPLE":"REAL";
  if(!confirm(`Delete ALL ${label} leads, drafts, and activity history? This cannot be undone.`)) return;
  if(!confirm(`Really delete every ${label} record?`)) return;
  for(const [col, items] of [["leads",cache.leads],["drafts",cache.drafts],["activities",cache.activities]]){
    for(const [id,x] of Object.entries(items)) if(!!x.sample===sample) await delDoc(col,id);
  }
  toast(label+" data deleted.");
}

/* ===================== 9. Lead profile & actions ===================== */
function stripId(obj){ const o = Object.assign({}, obj); delete o.id; return o; }
async function logAudit(leadId, message, sample){
  const id = uid("A");
  await putDoc("activities", id, { sample:!!sample, leadId, ts:Date.now(), date:todayStr(), time:nowTime(), channel:"", type:"audit", message });
}
async function logActivity(a){
  const id = uid("A");
  await putDoc("activities", id, Object.assign({ts:Date.now(), date:todayStr(), time:nowTime()}, a));
}
function openModal(html, narrow){
  const back = $("#modalback"), m = $("#modal");
  m.className = "modal" + (narrow?" narrow":"");
  m.innerHTML = `<button class="x" aria-label="Close">×</button>` + html;
  back.classList.add("on");
  $(".x",m).onclick = closeModal;
  back.onclick = e=>{ if(e.target===back) closeModal(); };
  return m;
}
function closeModal(){ $("#modalback").classList.remove("on"); $("#modal").innerHTML=""; }
document.addEventListener("keydown", e=>{ if(e.key==="Escape"){ closeModal(); } });

function openPrompt(title, label, cb, defVal){
  const m = openModal(`<h2>${esc(title)}</h2><label>${esc(label)}</label><textarea id="pr-v">${esc(defVal||"")}</textarea><div class="modalfoot"><button class="btn" id="pr-cancel">Cancel</button><button class="btn primary" id="pr-ok">Save</button></div>`, true);
  $("#pr-cancel",m).onclick=closeModal;
  $("#pr-ok",m).onclick=async ()=>{ const v=$("#pr-v",m).value.trim(); closeModal(); await cb(v); };
}
function openCopyModal(title, text){
  const m = openModal(`<h2>${esc(title)}</h2><textarea rows="10" id="copy-t">${esc(text)}</textarea><div class="modalfoot"><button class="btn primary" id="copy-b">Copy to clipboard</button></div>`, true);
  $("#copy-b",m).onclick=async ()=>{ try{ await navigator.clipboard.writeText(text); toast("Copied."); }catch(e){ $("#copy-t",m).select(); document.execCommand("copy"); toast("Copied."); } };
}

function openLead(id){
  const l = leadById(id); if(!l) return;
  const sc = computeScore(l);
  const [lab, labCls] = scoreLabel(sc.total);
  const d = draftForLead(l.id);
  const acts = scopedActs().filter(a=>a.leadId===l.id).sort((a,b)=>(b.ts||0)-(a.ts||0));
  const atMax = (Number(l.attempts)||0) >= (Number(cache.settings.maxAttempts)||4);
  const link = (lbl,v,href)=> v?`<dt>${lbl}</dt><dd>${href?`<a href="${esc(href)}" target="_blank" rel="noopener">${esc(v)}</a>`:esc(v)}</dd>`:"";
  const m = openModal(`
    <h2>${esc(l.name)} ${l.sample?'<span class="badge sample">Sample Data</span>':""} ${l.dnc?'<span class="badge dnc">DO NOT CONTACT</span>':""} ${l.dupStatus==="duplicate"?'<span class="badge dup">duplicate'+(l.dupOf?" of "+esc(l.dupOf):"")+'</span>':""} ${l.wonLost?`<span class="badge ${l.wonLost}">${l.wonLost}</span>`:""}</h2>
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
      ${scoreChip(sc.total)} <span class="badge ${labCls}">${lab}</span>
      <label style="margin:0">Stage</label><select id="lp-stage">${STAGES.map(s=>`<option ${s===l.stage?"selected":""}>${s}</option>`).join("")}</select>
      <label style="margin:0">Owner</label><select id="lp-owner">${["Unassigned"].concat(cache.settings.owners).map(o=>`<option ${o===(l.owner||"Unassigned")?"selected":""}>${o}</option>`).join("")}</select>
    </div>
    <div class="profcols">
      <div>
        <fieldset><legend>Profile</legend>
          <dl class="kv">
            ${link("Decision-maker", l.decisionMaker ? l.decisionMaker + (l.role?" — "+l.role:"") : "")}
            ${link("Type", l.type)}${link("Company", l.company)}
            ${link("Location", (l.location||"") + (l.zip?" · "+l.zip:""))}
            ${link("Properties", l.propertiesEst?("~"+l.propertiesEst):"")}
            ${link("Website", l.website, l.website)}
            ${link("Email", l.email, "mailto:"+l.email)}${link("Phone", l.phone, "tel:"+l.phone)}
            ${link("LinkedIn", l.linkedin, /^http/.test(l.linkedin||"")?l.linkedin:"https://"+(l.linkedin||""))}
            ${link("Facebook", l.facebook)}${link("Instagram", l.instagram)}
            ${link("Source", l.source)}
            ${link("Discovered", fmtDate(l.discovered))}${link("Last verified", fmtDate(l.verified))}
            ${link("Preferred channel", l.recChannel)}
            ${link("Last contact", l.lastContactDate?fmtDate(l.lastContactDate)+" ("+(l.lastContactChannel||"—")+")":"")}
            ${link("Attempts", String(l.attempts||0) + " / " + cache.settings.maxAttempts)}
            ${link("Next follow-up", l.nextFollowUp?fmtDate(l.nextFollowUp)+" · "+(l.followUpPriority||"Normal"):"")}
            ${link("Sentiment", l.sentiment)}
            ${link("Est. value", (Number(l.oppValue)||0)?fmtMoney(l.oppValue):"")}
            ${link("Proposal", l.proposalAmount?fmtMoney(l.proposalAmount)+" ("+(l.proposalStatus||"sent")+")":"")}
            ${link("Contract", l.contractValue?fmtMoney(l.contractValue):"")}
            ${link("Collected", l.revenueCollected?fmtMoney(l.revenueCollected):"")}
          </dl>
        </fieldset>
        ${l.strEvidence?`<fieldset><legend>STR activity evidence</legend><div style="font-size:12.5px">${esc(l.strEvidence)}</div>${l.sourceLinks?`<div style="font-size:12px;margin-top:6px">${String(l.sourceLinks).split(/\n|,/).map(s=>s.trim()).filter(Boolean).map(s=>`<a href="${esc(s)}" target="_blank" rel="noopener">${esc(clip(s,54))}</a>`).join("<br>")}</div>`:""}</fieldset>`:""}
        ${l.fitReason?`<fieldset><legend>Why this lead fits</legend><div style="font-size:12.5px">${esc(l.fitReason)}</div></fieldset>`:""}
        ${l.responseSummary?`<fieldset><legend>Latest response</legend><div style="font-size:12.5px">${esc(l.responseSummary)}</div></fieldset>`:""}
        <fieldset><legend>Notes</legend><div style="font-size:12.5px;white-space:pre-wrap">${esc(l.notes||"—")}</div></fieldset>
      </div>
      <div>
        <fieldset><legend>Score breakdown — ${sc.total}/10</legend>
          <table class="scoretable">${sc.rows.map(r=>`<tr><td>${esc(r.label)}</td><td style="font-size:11px;color:var(--muted)">${esc(r.evidence)}</td><td class="pts">${r.pts}/${r.max}</td></tr>`).join("")}</table>
          ${sc.missing.length?`<div style="font-size:12px;margin-top:6px"><b>Missing:</b> ${esc(sc.missing.join(", "))}</div>`:""}
          ${sc.disqual?`<div style="font-size:12px;margin-top:6px;color:var(--critical-text)"><b>Disqualified:</b> ${esc(sc.disqual)}</div>`:""}
          ${l.nextAction?`<div style="font-size:12px;margin-top:6px"><b>Next action:</b> ${esc(l.nextAction)}</div>`:""}
        </fieldset>
        <fieldset><legend>History &amp; audit trail</legend>
          ${acts.length?`<ul class="timeline">${acts.slice(0,14).map(a=>`<li><div class="when">${fmtDate(a.date)} ${esc(a.time||"")} · ${esc(a.type)}${a.channel?" · "+esc(a.channel):""}</div>${esc(a.message||"")}${a.replySummary?`<div style="color:var(--ink-2)">${esc(a.replySummary)}</div>`:""}${a.approvedBy?`<div class="when">approved by ${esc(a.approvedBy)}${a.sentBy?" · sent by "+esc(a.sentBy):""}</div>`:""}</li>`).join("")}</ul>`:`<div style="color:var(--muted);font-size:12.5px">No activity yet.</div>`}
        </fieldset>
      </div>
    </div>
    <div class="modalfoot" style="justify-content:flex-start">
      <button class="btn" id="lp-edit">✎ Edit lead</button>
      <button class="btn" id="lp-note">Add note</button>
      ${!l.dnc?`
        ${sc.total>=8 && !sc.disqual ? `<button class="btn primary" id="lp-draft">${d?"View drafts in queue":"Generate outreach drafts"}</button>`:""}
        <button class="btn" id="lp-contact" ${atMax?`title="Max approved attempts reached (${cache.settings.maxAttempts})" disabled`:""}>Log contact attempt</button>
        <button class="btn" id="lp-reply">Record reply</button>
        <button class="btn" id="lp-meet">Schedule meeting</button>
        <button class="btn" id="lp-prop">Record proposal</button>
        <button class="btn" id="lp-fup">Schedule follow-up</button>
        <button class="btn" id="lp-won" style="color:var(--good-text)">Mark won</button>
        <button class="btn" id="lp-lost">Mark lost</button>
        ${l.wonLost==="won"?`<button class="btn" id="lp-rev">+ Record collected revenue</button>`:""}
        <button class="btn danger" id="lp-dnc">Do not contact</button>
      `:`<button class="btn" id="lp-undnc">Remove do-not-contact (requires reason)</button>`}
      <button class="btn danger" id="lp-del" style="margin-left:auto">Delete</button>
    </div>`);
  $("#lp-stage",m).onchange = async e=>{ await setStage(l, e.target.value, "profile"); openLead(id); };
  $("#lp-owner",m).onchange = async e=>{ const o=e.target.value; l.owner=o; await putDoc("leads",l.id,stripId(l)); await logAudit(l.id,"Owner set to "+o,l.sample); };
  $("#lp-edit",m).onclick = ()=>openLeadForm(l);
  $("#lp-note",m).onclick = ()=>openPrompt("Add note","Note", async v=>{ if(!v)return; l.notes=(l.notes?l.notes+"\n":"")+todayStr()+": "+v; await putDoc("leads",l.id,stripId(l)); await logAudit(l.id,"Note added: "+clip(v,80),l.sample); openLead(id); });
  const b = sel=>$(sel,m);
  if(b("#lp-draft")) b("#lp-draft").onclick = ()=>{ if(d){ closeModal(); switchView("queue"); } else openGenerateDrafts(l); };
  if(b("#lp-contact")) b("#lp-contact").onclick = ()=>openLogContact(l);
  if(b("#lp-reply")) b("#lp-reply").onclick = ()=>openRecordReply(l);
  if(b("#lp-meet")) b("#lp-meet").onclick = ()=>openMeeting(l);
  if(b("#lp-prop")) b("#lp-prop").onclick = ()=>openProposal(l);
  if(b("#lp-fup")) b("#lp-fup").onclick = ()=>openFollowUp(l);
  if(b("#lp-won")) b("#lp-won").onclick = ()=>openWon(l);
  if(b("#lp-lost")) b("#lp-lost").onclick = ()=>openLost(l);
  if(b("#lp-rev")) b("#lp-rev").onclick = ()=>openAddRevenue(l);
  if(b("#lp-dnc")) b("#lp-dnc").onclick = async ()=>{ await markDNC(l); openLead(id); };
  if(b("#lp-undnc")) b("#lp-undnc").onclick = ()=>openPrompt("Remove do-not-contact","Why is it safe to contact this lead again? (e.g., they explicitly re-opted in)", async v=>{ if(!v) return toast("A reason is required."); l.dnc=false; l.stage="Qualified"; await putDoc("leads",l.id,stripId(l)); await logAudit(l.id,"DNC removed: "+v,l.sample); openLead(id); });
  b("#lp-del").onclick = async ()=>{ if(!confirm("Delete this lead and keep its activity history? (History is retained for audit.)")) return; await delDoc("leads", l.id); closeModal(); toast("Lead deleted."); };
}
async function markDNC(l){
  if(!confirm(`Mark ${l.name} as Do Not Contact? All outreach stops permanently.`)) return;
  l.dnc = true; l.stage="Do Not Contact"; l.nextFollowUp="";
  await putDoc("leads", l.id, stripId(l));
  await logActivity({sample:l.sample, leadId:l.id, channel:"", type:"optout", message:"Marked Do Not Contact. All future outreach blocked."});
  const d = draftForLead(l.id);
  if(d && ["awaiting","approved","revision","hold"].includes(d.status)){ d.status="rejected"; await putDoc("drafts",d.id,stripId(d)); }
  toast("Do-not-contact recorded and enforced.");
}

/* ---- Lead form ---- */
function openLeadForm(existing){
  const l = existing || { stage:"New", discovered:todayStr(), verified:todayStr(), recChannel:"Email", owner:cache.settings.owners[0]||"You", attempts:0, dupStatus:"unique", sample: scope==="sample", source:"Manual entry" };
  const F = (id,label,val,type,wide)=>`<div class="${wide?"wide":""}"><label for="lf-${id}">${label}</label><input id="lf-${id}" type="${type||"text"}" value="${esc(val==null?"":val)}"></div>`;
  const T = (id,label,val)=>`<div class="wide"><label for="lf-${id}">${label}</label><textarea id="lf-${id}" rows="2">${esc(val||"")}</textarea></div>`;
  const m = openModal(`
    <h2>${existing?"Edit lead":"Add lead"} ${scope==="sample"?'<span class="badge sample">will be saved as Sample Data</span>':""}</h2>
    <div class="formgrid">
      ${F("name","Business / host name *",l.name)}
      ${F("company","Company",l.company)}
      ${F("decisionMaker","Decision-maker",l.decisionMaker)}
      ${F("role","Role",l.role)}
      <div><label for="lf-type">Lead type</label><select id="lf-type">${LEAD_TYPES.map(t=>`<option ${t===l.type?"selected":""}>${t}</option>`).join("")}</select></div>
      <div><label for="lf-recChannel">Recommended channel</label><select id="lf-recChannel">${CHANNELS.map(c=>`<option ${c===l.recChannel?"selected":""}>${c}</option>`).join("")}</select></div>
      ${F("location","Atlanta-area location",l.location)}
      ${F("zip","ZIP",l.zip)}
      ${F("website","Website",l.website)}
      ${F("email","Public business email",l.email)}
      ${F("phone","Public business phone",l.phone)}
      ${F("linkedin","LinkedIn",l.linkedin)}
      ${F("facebook","Facebook",l.facebook)}
      ${F("instagram","Instagram",l.instagram)}
      ${F("propertiesEst","Estimated # properties",l.propertiesEst,"number")}
      ${F("source","Lead source",l.source)}
      ${F("discovered","Date discovered",l.discovered,"date")}
      ${F("verified","Last verified",l.verified,"date")}
      ${F("oppValue","Estimated opportunity value ($)",l.oppValue,"number")}
      ${F("owner","Owner",l.owner)}
      ${T("strEvidence","Evidence of Airbnb/STR activity",l.strEvidence)}
      ${T("sourceLinks","Source links (one per line)",l.sourceLinks)}
      ${T("growthSignal","Growth / activity signal",l.growthSignal)}
      ${T("needSignal","Visible cleaning / turnover need",l.needSignal)}
      ${T("fitReason","Fit reason (why they qualify)",l.fitReason)}
      ${T("notes","Notes",l.notes)}
    </div>
    <div class="modalfoot"><button class="btn" id="lf-cancel">Cancel</button><button class="btn primary" id="lf-save">${existing?"Save changes":"Add lead"}</button></div>`);
  $("#lf-cancel",m).onclick = existing ? ()=>openLead(existing.id) : closeModal;
  $("#lf-save",m).onclick = async ()=>{
    const g = id=>$("#lf-"+id,m).value.trim();
    if(!g("name")) return toast("Name is required.");
    const prevScore = existing ? computeScore(l).total : null;
    ["name","company","decisionMaker","role","location","zip","website","email","phone","linkedin","facebook","instagram","source","discovered","verified","owner","strEvidence","sourceLinks","growthSignal","needSignal","fitReason","notes"].forEach(k2=>l[k2]=g(k2));
    l.type=$("#lf-type",m).value; l.recChannel=$("#lf-recChannel",m).value;
    l.propertiesEst=Number(g("propertiesEst"))||0; l.oppValue=Number(g("oppValue"))||0;
    if(!existing){ l.id = uid("L"); l.createdAt = Date.now(); }
    // duplicate check
    const dup = findDuplicate(l, l.id);
    if(dup && l.dupStatus!=="duplicate"){
      l.dupStatus="duplicate"; l.dupOf=dup.lead.id;
      if(!existing) l.stage="Not Qualified";
      toast(`⚠ Duplicate detected — matches “${dup.lead.name}” on ${dup.on}. Flagged and excluded from the daily goal.`);
    } else if(!dup && l.dupStatus==="duplicate"){
      l.dupStatus="unique"; l.dupOf="";
    }
    const sc = computeScore(l);
    l.score = sc.total;
    await putDoc("leads", l.id, stripId(l));
    if(!existing){
      await logAudit(l.id, `Lead added (${l.source||"manual"}). Score ${sc.total}/10${sc.disqual?" — DISQUALIFIED: "+sc.disqual:""}${l.dupStatus==="duplicate"?" — duplicate of "+l.dupOf:""}`, l.sample);
      if(sc.disqual && l.dupStatus!=="duplicate" && /service area/.test(sc.disqual)){ l.stage="Not Qualified"; await putDoc("leads",l.id,stripId(l)); }
      toast(sc.disqual ? `Lead saved but does NOT count toward the goal: ${sc.disqual}` : `Lead added — scored ${sc.total}/10 (${scoreLabel(sc.total)[0]}).`);
    } else {
      if(prevScore!==sc.total) await logAudit(l.id, `Score changed ${prevScore} → ${sc.total} after edit (evidence updated)`, l.sample);
      toast("Lead updated.");
    }
    closeModal(); renderAll();
    if(sc.total>=8 && !sc.disqual && !draftForLead(l.id)){
      if(confirm(`${l.name} scores ${sc.total}/10 (High Priority). Generate outreach drafts for the approval queue now?`)) openGenerateDrafts(leadById(l.id));
    }
  };
}

/* ---- Outreach drafting ---- */
function fillPlaceholders(text, s){
  return String(text||"")
    .replaceAll("[CLEANING COMPANY NAME]", s.companyName)
    .replaceAll("[BUSINESS PHONE]", s.phone).replaceAll("[BUSINING PHONE]", s.phone)
    .replaceAll("[BUSINESS EMAIL]", s.email)
    .replaceAll("[BOOKING LINK]", s.bookingLink)
    .replaceAll("[PRIMARY OFFER]", s.primaryOffer)
    .replaceAll("[SERVICE AREA]", s.serviceArea);
}
function buildTemplateDrafts(l){
  const s = cache.settings;
  const first = (l.decisionMaker||"there").split(" ")[0];
  const hook = l.needSignal ? clip(l.needSignal,90) : l.growthSignal ? clip(l.growthSignal,90) : l.fitReason ? clip(l.fitReason,90) : `your ${l.propertiesEst||"short-term rental"} listings in ${l.location||"Atlanta"}`;
  const props = l.propertiesEst ? `${l.propertiesEst} doors` : "your properties";
  // COLD door-opener: goal is a reply, not a booked call. One specific
  // observation, one plain sentence on what we do, one low-pressure ask.
  const email = {
    subject: `Turnover cleaning for ${clip(l.company||l.name,40)}?`,
    body: `Hi ${first},\n\n${hook ? hook.charAt(0).toUpperCase()+hook.slice(1) : `You run short-term rentals in ${l.location||"Atlanta"}`} — so you know how much rides on a clean, on-time turnover.\n\nWe're [CLEANING COMPANY NAME], an Atlanta turnover-cleaning crew for Airbnb and short-term rentals: photo-verified guest-ready checks, fresh linens, and a restock report after every clean.\n\nWould it be worth a quick look at covering a few of ${l.company||l.name}'s turnovers? A simple "not right now" is a perfectly fine answer.\n\n${"[CLEANING COMPANY NAME]"}\n[BUSINESS PHONE] · [BUSINESS EMAIL]`
  };
  const li = clip(`Hi ${first} — ${hook||`you run short-term rentals in ${l.location||"Atlanta"}`}. We're an Atlanta turnover-cleaning crew for STRs (photo-verified, fresh linens, restock reports). Worth a quick chat about covering a few of your turnovers?`, 300);
  const fb = clip(`Hi ${first} — we're an Atlanta turnover-cleaning crew for short-term rentals: photo-verified guest-ready checks and restock reports. Open to me sending over how we could help with ${l.company||l.name}'s turnovers?`, 300);
  const ig = clip(`Hi ${first}! We do Airbnb/STR turnover cleaning in ${l.location||"Atlanta"} — photo-verified, fresh linens, restock reports. Mind if I share how we could cover a few of your turnovers?`, 300);
  const fu1 = {
    subject: "Re: " + email.subject,
    body: `Hi ${first},\n\nJust floating this back up in case it got buried. No pitch — I'm only trying to find out whether reliable turnover cleaning is something ${l.company||l.name} could use a hand with right now.\n\nIf it's not the right time, no worries at all — just let me know and I'll stop here.\n\n[CLEANING COMPANY NAME]`
  };
  const fu2 = `Hi ${first} — last note from me, I promise. If turnover cleaning ever becomes a headache, we're here: [BOOKING LINK]. Either way, wishing ${l.company||l.name} a full calendar!`;
  const call = `Hi ${first}, this is [YOUR NAME] with [CLEANING COMPANY NAME] — we do turnover cleaning for short-term rentals here in ${l.location||"Atlanta"}. I'll be quick: I'm just trying to learn how you're handling turnovers across ${props} right now, and whether it'd be worth us talking. Is now an okay moment for 30 seconds?`;
  return { email, linkedin: li, facebook: fb, instagram: ig, followup1: fu1, followup2: fu2, call };
}
function openGenerateDrafts(l){
  const sc = computeScore(l);
  if(sc.total < 8 || sc.disqual){ toast("Only leads scoring 8+ (and not disqualified) enter outreach drafting."); return; }
  if(l.dnc){ toast("This lead is on the do-not-contact list."); return; }
  const m = openModal(`
    <h2>Generate outreach drafts — ${esc(l.name)}</h2>
    <p style="font-size:13px;margin:0 0 10px">The agent prepares a full outreach package (email, LinkedIn, Facebook, Instagram, two follow-ups, and a call opening) using only verified facts from this lead's record. It goes to the <b>approval queue</b> — nothing is sent without you.</p>
    <div class="notice">Personalization uses: ${esc([l.fitReason&&"fit reason", l.needSignal&&"need signal", l.growthSignal&&"growth signal", l.propertiesEst&&"door count", l.location&&"location"].filter(Boolean).join(", ")||"basic profile fields")}. Nothing is invented.</div>
    <div class="modalfoot" style="justify-content:flex-start">
      ${aiSample?`<button class="btn primary" id="gd-ai">✨ Draft with AI (Claude)</button>`:""}
      <button class="btn ${aiSample?"":"primary"}" id="gd-tpl">Draft from template</button>
      <button class="btn" id="gd-cancel">Cancel</button>
    </div>
    <div id="gd-status" class="help" style="margin-top:8px"></div>`);
  $("#gd-cancel",m).onclick = closeModal;
  const finish = async channels=>{
    const d = { id:"D-"+l.id, leadId:l.id, sample:!!l.sample, status:"awaiting", generatedBy: channels.__ai?"ai":"template", createdAt:Date.now(), recommendedSend:todayStr(), recommendedFollowUp:addBusinessDays(todayStr(), cache.settings.followupDays[0]||3), supportingSource: String(l.sourceLinks||"").split(/\n|,/)[0]||"", channels };
    delete channels.__ai;
    await putDoc("drafts", d.id, stripId(d));
    if(["New","Researching","Qualified","Draft Ready"].includes(l.stage)){ l.stage="Awaiting Approval"; await putDoc("leads",l.id,stripId(l)); }
    await logAudit(l.id, "Outreach drafts created ("+d.generatedBy+") and placed in the approval queue", l.sample);
    closeModal(); switchView("queue"); toast("Drafts are in the approval queue.");
  };
  $("#gd-tpl",m).onclick = ()=>finish(buildTemplateDrafts(l));
  if($("#gd-ai",m)) $("#gd-ai",m).onclick = async ()=>{
    $("#gd-status",m).textContent = "Asking Claude to draft from the verified facts…";
    try{
      const s = cache.settings;
      const facts = { businessName:l.name, company:l.company, decisionMaker:l.decisionMaker, role:l.role, type:l.type, location:l.location, properties:l.propertiesEst, strEvidence:l.strEvidence, growthSignal:l.growthSignal, needSignal:l.needSignal, fitReason:l.fitReason };
      const out = await aiSample.json(
`You draft COLD door-opener outreach for ${s.companyName}, an Airbnb/short-term-rental turnover cleaning service in Atlanta (${s.primaryOffer}). This is a first-touch cold email to someone who has never heard of us — the ONLY goal is to earn a reply and start a conversation, NOT to book a call or pitch hard.

HARD RULES: Use ONLY the verified facts given — never invent names, numbers, familiarity, or claims of having serviced or spoken to them. Open with ONE specific, true observation about their STR operation (from the facts). Then one plain sentence on what we do (turnovers, guest readiness). Then ONE low-pressure, permission-based ask (e.g. "worth a quick look?", "mind if I send details?", "is this worth a conversation?") — explicitly make "no" an easy answer. Keep it short and human; no hype, no generic compliments, no fake urgency, no hard CTA. Use the literal placeholders [CLEANING COMPANY NAME], [BOOKING LINK], [BUSINESS PHONE], [BUSINESS EMAIL], [YOUR NAME] where appropriate.

LIMITS: email body under 125 words. linkedin/facebook/instagram each under 300 characters.

VERIFIED FACTS (JSON): ${JSON.stringify(facts)}

Return ONLY JSON: {"email":{"subject":string,"body":string},"linkedin":string,"facebook":string,"instagram":string,"followup1":{"subject":string,"body":string},"followup2":string,"call":string}`);
      if(!out || !out.email || !out.email.body) throw new Error("bad shape");
      out.linkedin = clip(out.linkedin,300); out.facebook = clip(out.facebook,300); out.instagram = clip(out.instagram,300);
      out.__ai = true;
      await finish(out);
    }catch(e){
      $("#gd-status",m).textContent = "AI drafting unavailable right now — using the template instead.";
      setTimeout(()=>finish(buildTemplateDrafts(l)), 600);
    }
  };
}
function openDraftEditor(d){
  const l = leadById(d.leadId);
  const c = d.channels||{};
  const em = c.email||{}, f1 = c.followup1||{};
  const wasApproved = d.status==="approved";
  const cnt = id=>`<span class="help" id="cnt-${id}"></span>`;
  const m = openModal(`
    <h2>Edit drafts — ${esc(l?l.name:d.leadId)}</h2>
    ${wasApproved?`<div class="notice">This draft is currently <b>approved</b>. Saving an edit returns it to the approval queue for re-approval.</div>`:""}
    <fieldset><legend>Email (keep under 125 words)</legend>
      <label>Subject</label><input id="de-subj" value="${esc(em.subject||"")}" style="width:100%">
      <label style="margin-top:6px">Body</label><textarea id="de-body" rows="8">${esc(em.body||"")}</textarea>
    </fieldset>
    <fieldset><legend>Social (max 300 characters each)</legend>
      <label>LinkedIn ${cnt("li")}</label><textarea id="de-li" rows="3" maxlength="300">${esc(typeof c.linkedin==="string"?c.linkedin:"")}</textarea>
      <label>Facebook ${cnt("fb")}</label><textarea id="de-fb" rows="3" maxlength="300">${esc(typeof c.facebook==="string"?c.facebook:"")}</textarea>
      <label>Instagram ${cnt("ig")}</label><textarea id="de-ig" rows="3" maxlength="300">${esc(typeof c.instagram==="string"?c.instagram:"")}</textarea>
    </fieldset>
    <fieldset><legend>Follow-ups &amp; call</legend>
      <label>Follow-up 1 — subject</label><input id="de-f1s" value="${esc(f1.subject||"")}" style="width:100%">
      <label style="margin-top:6px">Follow-up 1 — body</label><textarea id="de-f1b" rows="4">${esc(f1.body||"")}</textarea>
      <label style="margin-top:6px">Follow-up 2 (final)</label><textarea id="de-f2" rows="3">${esc(typeof c.followup2==="string"?c.followup2:"")}</textarea>
      <label style="margin-top:6px">Suggested call opening</label><textarea id="de-call" rows="2">${esc(typeof c.call==="string"?c.call:"")}</textarea>
    </fieldset>
    <div class="formgrid">
      <div><label>Recommended send date</label><input type="date" id="de-send" value="${esc(d.recommendedSend||todayStr())}"></div>
      <div><label>Recommended follow-up date</label><input type="date" id="de-fup" value="${esc(d.recommendedFollowUp||"")}"></div>
    </div>
    <div class="modalfoot"><button class="btn" id="de-cancel">Cancel</button><button class="btn primary" id="de-save">${wasApproved?"Save & return to queue":"Save drafts"}</button></div>`);
  const counters = [["li","de-li"],["fb","de-fb"],["ig","de-ig"]];
  counters.forEach(([id,tid])=>{
    const t = $("#"+tid,m), lab = $("#cnt-"+id,m);
    const upd=()=>lab.textContent = t.value.length+"/300";
    t.addEventListener("input",upd); upd();
  });
  $("#de-cancel",m).onclick = closeModal;
  $("#de-save",m).onclick = async ()=>{
    d.channels = {
      email:{subject:$("#de-subj",m).value, body:$("#de-body",m).value},
      linkedin:$("#de-li",m).value, facebook:$("#de-fb",m).value, instagram:$("#de-ig",m).value,
      followup1:{subject:$("#de-f1s",m).value, body:$("#de-f1b",m).value},
      followup2:$("#de-f2",m).value, call:$("#de-call",m).value
    };
    d.recommendedSend = $("#de-send",m).value; d.recommendedFollowUp = $("#de-fup",m).value;
    if(wasApproved){ d.status="awaiting"; d.editedAfterApproval=true; await logAudit(d.leadId,"Approved draft was edited — returned to approval queue", d.sample); toast("Edited after approval — back in the queue for re-approval."); }
    else { if(d.status==="revision") d.status="awaiting"; toast("Drafts saved."); }
    await putDoc("drafts", d.id, stripId(d));
    closeModal(); if(currentView==="queue") renderQueue();
  };
}
function openMarkSent(d){
  const l = leadById(d.leadId); if(!l) return;
  if(l.dnc) return toast("Blocked: this lead is on the do-not-contact list.");
  const t = todayStr();
  const sameDayOther = l.lastContactDate===t;
  const m = openModal(`
    <h2>Mark as sent — ${esc(l.name)}</h2>
    <div class="notice">Confirm only after <b>you</b> actually sent the message (integrations are Not Connected, so sending happens outside this dashboard). The agent never marks anything sent on its own.</div>
    <div class="formgrid">
      <div><label>Channel used</label><select id="ms-chan">${CHANNELS.map(c=>`<option ${c===(l.recChannel||"Email")?"selected":""}>${c}</option>`).join("")}</select></div>
      <div><label>Date sent</label><input type="date" id="ms-date" value="${t}"></div>
      <div><label>Sent by</label><input id="ms-by" value="Owner"></div>
      <div><label>Next follow-up</label><input type="date" id="ms-fup" value="${addBusinessDays(t, cache.settings.followupDays[Math.min(l.attempts||0, cache.settings.followupDays.length-1)]||3)}"></div>
    </div>
    <div class="modalfoot"><button class="btn" id="ms-cancel">Cancel</button><button class="btn primary" id="ms-ok">Confirm sent</button></div>`, true);
  $("#ms-cancel",m).onclick = closeModal;
  $("#ms-ok",m).onclick = async ()=>{
    const chan = $("#ms-chan",m).value;
    if(sameDayOther && l.lastContactChannel && l.lastContactChannel!==chan){
      if(!confirm(`You already contacted this lead today via ${l.lastContactChannel}. Contacting through a second channel on the same day requires explicit approval. Proceed anyway?`)) return;
    }
    const date = $("#ms-date",m).value||t, by = $("#ms-by",m).value||"Owner", fup = $("#ms-fup",m).value;
    d.status="sent"; d.sentChannel=chan; d.sentDate=date; d.sentBy=by;
    await putDoc("drafts", d.id, stripId(d));
    l.attempts = (Number(l.attempts)||0)+1;
    l.lastContactDate=date; l.lastContactChannel=chan;
    if(!l.firstContactDate) l.firstContactDate=date;
    l.nextFollowUp = fup; l.stage = "Contacted"; l.nextAction = "Wait for reply; follow up "+fmtDate(fup);
    await putDoc("leads", l.id, stripId(l));
    await logActivity({sample:l.sample, leadId:l.id, channel:chan, type:"contact", message:"Approved outreach sent via "+chan+" (attempt "+l.attempts+").", approvalStatus:"approved", approvedBy:d.approvedBy||"Owner", sentBy:by, outcome:"Awaiting reply", nextAction:"Follow up", nextFollowUp:fup});
    closeModal(); renderAll(); toast("Recorded as sent — follow-up scheduled for "+fmtDate(fup)+".");
  };
}

/* ---- Contact / reply / meeting / proposal / won / lost ---- */
function openLogContact(l){
  if(l.dnc) return toast("Blocked: do-not-contact.");
  const t = todayStr();
  const m = openModal(`
    <h2>Log contact attempt — ${esc(l.name)}</h2>
    <div class="formgrid">
      <div><label>Channel</label><select id="lc-chan">${CHANNELS.map(c=>`<option ${c===(l.recChannel||"Email")?"selected":""}>${c}</option>`).join("")}</select></div>
      <div><label>Date</label><input type="date" id="lc-date" value="${t}"></div>
      <div class="wide"><label>Message / summary</label><textarea id="lc-msg" rows="3" placeholder="What was sent or said"></textarea></div>
      <div><label>Outcome</label><input id="lc-out" placeholder="e.g. voicemail, no reply yet"></div>
      <div><label>Next follow-up</label><input type="date" id="lc-fup" value="${addBusinessDays(t, cache.settings.followupDays[Math.min(l.attempts||0,cache.settings.followupDays.length-1)]||3)}"></div>
    </div>
    <div class="modalfoot"><button class="btn" id="lc-cancel">Cancel</button><button class="btn primary" id="lc-ok">Record</button></div>`, true);
  $("#lc-cancel",m).onclick=closeModal;
  $("#lc-ok",m).onclick=async ()=>{
    const chan=$("#lc-chan",m).value, date=$("#lc-date",m).value||t;
    if(l.lastContactDate===date && l.lastContactChannel && l.lastContactChannel!==chan){
      if(!confirm(`Already contacted today via ${l.lastContactChannel}. A second same-day channel needs explicit approval. Proceed?`)) return;
    }
    l.attempts=(Number(l.attempts)||0)+1; l.lastContactDate=date; l.lastContactChannel=chan;
    if(!l.firstContactDate) l.firstContactDate=date;
    l.nextFollowUp=$("#lc-fup",m).value;
    if(["New","Researching","Qualified","Draft Ready","Awaiting Approval","Approved to Contact"].includes(l.stage)) l.stage="Contacted";
    await putDoc("leads",l.id,stripId(l));
    await logActivity({sample:l.sample,leadId:l.id,channel:chan,type:"contact",message:$("#lc-msg",m).value||"Manual contact attempt",approvalStatus:"manual",sentBy:"Owner",outcome:$("#lc-out",m).value,nextFollowUp:l.nextFollowUp});
    closeModal(); renderAll(); toast("Contact recorded (attempt "+l.attempts+").");
  };
}
function openRecordReply(l){
  const m = openModal(`
    <h2>Record reply — ${esc(l.name)}</h2>
    <div class="formgrid">
      <div class="wide"><label>Reply summary</label><textarea id="rr-sum" rows="3"></textarea></div>
      <div><label>Sentiment</label><select id="rr-sent">${SENTIMENTS.map(s=>`<option>${s}</option>`).join("")}</select></div>
      <div><label>Channel</label><select id="rr-chan">${CHANNELS.map(c=>`<option ${c===(l.lastContactChannel||"Email")?"selected":""}>${c}</option>`).join("")}</select></div>
      <div class="wide"><label><input type="checkbox" id="rr-stop" checked style="width:auto;margin-right:6px">Stop scheduled follow-ups (they replied)</label></div>
    </div>
    <div class="modalfoot"><button class="btn" id="rr-cancel">Cancel</button><button class="btn primary" id="rr-ok">Record reply</button></div>`, true);
  $("#rr-cancel",m).onclick=closeModal;
  $("#rr-ok",m).onclick=async ()=>{
    l.responseSummary=$("#rr-sum",m).value; l.sentiment=$("#rr-sent",m).value; l.responseDate=todayStr();
    if($("#rr-stop",m).checked) l.nextFollowUp="";
    l.stage = l.sentiment==="Negative" ? l.stage : "Responded";
    l.nextAction = "Reply to their message";
    await putDoc("leads",l.id,stripId(l));
    await logActivity({sample:l.sample,leadId:l.id,channel:$("#rr-chan",m).value,type:"reply",message:"Reply received ("+l.sentiment+").",replySummary:l.responseSummary,outcome:"Needs human response",nextAction:"Respond"});
    closeModal(); renderAll(); toast("Reply recorded — flagged for your response.");
  };
}
function openMeeting(l){
  const m = openModal(`
    <h2>Schedule meeting — ${esc(l.name)}</h2>
    <div class="formgrid">
      <div><label>Date</label><input type="date" id="mt-date" value="${addBusinessDays(todayStr(),2)}"></div>
      <div><label>Status</label><select id="mt-status"><option>Scheduled</option><option>Requested</option></select></div>
      <div class="wide"><label>Notes</label><input id="mt-notes" placeholder="e.g. video call, walkthrough"></div>
    </div>
    <div class="modalfoot"><button class="btn" id="mt-cancel">Cancel</button><button class="btn primary" id="mt-ok">Save</button></div>`, true);
  $("#mt-cancel",m).onclick=closeModal;
  $("#mt-ok",m).onclick=async ()=>{
    const st=$("#mt-status",m).value;
    l.meetingDate=$("#mt-date",m).value; l.apptStatus=st;
    l.stage = st==="Scheduled"?"Meeting Scheduled":"Meeting Requested";
    l.nextAction = "Prepare for the meeting " + fmtDate(l.meetingDate);
    await putDoc("leads",l.id,stripId(l));
    await logActivity({sample:l.sample,leadId:l.id,channel:"",type:"meeting",message:"Meeting "+st.toLowerCase()+" for "+fmtDate(l.meetingDate)+". "+$("#mt-notes",m).value,outcome:st});
    closeModal(); renderAll(); toast("Meeting "+st.toLowerCase()+".");
  };
}
function openProposal(l){
  const m = openModal(`
    <h2>Record proposal — ${esc(l.name)}</h2>
    <div class="formgrid">
      <div><label>Proposal amount ($/month)</label><input type="number" id="pp-amt" value="${esc(l.proposalAmount||"")}"></div>
      <div><label>Expected monthly value ($)</label><input type="number" id="pp-mo" value="${esc(l.expectedMonthly||l.proposalAmount||"")}"></div>
    </div>
    <div class="modalfoot"><button class="btn" id="pp-cancel">Cancel</button><button class="btn primary" id="pp-ok">Record proposal</button></div>`, true);
  $("#pp-cancel",m).onclick=closeModal;
  $("#pp-ok",m).onclick=async ()=>{
    l.proposalAmount=Number($("#pp-amt",m).value)||0; l.expectedMonthly=Number($("#pp-mo",m).value)||l.proposalAmount;
    l.proposalStatus="Sent"; l.stage="Proposal Sent";
    l.oppValue = l.expectedMonthly*12 || l.proposalAmount;
    l.nextAction = "Follow up on the proposal";
    await putDoc("leads",l.id,stripId(l));
    await logActivity({sample:l.sample,leadId:l.id,channel:"",type:"proposal",message:"Proposal sent: "+fmtMoney(l.proposalAmount)+"/mo (est. "+fmtMoney(l.expectedMonthly*12)+"/yr).",outcome:"Awaiting decision"});
    closeModal(); renderAll(); toast("Proposal recorded — pipeline value updated.");
  };
}
function openFollowUp(l){
  const m = openModal(`
    <h2>Schedule follow-up — ${esc(l.name)}</h2>
    <div class="formgrid">
      <div><label>Follow-up date</label><input type="date" id="fu-date" value="${esc(l.nextFollowUp||addBusinessDays(todayStr(),cache.settings.followupDays[0]||3))}"></div>
      <div><label>Priority</label><select id="fu-pri"><option>Normal</option><option ${l.followUpPriority==="High"?"selected":""}>High</option><option ${l.followUpPriority==="Low"?"selected":""}>Low</option></select></div>
    </div>
    <div class="help">Cadence (editable in Settings): +${cache.settings.followupDays.join(", +")} business days. Follow-up stops on reply, opt-out, a “no”, invalid contact info, or after ${cache.settings.maxAttempts} attempts.</div>
    <div class="modalfoot"><button class="btn" id="fu-cancel">Cancel</button><button class="btn primary" id="fu-ok">Schedule</button></div>`, true);
  $("#fu-cancel",m).onclick=closeModal;
  $("#fu-ok",m).onclick=async ()=>{
    l.nextFollowUp=$("#fu-date",m).value; l.followUpPriority=$("#fu-pri",m).value;
    if(l.stage==="Contacted") l.stage = l.nextFollowUp<=todayStr() ? "Follow-Up Due" : l.stage;
    await putDoc("leads",l.id,stripId(l));
    await logAudit(l.id,"Follow-up scheduled for "+fmtDate(l.nextFollowUp)+" ("+l.followUpPriority+")",l.sample);
    closeModal(); renderAll(); toast("Follow-up scheduled.");
  };
}
function openWon(l){
  const m = openModal(`
    <h2>Mark won — ${esc(l.name)} 🎉</h2>
    <div class="formgrid">
      <div><label>Contract value (total $)</label><input type="number" id="w-cv" value="${esc(l.contractValue|| (l.expectedMonthly? l.expectedMonthly*12 : ""))}"></div>
      <div><label>Expected monthly value ($)</label><input type="number" id="w-mo" value="${esc(l.expectedMonthly||"")}"></div>
      <div><label>Collected so far ($)</label><input type="number" id="w-col" value="${esc(l.revenueCollected||0)}"></div>
      <div><label>Won date</label><input type="date" id="w-date" value="${todayStr()}"></div>
    </div>
    <div class="help">Collected revenue is tracked separately from contract/pipeline value — only money actually received counts as revenue.</div>
    <div class="modalfoot"><button class="btn" id="w-cancel">Cancel</button><button class="btn primary" id="w-ok">Mark won</button></div>`, true);
  $("#w-cancel",m).onclick=closeModal;
  $("#w-ok",m).onclick=async ()=>{
    l.wonLost="won"; l.wonLostDate=$("#w-date",m).value||todayStr(); l.stage="Won";
    l.contractValue=Number($("#w-cv",m).value)||0; l.expectedMonthly=Number($("#w-mo",m).value)||0;
    l.revenueCollected=Number($("#w-col",m).value)||0; l.proposalStatus=l.proposalStatus?"Accepted":l.proposalStatus;
    l.oppValue=0; l.nextFollowUp=""; l.nextAction="Onboard the new customer";
    await putDoc("leads",l.id,stripId(l));
    await logActivity({sample:l.sample,leadId:l.id,channel:"",type:"won",message:"Opportunity WON — contract "+fmtMoney(l.contractValue)+(l.expectedMonthly?" ("+fmtMoney(l.expectedMonthly)+"/mo)":"")+". Collected so far: "+fmtMoney(l.revenueCollected)+".",outcome:"Customer"});
    closeModal(); renderAll(); toast("Won! Revenue tracking updated.");
  };
}
function openLost(l){
  openPrompt("Mark lost — "+l.name, "Reason (kept for the win/loss record)", async v=>{
    l.wonLost="lost"; l.wonLostDate=todayStr(); l.stage="Lost"; l.oppValue=0; l.nextFollowUp="";
    await putDoc("leads",l.id,stripId(l));
    await logActivity({sample:l.sample,leadId:l.id,channel:"",type:"audit",message:"Marked LOST: "+(v||"no reason given")});
    renderAll(); toast("Marked lost.");
  });
}
function openAddRevenue(l){
  openPrompt("Record collected revenue — "+l.name, "Amount collected ($)", async v=>{
    const amt = Number(v)||0; if(!amt) return toast("Enter a dollar amount.");
    l.revenueCollected = (Number(l.revenueCollected)||0) + amt;
    await putDoc("leads",l.id,stripId(l));
    await logActivity({sample:l.sample,leadId:l.id,channel:"",type:"revenue",message:"Collected revenue recorded: "+fmtMoney(amt)+" (total "+fmtMoney(l.revenueCollected)+")."});
    renderAll(); toast(fmtMoney(amt)+" recorded as collected.");
  });
}

/* ===================== 10. CSV ===================== */
const CSV_FIELDS = ["id","name","decisionMaker","role","type","company","location","zip","website","email","phone","linkedin","facebook","instagram","propertiesEst","strEvidence","sourceLinks","source","discovered","verified","growthSignal","needSignal","score","fitReason","recChannel","stage","owner","lastContactDate","lastContactChannel","attempts","responseSummary","sentiment","nextAction","nextFollowUp","followUpPriority","apptStatus","proposalStatus","proposalAmount","expectedMonthly","oppValue","wonLost","wonLostDate","contractValue","revenueCollected","dnc","notes","dupStatus","dupOf","sample"];
function csvEscape(v){ v = String(v==null?"":v); return /[",\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; }
function exportCSV(leads, name){
  const rows = [CSV_FIELDS.join(",")].concat(leads.map(l=>{
    l = Object.assign({}, l, {score: computeScore(l).total});
    return CSV_FIELDS.map(f=>csvEscape(l[f])).join(",");
  }));
  const csv = rows.join("\n");
  const fn = `str-agent-${name||"leads"}-${todayStr()}.csv`;
  if(dl){ dl.save({filename:fn, data:csv}).then(()=>toast("CSV offered for download.")).catch(()=>openCopyModal("CSV export — copy & save as "+fn, csv)); }
  else openCopyModal("CSV export — copy & save as "+fn, csv);
}
function parseCSV(text){
  const rows = []; let row = [], cur = "", inQ = false;
  for(let i=0;i<text.length;i++){
    const ch = text[i];
    if(inQ){
      if(ch==='"'){ if(text[i+1]==='"'){cur+='"';i++;} else inQ=false; }
      else cur+=ch;
    } else {
      if(ch==='"') inQ=true;
      else if(ch===","){ row.push(cur); cur=""; }
      else if(ch==="\n"||ch==="\r"){ if(ch==="\r"&&text[i+1]==="\n")i++; row.push(cur); cur=""; if(row.some(c=>c!=="")) rows.push(row); row=[]; }
      else cur+=ch;
    }
  }
  row.push(cur); if(row.some(c=>c!=="")) rows.push(row);
  return rows;
}
function openImport(){
  const m = openModal(`
    <h2>Import leads from CSV</h2>
    <p style="font-size:13px">Use the same column headers as the export (at minimum <b>name</b>; recommended: email, phone, location, zip, type, strEvidence, sourceLinks). Each row is duplicate-checked and scored on import.</p>
    <input type="file" id="im-file" accept=".csv,text/csv">
    <label style="margin-top:10px">…or paste CSV</label>
    <textarea id="im-text" rows="6" placeholder="name,email,location,zip,..."></textarea>
    <div class="modalfoot"><button class="btn" id="im-cancel">Cancel</button><button class="btn primary" id="im-ok">Import</button></div>`);
  $("#im-cancel",m).onclick=closeModal;
  $("#im-file",m).addEventListener("change", e=>{
    const f = e.target.files[0]; if(!f) return;
    const r = new FileReader(); r.onload = ()=>$("#im-text",m).value = r.result; r.readAsText(f);
  });
  $("#im-ok",m).onclick=async ()=>{
    const text = $("#im-text",m).value.trim(); if(!text) return toast("Nothing to import.");
    const rows = parseCSV(text); if(rows.length<2) return toast("Need a header row plus at least one lead.");
    const hdr = rows[0].map(h=>h.trim());
    let added=0, dups=0, skipped=0;
    for(const r of rows.slice(1)){
      const l = { stage:"New", attempts:0, dupStatus:"unique", sample:scope==="sample", discovered:todayStr(), verified:todayStr(), recChannel:"Email", owner:cache.settings.owners[0]||"You", source:"CSV import", createdAt:Date.now() };
      hdr.forEach((h,i)=>{ if(CSV_FIELDS.includes(h) && h!=="id" && h!=="sample" && r[i]!=null && r[i]!=="") l[h]=r[i]; });
      if(!l.name){ skipped++; continue; }
      l.propertiesEst=Number(l.propertiesEst)||0; l.attempts=Number(l.attempts)||0;
      l.dnc = String(l.dnc)==="true";
      l.id = uid("L");
      const dup = findDuplicate(l, l.id);
      if(dup){ l.dupStatus="duplicate"; l.dupOf=dup.lead.id; l.stage="Not Qualified"; dups++; }
      else added++;
      l.score = computeScore(l).total;
      await putDoc("leads", l.id, stripId(l));
      await logAudit(l.id, "Imported from CSV. "+(dup?("Duplicate of "+dup.lead.name+" ("+dup.on+")"):"Score "+l.score+"/10"), l.sample);
    }
    closeModal(); renderAll();
    toast(`Import done: ${added} added, ${dups} flagged as duplicates, ${skipped} skipped (no name).`);
  };
}

/* ===================== 11. Guided demo ===================== */
const TOUR = [
  ["Welcome to the guided demo","You're in Demo Mode — every record is fictional and labeled Sample Data, stored separately from real leads. This walkthrough follows one lead through the entire agent workflow.", "dashboard"],
  ["1 · Lead found","The agent researched public Atlanta STR sources and added “Peachtree Stay Co.” — a 14-door Midtown management company — with evidence and source links attached. The KPI row shows progress toward the 20-lead daily goal.", "dashboard"],
  ["2 · Sources verified & duplicate check","Open the Leads tab: every record shows verification dates and flags. “Peachtree Stay Company” (SL-3) was caught as a duplicate by email + company match and excluded from the goal; Blue Ridge Cabin Retreats was disqualified as outside the service area.", "leads"],
  ["3 · Lead scored","Click any lead to see its 1–10 score with per-category points and the evidence behind each point. Peachtree Stay scores 9/10 — High Priority. Scores are never inflated to hit quota: missing evidence simply means missing points.", "leads"],
  ["4 · Outreach drafted","Because it scored 8+, the agent drafted a full outreach package: email (<125 words), LinkedIn/Facebook/Instagram (<300 chars), two follow-ups, and a call opening — personalized only with verified facts.", "queue"],
  ["5 · Human approval","Nothing sends automatically. In the Approval Queue you can Approve, Edit, Request revision, Hold, or Reject. Editing an approved draft sends it back for re-approval. Try the channel tabs on Peachtree Stay's card.", "queue"],
  ["6 · Contact recorded","Integrations are Not Connected, so you copy the approved message, send it yourself, and “Mark as sent”. Westside Bungalows was contacted 3 days ago — each attempt logs channel, approver, sender, and outcome.", "pipeline"],
  ["7 · Follow-up scheduled","Westside Bungalows' first follow-up is due today (3 business days after contact), and Kirkwood Keys is overdue — both surface in Today's Priorities and the KPI row. The 3/5/7-day cadence is editable in Settings.", "dashboard"],
  ["8 · Reply tracked","Sweet Auburn Suites replied asking for pricing. The reply is recorded with sentiment, follow-ups stop automatically, and the lead is flagged for a human response.", "leads"],
  ["9 · Meeting scheduled","Grant Park Getaways moved to Meeting Scheduled with a prep reminder in Today's Priorities. The pipeline board tracks all 16 stages — drag cards to move them.", "pipeline"],
  ["10 · Revenue recorded","ATL Corporate Housing closed: $2,400/mo, $28,800 contract, $2,400 collected so far. Pipeline value and collected revenue are tracked separately — estimates never count as revenue.", "revenue"],
  ["11 · Opt-out honored","Cascade Villas asked to be removed. The do-not-contact flag blocks every send and follow-up action permanently, and the opt-out is in the audit trail.", "leads"],
  ["Done — your turn","Switch back to Real data and add your first lead, or ask Claude to run the daily agent research workflow to fill today's 20. Everything you saw works the same on real records.", "dashboard"]
];
let tourStep = -1;
function showTour(i){
  tourStep = i;
  const box = $("#tourbox");
  if(i<0 || i>=TOUR.length){ box.hidden = true; return; }
  const [title, text, view] = TOUR[i];
  if(scope!=="sample"){ scope="sample"; }
  if(currentView!==view) switchView(view); else renderAll();
  box.hidden = false;
  box.innerHTML = `<h3>${esc(title)}</h3><p>${esc(text)}</p>
    <div style="display:flex;gap:8px;align-items:center">
      <button class="btn small" id="tr-prev" ${i===0?"disabled":""}>← Back</button>
      <button class="btn small primary" id="tr-next">${i===TOUR.length-1?"Finish":"Next →"}</button>
      <span class="steps">${i+1} / ${TOUR.length}</span>
      <button class="btn small" id="tr-x" style="margin-left:auto">Exit</button>
    </div>`;
  $("#tr-prev").onclick=()=>showTour(i-1);
  $("#tr-next").onclick=()=>showTour(i+1 >= TOUR.length ? -1 : i+1);
  $("#tr-x").onclick=()=>showTour(-1);
}

/* ===================== 12. Agent workflow explainer ===================== */
function openAgentHow(){
  openModal(`
    <h2>How the daily agent works</h2>
    <p style="font-size:13px">Each business day the agent runs this loop. Steps 1–8 are research & preparation; <b>every outward message stops at step 8 for your approval</b>.</p>
    <ol style="font-size:13px;line-height:1.7;padding-left:20px">
      <li>Check the database for duplicates and existing contacts.</li>
      <li>Research new Atlanta-area STR prospects from lawful, public sources.</li>
      <li>Verify each lead (activity evidence, contact method, source links).</li>
      <li>Add up to 20 net-new qualified leads — never padding quality to hit quota.</li>
      <li>Score every lead 1–10 with per-category evidence.</li>
      <li>Explain each score and list missing information.</li>
      <li>Draft outreach for leads scoring 8+.</li>
      <li><b>Place drafts in the Approval Queue and stop.</b></li>
      <li>Surface follow-ups due today and prepare follow-up drafts.</li>
      <li>Flag replies that need a human response.</li>
      <li>Update dashboard metrics.</li>
      <li>Produce the daily report.</li>
      <li>List problems requiring human attention.</li>
    </ol>
    <div class="notice"><b>Running the research step:</b> ask Claude (the agent behind this dashboard) to “run today's lead research for the Atlanta STR dashboard”. It researches public sources and writes qualified, scored leads into this dashboard's database — you'll see them appear here. You can also add leads manually or import a CSV.</div>
    <div class="modalfoot"><button class="btn primary" onclick="document.getElementById('modalback').classList.remove('on')">Got it</button></div>`);
}

/* ===================== 13. Boot ===================== */
function bindChrome(){
  $$(".nav button").forEach(b=>b.onclick=()=>switchView(b.dataset.view));
  $("#scopeReal").onclick=()=>{ scope="real"; showTour(-1); renderAll(); };
  $("#scopeSample").onclick=()=>{ scope="sample"; renderAll(); maybeOfferSeed(); };
  let deb;
  $("#gsearch").addEventListener("input", e=>{
    clearTimeout(deb);
    deb = setTimeout(()=>{ filters.q = e.target.value.trim(); if(currentView!=="leads") switchView("leads"); else renderLeads(); }, 220);
  });
  $("#dashAddLead").onclick=()=>openLeadForm();
  $("#addLeadBtn").onclick=()=>openLeadForm();
  $("#importBtn").onclick=openImport;
  $("#exportBtn").onclick=()=>{
    const rows = scopedLeads().map(l=>({l, sc:computeScore(l)})).filter(x=>leadMatches(x.l,x.sc)).map(x=>x.l);
    exportCSV(rows, "filtered");
  };
  $("#agentHowBtn").onclick=openAgentHow;
  $("#startTour").onclick=()=>showTour(0);
  $("#resetSample").onclick=seedSample;
  $("#reportDate").addEventListener("change", renderReport);
  $("#exportReport").onclick=()=>{
    const txt = reportText();
    const fn = "agent-report-"+($("#reportDate").value||todayStr())+".txt";
    if(dl) dl.save({filename:fn, data:txt}).catch(()=>openCopyModal("Report — copy & save", txt));
    else openCopyModal("Report — copy & save", txt);
  };
  document.body.addEventListener("click", e=>{
    const o = e.target.closest("[data-open-lead]");
    if(o){ openLead(o.dataset.openLead); return; }
    const g = e.target.closest("[data-goto-queue]");
    if(g){ switchView("queue"); }
  });
}
async function seedSample(){
  if(!window.SAMPLE_SEED) return toast("Sample dataset unavailable.");
  if(scopedLeads().length || scope!=="sample"){
    scope="sample";
    if(Object.values(cache.leads).some(l=>l.sample) && !confirm("Reset the sample dataset? Existing sample records are replaced; real data is untouched.")) { renderAll(); return; }
  }
  // remove existing sample docs
  for(const [col, items] of [["leads",cache.leads],["drafts",cache.drafts],["activities",cache.activities]]){
    for(const [id,x] of Object.entries(items)) if(x.sample) await delDoc(col,id);
  }
  const S = window.SAMPLE_SEED;
  for(const [id,l] of Object.entries(S.leads)) await putDoc("leads", id, l);
  for(const [id,d] of Object.entries(S.drafts)) await putDoc("drafts", id, d);
  for(const [id,a] of Object.entries(S.activities)) await putDoc("activities", id, a);
  renderAll(); toast("Sample dataset loaded.");
}
function maybeOfferSeed(){
  if(scope==="sample" && !scopedLeads().length && window.SAMPLE_SEED){
    if(confirm("Demo Mode is empty. Load the sample dataset (fictional, clearly labeled records)?")) seedSample();
  }
}
async function boot(){
  bindChrome();
  renderAll(); // first paint with defaults
  const use = (window.claude && window.claude.use) ? n=>window.claude.use(n).catch(()=>null) : ()=>Promise.resolve(null);
  const [dbNS, aiNS, dlNS] = await Promise.all([use("db"), use("sample"), use("downloads")]);
  aiSample = aiNS; dl = dlNS;
  if(dbNS){
    db = dbNS; backend = "db";
    $("#storagePill").textContent = "● Shared database";
    const subCol = (col)=>{
      db.collection(col).limit(1000).onSnapshot(snap=>{
        const o = {}; snap.docs.forEach(d=>{ o[d.id] = d.data(); });
        cache[col] = o; renderAll();
      }, err=>{ toast("Live sync issue ("+col+"): "+err.code); });
    };
    subCol("leads"); subCol("drafts"); subCol("activities");
    db.doc("meta/settings").onSnapshot(snap=>{
      cache.settings = mergeSettings(snap.exists ? snap.data() : null);
      renderAll();
    }, ()=>{});
  } else {
    backend = "local"; loadLocal();
    $("#storagePill").textContent = "● This browser only";
    renderAll();
  }
}
boot();
