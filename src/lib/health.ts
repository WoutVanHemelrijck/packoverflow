import { corpus } from "./data";
import type { Conflict, JanitorResult } from "./types";

// "none" = raw import, "all" = the janitor processed every file, a Set = the doc ids processed so far.
export type Progress = "none" | "all" | ReadonlySet<string>;

export interface HealthNumbers {
  score: number;
  consistency: number;
  freshness: number;
  certainty: number;
  totalFacts: number;
  openConflicts: number;
  totalDocs: number;
  staleDocs: number;
}

export const CONFIDENCE = { agreed: 1, rule: 0.9, jury: 0.8, person: 1 } as const;

const done = (progress: Progress, docId: string) => progress === "all" || (progress !== "none" && progress.has(docId));

export function conflictDocs(c: Conflict): string[] {
  return [...new Set(c.values.flatMap((v) => v.docIds))];
}

export function conflictProcessed(c: Conflict, progress: Progress): boolean {
  return conflictDocs(c).every((d) => done(progress, d));
}

export function isOpen(c: Conflict, progress: Progress = "all"): boolean {
  return c.status === "human" || !conflictProcessed(c, progress);
}

export function factConfidence(c: Conflict, reviewed: readonly string[]): number {
  if (c.status === "resolved" || reviewed.includes(c.claimId)) return CONFIDENCE.person;
  return c.status === "debate" ? CONFIDENCE.jury : CONFIDENCE.rule;
}

export function cleanupDocIds(result: JanitorResult): string[] {
  return [...new Set(result.actions.filter((a) => a.kind === "archive" || a.kind === "notify_owner").map((a) => a.docIds[0]))];
}

export function measureHealth(result: JanitorResult, reviewed: readonly string[], progress: Progress = "all"): HealthNumbers {
  const totalFacts = corpus.claimKeys.length;
  const open = result.conflicts.filter((c) => isOpen(c, progress));
  const settled = result.conflicts.filter((c) => !isOpen(c, progress));
  const agreed = totalFacts - result.conflicts.length;
  const confSum = agreed * CONFIDENCE.agreed + settled.reduce((s, c) => s + factConfidence(c, reviewed), 0);
  const settledCount = agreed + settled.length;

  const totalDocs = corpus.docs.length;
  const staleDocs = cleanupDocIds(result).filter((d) => !done(progress, d)).length;

  const consistency = (100 * (totalFacts - open.length)) / totalFacts;
  const freshness = (100 * (totalDocs - staleDocs)) / totalDocs;
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
