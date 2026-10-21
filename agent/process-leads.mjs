#!/usr/bin/env node
/* Atlanta STR Revenue Agent — daily processing step.
 *
 * Deterministic scoring/dedup/ingest, mirroring the dashboard's rubric
 * (app.js computeScore) so leads score identically in both places.
 *
 * INPUTS (in agent/run/):
 *   merged.json         - today's researched candidate leads (array of objects)
 *                         with the fields the research step observed on each
 *                         company's public site. Missing fields = "" or 0.
 *   existing-leads.json - OPTIONAL array of leads already in the dashboard DB
 *                         (export with: Artifact read_db, collection "leads").
 *                         Used to dedupe and avoid re-adding known companies.
 *
 * OUTPUTS (in agent/run/out/):
 *   lead-<id>.json, act-<id>.json, draft-<id>.json  - one doc each
 *   writes.json        - manifest for Artifact write_db (batch)
 *   gmail-drafts.json   - [{leadId,to,subject,body}] for leads scoring 8+
 *                         (DRAFTS ONLY — the agent must never send)
 *   report.json         - daily report counts + rejection/dup reasons
 *
 * Usage: node agent/process-leads.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUN = join(HERE, "run");
const OUT = join(RUN, "out");
mkdirSync(OUT, { recursive: true });

const SETTINGS = JSON.parse(readFileSync(join(HERE, "business-settings.json"), "utf8"));
const TODAY = new Date().toISOString().slice(0, 10);
const MGMT_TYPES = ["Vacation-rental property manager", "STR management company", "Real-estate operator (STR)", "Expanding portfolio operator"];
const CITIES = String(SETTINGS.approvedCities || "").split(",").map(norm);

function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
function normPhone(s) { return String(s || "").replace(/\D/g, ""); }
function normHost(s) { try { return new URL(/^https?:/.test(s) ? s : "https://" + s).host.replace(/^www\./, ""); } catch { return norm(s); } }
function clip(s, n) { s = String(s || ""); if (s.length <= n) return s; const c = s.slice(0, n - 1), sp = c.lastIndexOf(" "); return (sp > n * 0.6 ? c.slice(0, sp) : c) + "…"; }
function addBusinessDays(iso, n) { const [y, m, d] = iso.split("-").map(Number); const dt = new Date(Date.UTC(y, m - 1, d)); let left = n; while (left > 0) { dt.setUTCDate(dt.getUTCDate() + 1); const w = dt.getUTCDay(); if (w !== 0 && w !== 6) left--; } return dt.toISOString().slice(0, 10); }

function inArea(l) {
  const zip = parseInt(String(l.zip || "").slice(0, 5), 10);
  if (!isNaN(zip) && zip >= SETTINGS.zipLow && zip <= SETTINGS.zipHigh) return true;
  const loc = norm(l.location);
  return !!loc && CITIES.some(c => c && loc.includes(c));
}
function score(l) {
  const missing = [];
  const area = inArea(l);
  const ev = String(l.strEvidence || "").trim(), src = String(l.sourceLinks || "").trim();
  const props = Number(l.propertiesEst) || 0;
  const mgmt = MGMT_TYPES.includes(l.type);
  const dm = String(l.decisionMaker || "").trim();
  const contact = !!(String(l.email || "").trim() || String(l.phone || "").trim());
  const growth = String(l.growthSignal || "").trim();
  const need = String(l.needSignal || "").trim();
  if (!l.location && !l.zip) missing.push("Location / ZIP");
  if (!ev) missing.push("STR activity evidence");
  if (!src) missing.push("Source link");
  if (!props && !mgmt) missing.push("Estimated property count");
  if (!dm) missing.push("Decision-maker");
  if (!contact) missing.push("Business email or phone");
  const total =
    (area ? 2 : 0) +
    (ev && src ? 2 : (ev || src ? 1 : 0)) +
    ((mgmt || props >= 4) ? 2 : (props >= 2 ? 1 : 0)) +
    (dm ? 1 : 0) + (contact ? 1 : 0) + (growth ? 1 : 0) + (need ? 1 : 0);
  let disqual = null;
  if (!area && (l.zip || l.location)) disqual = "Outside the approved service area";
  else if (!ev) disqual = "No evidence of active short-term-rental operations";
  else if (!contact) disqual = "No verifiable business contact method";
  return { total, missing, disqual };
}
function fill(t) {
  return String(t || "")
    .replaceAll("[CLEANING COMPANY NAME]", SETTINGS.companyName)
    .replaceAll("[BUSINESS PHONE]", SETTINGS.phone)
    .replaceAll("[BUSINESS EMAIL]", SETTINGS.email)
    .replaceAll("[BOOKING LINK]", SETTINGS.bookingLink)
    .replaceAll("[PRIMARY OFFER]", SETTINGS.primaryOffer)
    .replaceAll("[SERVICE AREA]", SETTINGS.serviceArea)
    .replaceAll("[YOUR NAME]", SETTINGS.senderName);
}
function buildDrafts(l) {
  const first = (l.decisionMaker || "there").split(" ")[0];
  const hook = l.needSignal ? clip(l.needSignal, 90) : l.growthSignal ? clip(l.growthSignal, 90) : l.fitReason ? clip(l.fitReason, 90) : `you run short-term rentals in ${l.location || "Atlanta"}`;
  const props = l.propertiesEst ? `${l.propertiesEst} doors` : "your properties";
  const email = {
    subject: `Turnover cleaning for ${clip(l.company || l.name, 40)}?`,
    body: `Hi ${first},\n\n${hook.charAt(0).toUpperCase() + hook.slice(1)} — so you know how much rides on a clean, on-time turnover.\n\nWe're [CLEANING COMPANY NAME], an Atlanta turnover-cleaning crew for Airbnb and short-term rentals: photo-verified guest-ready checks, fresh linens, and a restock report after every clean.\n\nWould it be worth a quick look at covering a few of ${l.company || l.name}'s turnovers? A simple "not right now" is a perfectly fine answer.\n\n[CLEANING COMPANY NAME]\n[BUSINESS PHONE] · [BUSINESS EMAIL]`
  };
  return {
    email,
    linkedin: clip(`Hi ${first} — ${hook}. We're an Atlanta turnover-cleaning crew for STRs (photo-verified, fresh linens, restock reports). Worth a quick chat about covering a few of your turnovers?`, 300),
    facebook: clip(`Hi ${first} — we're an Atlanta turnover-cleaning crew for short-term rentals: photo-verified guest-ready checks and restock reports. Open to me sending over how we could help with ${l.company || l.name}'s turnovers?`, 300),
    instagram: clip(`Hi ${first}! We do Airbnb/STR turnover cleaning in ${l.location || "Atlanta"} — photo-verified, fresh linens, restock reports. Mind if I share how we could cover a few of your turnovers?`, 300),
    followup1: { subject: "Re: " + email.subject, body: `Hi ${first},\n\nJust floating this back up in case it got buried. No pitch — I'm only trying to find out whether reliable turnover cleaning is something ${l.company || l.name} could use a hand with right now.\n\nIf it's not the right time, no worries at all — just let me know and I'll stop here.\n\n[CLEANING COMPANY NAME]` },
    followup2: `Hi ${first} — last note from me, I promise. If turnover cleaning ever becomes a headache, we're here: [BOOKING LINK]. Either way, wishing ${l.company || l.name} a full calendar!`,
    call: `Hi ${first}, this is [YOUR NAME] with [CLEANING COMPANY NAME] — we do turnover cleaning for short-term rentals here in ${l.location || "Atlanta"}. I'll be quick: I'm just trying to learn how you're handling turnovers across ${props} right now, and whether it'd be worth us talking. Is now an okay moment for 30 seconds?`
  };
}

const BASE = { sample: false, decisionMaker: "", role: "", company: "", location: "", zip: "", website: "", email: "", phone: "", linkedin: "", facebook: "", instagram: "", propertiesEst: 0, strEvidence: "", sourceLinks: "", source: "Daily agent — web research", discovered: TODAY, verified: TODAY, growthSignal: "", needSignal: "", fitReason: "", recChannel: "Email", stage: "New", owner: "Daily Agent", lastContactDate: "", lastContactChannel: "", attempts: 0, responseSummary: "", sentiment: "", nextAction: "", nextFollowUp: "", followUpPriority: "Normal", apptStatus: "", proposalStatus: "", oppValue: 0, wonLost: "", wonLostDate: "", revenueCollected: 0, contractValue: 0, proposalAmount: 0, expectedMonthly: 0, firstContactDate: "", responseDate: "", meetingDate: "", dnc: false, notes: "", dupStatus: "unique", dupOf: "", createdAt: Date.now() };

const raw = JSON.parse(readFileSync(join(RUN, "merged.json"), "utf8"));
const existing = existsSync(join(RUN, "existing-leads.json")) ? JSON.parse(readFileSync(join(RUN, "existing-leads.json"), "utf8")) : [];
const known = existing.map(l => ({ em: norm(l.email), ph: normPhone(l.phone), nm: norm(l.name), co: norm(l.company), ws: l.website ? normHost(l.website) : "", id: l.id || l._id || "", name: l.name }));

const seen = [], accepted = [], rejected = [], dupes = [];
function findDup(l) {
  const em = norm(l.email), ph = normPhone(l.phone), nm = norm(l.name), co = norm(l.company), ws = l.website ? normHost(l.website) : "";
  const pool = known.concat(seen);
  for (const k of pool) {
    if (em && k.em === em) return k;
    if (ph && ph.length >= 10 && k.ph === ph) return k;
    if (ws && k.ws === ws) return k;
    if (nm && (k.nm === nm || (co && k.co === co))) return k;
  }
  return null;
}
let idx = 1;
const slug = s => norm(s).slice(0, 18) || ("lead" + idx);
for (const r of raw) {
  const l = Object.assign({}, BASE, r);
  l.propertiesEst = Number(l.propertiesEst) || 0;
  const dup = findDup(l);
  const sc = score(l);
  l.score = sc.total;
  l.id = "L-" + TODAY.replaceAll("-", "") + "-" + String(idx++).padStart(2, "0") + "-" + slug(l.name);
  seen.push({ em: norm(l.email), ph: normPhone(l.phone), nm: norm(l.name), co: norm(l.company), ws: l.website ? normHost(l.website) : "", id: l.id, name: l.name });
  if (dup) { l.dupStatus = "duplicate"; l.dupOf = dup.id || ""; l.stage = "Not Qualified"; l.notes = "Agent note: duplicate of " + (dup.name || dup.id || "an existing lead"); dupes.push({ l, of: dup.name || dup.id }); continue; }
  if (sc.disqual) { l.stage = sc.disqual.includes("service area") ? "Not Qualified" : "Researching"; l.notes = "Agent note: " + sc.disqual; rejected.push({ l, why: sc.disqual }); continue; }
  l.stage = sc.total >= 8 ? "Awaiting Approval" : "Qualified";
  l.nextAction = sc.total >= 8 ? "Review the drafted door-opener before sending" : (sc.missing.length ? "Fill gaps: " + sc.missing.slice(0, 2).join(", ") : "Decide outreach channel");
  accepted.push({ l, sc });
}

const writes = [], gmail = [];
function emit(l) {
  const doc = Object.assign({}, l); delete doc.id;
  writeFileSync(join(OUT, "lead-" + l.id + ".json"), JSON.stringify(doc));
  writes.push({ op: "set", collection: "leads", doc_id: l.id, file: "out/lead-" + l.id + ".json" });
  const msg = l.dupStatus === "duplicate" ? "Daily agent: duplicate detected (" + (l.dupOf || "existing lead") + "); excluded from goal."
    : (l.notes || "").startsWith("Agent note:") ? "Daily agent: added but not counted — " + l.notes.slice(12)
      : "Daily agent: researched & verified from public sources. Score " + l.score + "/10.";
  const aid = "A-" + l.id;
  writeFileSync(join(OUT, "act-" + aid + ".json"), JSON.stringify({ sample: false, leadId: l.id, ts: Date.now(), date: TODAY, time: "07:00", channel: "", type: "audit", message: msg }));
  writes.push({ op: "set", collection: "activities", doc_id: aid, file: "out/act-" + aid + ".json" });
}
for (const { l } of accepted) emit(l);
for (const { l } of rejected) emit(l);
for (const { l } of dupes) emit(l);
for (const { l, sc } of accepted) {
  if (sc.total < 8) continue;
  const channels = buildDrafts(l);
  const d = { leadId: l.id, sample: false, status: "awaiting", generatedBy: "agent", createdAt: Date.now(), recommendedSend: TODAY, recommendedFollowUp: addBusinessDays(TODAY, SETTINGS.followupDays[0] || 3), supportingSource: String(l.sourceLinks || "").split(/\n|,/)[0] || "", channels };
  const did = "D-" + l.id;
  writeFileSync(join(OUT, "draft-" + did + ".json"), JSON.stringify(d));
  writes.push({ op: "set", collection: "drafts", doc_id: did, file: "out/draft-" + did + ".json" });
  if (l.email) gmail.push({ leadId: l.id, name: l.name, to: l.email, subject: fill(channels.email.subject), body: fill(channels.email.body) });
}

const report = {
  date: TODAY, researched: raw.length, accepted: accepted.length,
  highPriority8plus: accepted.filter(x => x.sc.total >= 8).length,
  draftsForGmail: gmail.length, rejected: rejected.length, duplicates: dupes.length,
  rejections: rejected.map(r => ({ name: r.l.name, reason: r.why })),
  dupeMatches: dupes.map(d => ({ name: d.l.name, of: d.of })),
  accepted_list: accepted.map(x => ({ name: x.l.name, score: x.sc.total, location: x.l.location, contact: x.l.email || x.l.phone, missing: x.sc.missing }))
};
writeFileSync(join(OUT, "writes.json"), JSON.stringify(writes, null, 1));
writeFileSync(join(OUT, "gmail-drafts.json"), JSON.stringify(gmail, null, 1));
writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));

console.log(`[process-leads] ${TODAY}`);
console.log(`  researched=${raw.length} accepted=${accepted.length} hi8+=${report.highPriority8plus} rejected=${rejected.length} dupes=${dupes.length}`);
console.log(`  wrote ${writes.length} DB docs to out/writes.json, ${gmail.length} Gmail door-opener drafts to out/gmail-drafts.json`);
if (rejected.length) console.log("  rejected: " + rejected.map(r => r.l.name + " (" + r.why + ")").join("; "));
if (dupes.length) console.log("  dupes: " + dupes.map(d => d.l.name + " = " + d.of).join("; "));
