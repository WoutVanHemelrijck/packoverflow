"use client";

import { motion } from "motion/react";
import { Archive, ChevronRight, FileText, type LucideIcon, Orbit, Scale, Sparkles, Swords, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { docById } from "@/lib/data";
import { shortTitle } from "@/lib/janitor";
import type { JanitorResult } from "@/lib/types";
import { Badge, cn, ConnectorIcon, JanitorAvatar, type Tone } from "@/flow/ui";
import { agentLog, type LogKind, type LogLine } from "./agentLog";
import type { Article, FileStep, OutcomeKind } from "./model";

const ICON: Record<LogKind, LucideIcon> = { read: FileText, embed: Orbit, extract: Sparkles, check: Swords, decide: Scale, human: UserRound, hygiene: Archive };
const ICON_TONE: Record<LogKind, string> = { read: "text-muted", embed: "text-agent", extract: "text-agent", check: "text-conflict", decide: "text-settled", human: "text-conflict", hygiene: "text-warn" };
const OUTCOME_TONE: Record<OutcomeKind, Tone> = { clean: "neutral", archived: "neutral", superseded: "warn", review: "warn", settled: "settled", jury: "agent", needs: "conflict" };
const MAX_DONE = 7;

function Line({ line }: { line: LogLine }) {
  const Icon = ICON[line.kind];
  return (
    <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }} className="flex gap-2.5 items-start py-[3px]">
      <Icon size={13} className={cn("flex-none mt-[3px]", ICON_TONE[line.kind])} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] leading-snug text-ink-2">{line.text}</div>
        {line.detail && <div className="font-mono text-[11px] leading-snug text-muted truncate">{line.detail}</div>}
      </div>
    </motion.div>
  );
}

function Current({ step, result, articles }: { step: FileStep; result: JanitorResult; articles: Article[] }) {
  const lines = useMemo(() => agentLog(step.docId, result, articles), [step.docId, result, articles]);
  const [shown, setShown] = useState(1);
  useEffect(() => {
    if (shown >= lines.length) return;
    const t = setTimeout(() => setShown((s) => s + 1), 320);
    return () => clearTimeout(t);
  }, [shown, lines.length]);
  const doc = docById.get(step.docId);
  if (!doc) return null;
  return (
    <div className="px-4 py-3 bg-agent-soft/50 border-b border-line">
      <div className="flex items-center gap-3">
        <ConnectorIcon id={doc.connector} size={20} />
        <div className="flex-1 min-w-0 truncate text-[14px] font-medium">{shortTitle(doc.title, 60)}</div>
        <span className="flex items-center gap-2 text-[13px] text-agent font-medium flex-none">
          <motion.span animate={{ y: [0, -2, 0] }} transition={{ repeat: Infinity, duration: 0.6 }}>
            <JanitorAvatar size={18} />
          </motion.span>
          Working
        </span>
      </div>
      <div className="mt-2 pl-8">
        {lines.slice(0, shown).map((l, i) => (
          <Line key={i} line={l} />
        ))}
      </div>
    </div>
  );
}

function Done({ step, result, articles, open, onToggle }: { step: FileStep; result: JanitorResult; articles: Article[]; open: boolean; onToggle: () => void }) {
  const doc = docById.get(step.docId);
  if (!doc) return null;
  return (
    <div className="border-b border-line last:border-b-0">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 h-10 text-left hover:bg-canvas cursor-pointer">
        <ChevronRight size={13} className={cn("text-faint flex-none transition-transform", open && "rotate-90")} />
        <ConnectorIcon id={doc.connector} size={18} />
        <div className="flex-1 min-w-0 truncate text-[13px] text-ink-2">{shortTitle(doc.title, 56)}</div>
        <Badge tone={OUTCOME_TONE[step.kind]}>{step.label}</Badge>
      </button>
      {open && (
        <div className="pl-[60px] pr-4 pb-3">
          {agentLog(step.docId, result, articles).map((l, i) => (
            <Line key={i} line={l} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AgentLog({ steps, done, result, articles }: { steps: FileStep[]; done: number; result: JanitorResult; articles: Article[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const cur = steps[done];
  const past = steps.slice(Math.max(0, done - MAX_DONE), done).reverse();
  const older = Math.max(0, done - MAX_DONE);
  const waiting = steps.length - done - (cur ? 1 : 0);
  return (
    <div>
      {cur && <Current key={cur.docId} step={cur} result={result} articles={articles} />}
      {past.map((s) => (
        <motion.div key={s.docId} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <Done step={s} result={result} articles={articles} open={open === s.docId} onToggle={() => setOpen(open === s.docId ? null : s.docId)} />
        </motion.div>
      ))}
      {(older > 0 || waiting > 0) && (
        <div className="px-4 h-9 flex items-center gap-4 text-[12px] text-faint border-t border-line">
          {waiting > 0 && <span>{waiting} files waiting</span>}
          {older > 0 && <span>{older} earlier files cleaned</span>}
        </div>
      )}
    </div>
  );
}
