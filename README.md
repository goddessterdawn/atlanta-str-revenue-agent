# Atlanta STR Revenue Agent

A revenue-generating lead-gen + outreach agent for an Atlanta Airbnb /
short-term-rental **turnover cleaning** company. It researches, verifies, scores,
and tracks leads, and prepares **door-opener cold outreach** — but **never sends
anything without human approval**.

Two parts:

### 1. The dashboard (hosted, shareable)
A published Claude Artifact with a persistent shared database — KPIs, a scored
lead table, a 16-stage pipeline, an approval queue, daily reports, and revenue
tracking. Source lives here as backup and so it can be re-deployed:
`index.html`, `app.js`, `seed.js`.

Live: https://claude.ai/code/artifact/ff713ecd-8272-418d-86f3-8f780250e0f9
(share it from the artifact's own share menu to give the team access).

### 2. The daily agent (scheduled cloud run)
A scheduled Claude Code routine runs every weekday at ~7am Eastern, clones this
repo, and follows [`agent/AGENT.md`](agent/AGENT.md): research ~20 net-new
metro-Atlanta STR prospects, verify each on its official site, dedupe against the
dashboard, score 1–10, write qualified leads into the dashboard, and prepare
door-opener **Gmail drafts** (never sent) for leads scoring 8+.

```
agent/
  AGENT.md               self-contained daily playbook (the cloud agent reads this)
  business-settings.json company identity, service area, cadence, dashboard URL — EDIT THESE
  process-leads.mjs      deterministic scoring/dedup/ingest (mirrors the dashboard rubric)
  runs/                  committed dated run logs
  run/                   per-run working files (gitignored)
```

## Setup / maintenance
- **Edit `agent/business-settings.json`** (company name, phone, email, booking
  link, sender name) and the matching fields on the dashboard's Settings page, so
  outreach drafts aren't placeholders.
- Scoring rubric and the door-opener templates live in `agent/process-leads.mjs`
  and `app.js` (`buildTemplateDrafts`) — keep the two in sync if you change them.
- Nothing in this repo is a secret: no API keys or tokens. The dashboard database
  is protected by Artifact sharing, not by anything stored here.

## Guardrails
Public business info only; no logins bypassed; no invented data; the agent drafts
and stops — a human approves and sends every message; opt-outs are permanent.
