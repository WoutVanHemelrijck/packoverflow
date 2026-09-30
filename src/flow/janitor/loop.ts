"use client";

import { useEffect, useMemo, useRef } from "react";
import { useJanitor } from "@/lib/store";
import { connectedDocIds, connectedHealth } from "@/flow/janitor/connected";

// Runs at app level so the janitor keeps cleaning whichever view is open.
export function useJanitorLoop() {
  const { sources, processed, markProcessed, result, reviewed, decisions, janitorRan, setJanitorRan, applyActions } = useJanitor();
  const runIdx = useRef(0);
  const connected = useMemo(() => connectedDocIds(sources), [sources]);
  const next = useMemo(() => {
    const P = new Set(processed);
    return connected.find((d) => !P.has(d));
  }, [connected, processed]);
  const n = connected.length;

  useEffect(() => {
    if (!next) return;
    const t = setTimeout(() => {
      runIdx.current++;
      markProcessed([next]);
    }, runIdx.current < 6 ? 3000 : 1400);
    return () => clearTimeout(t);
  }, [next, markProcessed]);

  useEffect(() => {
    if (next) {
      if (janitorRan) setJanitorRan(false);
      return;
    }
    runIdx.current = 0;
    if (!n || janitorRan) return;
    setJanitorRan(true);
    const P = new Set(processed);
    applyActions(result.actions.filter((a) => P.has(a.docIds[0])).map((a) => a.id));
  }, [next, n, janitorRan, setJanitorRan, applyActions, result.actions, processed]);

  useEffect(() => {
    if (!janitorRan) return;
    const now = connectedHealth(result, reviewed, connected, processed);
    fetch("/api/ledger", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ledger: result.ledger,
        health: { health: now.score, consistency: now.consistency, freshness: now.freshness, certainty: now.certainty, openConflicts: now.openConflicts },
        updatedAt: new Date().toISOString(),
      }),
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- post once per run or decision, not per health recompute
  }, [janitorRan, decisions, reviewed, result]);
}
