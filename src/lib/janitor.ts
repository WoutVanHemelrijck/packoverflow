import type {
  ClaimInstance,
  ClaimKey,
  Conflict,
  ConflictValue,
  CorpusData,
  Debate,
  HumanDecision,
  Issue,
  IssueKind,
  JanitorAction,
  JanitorResult,
  Person,
  RuleId,
  RulesConfig,
  SettledClaim,
  SourceDoc,
  TraceStep,
} from "./types";
import { CHANNEL_LABEL, CONNECTOR_LABEL, COUNTRY_LABEL } from "./labels";

export const DEFAULT_RULES: RulesConfig = {
  order: [
    { id: "scope", enabled: true },
    { id: "authority", enabled: true },
    { id: "recency", enabled: true },
    { id: "payroll", enabled: true },
    { id: "owner", enabled: true },
    { id: "seniority", enabled: false },
  ],
  authorityTiers: ["legal", "policy", "procedure", "faq", "slides", "email", "teams"],
  targetCountry: "BE",
  staleAfterMonths: 12,
  debateThreshold: 0.75,
};

export const RULE_META: Record<string, { label: string; description: string }> = {
  scope: { label: "Scope match", description: "A document written for another country never wins a claim for the target country." },
  authority: { label: "Source authority", description: "Legal text beats policy beats procedure beats FAQ beats slides beats email beats chat." },
  recency: { label: "Effective date", description: "When authority ties, the most recent effective date wins." },
  payroll: { label: "Payroll data agreement", description: "A value that matches what the payroll engine actually applies wins." },
  owner: { label: "Owner present", description: "A document with a named owner beats an orphan document." },
  seniority: { label: "Author seniority", description: "The more senior author wins remaining ties." },
};

// Health: score = 100 * exp(-penalty / HEALTH_SCALE). Tuned on the seeded corpus (see scripts/check-engine.ts).
export const HEALTH_WEIGHTS: Record<IssueKind, number> = { conflict: 9, duplicate: 1, stale: 1, orphan: 2, scope: 2 };
const HEALTH_SCALE = 250;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "no date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function shortTitle(title: string, max = 44): string {
  return title.length <= max ? title : `${title.slice(0, max - 1).trimEnd()}…`;
}

export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function juryTally(debate: Debate): { votesFor: number; total: number; label: string } {
  const votes = debate.turns.filter((t) => t.role === "juror" && t.vote);
  const total = votes.length || 3;
  const votesFor = votes.length
    ? votes.filter((t) => t.vote === debate.proposedValue).length
    : Math.round(debate.confidence * total);
  return { votesFor, total, label: `${votesFor}-${total - votesFor}` };
}

interface ConflictMeta {
  decidedBy: RuleId | "debate" | "human" | null;
  person?: string;
}
const conflictMeta = new WeakMap<Conflict, ConflictMeta>();

export function conflictStatusLabel(conflict: Conflict): string {
  const meta = conflictMeta.get(conflict);
  if (conflict.status === "resolved") return meta?.person ?? "Decided by a person";
  if (conflict.status === "debate") return conflict.debate ? `Jury ${juryTally(conflict.debate).label}` : "Jury";
  if (conflict.status === "human") return conflict.debate ? `Jury ${juryTally(conflict.debate).label}, needs you` : "Needs you";
  const ruleId = meta?.decidedBy ?? conflict.trace.find((s) => s.outcome === "decided")?.ruleId;
  return (ruleId && RULE_META[ruleId]?.label) || "Rules";
}

export function decidingRule(conflict: Conflict): RuleId | "debate" | "human" | null {
  return conflictMeta.get(conflict)?.decidedBy ?? null;
}

interface Ctx {
  corpus: CorpusData;
  rules: RulesConfig;
  docs: Map<string, SourceDoc>;
  people: Map<string, Person>;
  today: string;
}

const q = (d: SourceDoc | undefined) => (d ? `'${shortTitle(d.title)}'` : "an unknown document");
const distinct = (c: ClaimInstance[]) => [...new Set(c.map((x) => x.value))];

function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function docsOf(c: ClaimInstance[]): string[] {
  return [...new Set(c.map((x) => x.docId))];
}

