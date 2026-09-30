"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, X } from "lucide-react";
import { docById } from "@/lib/data";
import { formatDate, juryTally, RULE_META } from "@/lib/janitor";
import { CHANNEL_LABEL, CONNECTOR_LABEL } from "@/lib/labels";
import { CURRENT_USER, useJanitor } from "@/lib/store";
import type { Conflict } from "@/lib/types";
import { Badge, Button, cn, JanitorAvatar } from "@/flow/ui";
import { type Article, claimKeyById, howSettled, quoteParagraph } from "./model";

const RANK: Record<Conflict["status"], number> = { human: 0, resolved: 1, debate: 2, auto: 3 };

export function ConflictList({ conflicts, articles, onOpen }: { conflicts: Conflict[]; articles: Article[]; onOpen: (claimId: string) => void }) {
  const { reviewed } = useJanitor();
  const sorted = [...conflicts].sort((a, b) => RANK[a.status] - RANK[b.status]);
  return (
    <div className="divide-y divide-line">
      {sorted.map((c) => {
        const how = howSettled(c, articles, reviewed);
        const human = c.status === "human";
        const confirmed = c.status === "resolved" || reviewed.includes(c.claimId);
        return (
          <button key={c.claimId} onClick={() => onOpen(c.claimId)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-canvas cursor-pointer">
            <span className={cn("w-2 h-2 rounded-full flex-none", human ? "bg-conflict" : "bg-settled")} />
            <div className="flex-1 min-w-0">
              <div className="text-[14px] truncate">{claimKeyById.get(c.claimId)?.label ?? c.claimId}</div>
              <div className="text-[12px] text-muted truncate">{c.values.map((v) => v.value).join(" vs ")}</div>
            </div>
            {confirmed && !human && <Check size={14} className="text-settled flex-none" strokeWidth={3} />}
            <Badge tone={how.tone}>{how.label}</Badge>
          </button>
        );
      })}
    </div>
  );
}

export function ConflictDrawer({ conflict, articles, onClose, onDecided }: { conflict: Conflict | null; articles: Article[]; onClose: () => void; onDecided: (claimId: string) => void }) {
  return (
    <AnimatePresence>
      {conflict && (
        <>
          <motion.div key="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-ink/15 z-50" />
          <motion.aside
            key="drawer"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed top-0 right-0 bottom-0 w-[640px] bg-bg border-l border-line shadow-pop z-50 overflow-y-auto"
          >
            <DrawerBody key={conflict.claimId} conflict={conflict} articles={articles} onClose={onClose} onDecided={onDecided} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function DrawerBody({ conflict: c, articles, onClose, onDecided }: { conflict: Conflict; articles: Article[]; onClose: () => void; onDecided: (claimId: string) => void }) {
  const { decide: store, review, reviewed, decisions } = useJanitor();
  const decide = (d: { claimId: string; value: string }) => {
    const wasOpen = c.status === "human";
    store(d);
    if (wasOpen) onDecided(d.claimId);
  };
  const key = claimKeyById.get(c.claimId);
  const how = howSettled(c, articles, reviewed);
  const human = c.status === "human";
  const confirmed = c.status === "resolved" || reviewed.includes(c.claimId);
  const decision = decisions.find((d) => d.claimId === c.claimId);
  const suggestion = c.debate ? (c.debate.mergedStatement ?? c.debate.proposedValue) : null;
  const steps = c.trace.filter((t) => t.outcome !== "skipped" && t.ruleId !== "human");
  const jurors = c.debate?.turns.filter((t) => t.role === "juror") ?? [];

  return (
    <div className="p-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <Badge tone={how.tone}>{how.label}</Badge>
          <h2 className="mt-3 text-[26px] font-medium tracking-[-0.03em] leading-tight">{key?.question ?? key?.label ?? c.claimId}</h2>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-canvas cursor-pointer text-muted" aria-label="Close">
          <X size={18} />
        </button>
      </div>

      <div className={cn("mt-6 grid gap-3", c.values.length > 2 ? "grid-cols-3" : "grid-cols-2")}>
        {c.values.map((v) => {
          const doc = docById.get(v.docIds[0]);
          const para = quoteParagraph(v.claimInstanceIds[0]);
          const winning = c.winningValue === v.value;
          return (
            <div key={v.value} className={cn("rounded-xl border p-4 flex flex-col", winning ? "border-settled ring-1 ring-settled" : "border-line")}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-[20px] font-medium tracking-[-0.02em] leading-tight">{v.value}</div>
                {winning && <Check size={16} strokeWidth={3} className="text-settled flex-none" />}
              </div>
              {doc && (
                <a href={`/pdfs/${doc.fileName}`} target="_blank" rel="noreferrer" className="mt-1.5 text-[12px] text-muted hover:underline underline-offset-2 leading-snug">
                  {doc.title}
                  <br />
                  {CHANNEL_LABEL[doc.channel]} · {CONNECTOR_LABEL[doc.connector]} · {formatDate(doc.effectiveDate ?? doc.updatedAt)}
                  {v.docIds.length > 1 && ` · +${v.docIds.length - 1} more`}
                </a>
              )}
              {para && (
                <p className="mt-3 text-[13px] leading-relaxed text-ink-2 line-clamp-4">
                  {para.before}
                  <mark className="quote">{para.quote}</mark>
                  {para.after}
                </p>
              )}
              <div className="mt-auto pt-3">
                {!winning && (
                  <Button size="sm" variant="secondary" onClick={() => decide({ claimId: c.claimId, value: v.value })}>
                    Pick this
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-7">
        <div className="text-[13px] text-muted mb-2">How the janitor got here</div>
        <ol className="space-y-2">
          {steps.map((t, i) => {
            const art = articles.find((a) => a.key === t.ruleId);
            return (
              <li key={i} className="flex gap-3 text-[13px] leading-snug">
                <span className="num text-[12px] text-faint w-12 flex-none pt-px">{art?.n ? `Art. ${art.n}` : ""}</span>
                <span>
                  <span className="font-medium">{t.ruleId === "debate" ? "AI jury" : (RULE_META[t.ruleId]?.label ?? t.ruleId)}</span>
                  <span className={cn("ml-1.5", t.outcome === "decided" ? "text-settled" : "text-muted")}>{t.outcome === "decided" ? "decided" : t.outcome === "tie" ? "tie" : "narrowed"}</span>
                  <span className="text-ink-2">: {t.detail}</span>
                </span>
              </li>
            );
          })}
          {decision && (
            <li className="flex gap-3 text-[13px] leading-snug">
              <span className="w-12 flex-none" />
              <span>
                <span className="font-medium">{decision.by}</span> <span className="text-settled">decided</span>
                <span className="text-ink-2">: {decision.value}</span>
              </span>
            </li>
          )}
        </ol>
      </div>

      {c.debate && (
        <div className="mt-6 rounded-xl border border-agent/20 bg-agent-soft/40 p-4">
          <div className="flex items-center gap-3">
            <JanitorAvatar size={26} />
            <div className="text-[13px]">
              <span className="text-agent font-medium">AI jury {juryTally(c.debate).label}</span>
              <span className="text-ink-2"> suggests: {suggestion}</span>
            </div>
          </div>
          {jurors.length > 0 && (
            <ul className="mt-3 pl-9 space-y-1.5 text-[12px] text-ink-2 leading-snug">
              {jurors.map((t) => (
                <li key={t.speaker}>
                  <span className="font-medium">{t.speaker}</span> voted {t.vote}
                  <span className="text-muted">: {t.text.length > 140 ? `${t.text.slice(0, 139)}…` : t.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-7 pt-5 border-t border-line flex items-center gap-3">
        {human && suggestion && (
          <Button variant="agent" onClick={() => decide({ claimId: c.claimId, value: suggestion })}>
            Accept the jury&apos;s suggestion
          </Button>
        )}
        {!human && !confirmed && <Button onClick={() => review(c.claimId)}>Confirm</Button>}
        {confirmed && (
          <span className="inline-flex items-center gap-2 text-[14px] text-settled font-medium">
            <Check size={15} strokeWidth={3} /> Confirmed by {decision?.by ?? CURRENT_USER.name}
          </span>
        )}
        <span className="text-[13px] text-muted">{human ? "Or pick a value above." : "Confirming raises certainty to 100% for this fact."}</span>
      </div>
    </div>
  );
}
