import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  Channel, ClaimInstance, ClaimKey, Cluster, ConnectorId, CorpusData, Debate, DebateTurn, DocPoint, PayrollFact, RuleId, SourceDoc,
} from "../src/lib/types";
import { DOCS, PEOPLE, type TopicId } from "./seed-docs";

const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "src/data/corpus.json");
const TODAY = "2026-09-30";

const TOPICS: { id: TopicId; label: string; summary: string; color: string }[] = [
  { id: "indexation-cap", label: "Indexation cap 2026", summary: "When and above which gross monthly pay the 2026 indexation cap limits automatic wage indexation.", color: "#6cc5ff" },
  { id: "meal-vouchers", label: "Meal vouchers", summary: "Face value, employee share and ordering of electronic meal vouchers.", color: "#7cefc0" },
  { id: "home-working-allowance", label: "Home working allowance", summary: "Tax-free monthly allowance for structural home working after the April 2026 indexation.", color: "#f3c14e" },
  { id: "eco-cheques", label: "Eco-cheques", summary: "Yearly eco-cheque amount in PC 200 and how part-time employees are treated.", color: "#e183f5" },
  { id: "reintegration", label: "Reintegration and sick leave", summary: "The 2026 sick-leave reform: reintegration plan deadlines and the employer contribution in months 2 and 3.", color: "#ffab73" },
  { id: "voluntary-overtime", label: "Voluntary overtime", summary: "Yearly quota of voluntary overtime hours and the written agreement it requires.", color: "#95a0ff" },
  { id: "year-end-bonus-pc200", label: "Year-end bonus PC 200", summary: "Entitlement, seniority condition and payment month of the PC 200 year-end bonus.", color: "#4fd39a" },
  { id: "km-allowance", label: "Kilometre allowance", summary: "Flat rate per kilometre for business trips with a private car and its yearly cap.", color: "#ff8fa3" },
  { id: "flexi-jobs", label: "Flexi-jobs", summary: "Minimum flexi wage and the employer contribution for flexi-jobs in hospitality and care.", color: "#c8f23d" },
  { id: "payroll-cutoff", label: "Monthly payroll close", summary: "Monthly close dates per client for delivering payroll data to Payroll Ops BE.", color: "#8fe9ff" },
  { id: "notice-period", label: "Notice periods", summary: "Notice periods under the single status law, for dismissal and resignation.", color: "#ffd60a" },
  { id: "company-car-solidarity", label: "Company cars", summary: "CO2 solidarity contribution and tax deductibility of company cars in 2026.", color: "#b28dff" },
];

