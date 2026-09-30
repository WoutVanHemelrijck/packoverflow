"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { motion } from "motion/react";
import { useJanitor } from "@/lib/store";
import type { RuleId } from "@/lib/types";
import { cn, JanitorAvatar } from "@/flow/ui";
import { buildArticles } from "@/flow/janitor/model";

export function Rules() {
  const { rules, setRules } = useJanitor();
  const articles = buildArticles(rules, true);

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
    <section>
      <div className="mb-3">
        <h2 className="text-[17px] font-medium tracking-[-0.02em]">Constitution</h2>
        <p className="text-[13px] text-muted">When sources disagree, the janitor applies these articles in order.</p>
      </div>
      <ol className="rounded-xl border border-line bg-bg divide-y divide-line">
        {articles.map((a, i) => {
          const jury = a.key === "debate";
          return (
            <motion.li layout transition={{ duration: 0.25 }} key={a.key} className={cn("px-4 py-3 flex gap-3 items-start", jury && "bg-agent-soft/50 rounded-b-xl")}>
              <span className={cn("num text-[12px] w-11 flex-none pt-0.5", a.enabled ? "text-muted" : "text-faint")}>{a.n ? `Art. ${a.n}` : "Off"}</span>
              <div className={cn("flex-1 min-w-0", !a.enabled && "opacity-45")}>
                <div className="text-[14px] font-medium leading-tight flex items-center gap-1.5">
                  {jury && <JanitorAvatar size={14} />}
                  {a.title}
                </div>
                <div className="text-[13px] text-muted leading-snug mt-0.5">{a.text}</div>
              </div>
              {!jury && (
                <div className="flex items-center gap-0.5 flex-none">
                  <button onClick={() => move(a.key as RuleId, -1)} disabled={i === 0} className="p-1 rounded text-muted hover:text-ink hover:bg-canvas cursor-pointer disabled:opacity-30 disabled:pointer-events-none" aria-label="Move up">
                    <ChevronUp size={14} />
                  </button>
                  <button onClick={() => move(a.key as RuleId, 1)} disabled={i === articles.length - 2} className="p-1 rounded text-muted hover:text-ink hover:bg-canvas cursor-pointer disabled:opacity-30 disabled:pointer-events-none" aria-label="Move down">
                    <ChevronDown size={14} />
                  </button>
                  <button
                    onClick={() => toggle(a.key as RuleId)}
                    className={cn("ml-1.5 w-8 h-[18px] rounded-full relative transition-colors cursor-pointer", a.enabled ? "bg-ink" : "bg-line-strong")}
                    aria-label={a.enabled ? "Turn off" : "Turn on"}
                  >
                    <span className={cn("absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all", a.enabled ? "left-[16px]" : "left-[2px]")} />
                  </button>
                </div>
              )}
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
}
