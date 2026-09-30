import { corpus, docById } from "@/lib/data";
import { cleanupDocIds, conflictDocs, factConfidence, CONFIDENCE, type HealthNumbers } from "@/lib/health";
import type { SourceFile } from "@/lib/store";
import type { JanitorResult } from "@/lib/types";

export function connectedDocIds(sources: SourceFile[]): string[] {
  return [...new Set(sources.map((s) => s.docId).filter((d): d is string => !!d && docById.has(d)))];
}

// Health of the connected knowledge only: a conflict counts once all its documents are connected,
// and stays open until the janitor has processed every one of them (or while it needs a person).
export function connectedHealth(result: JanitorResult, reviewed: readonly string[], connected: readonly string[], processed: readonly string[]): HealthNumbers {
  const C = new Set(connected);
  const P = new Set(processed);
  const factIds = new Set(corpus.claims.filter((c) => C.has(c.docId)).map((c) => c.claimId));
  const conflicts = result.conflicts.filter((c) => factIds.has(c.claimId) && conflictDocs(c).every((d) => C.has(d)));
  const isOpen = (c: (typeof conflicts)[number]) => c.status === "human" || conflictDocs(c).some((d) => !P.has(d));
  const open = conflicts.filter(isOpen);
  const settled = conflicts.filter((c) => !isOpen(c));
  const totalFacts = factIds.size;
  const agreed = totalFacts - conflicts.length;
  const settledCount = agreed + settled.length;
  const confSum = agreed * CONFIDENCE.agreed + settled.reduce((s, c) => s + factConfidence(c, reviewed), 0);
  const totalDocs = C.size;
  const staleDocs = cleanupDocIds(result).filter((d) => C.has(d) && !P.has(d)).length;
  const consistency = totalFacts ? (100 * (totalFacts - open.length)) / totalFacts : 0;
  const freshness = totalDocs ? (100 * (totalDocs - staleDocs)) / totalDocs : 0;
  return {
    score: Math.round((consistency + freshness) / 2),
    consistency: Math.round(consistency),
    freshness: Math.round(freshness),
    certainty: settledCount ? Math.round((100 * confSum) / settledCount) : 0,
    totalFacts,
    openConflicts: open.length,
    totalDocs,
    staleDocs,
  };
}
