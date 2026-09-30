import embeddings from "@/data/embeddings.json";
import spaceJson from "@/data/embedding-space.json";
import claimsReal from "@/data/claims.real.json";
import { docById } from "@/lib/data";
import { decidingRule, juryTally } from "@/lib/janitor";
import type { Conflict, JanitorResult } from "@/lib/types";
import { type Article, claimKeyById } from "./model";

export type LogKind = "read" | "embed" | "extract" | "check" | "decide" | "human" | "hygiene";

export interface LogLine {
  kind: LogKind;
  text: string;
  detail?: string;
}

const vectors = (embeddings as { vectors: Record<string, number[]> }).vectors;
const clusters = (spaceJson as { clusters: { id: string; label: string; docIds: string[] }[] }).clusters;
const extracted = (claimsReal as { claims: { claimId: string; docId: string; value: string; quote: string; matchesPlanted: boolean }[] }).claims;

const norm = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));

// Each doc's cluster from the real k-means run, plus its closest neighbour by cosine over the real 384-dim vectors.
const nearest = new Map<string, { clusterId: string; label: string; related: number; closestId: string | null; closestSim: number; top: { id: string; sim: number }[] }>();
const cosine = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0) / (norm(a) * norm(b));
for (const c of clusters) {
  for (const d of c.docIds) {
    const v = vectors[d];
    if (!v) continue;
    const top = c.docIds
      .filter((other) => other !== d && vectors[other])
      .map((other) => ({ id: other, sim: cosine(v, vectors[other]) }))
      .sort((x, y) => y.sim - x.sim);
    nearest.set(d, { clusterId: c.id, label: c.label, related: c.docIds.length - 1, closestId: top[0]?.id ?? null, closestSim: top[0]?.sim ?? 0, top: top.slice(0, 3) });
  }
}

export const clusterOfDoc = (docId: string) => nearest.get(docId);

const claimLabel = (id: string) => claimKeyById.get(id)?.label ?? id;

export function decisionLine(c: Conflict, articles: Article[]): LogLine {
  if (c.status === "human") return { kind: "human", text: "Split jury, needs a person" };
  if (c.status === "resolved") return { kind: "decide", text: `Settled by a person: ${c.winningValue ?? ""}` };
  if (c.status === "debate") return { kind: "decide", text: `AI jury ${c.debate ? juryTally(c.debate).label : ""} for ${c.winningValue ?? ""}` };
  const rule = decidingRule(c) ?? c.trace.find((s) => s.outcome === "decided")?.ruleId;
  const art = articles.find((a) => a.key === rule);
  const step = c.trace.find((s) => s.ruleId === rule && s.outcome !== "skipped") ?? c.trace.find((s) => s.outcome === "decided");
  return { kind: "decide", text: `Art. ${art?.n ?? "?"} ${art?.title ?? ""}`, detail: step?.detail };
}

export function agentLog(docId: string, result: JanitorResult, articles: Article[]): LogLine[] {
  const doc = docById.get(docId);
  if (!doc) return [];
  const out: LogLine[] = [{ kind: "read", text: `Read ${doc.fileName}`, detail: `${doc.pages} pages, ${doc.body.length.toLocaleString("en")} characters` }];

  const nb = nearest.get(docId);
  if (nb) {
    const similar = nb.top.map((t) => `${docById.get(t.id)?.title ?? t.id} (${Math.round(t.sim * 100)}%)`);
    out.push({
      kind: "embed",
      text: `Found ${nb.related} similar ${nb.related === 1 ? "file" : "files"}`,
      detail: similar.length ? `Closest: ${similar.join(", ")}` : undefined,
    });
  }

  const facts = extracted.filter((c) => c.docId === docId);
  if (!facts.length) out.push({ kind: "extract", text: "No facts in this file" });
  for (const f of facts) out.push({ kind: "extract", text: `Haiku extracted: ${claimLabel(f.claimId)} = ${f.value}`, detail: f.quote.length > 90 ? `"${f.quote.slice(0, 88)}..."` : `"${f.quote}"` });

  for (const c of result.conflicts) {
    if (!c.values.some((v) => v.docIds.includes(docId))) continue;
    const docs = new Set(c.values.flatMap((v) => v.docIds)).size;
    out.push({ kind: "check", text: `Conflict on ${claimLabel(c.claimId)}`, detail: `${c.values.length} different values across ${docs} documents: ${c.values.map((v) => v.value).join(" vs ")}` });
    out.push(decisionLine(c, articles));
  }

  for (const a of result.actions) if (a.docIds[0] === docId) out.push({ kind: "hygiene", text: a.title, detail: a.detail });
  return out;
}