const CLAIM_KEYS: ClaimKey[] = [
  { id: "indexation_cap.threshold", topicId: "indexation-cap", label: "Indexation cap threshold", question: "Above which gross monthly pay does automatic indexation stop in 2026?", unit: "EUR" },
  { id: "indexation_cap.start_date", topicId: "indexation-cap", label: "Start date of the indexation cap", question: "From which date does the indexation cap apply in Belgium?" },
  { id: "indexation_cap.first_application_pc200", topicId: "indexation-cap", label: "First application of the cap in PC 200", question: "When does the indexation cap first apply to employees in PC 200?" },
  { id: "meal_vouchers.max_face_value", topicId: "meal-vouchers", label: "Max face value of a meal voucher", question: "What is the maximum face value of a meal voucher in 2026?", unit: "EUR" },
  { id: "meal_vouchers.employee_contribution", topicId: "meal-vouchers", label: "Minimum employee share per meal voucher", question: "How much does the employee pay per meal voucher at minimum?", unit: "EUR" },
  { id: "home_working.max_allowance", topicId: "home-working-allowance", label: "Max home working allowance", question: "What is the maximum tax-free home working allowance per month from April 2026?", unit: "EUR" },
  { id: "eco_cheques.max_amount", topicId: "eco-cheques", label: "Max eco-cheque amount per year", question: "What is the maximum eco-cheque amount per employee per year?", unit: "EUR" },
  { id: "eco_cheques.part_time", topicId: "eco-cheques", label: "Eco-cheques for part-time employees", question: "How much do part-time employees in PC 200 receive in eco-cheques?" },
  { id: "reintegration.plan_deadline", topicId: "reintegration", label: "Deadline for the reintegration plan", question: "How long does the employer have to deliver a reintegration plan after the assessment?", unit: "weeks" },
  { id: "reintegration.employer_contribution", topicId: "reintegration", label: "Employer contribution in months 2 and 3", question: "What share of the sickness benefit does the employer pay in months 2 and 3 of incapacity?", unit: "%" },
  { id: "voluntary_overtime.annual_hours", topicId: "voluntary-overtime", label: "Voluntary overtime hours per year", question: "How many voluntary overtime hours may an employee work per calendar year in 2026?", unit: "hours" },
  { id: "voluntary_overtime.agreement_duration", topicId: "voluntary-overtime", label: "Validity of the overtime agreement", question: "How long is a written agreement for voluntary overtime valid?", unit: "months" },
  { id: "year_end_bonus.min_seniority", topicId: "year-end-bonus-pc200", label: "Minimum seniority for the year-end bonus", question: "How much seniority does an employee in PC 200 need for the year-end bonus?" },
  { id: "year_end_bonus.payment_month", topicId: "year-end-bonus-pc200", label: "Payment of the year-end bonus", question: "With which monthly pay is the PC 200 year-end bonus paid?" },
  { id: "km_allowance.rate", topicId: "km-allowance", label: "Kilometre allowance rate", question: "What is the flat kilometre allowance for business trips with a private car?", unit: "EUR/km" },
  { id: "km_allowance.max_km", topicId: "km-allowance", label: "Yearly kilometre cap", question: "Up to how many kilometres per year can the flat rate be paid tax-free?", unit: "km" },
  { id: "flexi_jobs.employer_contribution", topicId: "flexi-jobs", label: "Employer contribution on flexi pay", question: "What special contribution does the employer pay on flexi pay in 2026?", unit: "%" },
  { id: "flexi_jobs.min_hourly_wage", topicId: "flexi-jobs", label: "Minimum flexi wage", question: "What is the minimum hourly flexi wage in 2026?", unit: "EUR/hour" },
  { id: "payroll_cutoff.transport_verhaeghe", topicId: "payroll-cutoff", label: "Monthly close, Transport Verhaeghe NV", question: "On which day of the month does payroll close for Transport Verhaeghe NV?" },
  { id: "payroll_cutoff.clinique_saint_luc", topicId: "payroll-cutoff", label: "Monthly close, Clinique Saint-Luc ASBL", question: "On which day of the month does payroll close for Clinique Saint-Luc ASBL?" },
  { id: "payroll_cutoff.bakkerij_janssens", topicId: "payroll-cutoff", label: "Monthly close, Bakkerij Janssens BV", question: "On which day of the month does payroll close for Bakkerij Janssens BV?" },
  { id: "notice_period.five_years", topicId: "notice-period", label: "Employer notice after 5 years", question: "What notice period applies when the employer dismisses an employee with 5 years of seniority?", unit: "weeks" },
  { id: "notice_period.employee_max", topicId: "notice-period", label: "Max notice when the employee resigns", question: "What is the maximum notice period when an employee resigns?", unit: "weeks" },
  { id: "company_car.min_solidarity", topicId: "company-car-solidarity", label: "Minimum CO2 solidarity contribution", question: "What is the minimum monthly CO2 solidarity contribution per company car in 2026?", unit: "EUR/month" },
  { id: "company_car.hybrid_deduction", topicId: "company-car-solidarity", label: "Deductibility of plug-in hybrids in 2026", question: "What share of the costs of a plug-in hybrid ordered before 2026 is deductible in 2026?", unit: "%" },
];

const PAYROLL_FACTS: PayrollFact[] = [
  { claimId: "home_working.max_allowance", value: "€157.83", source: "Payroll engine config, wage code 3120, run 2026-09" },
  { claimId: "company_car.min_solidarity", value: "€33.62", source: "Payroll engine config, CO2 contribution table, run 2026-09" },
  { claimId: "meal_vouchers.max_face_value", value: "€10.00", source: "Payroll engine config, PC 200, run 2026-09" },
  { claimId: "flexi_jobs.min_hourly_wage", value: "€12.29", source: "Payroll engine config, PC 302, run 2026-09" },
];