function tierOf(ctx: Ctx, docId: string): number {
  const d = ctx.docs.get(docId);
  const i = d ? ctx.rules.authorityTiers.indexOf(d.channel) : -1;
  return i === -1 ? Infinity : i;
}

function dateOf(ctx: Ctx, docId: string): string {
  const d = ctx.docs.get(docId);
  return d ? (d.effectiveDate ?? d.updatedAt) : "";
}

function channelTier(ctx: Ctx, docId: string): string {
  const d = ctx.docs.get(docId);
  if (!d) return "Unknown";
  const t = tierOf(ctx, docId);
  return `${CHANNEL_LABEL[d.channel]} (${t === Infinity ? "unranked" : `tier ${t + 1}`})`;
}

interface RuleOutcome {
  kept: ClaimInstance[];
  step: Omit<TraceStep, "ruleId" | "outcome"> & { outcome?: TraceStep["outcome"] };
}

function applyRule(ctx: Ctx, id: RuleId, cands: ClaimInstance[], claimId: string): RuleOutcome {
  const all = docsOf(cands);
  switch (id) {
    case "scope": {
      const target = ctx.rules.targetCountry;
      const kept = cands.filter((c) => ctx.docs.get(c.docId)?.country === target);
      const dropped = docsOf(cands.filter((c) => !kept.includes(c)));
      if (!dropped.length) return { kept: cands, step: { outcome: "skipped", detail: `All sources are written for ${COUNTRY_LABEL[target]}`, docIds: [] } };
      if (!kept.length) return { kept: cands, step: { outcome: "skipped", detail: `No source is written for ${COUNTRY_LABEL[target]}, so the rule keeps all of them`, docIds: [] } };
      const parts = dropped.map((d) => {
        const doc = ctx.docs.get(d);
        return `${q(doc)} (${doc ? COUNTRY_LABEL[doc.country] : "unknown"})`;
      });
      return { kept, step: { outcome: "excluded", detail: `Dropped ${listJoin(parts)}: target country is ${COUNTRY_LABEL[target]}`, docIds: dropped } };
    }
    case "authority": {
      const best = Math.min(...cands.map((c) => tierOf(ctx, c.docId)));
      const kept = cands.filter((c) => tierOf(ctx, c.docId) === best);
      const keptDocs = docsOf(kept);
      if (kept.length === cands.length) {
        return { kept, step: { detail: `All sources rank the same: ${channelTier(ctx, keptDocs[0])}`, docIds: keptDocs } };
      }
      const winner = channelTier(ctx, keptDocs[0]);
      const losers = [...new Set(docsOf(cands.filter((c) => !kept.includes(c))).sort((a, b) => tierOf(ctx, a) - tierOf(ctx, b)).map((d) => channelTier(ctx, d)))];
      return { kept, step: { detail: `${winner} outranks ${listJoin(losers)}`, docIds: keptDocs } };
    }
    case "recency": {
      const latest = cands.map((c) => dateOf(ctx, c.docId)).sort().at(-1) ?? "";
      const kept = cands.filter((c) => dateOf(ctx, c.docId) === latest);
      const keptDocs = docsOf(kept);
      if (kept.length === cands.length) {
        return { kept, step: { detail: `All sources take effect on ${formatDate(latest)}`, docIds: keptDocs } };
      }
      const losers = docsOf(cands.filter((c) => !kept.includes(c)))
        .sort((a, b) => dateOf(ctx, b).localeCompare(dateOf(ctx, a)))
        .slice(0, 2)
        .map((d) => `${q(ctx.docs.get(d))} (${formatDate(dateOf(ctx, d))})`);
      const head = keptDocs.length === 1 ? q(ctx.docs.get(keptDocs[0])) : `${keptDocs.length} sources`;
      return { kept, step: { detail: `${head} (${formatDate(latest)}) is newer than ${listJoin(losers)}`, docIds: keptDocs } };
    }
    case "payroll": {
      const fact = ctx.corpus.payrollFacts.find((f) => f.claimId === claimId);
      if (!fact) return { kept: cands, step: { outcome: "skipped", detail: "No payroll data for this claim", docIds: [] } };
      const kept = cands.filter((c) => c.value === fact.value);
      if (!kept.length) return { kept: cands, step: { outcome: "skipped", detail: `Payroll engine applies ${fact.value}, which no remaining source states`, docIds: [] } };
      if (kept.length === cands.length) return { kept, step: { detail: `Payroll engine applies ${fact.value}, as every remaining source states`, docIds: docsOf(kept) } };
      return { kept, step: { detail: `Payroll engine applies ${fact.value} (${fact.source})`, docIds: docsOf(kept) } };
    }
    case "owner": {
      const kept = cands.filter((c) => ctx.docs.get(c.docId)?.ownerId);
      if (!kept.length) return { kept: cands, step: { outcome: "skipped", detail: "No remaining source has an owner", docIds: [] } };
      if (kept.length === cands.length) return { kept, step: { outcome: "skipped", detail: "Every remaining source has an owner", docIds: [] } };
      const orphans = docsOf(cands.filter((c) => !kept.includes(c))).map((d) => q(ctx.docs.get(d)));
      const owned = docsOf(kept);
      const ownerName = ctx.people.get(ctx.docs.get(owned[0])?.ownerId ?? "")?.name;
      const head = owned.length === 1 ? `${q(ctx.docs.get(owned[0]))}${ownerName ? ` (owner ${ownerName})` : ""}` : `${owned.length} owned sources`;
      return { kept, step: { detail: `${head} beats ${listJoin(orphans)}, which has no owner`, docIds: owned } };
    }
    case "seniority": {
      const sen = (c: ClaimInstance) => ctx.people.get(ctx.docs.get(c.docId)?.authorId ?? "")?.seniority ?? 0;
      const top = Math.max(...cands.map(sen));
      const kept = cands.filter((c) => sen(c) === top);
      if (kept.length === cands.length) return { kept, step: { detail: `All authors have seniority ${top}`, docIds: all } };
      const author = ctx.people.get(ctx.docs.get(kept[0].docId)?.authorId ?? "");
      const others = [...new Set(cands.filter((c) => !kept.includes(c)).map((c) => ctx.people.get(ctx.docs.get(c.docId)?.authorId ?? "")?.name ?? "unknown"))];
      return { kept, step: { detail: `${author?.name ?? "Author"} (seniority ${top}) outranks ${listJoin(others)}`, docIds: docsOf(kept) } };
    }
  }
}

