"use client";

import { motion } from "motion/react";
import { ArrowRight, Plug } from "lucide-react";
import { useEffect, useMemo, useReducer, useState } from "react";
import { useJanitor } from "@/lib/store";
import type { Conflict } from "@/lib/types";
import { Button, Card, cn, JanitorAvatar } from "@/flow/ui";
import { AgentLog } from "@/flow/janitor/LogFeed";
import { ConflictSpotlight } from "@/flow/janitor/Spotlight";
import { ConflictDrawer, ConflictList } from "@/flow/janitor/Conflicts";
import { Constitution } from "@/flow/janitor/Constitution";
import { FlowCanvas } from "@/flow/janitor/FlowCanvas";
import { HealthStrip } from "@/flow/janitor/HealthStrip";
import { connectedDocIds, connectedHealth } from "@/flow/janitor/connected";
import { articleUse, buildArticles, buildQueue, TALLY, tallyOf } from "@/flow/janitor/model";


// Module scope so the chart keeps its history while another view is open.
const history = { series: [] as number[], tick: "" };

export default function JanitorPage() {
  const { sources, processed, result, rules, reviewed, setStep } = useJanitor();
  const [tab, setTab] = useState<"queue" | "conflicts">("queue");
  const [openClaim, setOpenClaim] = useState<string | null>(null);
  const [, redraw] = useReducer((x: number) => x + 1, 0);

  const connected = useMemo(() => connectedDocIds(sources), [sources]);
  const order = useMemo(() => {
    const C = new Set(connected);
    const P = new Set(processed);
    return [...processed.filter((d) => C.has(d)), ...connected.filter((d) => !P.has(d))];
  }, [connected, processed]);
  const done = useMemo(() => processed.filter((d) => connected.includes(d)).length, [processed, connected]);
  const n = order.length;
  const next = order[done] as string | undefined;

  const articles = useMemo(() => buildArticles(rules), [rules]);
  const steps = useMemo(() => buildQueue(order, result, articles), [order, result, articles]);
  const doneSteps = steps.slice(0, done);
  const now = connectedHealth(result, reviewed, connected, processed);
  const raw = connectedHealth(result, reviewed, connected, []);
  const seen: Conflict[] = doneSteps.flatMap((s) => s.completes);
  const needsYou = seen.filter((c) => c.status === "human");

  const tick = `${n}|${done}|${now.score}`;
  useEffect(() => {
    if (tick === history.tick) return;
    history.tick = tick;
    if (!n) history.series = [];
    else if (history.series.length) history.series = [...history.series, now.score];
    else history.series = Array.from({ length: done + 1 }, (_, i) => connectedHealth(result, reviewed, connected, order.slice(0, i)).score);
    redraw();
  }, [tick, n, done, now.score, result, reviewed, connected, order]);

  if (!n)
    return (
      <div className="h-[70vh] grid place-items-center">
        <div className="flex flex-col items-center text-center">
          <JanitorAvatar size={56} />
          <h1 className="headline text-[32px] mt-6">Connect a source to start</h1>
          <p className="mt-2 text-[15px] text-muted max-w-[420px]">The janitor cleans every file you connect, settles conflicting facts by the constitution and asks you when it cannot.</p>
          <Button className="mt-6" onClick={() => setStep("connectors")}>
            <Plug size={15} /> Connect a source
          </Button>
        </div>
      </div>
    );

  const running = !!next;
  const spotlight = running ? (seen[seen.length - 1] ?? null) : (needsYou[0] ?? seen[seen.length - 1] ?? null);
  const openConflict = result.conflicts.find((c) => c.claimId === openClaim) ?? null;
  const status = running
    ? `Cleaning ${done + 1} of ${n} files`
    : `All ${n} files clean. ${needsYou.length ? `${needsYou.length} conflict${needsYou.length === 1 ? " needs" : "s need"} you.` : "Every fact is settled."}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-6">
        <div>
          <h1 className="headline text-[32px]">Janitor</h1>
          <div className="mt-1 flex items-center gap-2 text-[14px] text-muted">
            {running && <motion.span className="w-2 h-2 rounded-full bg-agent" animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} />}
            {status}
          </div>
        </div>
        {!running && needsYou.length > 0 && (
          <Button onClick={() => setOpenClaim(needsYou[0].claimId)}>
            Review {needsYou.length} conflict{needsYou.length === 1 ? "" : "s"} <ArrowRight size={15} />
          </Button>
        )}
      </div>

      <FlowCanvas />

      <HealthStrip now={now} raw={raw} series={history.series} total={Math.max(history.series.length, n + 1)} showCertainty={done > 0} />

      <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-5 items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-1 mb-2.5">
            {(["queue", "conflicts"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn("h-8 px-3 rounded-md text-[13px] cursor-pointer", tab === t ? "bg-canvas text-ink font-medium" : "text-muted hover:text-ink")}
              >
                {t === "queue" ? (
                  <>
                    Queue <span className="num ml-1 text-[12px] text-muted">{n - done}</span>
                  </>
                ) : (
                  <>
                    Conflicts <span className="num ml-1 text-[12px] text-muted">{seen.length}</span>
                    {needsYou.length > 0 && <span className="text-conflict text-[12px]"> · {needsYou.length} need you</span>}
                  </>
                )}
              </button>
            ))}
          </div>

          {tab === "queue" ? (
            <Card className="overflow-hidden">
              <Tally tally={tallyOf(doneSteps)} started={done > 0} />
              <AgentLog steps={steps} done={done} result={result} articles={articles} />
            </Card>
          ) : (
            <Card className="overflow-hidden max-h-[440px] overflow-y-auto">
              {seen.length ? (
                <ConflictList conflicts={seen} articles={articles} onOpen={setOpenClaim} />
              ) : (
                <div className="px-4 py-6 text-[14px] text-muted">No conflicts found yet.</div>
              )}
            </Card>
          )}
        </div>

        <div className="min-w-0 flex flex-col gap-5">
          <ConflictSpotlight conflict={spotlight} articles={articles} running={running} onReview={setOpenClaim} />
          <Constitution use={articleUse(doneSteps)} readOnly compact onEdit={() => setStep("rules")} />
        </div>
      </div>

      <ConflictDrawer
        conflict={openConflict}
        articles={articles}
        onClose={() => setOpenClaim(null)}
        onDecided={(id) => {
          const nextOpen = needsYou.find((c) => c.claimId !== id);
          setTimeout(() => setOpenClaim(nextOpen ? nextOpen.claimId : null), 700);
        }}
      />
    </div>
  );
}

function Tally({ tally, started }: { tally: Record<string, number>; started: boolean }) {
  return (
    <div className="flex items-center gap-5 px-4 h-11 border-b border-line bg-canvas/60">
      {TALLY.map((t) => (
        <div key={t.key} className={cn("flex items-baseline gap-1.5 text-[13px]", !started && "opacity-40")}>
          <motion.span key={tally[t.key]} initial={{ y: -3, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} className={cn("num font-medium", t.key === "needs" && tally.needs ? "text-conflict" : t.key === "settled" && tally.settled ? "text-settled" : "text-ink")}>
            {tally[t.key]}
          </motion.span>
          <span className="text-muted">{t.label}</span>
        </div>
      ))}
    </div>
  );
}