type Jury = [vote: string, text: string][];
type Advocacy = [docKey: string, text: string][];
const DEBATE_DEFS: { claimId: string; advocates: Advocacy; jurors: Jury; proposed: string; merged?: string }[] = [
  {
    claimId: "indexation_cap.first_application_pc200",
    advocates: [
      ["idx_procA", "The Payroll Ops BE procedure states the cap is \"voor het eerst toegepast bij de indexering van juni 2026\". It ties the first application to the date the cap enters into force, 1 June 2026, and Payroll Ops BE runs the engine parameter INDEX_CAP_BE. Applying the cap from the first run after 1 June follows the policy literally."],
      ["idx_procB", "The Client Services Brussels procedure states \"il s'applique pour la première fois à l'indexation de janvier 2027\", because PC 200 indexes wages once a year, in January. The cap limits an indexation; in June 2026 there is no PC 200 indexation for it to limit. The bridge note on the year-end bonus uses the same January 2027 timing."],
    ],
    jurors: [
      ["January 2027 indexation", "PC 200 has a single indexation moment in January, so the first indexation the cap can limit is January 2027. The June source confuses the date the cap enters into force with the date it takes effect on pay."],
      ["June 2026 indexation", "The policy puts the cap in force from 1 June 2026 and the Payroll Ops procedure owns the engine setting. Waiting until January 2027 leaves seven months in which the engine does not reflect the policy."],
      ["January 2027 indexation", "Both sources agree the cap is in force from 1 June 2026. The Brussels procedure explains the PC 200 mechanism and the rekenvoorbeeld for the year-end bonus assumes January 2027, so I side with January 2027."],
    ],
    proposed: "January 2027 indexation",
    merged: "The cap is in force from 1 June 2026; for PC 200 it first applies at the January 2027 indexation, because PC 200 indexes once a year in January.",
  },
  {
    claimId: "payroll_cutoff.transport_verhaeghe",
    advocates: [
      ["pc_verhA", "The client calendar of Client Services Gent says data must arrive \"uiterlijk op de 20e\" and spells out the weekend rule. Client Services Gent owns the client relation and agreed this calendar with Transport Verhaeghe NV in January 2026."],
      ["pc_verhB", "The Payroll Ops BE procedure closes \"op de 22e van de maand\" and gives the reason: the client only delivers ride registration on the 21st. A close on the 20th would run payroll without driver data."],
    ],
    jurors: [
      ["22nd of the month", "The 22nd is the only date consistent with ride data arriving on the 21st, and Payroll Ops BE executes the close."],
      ["20th of the month", "The client-facing calendar is what Transport Verhaeghe NV signed off on; the internal procedure should adapt to it."],
      ["22nd of the month", "The Gent calendar is the client deadline for timesheets, the Payroll Ops procedure is the actual close. The close date question points to the 22nd."],
    ],
    proposed: "22nd of the month",
    merged: "Transport Verhaeghe NV sends timesheets by the 20th and ride data on the 21st; Payroll Ops BE closes the month on the 22nd.",
  },
  {
    claimId: "company_car.hybrid_deduction",
    advocates: [
      ["cc_polA", "The Payroll Legal policy states a plug-in hybrid ordered between 1 July 2023 and 31 December 2025 \"is 50% deductible in 2026\". This follows the phase-out schedule of 75% in 2025, 50% in 2026 and 25% in 2027."],
      ["cc_polB", "The fiscal policy states \"geldt in 2026 een aftrek van 75%\" for hybrids ordered before 1 January 2026. It reads the transitional rule as keeping the 75% rate for cars already on order."],
    ],
    jurors: [
      ["50%", "The phase-out lowers the rate each calendar year, whatever the order date inside the transitional window. 50% applies in 2026."],
      ["75%", "The 75% policy is more recent and written by a legal expert; the transitional rule may protect cars on order."],
      ["50%", "The 75% reading describes 2025. For 2026 the schedule gives 50%."],
    ],
    proposed: "50%",
    merged: "A plug-in hybrid ordered between 1 July 2023 and 31 December 2025 is 50% deductible in 2026; the 75% rate applied in 2025.",
  },
  {
    claimId: "eco_cheques.part_time",
    advocates: [
      ["eco_faqA", "The Dutch FAQ states a part-time employee \"ontvangt ecocheques pro rata van zijn arbeidsduur\" and works out EUR 200.00 for a 4/5 employee. This matches the sector agreement in PC 200."],
      ["eco_faqB", "The French FAQ states \"le travailleur à temps partiel reçoit le montant complet de EUR 250,00\". It treats eco-cheques as a flat benefit per employee."],
    ],
    jurors: [
      ["Pro rata of working time", "The PC 200 sector agreement grants eco-cheques pro rata of working time for part-time employees."],
      ["Pro rata of working time", "The full-amount reading has no basis in the sector agreement; the pro rata example adds up."],
      ["Pro rata of working time", "Pro rata. The French FAQ confuses the full-time maximum with the part-time amount."],
    ],
    proposed: "Pro rata of working time",
    merged: "Part-time employees in PC 200 receive eco-cheques pro rata of their working time, for example EUR 200.00 for a 4/5 employee over a full reference period.",
  },
  {
    claimId: "reintegration.employer_contribution",
    advocates: [
      ["re_procA", "The Payroll Ops BE procedure states \"een bijdrage van 30% van de ziekte-uitkering\" in months 2 and 3, with an exemption below 50 employees. Its worked example of EUR 585.00 per month adds up."],
      ["re_procB", "The Liège procedure states \"une cotisation de 25% de l'indemnité de maladie\" for the same months and the same exemption."],
    ],
    jurors: [
      ["30%", "The royal decree sets 30%; 25% was the figure in the draft text."],
      ["30%", "30%. Both sources agree on months 2 and 3 and the 50-employee exemption; only the Gent procedure matches the final rate."],
      ["30%", "30%, the rate the payroll team already uses in the quarterly declaration."],
    ],
    proposed: "30%",
    merged: "Employers with 50 or more employees pay 30% of the sickness benefit during the second and third month of incapacity, from 1 July 2026.",
  },
  {
    claimId: "year_end_bonus.min_seniority",
    advocates: [
      ["ye_procA", "The Payroll Ops BE procedure requires \"minstens 6 maanden anciënniteit\" in the company at the time of payment, and computes a pro rata bonus of EUR 2,400.00."],
      ["ye_procB", "The Brussels procedure requires \"au moins 1 an d'ancienneté\" in the company before the bonus is due."],
    ],
    jurors: [
      ["6 months", "The PC 200 sector agreement sets 6 months of seniority; one year is a company-level practice."],
      ["6 months", "6 months. The Brussels team applies a stricter internal rule that clients cannot rely on."],
      ["6 months", "6 months, as in the sector agreement."],
    ],
    proposed: "6 months",
    merged: "Employees in PC 200 are entitled to the year-end bonus after 6 months of service in the company.",
  },
];

