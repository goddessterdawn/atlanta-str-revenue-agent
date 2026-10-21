/* Sample dataset for Demo Mode. Every record carries sample:true and is
   labeled "Sample Data" in the UI. All businesses and people are fictional. */
(function (root) {
  function D(offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const p = n => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function Dm(offsetMonths, day) {
    const d = new Date();
    d.setMonth(d.getMonth() + offsetMonths, day || 15);
    const p = n => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  const L = (o) => Object.assign({
    sample: true, decisionMaker: "", role: "", company: "", location: "", zip: "",
    website: "", email: "", phone: "", linkedin: "", facebook: "", instagram: "",
    propertiesEst: 0, strEvidence: "", sourceLinks: "", source: "Web research",
    discovered: D(0), verified: D(0), growthSignal: "", needSignal: "",
    fitReason: "", recChannel: "Email", stage: "New", owner: "Unassigned",
    lastContactDate: "", lastContactChannel: "", attempts: 0,
    responseSummary: "", sentiment: "", nextAction: "", nextFollowUp: "",
    followUpPriority: "Normal", apptStatus: "", proposalStatus: "",
    oppValue: 0, wonLost: "", wonLostDate: "", revenueCollected: 0,
    contractValue: 0, proposalAmount: 0, expectedMonthly: 0,
    firstContactDate: "", responseDate: "", meetingDate: "",
    dnc: false, notes: "", dupStatus: "unique", dupOf: "",
    createdAt: Date.now()
  }, o);

  const leads = {
    "SL-1": L({
      name: "Peachtree Stay Co.", company: "Peachtree Stay Co.",
      decisionMaker: "Maya Thompson", role: "Operations Manager",
      type: "STR management company", location: "Midtown Atlanta", zip: "30308",
      website: "https://example.com/peachtreestay", email: "hello@peachtreestay.example",
      phone: "(404) 555-0142", linkedin: "linkedin.com/company/peachtree-stay-example",
      instagram: "@peachtreestay_example", propertiesEst: 14,
      strEvidence: "14 active Airbnb listings linked from company site; 'Superhost managed' badges; public turnover calendar.",
      sourceLinks: "https://example.com/peachtreestay/listings\nhttps://example.com/directory/atl-str-managers",
      growthSignal: "Posted 3 new Midtown listings this month; hiring a guest-experience coordinator.",
      fitReason: "Scaling STR manager in Midtown with 14 doors and no in-house cleaning team listed.",
      recChannel: "Email", stage: "Draft Ready", owner: "You",
      nextAction: "Review outreach draft in Approval Queue",
      source: "Public listing directory"
    }),
    "SL-2": L({
      name: "Midtown Loft Hosts", company: "Midtown Loft Hosts",
      decisionMaker: "Jordan Ellis", role: "Co-host",
      type: "Co-host", location: "Midtown Atlanta", zip: "30309",
      email: "stay@midtownlofts.example", propertiesEst: 2,
      strEvidence: "Two active loft listings; co-host profile public on booking platform.",
      sourceLinks: "https://example.com/midtown-lofts",
      fitReason: "Small co-host operation; could grow, but limited door count today.",
      stage: "Qualified", owner: "You", discovered: D(-1), verified: D(-1),
      nextAction: "Re-check door count next month",
      source: "Host community forum"
    }),
    "SL-3": L({
      name: "Peachtree Stay Company", company: "Peachtree Stay Co.",
      decisionMaker: "M. Thompson", role: "Operations",
      type: "STR management company", location: "Atlanta", zip: "30308",
      email: "hello@peachtreestay.example", propertiesEst: 14,
      strEvidence: "Same organization as SL-1 under a slightly different name.",
      sourceLinks: "https://example.com/peachtreestay",
      stage: "Not Qualified", dupStatus: "duplicate", dupOf: "SL-1",
      notes: "Duplicate of Peachtree Stay Co. — caught by email + company match. Does not count toward the daily goal.",
      source: "Business registry"
    }),
    "SL-4": L({
      name: "Blue Ridge Cabin Retreats", company: "Blue Ridge Cabin Retreats",
      decisionMaker: "Sam Carter", role: "Owner",
      type: "Vacation-rental property manager", location: "Blairsville, GA", zip: "30512",
      email: "stay@blueridgecabins.example", phone: "(706) 555-0188", propertiesEst: 9,
      strEvidence: "9 cabin listings on company site.",
      sourceLinks: "https://example.com/blueridgecabins",
      stage: "Not Qualified",
      notes: "Strong operator, but ~100 miles outside the approved Atlanta service area.",
      source: "Web research", discovered: D(-1), verified: D(-1)
    }),
    "SL-5": L({
      name: "Ponce Park Stays", company: "Ponce Park Stays",
      type: "Airbnb host", location: "Old Fourth Ward, Atlanta", zip: "30306",
      propertiesEst: 3,
      strEvidence: "Three active listings near Ponce City Market; recent guest reviews.",
      sourceLinks: "https://example.com/ponce-park-stays",
      stage: "Researching", owner: "You",
      nextAction: "Find a public business email or phone before this lead can be contacted",
      notes: "No verified contact method yet — cannot enter outreach until one is found.",
      source: "Listing search"
    }),
    "SL-6": L({
      name: "Westside Bungalows", company: "Westside Bungalows LLC",
      decisionMaker: "Priya Nair", role: "Owner-operator",
      type: "Owner with multiple STR properties", location: "West Midtown, Atlanta", zip: "30318",
      email: "priya@westsidebungalows.example", phone: "(404) 555-0117",
      website: "https://example.com/westsidebungalows", propertiesEst: 5,
      strEvidence: "5 bungalow listings; self-managed per site FAQ.",
      sourceLinks: "https://example.com/westsidebungalows",
      needSignal: "Site FAQ mentions 'same-day turnover windows are tight' — explicit turnover pain.",
      fitReason: "Owner-operator with 5 doors and stated same-day turnover pressure.",
      stage: "Follow-Up Due", owner: "You",
      discovered: D(-5), verified: D(-5),
      lastContactDate: D(-3), lastContactChannel: "Email", attempts: 1,
      firstContactDate: D(-3), nextFollowUp: D(0), followUpPriority: "High",
      nextAction: "Send first follow-up (due today)",
      source: "Public listing directory"
    }),
    "SL-7": L({
      name: "Sweet Auburn Suites", company: "Sweet Auburn Suites",
      decisionMaker: "Devon Brooks", role: "Managing Partner",
      type: "Furnished-rental operator", location: "Sweet Auburn, Atlanta", zip: "30312",
      email: "devon@sweetauburnsuites.example", phone: "(404) 555-0129",
      propertiesEst: 7, website: "https://example.com/sweetauburn",
      strEvidence: "7 furnished units marketed for 30+ day and short stays.",
      sourceLinks: "https://example.com/sweetauburn",
      growthSignal: "Announced two new units opening next quarter.",
      fitReason: "Growing furnished operator; mixed stay lengths mean frequent turnovers.",
      stage: "Responded", owner: "You",
      discovered: D(-8), verified: D(-8),
      lastContactDate: D(-2), lastContactChannel: "Email", attempts: 1,
      firstContactDate: D(-2), responseDate: D(-1),
      responseSummary: "Replied: 'Interested — what do you charge for a 2BR turnover?' Wants pricing.",
      sentiment: "Positive",
      nextAction: "Reply with pricing and offer a 15-min call",
      source: "Chamber directory"
    }),
    "SL-8": L({
      name: "Grant Park Getaways", company: "Grant Park Getaways",
      decisionMaker: "Alicia Fontaine", role: "Founder",
      type: "Vacation-rental property manager", location: "Grant Park, Atlanta", zip: "30315",
      email: "alicia@grantparkgetaways.example", phone: "(404) 555-0163",
      propertiesEst: 11, website: "https://example.com/grantparkgetaways",
      strEvidence: "11 managed listings; public host profile with 400+ reviews.",
      sourceLinks: "https://example.com/grantparkgetaways",
      growthSignal: "Job post for a part-time field inspector suggests portfolio growth.",
      fitReason: "11-door manager actively growing; inspections already on their mind.",
      stage: "Meeting Scheduled", owner: "You",
      discovered: D(-12), verified: D(-12),
      lastContactDate: D(-4), lastContactChannel: "Email", attempts: 2,
      firstContactDate: D(-9), responseDate: D(-4),
      responseSummary: "Positive reply; asked for a walkthrough of linen service options.",
      sentiment: "Positive", meetingDate: D(2), apptStatus: "Scheduled",
      oppValue: 1800,
      nextAction: "Prepare meeting: linen program one-pager",
      source: "Public listing directory"
    }),
    "SL-9": L({
      name: "ATL Corporate Housing Group", company: "ATL Corporate Housing Group",
      decisionMaker: "Marcus Lee", role: "Director of Operations",
      type: "STR management company", location: "Buckhead, Atlanta", zip: "30326",
      email: "mlee@atlcorphousing.example", phone: "(404) 555-0104",
      propertiesEst: 22, website: "https://example.com/atlcorphousing",
      strEvidence: "22 managed corporate and short-stay units across Buckhead and Midtown.",
      sourceLinks: "https://example.com/atlcorphousing",
      needSignal: "RFP page sought 'turnover cleaning and restocking partner'.",
      fitReason: "Published an open request for exactly our service.",
      stage: "Won", owner: "You",
      discovered: D(-30), verified: D(-30),
      lastContactDate: D(-10), lastContactChannel: "Phone", attempts: 3,
      firstContactDate: D(-25), responseDate: D(-22),
      meetingDate: D(-18), apptStatus: "Completed",
      proposalStatus: "Accepted", proposalAmount: 2400,
      expectedMonthly: 2400, contractValue: 28800,
      wonLost: "won", wonLostDate: D(-6), revenueCollected: 2400,
      oppValue: 28800,
      sentiment: "Positive",
      nextAction: "Onboard: confirm restocking checklist",
      source: "RFP board"
    }),
    "SL-10": L({
      name: "Cascade Villas", company: "Cascade Villas",
      decisionMaker: "T. Osei", role: "Owner",
      type: "Airbnb host", location: "Cascade Heights, Atlanta", zip: "30311",
      email: "stay@cascadevillas.example", propertiesEst: 4,
      strEvidence: "4 active listings.",
      sourceLinks: "https://example.com/cascadevillas",
      stage: "Do Not Contact", owner: "You", dnc: true,
      discovered: D(-15), verified: D(-15),
      lastContactDate: D(-11), lastContactChannel: "Email", attempts: 1,
      firstContactDate: D(-11), responseDate: D(-10),
      responseSummary: "Replied: 'Please remove me from your list.' Opted out.",
      sentiment: "Negative",
      notes: "Opt-out honored " + D(-10) + ". All outreach permanently stopped.",
      source: "Listing search"
    }),
    "SL-11": L({
      name: "Decatur Dwell Management", company: "Decatur Dwell Management",
      decisionMaker: "Hannah Cho", role: "Portfolio Manager",
      type: "Vacation-rental property manager", location: "Decatur", zip: "30030",
      email: "hannah@decaturdwell.example", phone: "(404) 555-0171",
      propertiesEst: 6, website: "https://example.com/decaturdwell",
      strEvidence: "6 managed STR listings in Decatur and Avondale Estates.",
      sourceLinks: "https://example.com/decaturdwell",
      needSignal: "Review responses repeatedly apologize for late check-in readiness.",
      fitReason: "6-door Decatur manager with visible guest-readiness complaints.",
      recChannel: "LinkedIn", stage: "Awaiting Approval", owner: "You",
      nextAction: "Approve or edit LinkedIn-first outreach",
      source: "Review-site research"
    }),
    "SL-12": L({
      name: "Old Fourth Ward Flats", company: "O4W Flats",
      decisionMaker: "", role: "",
      type: "Airbnb host", location: "Old Fourth Ward, Atlanta", zip: "30312",
      email: "host@o4wflats.example", propertiesEst: 3,
      strEvidence: "3 active flats; frequent 1-night stays per calendar.",
      sourceLinks: "https://example.com/o4wflats",
      fitReason: "High-frequency turnovers from 1-night stays.",
      stage: "New", nextAction: "Identify the decision-maker, then re-score",
      source: "Listing search"
    }),
    "SL-13": L({
      name: "Kirkwood Keys", company: "Kirkwood Keys",
      decisionMaker: "Robin Vance", role: "Owner",
      type: "Owner with multiple STR properties", location: "Kirkwood, Atlanta", zip: "30317",
      email: "robin@kirkwoodkeys.example", phone: "(404) 555-0195",
      propertiesEst: 4,
      strEvidence: "4 listings; self-managed.",
      sourceLinks: "https://example.com/kirkwoodkeys",
      fitReason: "4-door self-managing owner in the core service area.",
      stage: "Follow-Up Due", owner: "You",
      discovered: D(-9), verified: D(-9),
      lastContactDate: D(-6), lastContactChannel: "Email", attempts: 1,
      firstContactDate: D(-6), nextFollowUp: D(-2), followUpPriority: "High",
      nextAction: "Follow-up is overdue by 2 days",
      source: "Public listing directory"
    })
  };

  const drafts = {
    "SD-1": {
      sample: true, leadId: "SL-1", status: "awaiting", generatedBy: "agent",
      createdAt: Date.now(), recommendedSend: D(0), recommendedFollowUp: D(3),
      supportingSource: "https://example.com/peachtreestay/listings",
      channels: {
        email: {
          subject: "Same-day turnovers for Peachtree Stay's 14 Midtown doors",
          body: "Hi Maya,\n\nI noticed Peachtree Stay added three new Midtown listings this month — congrats on the growth. Fourteen doors means a lot of same-day turnovers riding on one cleaning calendar.\n\n[CLEANING COMPANY NAME] specializes in Airbnb turnover cleaning in Atlanta: photo-verified guest-ready checks, linen handling, and restock reporting after every clean, so your team hears about issues before guests do.\n\nWould a 15-minute call this week be useful to see if we can take turnover scheduling off your plate? Book a time here: [BOOKING LINK].\n\nBest,\n[CLEANING COMPANY NAME]\n[BUSINESS PHONE] · [BUSINESS EMAIL]"
        },
        linkedin: "Hi Maya — saw Peachtree Stay added 3 new Midtown listings this month. We handle Airbnb turnover cleaning for Atlanta operators (photo-verified, with restock reports). Open to a quick 15-min call about your turnover calendar?",
        facebook: "Hi Maya — congrats on Peachtree Stay's new Midtown listings. We do photo-verified Airbnb turnover cleaning across Atlanta and would love to show you how we keep 10+ door portfolios guest-ready. Worth a quick chat?",
        instagram: "Hi Maya! Saw the new Midtown listings — nice growth. We handle photo-verified Airbnb turnover cleaning for Atlanta managers. Happy to share how we keep multi-door calendars guest-ready if useful!",
        followup1: {
          subject: "Re: Same-day turnovers for Peachtree Stay",
          body: "Hi Maya,\n\nFollowing up on my note from earlier this week. With 14 active doors, even one missed turnover is a refund risk — we build the schedule around your check-out times so that never happens.\n\nHappy to share pricing for a 14-door portfolio. Would a quick call work? [BOOKING LINK]\n\n[CLEANING COMPANY NAME]"
        },
        followup2: "Hi Maya — last note from me. If turnover cleaning ever becomes the bottleneck as Peachtree Stay grows, we're a 15-minute call away: [BOOKING LINK]. Either way, good luck with the new Midtown units!",
        call: "Hi Maya, this is [YOUR NAME] with [CLEANING COMPANY NAME]. I work with Atlanta short-term-rental managers on turnover cleaning — I saw Peachtree Stay just added three Midtown listings and wanted to ask how you're covering same-day turnovers right now."
      }
    },
    "SD-2": {
      sample: true, leadId: "SL-11", status: "awaiting", generatedBy: "agent",
      createdAt: Date.now(), recommendedSend: D(0), recommendedFollowUp: D(3),
      supportingSource: "https://example.com/decaturdwell",
      channels: {
        email: {
          subject: "Guest-ready on time, every turnover — Decatur Dwell",
          body: "Hi Hannah,\n\nReading Decatur Dwell's recent reviews, a few guests mentioned check-in readiness — a familiar pain when six doors share one turnover window.\n\n[CLEANING COMPANY NAME] does Airbnb turnover cleaning across Decatur and Atlanta: we schedule around your check-outs, photo-verify every unit, and flag low supplies before guests arrive. Managers use us so 'late check-in' reviews stop happening.\n\nWorth a 15-minute call to compare notes? [BOOKING LINK]\n\nBest,\n[CLEANING COMPANY NAME]\n[BUSINESS PHONE] · [BUSINESS EMAIL]"
        },
        linkedin: "Hi Hannah — we help Decatur STR managers hit every check-in window with photo-verified turnover cleaning. Noticed a few readiness mentions in Decatur Dwell's reviews; we can make those disappear. Open to a 15-min call?",
        facebook: "Hi Hannah — we provide turnover cleaning for Decatur short-term rentals with photo-verified guest-ready checks. Would love to chat about Decatur Dwell's six doors if the turnover calendar ever feels tight.",
        instagram: "Hi Hannah! We do Airbnb turnover cleaning in Decatur — photo-verified and scheduled around your check-outs. Happy to share how we keep 6-door portfolios guest-ready on time!",
        followup1: {
          subject: "Re: Guest-ready on time — Decatur Dwell",
          body: "Hi Hannah,\n\nQuick follow-up. The fastest fix for readiness complaints is a cleaning partner who schedules from your check-out feed instead of a fixed route. That's how we run turnovers for Atlanta managers.\n\n15 minutes this week? [BOOKING LINK]\n\n[CLEANING COMPANY NAME]"
        },
        followup2: "Hi Hannah — closing the loop. If turnover readiness ever bites again, we're here: [BOOKING LINK]. Wishing Decatur Dwell a full calendar either way!",
        call: "Hi Hannah, this is [YOUR NAME] from [CLEANING COMPANY NAME]. We do turnover cleaning for short-term rentals around Decatur — I wanted to ask how you're scheduling turnovers across your six doors today."
      }
    },
    "SD-3": {
      sample: true, leadId: "SL-8", status: "approved", generatedBy: "agent",
      createdAt: Date.now() - 86400000 * 4, approvedBy: "Owner", approvedAt: D(-4),
      recommendedSend: D(-4), recommendedFollowUp: D(-1),
      supportingSource: "https://example.com/grantparkgetaways",
      channels: {
        email: {
          subject: "Linen program details ahead of our call — Grant Park Getaways",
          body: "Hi Alicia,\n\nLooking forward to our call. Ahead of it, here's the short version of our linen service: hotel-grade sets per unit, swapped at every turnover, with counts reported so nothing walks away.\n\nIf anything specific would help to see on the call, let me know.\n\n[CLEANING COMPANY NAME]\n[BUSINESS PHONE]"
        },
        linkedin: "Hi Alicia — looking forward to the walkthrough. I'll bring linen program pricing for 11 doors plus our inspection checklist.",
        facebook: "", instagram: "",
        followup1: { subject: "", body: "" }, followup2: "", call: ""
      }
    }
  };

  const activities = {
    "SA-1": { sample: true, leadId: "SL-6", ts: Date.now() - 86400000 * 3, date: D(-3), time: "10:05", channel: "Email", type: "contact", message: "Initial approved outreach sent (email).", approvalStatus: "approved", approvedBy: "Owner", sentBy: "Owner", outcome: "No reply yet", nextAction: "Follow-up in 3 business days", nextFollowUp: D(0) },
    "SA-2": { sample: true, leadId: "SL-7", ts: Date.now() - 86400000 * 2, date: D(-2), time: "09:40", channel: "Email", type: "contact", message: "Initial approved outreach sent (email).", approvalStatus: "approved", approvedBy: "Owner", sentBy: "Owner", outcome: "Replied next day", nextAction: "", nextFollowUp: "" },
    "SA-3": { sample: true, leadId: "SL-7", ts: Date.now() - 86400000 * 1, date: D(-1), time: "14:22", channel: "Email", type: "reply", message: "Positive reply received.", replySummary: "'Interested — what do you charge for a 2BR turnover?'", outcome: "Needs pricing reply", nextAction: "Send pricing + offer 15-min call" },
    "SA-4": { sample: true, leadId: "SL-8", ts: Date.now() - 86400000 * 9, date: D(-9), time: "11:12", channel: "Email", type: "contact", message: "Initial approved outreach sent (email).", approvalStatus: "approved", approvedBy: "Owner", sentBy: "Owner", outcome: "Replied after follow-up" },
    "SA-5": { sample: true, leadId: "SL-8", ts: Date.now() - 86400000 * 4, date: D(-4), time: "16:03", channel: "Email", type: "reply", message: "Positive reply.", replySummary: "Asked for linen service walkthrough.", outcome: "Meeting requested" },
    "SA-6": { sample: true, leadId: "SL-8", ts: Date.now() - 86400000 * 3, date: D(-3), time: "09:15", channel: "Email", type: "meeting", message: "Meeting scheduled for " + D(2) + " (video call).", outcome: "Scheduled" },
    "SA-7": { sample: true, leadId: "SL-9", ts: Date.now() - 86400000 * 25, date: D(-25), time: "10:00", channel: "Email", type: "contact", message: "Initial approved outreach sent (email).", approvalStatus: "approved", approvedBy: "Owner", sentBy: "Owner" },
    "SA-8": { sample: true, leadId: "SL-9", ts: Date.now() - 86400000 * 22, date: D(-22), time: "13:30", channel: "Email", type: "reply", message: "Reply received.", replySummary: "Asked for references and insurance docs.", outcome: "Docs sent" },
    "SA-9": { sample: true, leadId: "SL-9", ts: Date.now() - 86400000 * 18, date: D(-18), time: "15:00", channel: "Phone", type: "meeting", message: "Walkthrough meeting completed at Buckhead unit.", outcome: "Proposal requested" },
    "SA-10": { sample: true, leadId: "SL-9", ts: Date.now() - 86400000 * 14, date: D(-14), time: "09:00", channel: "Email", type: "proposal", message: "Proposal sent: $2,400/mo turnover + restock program.", outcome: "Accepted " + D(-6) },
    "SA-11": { sample: true, leadId: "SL-9", ts: Date.now() - 86400000 * 6, date: D(-6), time: "12:00", channel: "Email", type: "won", message: "Opportunity WON. 12-month agreement, $2,400/mo ($28,800 contract). First invoice collected: $2,400.", outcome: "Customer" },
    "SA-12": { sample: true, leadId: "SL-10", ts: Date.now() - 86400000 * 11, date: D(-11), time: "10:45", channel: "Email", type: "contact", message: "Initial approved outreach sent (email).", approvalStatus: "approved", approvedBy: "Owner", sentBy: "Owner" },
    "SA-13": { sample: true, leadId: "SL-10", ts: Date.now() - 86400000 * 10, date: D(-10), time: "08:20", channel: "Email", type: "optout", message: "Lead opted out ('Please remove me from your list'). Marked Do Not Contact; all future outreach blocked.", outcome: "Opt-out honored" },
    "SA-14": { sample: true, leadId: "SL-3", ts: Date.now() - 3600000, date: D(0), time: "08:05", channel: "", type: "audit", message: "Duplicate check: matched SL-1 (Peachtree Stay Co.) on email + company name. Excluded from daily goal." },
    "SA-15": { sample: true, leadId: "SL-4", ts: Date.now() - 86400000, date: D(-1), time: "08:10", channel: "", type: "audit", message: "Disqualified: ZIP 30512 (Blairsville) is outside the approved Atlanta service area." }
  };

  root.SAMPLE_SEED = { leads, drafts, activities };
})(typeof window !== "undefined" ? window : module.exports);
