"use client";

import { animate, motion } from "motion/react";
import { Bot, FolderLock, Plug, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { corpus, docById, report, space } from "@/lib/data";
import { conflictDocs } from "@/lib/health";
import { useJanitor } from "@/lib/store";
import type { ConnectorId } from "@/lib/types";
import { Card, ConnectorIcon, JanitorAvatar, cn } from "@/flow/ui";
import { connectedDocIds, connectedHealth } from "@/flow/janitor/connected";
import { buildArticles } from "@/flow/janitor/model";

const H = 232;
const PAD = 16;
const SRC_W = 176;
const TRUTH_W = 156;
const MCP_W = 160;
const GAP_L = 56;
const GAP_R = 36;
const JAN_H = 148;
const LINE = "#e4e4e7";

const CONNECTOR_NAME: Record<ConnectorId, string> = {
  sharepoint: "SharePoint",
  teams: "Teams",
  outlook: "Outlook",
  onedrive: "OneDrive",
  confluence: "Confluence",
  mysdworx: "mysdworx",
};

const AGENTS: { name: string; tile: string; Icon: typeof Bot }[] = [
  { name: "Claude", tile: "#d97757", Icon: Sparkles },
  { name: "ChatGPT", tile: "#0b0b0c", Icon: Bot },
  { name: "mysdworx assistant", tile: "#e5484d", Icon: FolderLock },
];

function Num({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(value);
  useEffect(() => {
    const c = animate(from.current, value, {
      duration: 0.5,
      ease: "easeOut",
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = String(Math.round(v));
      },
    });
    from.current = value;
    return () => c.stop();
  }, [value]);
  return <span ref={ref} className="num">{value}</span>;
}

function curve(x1: number, y1: number, x2: number, y2: number) {
  const m = (x1 + x2) / 2;
  return `M${x1} ${y1} C${m} ${y1} ${m} ${y2} ${x2} ${y2}`;
}

function Wire({ d, active, color = "var(--agent)", dur = 0.7 }: { d: string; active: boolean; color?: string; dur?: number }) {
  return (
    <g>
      <path d={d} fill="none" stroke={LINE} strokeWidth={1.5} />
      {active && (
        <>
          <motion.path d={d} fill="none" stroke={color} strokeWidth={1.5} initial={{ opacity: 0 }} animate={{ opacity: 0.9 }} transition={{ duration: 0.2 }} />
          <circle r={3.5} fill={color}>
            <animateMotion dur={`${dur}s`} repeatCount="indefinite" path={d} />
          </circle>
        </>
      )}
    </g>
  );
}

export function FlowCanvas() {
  const { sources, processed, result, reviewed, rules, setStep } = useJanitor();
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(1100);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const connected = useMemo(() => connectedDocIds(sources), [sources]);
  const P = useMemo(() => new Set(processed), [processed]);
  const next = connected.find((d) => !P.has(d));
  const running = !!next;
  const done = useMemo(() => connected.filter((d) => P.has(d)), [connected, P]);
  const D = useMemo(() => new Set(done), [done]);

  const connectorOf = (docId: string) => sources.find((s) => s.docId === docId)?.connector ?? docById.get(docId)?.connector;
  const activeConnector = next ? connectorOf(next) : undefined;

  const groups = useMemo(() => {
    const m = new Map<ConnectorId, { total: number; done: number }>();
    for (const s of sources) {
      const id = s.connector ?? (s.docId ? docById.get(s.docId)?.connector : undefined);
      if (!id) continue;
      const g = m.get(id) ?? { total: 0, done: 0 };
      g.total++;
      if (s.docId && P.has(s.docId)) g.done++;
      m.set(id, g);
    }
    return [...m.entries()].slice(0, 6).map(([id, g]) => ({ id, ...g }));
  }, [sources, P]);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setTick((n) => n + 1), 450);
    return () => clearInterval(t);
  }, [running]);
  const stage = running ? tick % 6 : -1;

  const stats = useMemo(() => {
    const conflicts = result.conflicts.filter((c) => conflictDocs(c).every((d) => D.has(d)));
    const topics = new Set(space.points.filter((p) => D.has(p.docId)).map((p) => p.clusterId)).size;
    const facts = new Set(corpus.claims.filter((c) => D.has(c.docId)).map((c) => c.claimId));
    const human = conflicts.filter((c) => c.status === "human");
    const openIds = new Set(human.map((c) => c.claimId));
    return {
      topics,
      facts: facts.size,
      byRules: conflicts.filter((c) => c.status === "auto").length,
      byJury: conflicts.filter((c) => c.status === "debate").length,
      human: human.length,
      settled: [...facts].filter((id) => !openIds.has(id)).length,
    };
  }, [result, D]);

  const health = useMemo(() => connectedHealth(result, reviewed, connected, processed), [result, reviewed, connected, processed]);
  const articles = useMemo(() => buildArticles(rules).length, [rules]);
  const pages = report.pagesParsed && report.docsParsed ? Math.round((report.pagesParsed * done.length) / report.docsParsed) : 0;
  const k = report.k ?? 14;

  const STAGES = [
    { name: "Parse", value: <><Num value={done.length} />/{connected.length}</>, detail: `unpdf, ${pages} pages read` },
    { name: "Embed", value: <><Num value={done.length} /> files</>, detail: "finds similar files, across Dutch, French and English" },
    { name: "Cluster", value: <><Num value={stats.topics} />/{k}</>, detail: `k-means over the embeddings, ${k} clusters, related files grouped together` },
    { name: "Extract", value: <><Num value={stats.facts} /> facts</>, detail: `Claude Haiku, ${report.claimsMatching ?? 48}/${report.claimsPlanted ?? 61} facts verified` },
    { name: "Rules", value: <><Num value={stats.byRules} /> settled</>, detail: `Constitution, ${articles} articles` },
    { name: "AI jury", value: <><Num value={stats.byJury} /> settled</>, detail: "3 jurors vote on ties" },
  ];

  const janX = PAD + SRC_W + GAP_L;
  const mcpX = W - PAD - MCP_W;
  const truthX = mcpX - GAP_R - TRUTH_W;
  const janW = truthX - GAP_R - janX;
  const mid = H / 2;
  const janY = mid - JAN_H / 2;

  const n = Math.max(1, groups.length);
  const nodeH = n > 4 ? 30 : 40;
  const gap = n > 4 ? 6 : 10;
  const stackH = n * nodeH + (n - 1) * gap;
  const srcTop = (i: number) => mid - stackH / 2 + i * (nodeH + gap);
  const inY = (i: number) => mid - 36 + (n === 1 ? 36 : (i * 72) / (n - 1));

  const reading = next ? docById.get(next)?.title ?? next : null;

  return (
    <Card className="p-0 overflow-hidden">
      <div
        ref={box}
        className="relative w-full"
        style={{ height: H, backgroundImage: "radial-gradient(#e9e9ee 1px, transparent 1px)", backgroundSize: "16px 16px" }}
      >
        <svg className="absolute inset-0 pointer-events-none" width={W} height={H} aria-hidden>
          {groups.length === 0 ? (
            <path d={curve(PAD + SRC_W, mid, janX, mid)} fill="none" stroke={LINE} strokeWidth={1.5} strokeDasharray="4 4" />
          ) : (
            groups.map((g, i) => (
              <Wire key={g.id} d={curve(PAD + SRC_W, srcTop(i) + nodeH / 2, janX, inY(i))} active={g.id === activeConnector} dur={1.4} />
            ))
          )}
          <Wire d={curve(janX + janW, mid, truthX, mid)} active={running} dur={1.6} />
          <Wire d={curve(truthX + TRUTH_W, mid, mcpX, mid)} active={!running && done.length > 0} color="var(--settled)" dur={1.6} />
        </svg>

        {groups.length === 0 ? (
          <button
            onClick={() => setStep("connectors")}
            className="absolute flex items-center gap-2.5 px-3 rounded-[12px] border border-dashed border-line-strong bg-bg/80 text-[13px] text-muted hover:text-ink hover:border-ink-2 transition-colors"
            style={{ left: PAD, top: mid - 20, width: SRC_W, height: 40 }}
          >
            <Plug size={15} /> Connect a source
          </button>
        ) : (
          groups.map((g, i) => {
            const active = g.id === activeConnector;
            return (
              <div
                key={g.id}
                className={cn(
                  "absolute flex items-center gap-2.5 px-2.5 rounded-[12px] border bg-bg shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors",
                  active ? "border-agent/50 ring-2 ring-agent-soft" : "border-line",
                )}
                style={{ left: PAD, top: srcTop(i), width: SRC_W, height: nodeH }}
              >
                <ConnectorIcon id={g.id} size={nodeH > 34 ? 24 : 20} />
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="text-[12.5px] font-medium text-ink truncate">{CONNECTOR_NAME[g.id]}</div>
                  {nodeH > 34 && (
                    <div className="text-[11px] text-muted num">
                      {g.done < g.total ? `${g.done}/${g.total} files` : `${g.total} files`}
                    </div>
                  )}
                </div>
                {nodeH <= 34 && <span className="text-[11px] text-muted num">{g.done < g.total ? `${g.done}/${g.total}` : g.total}</span>}
                <span className={cn("w-1.5 h-1.5 rounded-full flex-none", active ? "bg-agent" : g.done === g.total ? "bg-settled" : "bg-line-strong")} />
              </div>
            );
          })
        )}

        <div
          className={cn(
            "absolute rounded-[12px] border bg-bg shadow-[0_1px_2px_rgba(0,0,0,0.04)] px-3.5 py-3 flex flex-col",
            running ? "border-agent/40" : "border-line",
          )}
          style={{ left: janX, top: janY, width: janW, height: JAN_H }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <motion.div animate={running ? { y: [0, -2, 0] } : { y: 0 }} transition={{ repeat: running ? Infinity : 0, duration: 0.8 }}>
              <JanitorAvatar size={30} />
            </motion.div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-semibold text-ink">Janitor</span>
                <span className={cn("text-[10.5px] font-medium px-1.5 py-px rounded-full", running ? "bg-agent-soft text-agent" : done.length ? "bg-settled-soft text-settled" : "bg-[#f4f4f5] text-muted")}>
                  {running ? "Running" : done.length ? "Up to date" : "Waiting"}
                </span>
              </div>
              <div className="text-[12px] text-muted truncate">
                {reading ? (
                  <>
                    Reading <span className="text-ink-2">{reading}</span>
                  </>
                ) : done.length ? (
                  "All files clean"
                ) : (
                  "Waiting for files"
                )}
              </div>
            </div>
            {stats.human > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-conflict bg-conflict-soft px-2 py-1 rounded-full flex-none">
                <UserRound size={11} /> <Num value={stats.human} /> need a person
              </span>
            )}
          </div>

          <div className="mt-auto grid grid-cols-6 gap-1">
            {STAGES.map((s, i) => {
              const on = i === stage;
              return (
                <div key={s.name} className="relative">
                  <div
                    className={cn(
                      "rounded-[8px] border px-2 py-1.5 transition-colors duration-150",
                      on ? "border-agent bg-agent-soft" : "border-line bg-[#fafafa]",
                    )}
                    title={s.detail}
                  >
                    <div className={cn("text-[11px] font-medium truncate", on ? "text-agent" : "text-ink-2")}>{s.name}</div>
                    <div className={cn("text-[11px] truncate", on ? "text-agent" : "text-muted")}>{s.value}</div>
                  </div>
                  {i < 5 && <span className="absolute top-1/2 -right-[5px] w-[6px] h-px bg-line-strong" />}
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 text-[11px] text-muted truncate h-4">
            {stage >= 0 ? (
              <>
                <span className="text-agent font-medium">{STAGES[stage].name}</span> {STAGES[stage].detail}
              </>
            ) : (
              `${report.docsParsed ?? 100} docs parsed, ${k} clusters, ${report.claimsFoundByLlm ?? 88} facts extracted by Claude Haiku 4.5`
            )}
          </div>
        </div>

        <div
          className={cn("absolute rounded-[12px] border bg-bg shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-3", done.length ? "border-settled/40" : "border-line")}
          style={{ left: truthX, top: mid - 52, width: TRUTH_W, height: 104 }}
        >
          <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
            <ShieldCheck size={14} className="text-settled" /> Ground truth
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-[22px] font-semibold text-ink leading-none">
              <Num value={stats.settled} />
            </span>
            <span className="text-[11.5px] text-muted">settled facts</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-[#f4f4f5] overflow-hidden">
              <motion.div className="h-full bg-settled rounded-full" animate={{ width: `${connected.length ? health.score : 0}%` }} transition={{ duration: 0.5 }} />
            </div>
            <span className="text-[11px] text-muted num">
              {connected.length ? <Num value={health.score} /> : 0}% health
            </span>
          </div>
        </div>

        <div
          className="absolute rounded-[12px] border border-line bg-bg shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-3"
          style={{ left: mcpX, top: mid - 62, width: MCP_W, height: 124 }}
        >
          <div className="text-[12.5px] font-semibold text-ink">MCP</div>
          <div className="text-[10.5px] text-muted">spotless MCP server</div>
          <div className="mt-2 flex flex-col gap-1.5">
            {AGENTS.map((a) => (
              <div key={a.name} className="flex items-center gap-2 text-[11.5px] text-ink-2">
                <span className="grid place-items-center w-[18px] h-[18px] rounded-[5px] text-white flex-none" style={{ background: a.tile }}>
                  <a.Icon size={10} strokeWidth={2.4} />
                </span>
                <span className="truncate">{a.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
