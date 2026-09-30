"use client";

import { motion } from "motion/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { useJanitor } from "@/lib/store";
import type { RuleId } from "@/lib/types";
import { Card, cn } from "@/flow/ui";
import { buildArticles } from "./model";

export function Constitution({ use, readOnly, compact, onEdit }: { use: Record<string, number>; readOnly?: boolean; compact?: boolean; onEdit?: () => void }) {
  const { rules, setRules } = useJanitor();
  const [editing, setEditing] = useState(false);
  const articles = buildArticles(rules, editing);

  const move = (id: RuleId, dir: -1 | 1) => {
    const order = [...rules.order];
    const i = order.findIndex((r) => r.id === id);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    setRules({ ...rules, order });
  };
  const toggle = (id: RuleId) => setRules({ ...rules, order: rules.order.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)) });

  return (
    <Card className="px-5 py-4">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[16px] font-medium tracking-[-0.02em]">Constitution</div>
          <div className="text-[13px] text-muted">The rules the janitor applies, in order</div>
        </div>
        <button onClick={() => (readOnly ? onEdit?.() : setEditing(!editing))} className="text-[13px] text-muted hover:text-ink underline underline-offset-2 cursor-pointer whitespace-nowrap">
          {readOnly ? "Edit in Setup" : editing ? "Done" : "Edit"}
        </button>
      </div>
      <ol className="mt-2 divide-y divide-line">
        {articles.map((a) => {
          const count = use[a.key] ?? 0;
          return (
            <li key={a.key} className={cn(compact ? "py-1.5 flex gap-3 items-center" : "py-2 flex gap-3 items-start", !a.enabled && "opacity-45")}>
              <span className={cn("num text-[12px] text-faint w-10 flex-none", !compact && "pt-0.5")}>{a.n ? `Art. ${a.n}` : "Off"}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium leading-tight">{a.title}</div>
                {!compact && <div className="text-[13px] text-muted leading-snug mt-0.5">{a.text}</div>}
              </div>
              {editing && a.key !== "debate" ? (
                <div className="flex items-center gap-1 flex-none">
                  <button onClick={() => move(a.key as RuleId, -1)} className="p-1 rounded hover:bg-canvas cursor-pointer" aria-label="Move up"><ChevronUp size={14} /></button>
                  <button onClick={() => move(a.key as RuleId, 1)} className="p-1 rounded hover:bg-canvas cursor-pointer" aria-label="Move down"><ChevronDown size={14} /></button>
                  <button
                    onClick={() => toggle(a.key as RuleId)}
                    className={cn("w-8 h-[18px] rounded-full relative transition-colors cursor-pointer", a.enabled ? "bg-ink" : "bg-line-strong")}
                    aria-label="Toggle"
                  >
                    <span className={cn("absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all", a.enabled ? "left-[16px]" : "left-[2px]")} />
                  </button>
                </div>
              ) : (
                <motion.span
                  key={count}
                  initial={count ? { scale: 1.35, backgroundColor: "var(--agent-soft)" } : false}
                  animate={{ scale: 1, backgroundColor: "rgba(0,0,0,0)" }}
                  transition={{ duration: 0.6 }}
                  className={cn("num text-[13px] rounded-md px-1.5 min-w-8 text-right flex-none", count ? "text-agent" : "text-faint")}
                >
                  {count ? `×${count}` : "0"}
                </motion.span>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