function statementFor(key: ClaimKey | undefined, value: string, inst: ClaimInstance[]): string {
  const appliesTo = inst.find((c) => c.value === value && c.appliesTo)?.appliesTo;
  const label = key?.label ?? "Claim";
  return `${label}: ${value}${appliesTo && !label.includes(appliesTo) ? ` (${appliesTo})` : ""}`;
}

function settle(claimId: string, statement: string, value: string, sourceDocIds: string[], trace: TraceStep[], vouchedBy: string, settledAt: string, confidence: number): SettledClaim {
  return { claimId, statement, value, sourceDocIds, trace, vouchedBy, settledAt, confidence, hash: fnv1a(`${claimId}|${value}|${vouchedBy}`) };
}

interface ResolveOut {
  conflicts: Conflict[];
  ledger: SettledClaim[];
}

function resolveClaims(ctx: Ctx, decisions: HumanDecision[]): ResolveOut {
  const { corpus, rules } = ctx;
  const byClaim = new Map<string, ClaimInstance[]>();
  for (const c of corpus.claims) {
    const arr = byClaim.get(c.claimId);
    if (arr) arr.push(c);
    else byClaim.set(c.claimId, [c]);
  }
  const decisionBy = new Map(decisions.map((d) => [d.claimId, d]));
  const conflicts: Conflict[] = [];
  const ledger: SettledClaim[] = [];

  for (const key of corpus.claimKeys) {
    const inst = byClaim.get(key.id);
    if (!inst?.length) continue;
    const values = distinct(inst);
    if (values.length === 1) {
      const docIds = docsOf(inst);
      ledger.push(settle(key.id, statementFor(key, values[0], inst), values[0], docIds, [], `Agreed across ${docIds.length} source${docIds.length === 1 ? "" : "s"}`, corpus.generatedAt, 1));
      continue;
    }

    let cands = inst;
    const scopeDropped = new Set<string>();
    const trace: TraceStep[] = [];
    let decidedBy: ConflictMeta["decidedBy"] = null;

    for (const rule of rules.order) {
      const label = RULE_META[rule.id]?.label ?? rule.id;
      if (decidedBy) {
        trace.push({ ruleId: rule.id, outcome: "skipped", detail: `Not needed: ${RULE_META[decidedBy]?.label ?? "an earlier rule"} settled it`, docIds: [] });
        continue;
      }
      if (!rule.enabled) {
        trace.push({ ruleId: rule.id, outcome: "skipped", detail: `${label} is switched off`, docIds: [] });
        continue;
      }
      const { kept, step } = applyRule(ctx, rule.id, cands, key.id);
      if (rule.id === "scope" && step.outcome === "excluded") step.docIds.forEach((d) => scopeDropped.add(d));
      cands = kept;
      const left = distinct(cands).length;
      let outcome: TraceStep["outcome"] = step.outcome ?? "tie";
      if (left === 1) {
        outcome = "decided";
        decidedBy = rule.id;
      } else if (outcome !== "excluded" && outcome !== "skipped") {
        outcome = "tie";
      }
      trace.push({ ruleId: rule.id, outcome, detail: step.detail, docIds: step.docIds });
    }

    const conflictValues: ConflictValue[] = values.map((v) => {
      const ci = inst.filter((c) => c.value === v);
      return { value: v, claimInstanceIds: ci.map((c) => c.id), docIds: docsOf(ci) };
    });
    const clusterId = corpus.clusters.find((c) => c.topicId === key.topicId)?.id ?? "";
    const surviving = docsOf(cands);
    const debate = corpus.debates.find((d) => d.claimId === key.id);

    let status: Conflict["status"];
    let winningValue: string | null;
    if (decidedBy) {
      status = "auto";
      winningValue = cands[0].value;
    } else if (debate) {
      const tally = juryTally(debate);
      const advocateDocs = [...new Set(debate.turns.filter((t) => t.docId).map((t) => t.docId as string))];
      if (debate.confidence >= rules.debateThreshold) {
        status = "debate";
        winningValue = debate.proposedValue;
        decidedBy = "debate";
        trace.push({ ruleId: "debate", outcome: "decided", detail: `Jury ${tally.label} for ${debate.mergedStatement && !values.includes(debate.proposedValue) ? "a merged statement" : debate.proposedValue}`, docIds: advocateDocs });
      } else {
        status = "human";
        winningValue = null;
        trace.push({ ruleId: "debate", outcome: "tie", detail: `Jury ${tally.label}, split: needs a person`, docIds: advocateDocs });
      }
    } else {
      status = "human";
      winningValue = null;
      trace.push({ ruleId: "debate", outcome: "skipped", detail: "No jury ran on this tie: needs a person", docIds: [] });
    }

    const decision = decisionBy.get(key.id);
    let person: string | undefined;
    if (decision) {
      const merged = !values.includes(decision.value);
      person = decision.by;
      status = "resolved";
      winningValue = decision.value;
      decidedBy = "human";
      trace.push({
        ruleId: "human",
        outcome: "decided",
        detail: `${decision.by} ${merged ? "accepted the merged statement" : `chose ${decision.value}`}${decision.note ? `: ${decision.note}` : ""}`,
        docIds: merged ? surviving : conflictValues.find((v) => v.value === decision.value)?.docIds.filter((d) => !scopeDropped.has(d)) ?? [],
      });
    }

    const conflict: Conflict = { claimId: key.id, clusterId, values: conflictValues, status, winningValue, trace, ...(debate ? { debate } : {}) };
    conflictMeta.set(conflict, { decidedBy, person });
    conflicts.push(conflict);

    if (status === "human" || winningValue === null) continue;
    const isValue = values.includes(winningValue);
    const sources = isValue ? (conflictValues.find((v) => v.value === winningValue)?.docIds ?? []).filter((d) => !scopeDropped.has(d)) : surviving;
    let statement: string;
    if (isValue) statement = statementFor(key, winningValue, inst);
    else if (status === "resolved") statement = winningValue;
    else statement = debate?.mergedStatement ?? statementFor(key, winningValue, inst);
    const vouchedBy =
      status === "resolved" ? (decision?.by ?? "A person")
      : status === "debate" ? `Jury ${debate ? juryTally(debate).label : ""}`.trim()
      : `Rules: ${RULE_META[decidedBy as RuleId]?.label ?? "rules"}`;
    ledger.push(
      settle(key.id, statement, winningValue, sources, trace, vouchedBy, status === "resolved" && decision ? decision.at : corpus.generatedAt, status === "debate" && debate ? debate.confidence : 1),
    );
  }
  return { conflicts, ledger };
}

