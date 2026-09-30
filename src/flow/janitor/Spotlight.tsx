"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { docById, personById } from "@/lib/data";
import { formatDate } from "@/lib/janitor";
import { CHANNEL_LABEL, COUNTRY_LABEL } from "@/lib/labels";
import type { Conflict } from "@/lib/types";
import { Button, Card, cn, JanitorAvatar } from "@/flow/ui";
import { decisionLine } from "./agentLog";
import { type Article, claimKeyById } from "./model";

function DocChip({ docId }: { docId: string }) {
  const doc = docById.get(docId);
  if (!doc) return null;
  const owner = doc.ownerId ? personById.get(doc.ownerId)?.name : null;
  return (
    <div className="rounded-md border border-line bg-bg px-2 py-1 text-[11px] leading-tight">
      <div className="font-medium text-ink-2">{CHANNEL_LABEL[doc.channel]}</div>
      <div className="text-muted">
        {owner ?? <span className="text-conflict">No owner</span>}
        {doc.country !== "BE" && <span className="text-warn">, {COUNTRY_LABEL[doc.country]}</span>}
        <span>, {formatDate(doc.updatedAt)}</span>
      </div>
    </div>
  );
}

export function ConflictSpotlight({ conflict, articles, running, onReview }: { conflict: Conflict | null; articles: Article[]; running: boolean; onReview: (claimId: string) => void }) {
  return (
    <Card className="px-5 py-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="text-[12px] uppercase tracking-[0.08em] text-conflict font-medium">Conflict</div>
        <div className="text-[12px] text-faint">{running ? "Latest the janitor reached" : conflict?.status === "human" ? "Waiting for you" : "Last settled"}</div>
      </div>
      <AnimatePresence mode="wait">
        {conflict ? (
          <motion.div key={conflict.claimId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
            <Body conflict={conflict} articles={articles} onReview={onReview} />
          </motion.div>
        ) : (
          <motion.div key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-6 text-[14px] text-muted">
            No conflicting facts found yet.
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function Body({ conflict: c, articles, onReview }: { conflict: Conflict; articles: Article[]; onReview: (claimId: string) => void }) {
  const decided = c.status !== "human" && !!c.winningValue;
  const values = c.values.slice(0, 3);
  const verdict = decisionLine(c, articles);
  return (
    <>
      <div className="mt-1 text-[20px] font-medium tracking-[-0.02em] leading-tight">{claimKeyById.get(c.claimId)?.label ?? c.claimId}</div>
      <div className={cn("mt-3 grid gap-2", values.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
        {values.map((v) => {
          const win = decided && v.value === c.winningValue;
          const lose = decided && !win;
          return (
            <div key={v.value} className={cn("rounded-lg p-2.5 border transition-all", win ? "border-settled border-2 bg-settled-soft/40" : "border-line bg-canvas/60", lose && "opacity-45")}>
              <div className="flex items-start gap-1.5">
                <div className={cn("font-medium tracking-[-0.02em] break-words min-w-0 flex-1", v.value.length > 14 ? "text-[15px] leading-snug" : "text-[24px] leading-none", lose && "line-through decoration-2", win && "text-settled")}>{v.value}</div>
                {win && <Check size={16} strokeWidth={3} className="text-settled flex-none mt-0.5" />}
              </div>
              <div className="mt-2 flex flex-col gap-1">
                {v.docIds.slice(0, 3).map((d) => (
                  <DocChip key={d} docId={d} />
                ))}
                {v.docIds.length > 3 && <div className="text-[11px] text-faint">and {v.docIds.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-2.5 border-t border-line pt-3">
        <JanitorAvatar size={22} color={c.status === "human" ? "var(--conflict)" : "var(--agent)"} />
        {c.status === "human" ? (
          <>
            <div className="flex-1 text-[14px] font-medium text-conflict">Split jury: needs you</div>
            <Button onClick={() => onReview(c.claimId)} className="h-8 px-3 text-[13px]">
              Review
            </Button>
          </>
        ) : (
          <div className="flex-1 min-w-0 text-[13px] leading-snug">
            <span className="font-medium">{verdict.text}</span>
            {verdict.detail && <span className="text-muted">: {verdict.detail}</span>}
          </div>
        )}
      </div>
    </>
  );
}
