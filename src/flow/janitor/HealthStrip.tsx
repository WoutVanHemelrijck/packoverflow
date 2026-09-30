"use client";

import { animate } from "motion/react";
import { useEffect, useRef } from "react";
import type { HealthNumbers } from "@/lib/health";
import { Card, cn } from "@/flow/ui";

export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  useEffect(() => {
    const controls = animate(shown.current, value, {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        shown.current = v;
        if (ref.current) ref.current.textContent = String(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [value]);
  return (
    <span ref={ref} className={className}>
      {Math.round(value)}
    </span>
  );
}

function Chart({ series, total }: { series: number[]; total: number }) {
  const W = 220;
  const H = 40;
  const min = 40;
  const x = (i: number) => (total <= 1 ? 0 : (i / (total - 1)) * W);
  const y = (v: number) => H - ((Math.max(min, v) - min) / (100 - min)) * H;
  const pts = series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const line = pts.length ? `M${pts.join(" L")}` : "";
  const area = pts.length ? `${line} L${x(series.length - 1).toFixed(1)},${H} L0,${H} Z` : "";
  const last = series.at(-1);
  return (
    <svg width={W} height={H + 16} viewBox={`0 -8 ${W} ${H + 16}`} className="overflow-visible">
      <defs>
        <linearGradient id="health-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--settled)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--settled)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={0} x2={W} y1={y(100)} y2={y(100)} stroke="var(--line)" strokeDasharray="3 4" />
      <line x1={0} x2={W} y1={H} y2={H} stroke="var(--line)" />
      <path d={area} fill="url(#health-fill)" />
      <path d={line} fill="none" stroke="var(--settled)" strokeWidth={2} strokeLinejoin="round" />
      {last !== undefined && <circle cx={x(series.length - 1)} cy={y(last)} r={3.5} fill="var(--settled)" />}
      <text x={0} y={y(100) - 4} textAnchor="start" className="fill-faint text-[10px]">100</text>
    </svg>
  );
}

function Bar({ label, value, from, color, caption }: { label: string; value: number; from: number; color: string; caption: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="text-ink-2 whitespace-nowrap">{label}</span>
        <span className="num text-[13px] whitespace-nowrap">
          {value !== from && <span className="text-faint">{from}% → </span>}
          <AnimatedNumber value={value} />%
        </span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-canvas-2 overflow-hidden">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${value}%`, background: color }} />
      </div>
      <div className="mt-1 text-[12px] text-muted">{caption}</div>
    </div>
  );
}

export function HealthStrip({ now, raw, series, total, showCertainty }: { now: HealthNumbers; raw: HealthNumbers; series: number[]; total: number; showCertainty: boolean }) {
  const tone = now.score >= 90 ? "text-settled" : now.score >= 70 ? "text-ink" : "text-warn";
  return (
    <Card className="px-5 py-2.5 flex items-center gap-7">
      <div className="flex-none w-[150px] flex items-baseline gap-2">
        <div className="text-[13px] text-muted">Data health</div>
        <div className={cn("stat text-[40px] transition-colors duration-500", tone)}>
          <AnimatedNumber value={now.score} />
        </div>
      </div>
      <div className="flex-none">
        <Chart series={series} total={total} />
      </div>
      <div className="flex-1 grid grid-cols-2 gap-6 min-w-0">
        <Bar
          label="Conflict-free facts"
          value={now.consistency}
          from={raw.consistency}
          color={now.consistency === 100 ? "var(--settled)" : "var(--ink)"}
          caption={`${now.totalFacts - now.openConflicts} of ${now.totalFacts} facts, ${now.openConflicts} open conflict${now.openConflicts === 1 ? "" : "s"}`}
        />
        <Bar
          label="Current documents"
          value={now.freshness}
          from={raw.freshness}
          color={now.freshness === 100 ? "var(--settled)" : "var(--ink)"}
          caption={`${now.totalDocs - now.staleDocs} of ${now.totalDocs}, ${now.staleDocs} stale or duplicate`}
        />
      </div>
      <div className="flex-none w-[150px] pl-6 border-l border-line">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] text-muted">Certainty</span>
          <span className="stat text-[26px]">{showCertainty ? <><AnimatedNumber value={now.certainty} />%</> : <span className="text-faint">–</span>}</span>
        </div>
        <div className="text-[12px] text-muted">{showCertainty ? "rises as you confirm" : "after cleaning"}</div>
      </div>
    </Card>
  );
}