function monthsBefore(iso: string, months: number): string {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

function topicLabel(corpus: CorpusData, topicId: string): string {
  return corpus.clusters.find((c) => c.topicId === topicId)?.label ?? topicId;
}

function hygiene(ctx: Ctx): { issues: Issue[]; actions: JanitorAction[] } {
  const { corpus, rules, docs, people, today } = ctx;
  const issues: Issue[] = [];
  const actions: JanitorAction[] = [];
  const staleCutoff = monthsBefore(today, rules.staleAfterMonths);
  const name = (id: string | null | undefined) => (id && people.get(id)?.name) || "the author";

  const ownersByTopic = new Map<string, Map<string, number>>();
  const ownersAll = new Map<string, number>();
  for (const d of corpus.docs) {
    if (!d.ownerId) continue;
    const m = ownersByTopic.get(d.topicId) ?? new Map<string, number>();
    m.set(d.ownerId, (m.get(d.ownerId) ?? 0) + 1);
    ownersByTopic.set(d.topicId, m);
    ownersAll.set(d.ownerId, (ownersAll.get(d.ownerId) ?? 0) + 1);
  }
  const topOwner = (m: Map<string, number> | undefined) =>
    m ? [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] : undefined;

  const push = (kind: Exclude<IssueKind, "conflict">, doc: SourceDoc, severity: 1 | 2 | 3, title: string, detail: string, act: Omit<JanitorAction, "id" | "issueId" | "docIds">, extraDocs: string[] = []) => {
    const issueId = `ISS-${kind}-${doc.id}`;
    issues.push({ id: issueId, kind, title, detail, docIds: [doc.id, ...extraDocs], severity });
    actions.push({ id: `ACT-${kind}-${doc.id}`, issueId, docIds: [doc.id, ...extraDocs], ...act });
  };

  for (const d of corpus.docs) {
    const t = q(d);
    if (d.duplicateOf) {
      const orig = docs.get(d.duplicateOf);
      push("duplicate", d, 1, `${t} duplicates ${q(orig)}`, `Near-identical copy of ${q(orig)} (${d.duplicateOf}) in ${d.path}`, {
        kind: "archive",
        title: `Archive duplicate '${d.fileName}'`,
        detail: `Keeps ${q(orig)} as the single copy`,
      }, [d.duplicateOf]);
    }
    if (!d.ownerId) {
      const top = topOwner(ownersByTopic.get(d.topicId)) ?? topOwner(ownersAll);
      const who = top ? name(top[0]) : "a team lead";
      const topic = topicLabel(corpus, d.topicId);
      push("orphan", d, 2, `${t} has no owner`, `No owner is set in ${CONNECTOR_LABEL[d.connector]}, so nobody keeps it up to date`, {
        kind: "assign_owner",
        title: `Assign ${who} as owner of ${t}`,
        detail: top ? `${who} owns ${top[1]} other document${top[1] === 1 ? "" : "s"} on ${topic}` : `No owner found on ${topic}`,
      });
    }
    const pastReview = d.reviewBy && d.reviewBy.slice(0, 10) < today;
    const old = d.updatedAt.slice(0, 10) < staleCutoff;
    if (pastReview || old) {
      const who = name(d.ownerId ?? d.authorId);
      const why = pastReview ? `Review date passed on ${formatDate(d.reviewBy)}` : `Last updated ${formatDate(d.updatedAt)}, more than ${rules.staleAfterMonths} months ago`;
      push("stale", d, 1, `${t} is past its review date`, why, {
        kind: "notify_owner",
        title: `Ask ${who} to review ${t}`,
        detail: why,
      });
    }
    if (d.country !== rules.targetCountry) {
      push("scope", d, 2, `${t} is written for ${COUNTRY_LABEL[d.country]}`, `Found in ${d.path}. Its rules apply to ${COUNTRY_LABEL[d.country]}, not ${COUNTRY_LABEL[rules.targetCountry]}`, {
        kind: "tag_scope",
        title: `Tag ${t} as ${COUNTRY_LABEL[d.country]} only`,
        detail: `Excludes it from answers for ${COUNTRY_LABEL[rules.targetCountry]}`,
      });
    }
  }
  return { issues, actions };
}

const healthScore = (penalty: number) => Math.max(0, Math.min(100, Math.round(100 * Math.exp(-penalty / HEALTH_SCALE))));

export function runJanitor(corpus: CorpusData, rules: RulesConfig, decisions: HumanDecision[], appliedActionIds: string[]): JanitorResult {
  const ctx: Ctx = {
    corpus,
    rules,
    docs: new Map(corpus.docs.map((d) => [d.id, d])),
    people: new Map(corpus.people.map((p) => [p.id, p])),
    today: corpus.generatedAt.slice(0, 10),
  };
  const { conflicts, ledger } = resolveClaims(ctx, decisions);
  const hy = hygiene(ctx);
  const applied = new Set(appliedActionIds);
  const closed = new Set(hy.actions.filter((a) => applied.has(a.id)).map((a) => a.issueId));

  const keys = new Map(corpus.claimKeys.map((k) => [k.id, k]));
  const conflictIssues: Issue[] = conflicts
    .filter((c) => c.status === "human")
    .map((c) => ({
      id: `ISS-conflict-${c.claimId}`,
      kind: "conflict",
      title: `${keys.get(c.claimId)?.label ?? c.claimId}: ${c.values.length} values`,
      detail: `Sources disagree: ${c.values.map((v) => v.value).join(" vs ")}. ${conflictStatusLabel(c)}.`,
      docIds: [...new Set(c.values.flatMap((v) => v.docIds))],
      claimId: c.claimId,
      severity: 3,
    }));
  const openHygiene = hy.issues.filter((i) => !closed.has(i.id));
  const issues = [...conflictIssues, ...openHygiene];

  const breakdown: Record<IssueKind, number> = { conflict: 0, duplicate: 0, stale: 0, orphan: 0, scope: 0 };
  for (const i of issues) breakdown[i.kind]++;
  const penalty = issues.reduce((s, i) => s + HEALTH_WEIGHTS[i.kind], 0);
  const basePenalty = conflicts.length * HEALTH_WEIGHTS.conflict + hy.issues.reduce((s, i) => s + HEALTH_WEIGHTS[i.kind], 0);

  return {
    conflicts,
    issues,
    actions: hy.actions,
    ledger,
    health: { score: healthScore(penalty), baseline: healthScore(basePenalty), breakdown },
  };
}

export function syntheticDecisions(corpus: CorpusData, result: JanitorResult, by = "Lotte Peeters"): HumanDecision[] {
  return result.conflicts
    .filter((c) => c.status === "human")
    .map((c) => ({ claimId: c.claimId, value: c.debate?.mergedStatement ?? c.debate?.proposedValue ?? c.values[0].value, by, at: corpus.generatedAt }));
}

export function healthStages(corpus: CorpusData, rules: RulesConfig): { baseline: number; afterRules: number; afterActions: number; afterHuman: number } {
  const noWork = runJanitor(corpus, rules, [], []);
  const allActions = noWork.actions.map((a) => a.id);
  const withActions = runJanitor(corpus, rules, [], allActions);
  const withHuman = runJanitor(corpus, rules, syntheticDecisions(corpus, noWork), allActions);
  return { baseline: noWork.health.baseline, afterRules: noWork.health.score, afterActions: withActions.health.score, afterHuman: withHuman.health.score };
}
