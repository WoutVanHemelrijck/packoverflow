"use client";

import { motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { docById } from "@/lib/data";
import { shortTitle } from "@/lib/janitor";
import type { JanitorResult } from "@/lib/types";
import { Badge, ConnectorIcon, type Tone } from "@/flow/ui";
import { agentLog } from "./agentLog";
import type { Article, FileStep, OutcomeKind } from "./model";
import { ReasoningDrawer } from "./ReasoningDrawer";

const OUTCOME_TONE: Record<OutcomeKind, Tone> = { clean: "neutral", archived: "neutral", superseded: "warn", review: "warn", settled: "settled", jury: "agent", needs: "conflict" };
const MAX_DONE = 5;
const QUEUED = 2;

// Mirrors loop.ts: the first 6 files of a run take 3000ms, the rest 1400ms. Module scope so it survives view switches.
const run = { count: 0, last: "" };

function Current({ step, result, articles, duration, onOpen }: { step: FileStep; result: JanitorResult; articles: Article[]; duration: number; onOpen: () => void }) {
  const lines = useMemo(() => agentLog(step.docId, result, articles), [step.docId, result, articles]);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (i >= lines.length - 1) return;
    const t = setTimeout(() => setI((x) => x + 1), duration / lines.length);
    return () => clearTimeout(t);
  }, [i, lines.length, duration]);
  const doc = docById.get(step.docId);
  if (!doc) return null;
  return (
    <button onClick={onOpen} className="relative w-full flex items-center gap-3 px-4 py-2.5 text-left bg-agent-soft/40 hover:bg-agent-soft/70 cursor-pointer border-b border-line">
      <ConnectorIcon id={doc.connector} size={18} />
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-medium truncate">{shortTitle(doc.title, 60)}</div>
        <motion.div key={i} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="text-[12px] text-muted truncate">
          {lines[i]?.text}
        </motion.div>
      </div>
      <span className="flex items-center gap-1.5 text-[12.5px] text-agent font-medium flex-none">
        <Loader2 size={13} className="animate-spin" /> Reading
      </span>
      <motion.span initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: duration / 1000, ease: "linear" }} className="absolute left-0 bottom-0 h-[2px] bg-agent" />
    </button>
  );
}

function Row({ step, onOpen }: { step: FileStep; onOpen: () => void }) {
  const doc = docById.get(step.docId);
  if (!doc) return null;
  return (
    <button onClick={onOpen} className="w-full flex items-center gap-3 px-4 h-10 text-left hover:bg-canvas cursor-pointer border-b border-line">
      <ConnectorIcon id={doc.connector} size={18} />
      <div className="flex-1 min-w-0 truncate text-[13px] text-ink-2">{shortTitle(doc.title, 56)}</div>
      <Badge tone={OUTCOME_TONE[step.kind]}>{step.label}</Badge>
    </button>
  );
}

function Queued({ step }: { step: FileStep }) {
  const doc = docById.get(step.docId);
  if (!doc) return null;
  return (
    <div className="w-full flex items-center gap-3 px-4 h-10 border-b border-line opacity-45">
      <ConnectorIcon id={doc.connector} size={18} />
      <div className="flex-1 min-w-0 truncate text-[13px] text-muted">{shortTitle(doc.title, 56)}</div>
      <span className="text-[12px] text-faint">Queued</span>
    </div>
  );
}

export function AgentLog({
  steps,
  done,
  result,
  articles,
  onOpenConflict,
}: {
  steps: FileStep[];
  done: number;
  result: JanitorResult;
  articles: Article[];
  onOpenConflict: (claimId: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const cur = steps[done];
  // Mirrors loop.ts's per-run file counter so the progress bar matches its 3s/1.4s pacing.
  /* eslint-disable react-hooks/immutability, react-hooks/globals */
  if (!cur) run.count = 0;
  else if (run.last !== cur.docId) {
    run.last = cur.docId;
    run.count++;
  }
  /* eslint-enable react-hooks/immutability, react-hooks/globals */
  const duration = run.count <= 6 ? 3000 : 1400;
  const queued = steps.slice(done + 1, done + 1 + QUEUED);
  const past = steps.slice(Math.max(0, done - MAX_DONE), done).reverse();
  const older = Math.max(0, done - MAX_DONE);
  const waiting = steps.length - done - (cur ? 1 : 0) - queued.length;
  const openStep = steps.find((s) => s.docId === open) ?? null;
  return (
    <div>
      {queued
        .slice()
        .reverse()
        .map((s) => (
          <Queued key={s.docId} step={s} />
        ))}
      {cur && <Current key={cur.docId} step={cur} result={result} articles={articles} duration={duration} onOpen={() => setOpen(cur.docId)} />}
      {past.map((s) => (
        <motion.div key={s.docId} layout initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <Row step={s} onOpen={() => setOpen(s.docId)} />
        </motion.div>
      ))}
      {(older > 0 || waiting > 0) && (
        <div className="px-4 h-9 flex items-center gap-4 text-[12px] text-faint">
          {waiting > 0 && <span>{waiting} more files waiting</span>}
          {older > 0 && <span>{older} earlier files cleaned</span>}
        </div>
      )}
      <ReasoningDrawer
        step={openStep}
        result={result}
        articles={articles}
        onClose={() => setOpen(null)}
        onOpenConflict={(id) => {
          setOpen(null);
          onOpenConflict(id);
        }}
      />
    </div>
  );
}
