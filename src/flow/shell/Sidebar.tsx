"use client";

import { animate, motion } from "motion/react";
import { Bot, BrushCleaning, Plug, RotateCcw, Scale, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { conflictProcessed } from "@/lib/health";
import { connectedDocIds, connectedHealth } from "@/flow/janitor/connected";
import { CURRENT_USER, type Step, useJanitor } from "@/lib/store";
import { BrandMark, cn } from "@/flow/ui";
import { BRAND } from "@/lib/brand";
import { forgetDriveConnection } from "@/flow/sources/GoogleDriveConnect";

const NAV: { step: Step; label: string; Icon: typeof Search }[] = [
  { step: "janitor", label: "Janitor", Icon: BrushCleaning },
  { step: "search", label: "Search", Icon: Search },
  { step: "agent", label: "Agent", Icon: Bot },
];

function AnimatedNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const controls = animate(from.current, value, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (v) => {
        from.current = v;
        setShown(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [value]);
  return <>{shown}</>;
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted">
      <span className="w-[68px]">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-line overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ background: color }} animate={{ width: `${value}%` }} transition={{ duration: 0.8, ease: "easeOut" }} />
      </div>
      <span className="tabular-nums w-7 text-right text-ink-2">{value}</span>
    </div>
  );
}

function HealthWidget() {
  const { sources, processed, result, reviewed, setStep } = useJanitor();
  const health = useMemo(() => connectedHealth(result, reviewed, connectedDocIds(sources), processed), [result, reviewed, sources, processed]);
  const prev = useRef(health.score);
  const [pulse, setPulse] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    if (health.score === prev.current) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- flash on score change
    setPulse(health.score > prev.current ? "up" : "down");
    prev.current = health.score;
    const t = setTimeout(() => setPulse(null), 900);
    return () => clearTimeout(t);
  }, [health.score]);

  if (!sources.length)
    return (
      <div className="rounded-xl border border-line bg-bg p-3.5">
        <div className="text-[12px] text-muted">Data health</div>
        <div className="mt-1 text-[13px] text-faint">No sources connected</div>
      </div>
    );

  const dot = health.score >= 95 ? "bg-settled" : health.score >= 80 ? "bg-warn" : "bg-conflict";
  return (
    <button onClick={() => setStep("janitor")} className="w-full text-left rounded-xl border border-line bg-bg p-3.5 cursor-pointer hover:border-line-strong transition-colors">
      <div className="flex items-center justify-between text-[12px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className={cn("w-1.5 h-1.5 rounded-full", dot)} /> Data health
        </span>
        <span>certainty <span className="tabular-nums text-ink-2">{health.certainty}%</span></span>
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={cn("stat text-[34px] leading-none transition-colors duration-500", pulse === "up" ? "text-settled" : pulse === "down" ? "text-conflict" : "text-ink")}>
          <AnimatedNumber value={health.score} />
        </span>
        <span className="text-[12px] text-faint">/ 100</span>
      </div>
      <div className="mt-3 space-y-1.5">
        <Bar label="Consistency" value={health.consistency} color="var(--settled)" />
        <Bar label="Freshness" value={health.freshness} color="var(--blue)" />
      </div>
    </button>
  );
}

function NavItem({ active, onClick, Icon, label, badge }: { active: boolean; onClick: () => void; Icon: typeof Search; label: string; badge?: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full h-9 px-2.5 rounded-lg flex items-center gap-2.5 text-[14px] cursor-pointer transition-colors",
        active ? "bg-bg text-ink font-medium shadow-card border border-line" : "text-ink-2 hover:bg-canvas-2 border border-transparent",
      )}
    >
      <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
      <span className="flex-1 text-left">{label}</span>
      {!!badge && (
        <motion.span key={badge} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="tabular-nums min-w-5 h-5 px-1.5 rounded-full bg-conflict text-white text-[11px] grid place-items-center">
          {badge}
        </motion.span>
      )}
    </button>
  );
}

export function Sidebar() {
  const { step, setStep, reset, result, processed } = useJanitor();
  const needsPerson = useMemo(() => {
    const done = new Set(processed);
    return result.conflicts.filter((c) => c.status === "human" && conflictProcessed(c, done)).length;
  }, [result, processed]);

  return (
    <aside className="w-[240px] flex-none h-screen sticky top-0 bg-canvas bg-[url(/pattern-cleaning.svg)] bg-[length:168px_168px] border-r border-line flex flex-col px-3 py-4">
      <button onClick={() => setStep("janitor")} className="flex items-center gap-2.5 px-1.5 cursor-pointer text-left">
        <BrandMark size={34} />
        <div className="font-semibold tracking-[-0.03em] text-[19px]">{BRAND.name}</div>
      </button>

      <div className="mt-5">
        <HealthWidget />
      </div>

      <nav className="mt-5 space-y-0.5">
        <NavItem active={step === "connectors"} onClick={() => setStep("connectors")} Icon={Plug} label="Connectors" />
        <NavItem active={step === "rules"} onClick={() => setStep("rules")} Icon={Scale} label="Rules" />
        <div className="h-px bg-line mx-2 my-2" />
        {NAV.map(({ step: s, label, Icon }) => (
          <NavItem key={s} active={step === s} onClick={() => setStep(s)} Icon={Icon} label={label} badge={s === "janitor" ? needsPerson : undefined} />
        ))}
      </nav>

      <div className="mt-auto space-y-0.5">
        <div className="mt-3 pt-3 border-t border-line flex items-center gap-2.5 px-1.5">
          <span className="w-8 h-8 rounded-full bg-ink text-white grid place-items-center text-[12px] font-medium flex-none">{CURRENT_USER.initials}</span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="text-[13px] font-medium truncate">{CURRENT_USER.name}</div>
            <div className="text-[11px] text-muted truncate">{CURRENT_USER.role}</div>
          </div>
        </div>
        <button
          onClick={() => {
            reset();
            forgetDriveConnection();
          }}
          className="mt-2 px-1.5 flex items-center gap-1.5 text-[12px] text-faint hover:text-ink cursor-pointer"
          title="Clear all state and start the demo over"
        >
          <RotateCcw size={11} /> Reset demo
        </button>
      </div>
    </aside>
  );
}