// ---------- helpers ----------

const CONNECTOR: Record<Channel, ConnectorId> = {
  policy: "sharepoint", procedure: "sharepoint", teams: "teams", email: "outlook", faq: "confluence", slides: "onedrive", legal: "mysdworx",
};

function defaultPath(channel: Channel, authorId: string): string {
  const author = PEOPLE.find((p) => p.id === authorId)!;
  return {
    policy: "SharePoint / Payroll BE / Policies",
    procedure: "SharePoint / Payroll BE / Procedures",
    faq: "Confluence / PAYBE / Client FAQ",
    slides: `OneDrive / ${author.name} / Training`,
    email: `Outlook / ${author.name} / Sent Items`,
    teams: "Teams / Chat exports",
    legal: "mysdworx Documents / Legal / Social law",
  }[channel];
}

const addMonths = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};

function numericOf(value: string): number | undefined {
  if (/\d{4}$/.test(value) || /indexation$/.test(value)) return undefined;
  const m = value.replace(/,/g, "").match(/(\d+(\.\d+)?)/);
  return m ? Number(m[1]) : undefined;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- build ----------

export function buildCorpus(): CorpusData {
  const errors: string[] = [];
  const idOf = new Map<string, string>();
  DOCS.forEach((d, i) => idOf.set(d.key, `DOC-${String(i + 1).padStart(3, "0")}`));

  const fileNames = new Set<string>();
  const docs: SourceDoc[] = DOCS.map((d) => {
    const fileName = d.file ?? `${d.title.replace(/[:/\\?*"<>|]/g, "").trim()}.pdf`;
    if (fileNames.has(fileName)) errors.push(`duplicate fileName ${fileName}`);
    fileNames.add(fileName);
    const reviewable = d.channel !== "email" && d.channel !== "teams";
    return {
      id: idOf.get(d.key)!,
      title: d.title,
      fileName,
      connector: CONNECTOR[d.channel],
      path: d.path ?? defaultPath(d.channel, d.author),
      channel: d.channel,
      lang: d.lang,
      country: d.country,
      ownerId: d.owner,
      authorId: d.author,
      createdAt: d.created,
      updatedAt: d.updated,
      effectiveDate: d.eff,
      reviewBy: reviewable ? addMonths(d.updated, 12) : null,
      pages: 1,
      sizeKb: 0,
      duplicateOf: d.dupOf ? idOf.get(d.dupOf)! : null,
      topicId: d.topic,
      body: d.body,
    };
  });

  const claims: ClaimInstance[] = [];
  for (const d of DOCS) {
    for (const [claimId, value, quote, appliesTo] of d.claims) {
      if (!CLAIM_KEYS.some((k) => k.id === claimId)) errors.push(`unknown claim ${claimId} in ${d.key}`);
      if (!d.body.includes(quote)) errors.push(`quote not in body: ${d.key} "${quote}"`);
      const numeric = numericOf(value);
      claims.push({
        id: `CI-${String(claims.length + 1).padStart(3, "0")}`,
        claimId, docId: idOf.get(d.key)!, value, quote,
        ...(numeric !== undefined ? { numeric } : {}),
        ...(appliesTo ? { appliesTo } : {}),
      });
    }
  }

  const docTitle = (key: string) => DOCS.find((d) => d.key === key)!.title;
  const debates: Debate[] = DEBATE_DEFS.map((def) => {
    const turns: DebateTurn[] = [
      ...def.advocates.map(([key, text]): DebateTurn => {
        const ci = claims.find((c) => c.docId === idOf.get(key) && c.claimId === def.claimId);
        if (!ci) errors.push(`advocate ${key} has no claim ${def.claimId}`);
        return { role: "advocate", speaker: `Advocate for ${docTitle(key)}`, docId: idOf.get(key), forValue: ci?.value, text };
      }),
      ...def.jurors.map(([vote, text], i): DebateTurn => ({ role: "juror", speaker: `Juror ${i + 1}`, text, vote })),
    ];
    const agree = def.jurors.filter(([v]) => v === def.proposed).length;
    return {
      claimId: def.claimId, turns, proposedValue: def.proposed,
      ...(def.merged ? { mergedStatement: def.merged } : {}),
      confidence: Math.round((agree / def.jurors.length) * 100) / 100,
    };
  });

  const clusters: Cluster[] = TOPICS.map((t, i) => ({
    id: `C-${String(i + 1).padStart(2, "0")}`,
    topicId: t.id, label: t.label, summary: t.summary, color: t.color,
    docIds: docs.filter((d) => d.topicId === t.id).map((d) => d.id),
  }));

  const points = layout(docs, clusters);

  for (const t of TOPICS) {
    const n = docs.filter((d) => d.topicId === t.id).length;
    if (n < 5 || n > 11) errors.push(`topic ${t.id} has ${n} docs`);
  }
  if (docs.length !== 100) errors.push(`expected 100 docs, got ${docs.length}`);
  for (const d of docs) {
    if (d.updatedAt > TODAY || d.createdAt > d.updatedAt) errors.push(`bad dates ${d.id}`);
  }
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }

  return {
    generatedAt: "2026-09-30T19:30:00.000Z", mode: "mock", people: PEOPLE, docs, claimKeys: CLAIM_KEYS, claims,
    clusters, points, debates, payrollFacts: PAYROLL_FACTS,
  };
}

