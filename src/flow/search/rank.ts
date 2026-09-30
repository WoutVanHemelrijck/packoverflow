import { corpus, docById } from "@/lib/data";
import type { JanitorResult, SourceDoc } from "@/lib/types";

export interface Hit {
  doc: SourceDoc;
  score: number | null; // cosine similarity; null = keyword match
}

export type DocStatus =
  | { kind: "conflict"; label: string }
  | { kind: "settled"; value: string; label: string }
  | { kind: "superseded"; label: string }
  | { kind: "none" };

export function queryTerms(q: string): string[] {
  return [...new Set(q.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 3))];
}

export function keywordHits(q: string, pool: SourceDoc[], limit: number): Hit[] {
  const terms = queryTerms(q);
  if (!terms.length) return [];
  return pool
    .map((doc) => {
      const title = doc.title.toLowerCase();
      const body = doc.body.toLowerCase();
      const s = terms.reduce((acc, t) => acc + (title.includes(t) ? 3 : 0) + (body.includes(t) ? 1 : 0), 0);
      return { doc, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(({ doc }) => ({ doc, score: null }));
}

export function snippet(doc: SourceDoc, q: string): string {
  const terms = queryTerms(q);
  const text = doc.body
    .split("\n")
    .filter((l) => !/^\s*(>|[\p{L}-]{1,12}:\s)/u.test(l))
    .join(" ");
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 20);
  let best = sentences[0] ?? doc.body;
  let bestN = 0;
  for (const s of sentences) {
    const low = s.toLowerCase();
    const n = terms.filter((t) => low.includes(t)).length;
    if (n > bestN) [best, bestN] = [s, n];
  }
  return best.length > 190 ? `${best.slice(0, 187).trimEnd()}...` : best;
}

export function docStatus(docId: string, result: JanitorResult): DocStatus {
  const claims = corpus.claims.filter((c) => c.docId === docId);
  if (!claims.length) return { kind: "none" };
  const open = result.conflicts.find((c) => c.status === "human" && c.values.some((v) => v.docIds.includes(docId)));
  if (open) return { kind: "conflict", label: "In conflict" };
  for (const claim of claims) {
    const fact = result.ledger.find((l) => l.claimId === claim.claimId);
    if (fact?.sourceDocIds.includes(docId)) return { kind: "settled", value: fact.value, label: `Settled: ${fact.value}` };
  }
  if (claims.some((c) => result.ledger.some((l) => l.claimId === c.claimId))) return { kind: "superseded", label: "Superseded" };
  return { kind: "none" };
}

export function toHits(neighbors: { docId: string; score: number }[], allowed: Set<string>): Hit[] {
  return neighbors.flatMap((n) => {
    const doc = docById.get(n.docId);
    return doc && allowed.has(doc.id) ? [{ doc, score: n.score }] : [];
  });
}
