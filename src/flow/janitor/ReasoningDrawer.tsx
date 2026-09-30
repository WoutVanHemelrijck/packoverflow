"use client";

import { AnimatePresence, motion } from "motion/react";
import { Archive, ArrowRight, Check, ExternalLink, FileText, type LucideIcon, Orbit, RotateCcw, Scale, Sparkles, Swords, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { docById } from "@/lib/data";
import { CONNECTOR_LABEL, LANG_LABEL } from "@/lib/labels";
import type { Conflict, JanitorResult } from "@/lib/types";
import { Badge, Button, cn, ConnectorIcon } from "@/flow/ui";
import { agentLog, type LogKind, type LogLine } from "./agentLog";
import type { Article, FileStep } from "./model";

const ICON: Record<LogKind, LucideIcon> = { read: FileText, embed: Orbit, extract: Sparkles, check: Swords, decide: Scale, human: UserRound, hygiene: Archive };
const GAP = 0.35;

function Chip({ children, tone = "agent" }: { children: string; tone?: "agent" | "neutral" }) {
  return (
    <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[12.5px] font-medium", tone === "agent" ? "bg-agent-soft text-agent" : "bg-canvas text-ink-2 border border-line")}>{children}</span>
  );
}

function StepBody({ line, conflict }: { line: LogLine; conflict?: Conflict }) {
  if (line.kind === "extract" && line.text.includes(" = ")) {
    const [label, value] = line.text.replace("Haiku extracted: ", "").split(" = ");
    return (
      <>
        <div className="text-[14px] text-ink-2">
          Haiku extracted <span className="text-ink font-medium">{label}</span>
        </div>
        <div className="mt-2">
          <Chip>{value}</Chip>
        </div>
        {line.detail && <div className="mt-2 text-[13px] italic text-muted leading-relaxed">{line.detail}</div>}
      </>
    );
  }
  if (line.kind === "check" && conflict) {
    return (
      <>
        <div className="text-[14px] text-ink font-medium">{line.text}</div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {conflict.values.map((v, i) => (
            <span key={v.value} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-[12px] text-faint">vs</span>}
              <Chip tone="neutral">{v.value}</Chip>
            </span>
          ))}
        </div>
      </>
    );
  }
  return (
    <>
      <div className={cn("text-[14px]", line.kind === "decide" || line.kind === "human" ? "text-ink font-medium" : "text-ink-2")}>{line.text}</div>
      {line.detail && <div className="mt-1 text-[12.5px] text-muted leading-snug">{line.detail}</div>}
    </>
  );
}

function Timeline({ lines, conflictAt, step, onOpenConflict }: { lines: LogLine[]; conflictAt: (Conflict | undefined)[]; step: FileStep; onOpenConflict: (claimId: string) => void }) {
  const human = conflictAt.find((c) => c?.status === "human");
  const decide = [...lines].reverse().find((l) => l.kind === "decide");
  const end = lines.length * GAP;
  return (
    <div>
      <ol>
        {lines.map((l, i) => {
          const Icon = ICON[l.kind];
          const last = i === lines.length - 1;
          const d = i * GAP;
          return (
            <li key={i} className="relative flex gap-4 pb-7">
              {!last && (
                <motion.span
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: d + 0.15, duration: 0.3, ease: "easeOut" }}
                  className="absolute left-[15px] top-8 bottom-0 w-px bg-line-strong origin-top"
                />
              )}
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: d, type: "spring", stiffness: 500, damping: 22 }}
                className={cn(
                  "relative z-10 w-8 h-8 rounded-full grid place-items-center flex-none",
                  l.kind === "human" || l.kind === "check" ? "bg-conflict-soft text-conflict" : l.kind === "decide" ? "bg-settled-soft text-settled" : "bg-agent-soft text-agent",
                )}
              >
                <Icon size={15} />
              </motion.span>
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: d + 0.08, duration: 0.3 }} className="min-w-0 flex-1 pt-1.5">
                <StepBody line={l} conflict={conflictAt[i]} />
              </motion.div>
            </li>
          );
        })}
      </ol>
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: end, duration: 0.3 }} className="pl-12 flex items-center gap-3 flex-wrap">
        {human ? (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[14px] font-medium bg-conflict-soft text-conflict">
              <UserRound size={15} /> Needs a person
            </span>
            <Button size="sm" variant="secondary" onClick={() => onOpenConflict(human.claimId)}>
              Open conflict <ArrowRight size={14} />
            </Button>
          </>
        ) : decide ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[14px] font-medium bg-settled-soft text-settled">
            <Check size={15} strokeWidth={3} /> Settled: {decide.text}
          </span>
        ) : (
          <Badge tone={step.kind === "needs" ? "conflict" : step.kind === "settled" ? "settled" : "neutral"} className="!text-[14px] !px-3 !py-1.5 !rounded-lg">
            {step.label}
          </Badge>
        )}
      </motion.div>
    </div>
  );
}