function layout(docs: SourceDoc[], clusters: Cluster[]): DocPoint[] {
  const rand = mulberry32(20260930);
  const gauss = () => {
    const u = Math.max(rand(), 1e-9), v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  // Ring order keeps related topics adjacent: cut-off, indexation, year-end bonus.
  const ring: TopicId[] = [
    "payroll-cutoff", "indexation-cap", "year-end-bonus-pc200", "eco-cheques", "meal-vouchers", "home-working-allowance",
    "km-allowance", "company-car-solidarity", "flexi-jobs", "voluntary-overtime", "reintegration", "notice-period",
  ];
  const center = new Map<string, { x: number; y: number }>();
  ring.forEach((t, i) => {
    const a = (i / ring.length) * 2 * Math.PI - Math.PI / 2;
    const r = 300 + (i % 2 ? -45 : 30);
    center.set(t, { x: 500 + r * Math.cos(a), y: 500 + r * Math.sin(a) });
  });
  const clamp = (v: number) => Math.min(910, Math.max(90, v));
  const clusterOf = new Map(clusters.flatMap((c) => c.docIds.map((id) => [id, c.id] as const)));
  const pos = new Map<string, { x: number; y: number }>();
  const bridges = new Map(DOCS.filter((d) => d.bridge).map((d) => [d.title, d.bridge!]));
  for (const d of docs.filter((d) => !d.duplicateOf)) {
    const c = center.get(d.topicId)!;
    const bridge = bridges.get(d.title);
    const base = bridge ? { x: (c.x + center.get(bridge)!.x) / 2, y: (c.y + center.get(bridge)!.y) / 2 } : c;
    const sigma = bridge ? 12 : 35;
    pos.set(d.id, { x: clamp(base.x + gauss() * sigma), y: clamp(base.y + gauss() * sigma) });
  }
  for (const d of docs.filter((d) => d.duplicateOf)) {
    const o = pos.get(d.duplicateOf!)!;
    const a = rand() * 2 * Math.PI, r = 3 + rand() * 4;
    pos.set(d.id, { x: clamp(o.x + r * Math.cos(a)), y: clamp(o.y + r * Math.sin(a)) });
  }
  return docs.map((d) => {
    const p = pos.get(d.id)!;
    return { docId: d.id, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, clusterId: clusterOf.get(d.id)! };
  });
}

// ---------- local rule simulation (mirrors the engine semantics) ----------

const TIERS: Channel[] = ["legal", "policy", "procedure", "faq", "slides", "email", "teams"];

function simulate(c: CorpusData, order: RuleId[]) {
  const doc = new Map(c.docs.map((d) => [d.id, d]));
  const seniority = new Map(c.people.map((p) => [p.id, p.seniority]));
  const out: { claimId: string; outcome: string; value: string | null }[] = [];
  for (const key of c.claimKeys) {
    const inst = c.claims.filter((ci) => ci.claimId === key.id);
    const distinct = new Set(inst.map((i) => i.value));
    if (distinct.size < 2) { out.push({ claimId: key.id, outcome: "agreed", value: [...distinct][0] ?? null }); continue; }
    let cand = inst;
    let decidedBy: string | null = null;
    for (const rule of order) {
      const keep = (f: (i: ClaimInstance) => boolean) => { const k = cand.filter(f); if (k.length) cand = k; };
      const d = (i: ClaimInstance) => doc.get(i.docId)!;
      if (rule === "scope") keep((i) => d(i).country === "BE");
      if (rule === "authority") { const best = Math.min(...cand.map((i) => TIERS.indexOf(d(i).channel))); keep((i) => TIERS.indexOf(d(i).channel) === best); }
      if (rule === "recency") { const date = (i: ClaimInstance) => d(i).effectiveDate ?? d(i).updatedAt; const best = cand.map(date).sort().at(-1); keep((i) => date(i) === best); }
      if (rule === "payroll") { const f = c.payrollFacts.find((p) => p.claimId === key.id); if (f) keep((i) => i.value === f.value); }
      if (rule === "owner") keep((i) => d(i).ownerId !== null);
      if (rule === "seniority") { const s = (i: ClaimInstance) => seniority.get(d(i).authorId)!; const best = Math.max(...cand.map(s)); keep((i) => s(i) === best); }
      if (new Set(cand.map((i) => i.value)).size === 1) { decidedBy = rule; break; }
    }
    if (decidedBy) { out.push({ claimId: key.id, outcome: `auto:${decidedBy}`, value: cand[0].value }); continue; }
    const deb = c.debates.find((x) => x.claimId === key.id);
    if (deb && deb.confidence >= 0.75) out.push({ claimId: key.id, outcome: "debate", value: deb.proposedValue });
    else out.push({ claimId: key.id, outcome: "human", value: null });
  }
  return out;
}

function report(c: CorpusData) {
  const base: RuleId[] = ["scope", "authority", "recency", "payroll", "owner"];
  const swapped: RuleId[] = ["scope", "recency", "authority", "payroll", "owner"];
  const a = simulate(c, base);
  const b = simulate(c, swapped);
  console.log("claim".padEnd(44), "outcome".padEnd(16), "value".padEnd(26), "recency first");
  let flips = 0;
  a.forEach((r, i) => {
    const flip = r.value !== b[i].value;
    if (flip) flips++;
    console.log(r.claimId.padEnd(44), r.outcome.padEnd(16), String(r.value).padEnd(26), flip ? `FLIPS to ${b[i].value}` : "");
  });
  const count = (p: string) => a.filter((r) => r.outcome.startsWith(p)).length;
  const auto: Record<string, number> = {};
  a.filter((r) => r.outcome.startsWith("auto:")).forEach((r) => { const k = r.outcome.slice(5); auto[k] = (auto[k] ?? 0) + 1; });
  const totals = { agreed: count("agreed"), auto: count("auto"), autoByRule: auto, debate: count("debate"), human: count("human"), flips };
  console.log("\ntotals", JSON.stringify(totals));

  const docs = c.docs;
  const hygiene = {
    docs: docs.length,
    duplicates: docs.filter((d) => d.duplicateOf).length,
    orphans: docs.filter((d) => !d.ownerId).length,
    stale: docs.filter((d) => d.reviewBy && d.reviewBy < TODAY).length,
    nonBE: docs.filter((d) => d.country !== "BE").length,
    lang: Object.fromEntries(["nl", "fr", "en"].map((l) => [l, docs.filter((d) => d.lang === l).length])),
  };
  console.log("hygiene", JSON.stringify(hygiene));

  const misses: string[] = [];
  if (totals.agreed < 5 || totals.agreed > 8) misses.push("agreed");
  if (totals.auto < 10 || totals.auto > 15) misses.push("auto");
  for (const r of ["scope", "recency", "payroll", "owner"]) if (!auto[r]) misses.push(`auto:${r}`);
  if ((auto.authority ?? 0) < 5) misses.push("auto:authority");
  if (totals.debate !== 3) misses.push("debate");
  if (totals.human !== 3) misses.push("human");
  if (flips < 3) misses.push("flips");
  if (a.find((r) => r.claimId === "indexation_cap.first_application_pc200")?.outcome !== "human") misses.push("hero");
  if (misses.length) { console.error("targets missed:", misses.join(", ")); process.exit(1); }
}

async function main() {
  const corpus = buildCorpus();
  report(corpus);
  writeFileSync(OUT, JSON.stringify(corpus, null, 2) + "\n");
  console.log(`wrote ${OUT}`);
  if (!process.argv.includes("--no-pdf")) {
    const { makePdfs } = await import("./make-pdfs");
    await makePdfs(corpus);
    writeFileSync(OUT, JSON.stringify(corpus, null, 2) + "\n");
    console.log("updated pages and sizeKb");
  }
}

main();
