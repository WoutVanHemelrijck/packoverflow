// Shared contract. Corpus data (src/data/*.json) is produced by scripts/seed.ts (mock) or pipeline/ (real);
// everything under "Engine output" is computed at runtime by runJanitor() in src/lib/janitor.ts.

export type ConnectorId = "sharepoint" | "teams" | "outlook" | "onedrive" | "confluence" | "mysdworx";
export type Channel = "legal" | "policy" | "procedure" | "faq" | "slides" | "email" | "teams";
export type Country = "BE" | "NL" | "FR" | "LU";
export type Lang = "nl" | "fr" | "en";

export interface Person {
  id: string; // "P-01"
  name: string;
  role: string; // "Senior payroll consultant"
  team: string; // "Payroll Ops BE"
  seniority: 1 | 2 | 3 | 4 | 5; // 5 = most senior
}

export interface SourceDoc {
  id: string; // "DOC-001"
  title: string;
  fileName: string; // "Maaltijdcheques_beleid_2026.pdf", also served at /pdfs/<fileName>
  connector: ConnectorId;
  path: string; // "SharePoint / Payroll BE / Policies"
  channel: Channel;
  lang: Lang;
  country: Country;
  ownerId: string | null; // null = orphan document
  authorId: string;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
  effectiveDate: string | null; // date the content applies from
  reviewBy: string | null; // after this date the doc is stale
  pages: number;
  sizeKb: number;
  duplicateOf: string | null; // near-identical copy of another doc id
  topicId: string; // planted topic; the real pipeline recomputes clusters from embeddings
  body: string; // full text, paragraphs separated by "\n\n"
}

export interface ClaimKey {
  id: string; // "meal_voucher.max_face_value"
  topicId: string;
  label: string; // "Max face value of a meal voucher"
  question: string; // "What is the maximum face value of a meal voucher in 2026?"
  unit?: string; // "EUR", "%", "days"
}

export interface ClaimInstance {
  id: string; // "CI-001"
  claimId: string; // ClaimKey.id
  docId: string;
  value: string; // display value, normalised: "€10.00", "2.21%", "8 weeks"
  numeric?: number;
  quote: string; // exact substring of the doc body that states the value
  appliesTo?: string; // optional scope qualifier, e.g. "PC 200"
}

export interface Cluster {
  id: string; // "C-01"
  topicId: string;
  label: string; // "Meal vouchers"
  summary: string;
  color: string; // hex
  docIds: string[];
}

export interface DocPoint {
  docId: string;
  x: number; // 0..1000
  y: number; // 0..1000
  clusterId: string;
}

export interface DebateTurn {
  role: "advocate" | "juror";
  speaker: string; // "Advocate for DOC-014" / "Juror 2"
  docId?: string;
  forValue?: string;
  text: string;
  vote?: string; // juror's chosen value
}

export interface Debate {
  claimId: string;
  turns: DebateTurn[];
  proposedValue: string;
  mergedStatement?: string; // when the verdict combines sources ("€10 for PC 200, €8 for PC 118")
  confidence: number; // 0..1, share of jurors agreeing
}

export interface PayrollFact {
  claimId: string;
  value: string; // what the payroll engine actually applies
  source: string; // "Payroll engine config, PC 200, run 2026-09"
}

export interface CorpusData {
  generatedAt: string;
  mode: "mock" | "real";
  people: Person[];
  docs: SourceDoc[];
  claimKeys: ClaimKey[];
  claims: ClaimInstance[];
  clusters: Cluster[];
  points: DocPoint[];
  debates: Debate[];
  payrollFacts: PayrollFact[];
}

// ---------- Rules (user-editable) ----------

export type RuleId = "scope" | "authority" | "recency" | "owner" | "payroll" | "seniority";

export interface Rule {
  id: RuleId;
  enabled: boolean;
}

export interface RulesConfig {
  order: Rule[]; // precedence, first rule is applied first
  authorityTiers: Channel[]; // most authoritative first
  targetCountry: Country;
  staleAfterMonths: number;
  debateThreshold: number; // jury confidence at or above this settles without a human (0..1)
}

// ---------- Engine output ----------

export interface TraceStep {
  ruleId: RuleId | "debate" | "human";
  outcome: "excluded" | "decided" | "tie" | "skipped";
  detail: string; // "Policy (tier 2) outranks Teams chat (tier 7)"
  docIds: string[];
}

export type ConflictStatus = "auto" | "debate" | "human" | "resolved";

export interface ConflictValue {
  value: string;
  claimInstanceIds: string[];
  docIds: string[];
}

export interface Conflict {
  claimId: string;
  clusterId: string;
  values: ConflictValue[]; // at least 2 distinct values
  status: ConflictStatus; // auto = rules settled it; debate = jury settled it; human = needs the user; resolved = user decided
  winningValue: string | null;
  trace: TraceStep[];
  debate?: Debate;
}

export type IssueKind = "conflict" | "duplicate" | "stale" | "orphan" | "scope";

export interface Issue {
  id: string;
  kind: IssueKind;
  title: string;
  detail: string;
  docIds: string[];
  claimId?: string;
  severity: 1 | 2 | 3;
}

export type ActionKind = "archive" | "assign_owner" | "notify_owner" | "tag_scope" | "settle";

export interface JanitorAction {
  id: string;
  kind: ActionKind;
  title: string; // "Archive duplicate 'Meal vouchers v2 (copy).pdf'"
  detail: string;
  docIds: string[];
  issueId: string;
}

export interface SettledClaim {
  claimId: string;
  statement: string; // "The maximum face value of a meal voucher is €10.00 from 1 January 2026."
  value: string;
  sourceDocIds: string[];
  trace: TraceStep[];
  vouchedBy: string; // "Rules: authority > recency" | "Jury 3-0" | person name
  settledAt: string;
  hash: string; // short deterministic hash for the ledger
  confidence: number; // 0..1
}

export interface HealthReport {
  score: number; // 0..100, current
  baseline: number; // score of the raw import before any janitor work
  breakdown: Record<IssueKind, number>; // open issue counts
}

export interface JanitorResult {
  conflicts: Conflict[];
  issues: Issue[];
  actions: JanitorAction[];
  ledger: SettledClaim[];
  health: HealthReport;
}

export interface HumanDecision {
  claimId: string;
  value: string;
  note?: string;
  by: string;
  at: string;
}

// Written by pipeline/run.ts from real multilingual embeddings (UMAP to 2D). Empty until the pipeline has run.
export interface EmbeddingSpace {
  model: string | null;
  generatedAt: string | null;
  points: DocPoint[];
  clusters: Cluster[];
  purity: number | null; // share of docs whose real cluster matches the planted topic, 0..1
}

// Written by pipeline/run.ts; all null until the real pipeline has run.
export interface PipelineReport {
  model: string | null;
  llmModel: string | null;
  docsParsed: number | null;
  pagesParsed: number | null;
  chars: number | null;
  embedMs: number | null;
  umapMs: number | null;
  k: number | null;
  purity: number | null;
  llmCalls: number | null;
  claimsPlanted: number | null;
  claimsFoundByLlm: number | null;
  claimsMatching: number | null;
  generatedAt: string | null;
}
