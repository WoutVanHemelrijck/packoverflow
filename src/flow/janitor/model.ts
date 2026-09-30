import { corpus, docById } from "@/lib/data";
import { decidingRule, juryTally, RULE_META } from "@/lib/janitor";
import { cleanupDocIds, conflictDocs } from "@/lib/health";
import type { Conflict, JanitorResult, RuleId, RulesConfig } from "@/lib/types";
import type { Tone } from "@/flow/ui";

export const HERO_CLAIM = "indexation_cap.first_application_pc200";
export const claimKeyById = new Map(corpus.claimKeys.map((k) => [k.id, k]));
const claimById = new Map(corpus.claims.map((c) => [c.id, c]));
const factsPerDoc = corpus.claims.reduce((m, c) => m.set(c.docId, (m.get(c.docId) ?? 0) + 1), new Map<string, number>());

export type ArticleKey = RuleId | "debate";

export interface Article {
  key: ArticleKey;
  n: number | null;
  title: string;
  text: string;
  enabled: boolean;
}

const ARTICLE_TEXT: Partial<Record<ArticleKey, string>> = {
  scope: "A document written for another country never decides a Belgian fact.",
  authority: "Legal text beats policy, procedure, FAQ, slides, email and chat.",
  recency: "When sources rank the same, the latest effective date wins.",
  payroll: "The value the payroll engine applies today wins.",
  owner: "A document with a named owner beats an orphan document.",
  seniority: "The more senior author wins what is left.",
  debate: "Ties go to three AI jurors; a split jury goes to a person.",
};

export function buildArticles(rules: RulesConfig, includeDisabled = false): Article[] {
  let n = 0;
  const out: Article[] = [];
  for (const r of rules.order) {
    if (!r.enabled && !includeDisabled) continue;
    out.push({ key: r.id, n: r.enabled ? ++n : null, title: RULE_META[r.id]?.label ?? r.id, text: ARTICLE_TEXT[r.id] ?? RULE_META[r.id]?.description ?? "", enabled: r.enabled });
  }
  out.push({ key: "debate", n: n + 1, title: "AI jury", text: ARTICLE_TEXT.debate!, enabled: true });
  return out;
}

export function howSettled(c: Conflict, articles: Article[], reviewed: readonly string[]): { label: string; tone: Tone } {
  if (c.status === "human") return { label: "Needs you", tone: "conflict" };
  if (c.status === "resolved") return { label: "Settled by you", tone: "settled" };
  const suffix = reviewed.includes(c.claimId) ? ", confirmed" : "";
  if (c.status === "debate") return { label: `AI jury ${c.debate ? juryTally(c.debate).label : ""}${suffix}`, tone: "agent" };
  const rule = decidingRule(c) ?? c.trace.find((s) => s.outcome === "decided")?.ruleId;
  const art = articles.find((a) => a.key === rule);
  return { label: `Art. ${art?.n ?? "?"} ${art?.title ?? ""}${suffix}`, tone: "neutral" };
}

export type OutcomeKind = "clean" | "archived" | "superseded" | "review" | "settled" | "jury" | "needs";

export interface FileStep {
  docId: string;
  kind: OutcomeKind;
  label: string;
  completes: Conflict[];
}

export const TALLY: { key: string; label: string; kinds: OutcomeKind[]; tone: Tone }[] = [
  { key: "clean", label: "Clean", kinds: ["clean"], tone: "neutral" },
  { key: "archived", label: "Archived", kinds: ["archived"], tone: "neutral" },
  { key: "stale", label: "Superseded", kinds: ["superseded", "review"], tone: "warn" },
  { key: "settled", label: "Conflicts settled", kinds: ["settled", "jury"], tone: "settled" },
  { key: "needs", label: "Needs you", kinds: ["needs"], tone: "conflict" },
];

export function buildQueue(docIds: string[], result: JanitorResult, articles: Article[]): FileStep[] {
  const pos = new Map(docIds.map((d, i) => [d, i]));
  const completesAt = new Map<number, Conflict[]>();
  for (const c of result.conflicts) {
    const idx = conflictDocs(c).map((d) => pos.get(d) ?? Infinity);
    const last = Math.max(...idx);
    if (last === Infinity) continue;
    completesAt.set(last, [...(completesAt.get(last) ?? []), c]);
  }
  const archived = new Set(result.actions.filter((a) => a.kind === "archive").map((a) => a.docIds[0]));
  const stale = new Set(cleanupDocIds(result).filter((d) => !archived.has(d)));

  return docIds.map((docId, i) => {
    const completes = completesAt.get(i) ?? [];
    const needs = completes.find((c) => c.status === "human");
    const byRule = completes.find((c) => c.status === "auto");
    const byJury = completes.find((c) => c.status === "debate" || c.status === "resolved");
    const facts = factsPerDoc.get(docId) ?? 0;
    let kind: OutcomeKind = "clean";
    let label = facts ? `Clean, ${facts} fact${facts === 1 ? "" : "s"}` : "Clean";
    if (archived.has(docId)) [kind, label] = ["archived", "Archived duplicate"];
    else if (stale.has(docId)) [kind, label] = facts ? ["superseded", "Superseded, newer source"] : ["review", "Owner asked to review"];
    if (byRule) [kind, label] = ["settled", `Conflict settled, ${howSettled(byRule, articles, []).label.split(" ").slice(0, 2).join(" ")}`];
    if (byJury) [kind, label] = byJury.status === "resolved" ? ["settled", "Conflict settled by you"] : ["jury", "Jury settled"];
    if (needs) [kind, label] = ["needs", "Needs you"];
    return { docId, kind, label, completes };
  });
}

export function tallyOf(steps: FileStep[]): Record<string, number> {
  const t: Record<string, number> = { clean: 0, archived: 0, stale: 0, settled: 0, needs: 0 };
  for (const s of steps) {
    if (s.kind === "clean") t.clean++;
    if (s.kind === "archived") t.archived++;
    if (s.kind === "superseded" || s.kind === "review") t.stale++;
    for (const c of s.completes) t[c.status === "human" ? "needs" : "settled"]++;
  }
  return t;
}

export function articleUse(steps: FileStep[]): Record<string, number> {
  const use: Record<string, number> = {};
  for (const s of steps)
    for (const c of s.completes)
      for (const t of c.trace) {
        if (t.ruleId === "human" || t.outcome === "skipped") continue;
        if (t.ruleId !== "debate" && t.outcome === "tie") continue;
        use[t.ruleId] = (use[t.ruleId] ?? 0) + 1;
      }
  return use;
}

export function quoteParagraph(claimInstanceId: string): { before: string; quote: string; after: string } | null {
  const ci = claimById.get(claimInstanceId);
  const doc = ci && docById.get(ci.docId);
  if (!ci || !doc) return null;
  const para = doc.body.split("\n\n").find((p) => p.includes(ci.quote));
  if (!para) return { before: "", quote: ci.quote, after: "" };
  const i = para.indexOf(ci.quote);
  const before = para.slice(0, i);
  const after = para.slice(i + ci.quote.length);
  const end = after.search(/[.!?](\s|$)/);
  return { before: before.slice(before.search(/[^.!?]*$/)).trimStart(), quote: ci.quote, after: end === -1 ? after : after.slice(0, end + 1) };
}
