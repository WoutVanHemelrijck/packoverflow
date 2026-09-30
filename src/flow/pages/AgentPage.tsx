"use client";

import { useEffect, useMemo, useState } from "react";
import { corpus } from "@/lib/data";
import { useJanitor } from "@/lib/store";
import { connectedDocIds, connectedHealth } from "@/flow/janitor/connected";
import { Chat } from "@/flow/claude/Chat";
import { McpCard } from "@/flow/claude/McpCard";
import { type LedgerFile, toFacts } from "@/flow/claude/facts";

export default function AgentPage() {
  const { result, processed, reviewed, sources } = useJanitor();
  const [served, setServed] = useState<LedgerFile | null>(null);

  const health = useMemo(() => {
    const h = connectedHealth(result, reviewed, connectedDocIds(sources), processed);
    return { health: h.score, consistency: h.consistency, freshness: h.freshness, certainty: h.certainty, openConflicts: h.openConflicts };
  }, [result, reviewed, processed, sources]);
  const facts = useMemo(() => toFacts(result.ledger, corpus.docs, corpus.claimKeys), [result.ledger]);

  useEffect(() => {
    const local: LedgerFile = { ledger: result.ledger, health, updatedAt: new Date().toISOString() };
    fetch("/api/ledger", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(local) })
      .then((r) => r.json() as Promise<LedgerFile>)
      .then(setServed)
      .catch(() => setServed(local));
  }, [result.ledger, health]);

  return (
    <div className="flex flex-col h-[calc(100dvh-68px)] min-h-[560px]">
      <div className="mb-7">
        <h1 className="headline text-[32px]">Agent</h1>
        <p className="mt-1.5 text-[15px] text-muted">Claude answers from the ground truth through the Spotless MCP server.</p>
      </div>
      <div className="flex-1 min-h-0 grid grid-cols-[340px_1fr] gap-6">
        <div className="min-h-0 overflow-y-auto">
          <McpCard facts={served?.ledger.length ?? null} health={health} />
        </div>
        <div className="min-h-0">
          <Chat facts={facts} ledger={result.ledger} />
        </div>
      </div>
    </div>
  );
}