function Body({ step, result, articles, onClose, onOpenConflict }: { step: FileStep; result: JanitorResult; articles: Article[]; onClose: () => void; onOpenConflict: (claimId: string) => void }) {
  const [run, setRun] = useState(0);
  const doc = docById.get(step.docId);
  const lines = useMemo(() => agentLog(step.docId, result, articles), [step.docId, result, articles]);
  const conflictAt = useMemo(() => {
    const mine = result.conflicts.filter((c) => c.values.some((v) => v.docIds.includes(step.docId)));
    let k = -1;
    return lines.map((l) => {
      if (l.kind === "check") k++;
      return l.kind === "check" || l.kind === "decide" || l.kind === "human" ? mine[k] : undefined;
    });
  }, [lines, result.conflicts, step.docId]);
  if (!doc) return null;
  return (
    <div className="p-8">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="text-[13px] text-agent font-medium">Reasoning</div>
          <h2 className="mt-2 text-[22px] font-medium tracking-[-0.02em] leading-tight break-words">{doc.fileName}</h2>
          <div className="mt-3 flex items-center gap-2 text-[13px] text-muted">
            <ConnectorIcon id={doc.connector} size={18} />
            <span>{CONNECTOR_LABEL[doc.connector]}</span>
            <span className="text-faint">·</span>
            <span>{LANG_LABEL[doc.lang]}</span>
            <span className="text-faint">·</span>
            <span>
              {doc.pages} {doc.pages === 1 ? "page" : "pages"}
            </span>
            <span className="text-faint">·</span>
            <a href={`/pdfs/${doc.fileName}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-agent hover:underline underline-offset-2">
              Open PDF <ExternalLink size={12} />
            </a>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-none">
          <Button size="sm" variant="ghost" onClick={() => setRun((r) => r + 1)}>
            <RotateCcw size={13} /> Replay
          </Button>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-canvas cursor-pointer text-muted" aria-label="Close">
            <X size={18} />
          </button>
        </div>
      </div>
      <div className="mt-10">
        <Timeline key={run} lines={lines} conflictAt={conflictAt} step={step} onOpenConflict={onOpenConflict} />
      </div>
    </div>
  );
}

export function ReasoningDrawer({
  step,
  result,
  articles,
  onClose,
  onOpenConflict,
}: {
  step: FileStep | null;
  result: JanitorResult;
  articles: Article[];
  onClose: () => void;
  onOpenConflict: (claimId: string) => void;
}) {
  useEffect(() => {
    if (!step) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, onClose]);
  return (
    <AnimatePresence>
      {step && (
        <>
          <motion.div key="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-ink/15 z-50" />
          <motion.aside
            key="drawer"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed top-0 right-0 bottom-0 w-[560px] bg-bg border-l border-line shadow-pop z-50 overflow-y-auto"
          >
            <Body key={step.docId} step={step} result={result} articles={articles} onClose={onClose} onOpenConflict={onOpenConflict} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
