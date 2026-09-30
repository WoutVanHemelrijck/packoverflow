"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronRight, FileText, Sparkle } from "lucide-react";
import { cn } from "@/flow/ui";
import type { SettledClaim } from "@/lib/types";
import { corpus } from "@/lib/data";
import { type Fact, searchFacts, toFacts } from "./facts";

const EXAMPLES = [
  "Vanaf wanneer geldt het indexeringsplafond voor PC 200?",
  "What is the payroll cut-off for Transport Verhaeghe?",
  "Quel est le montant maximum d'un chèque-repas en 2026 ?",
];

interface Turn {
  id: number;
  question: string;
  facts: Fact[] | null;
  answer: string | null;
  shown: number;
  cited: Fact[];
}

function cite(answer: string, facts: Fact[]): { text: string; cited: Fact[] } {
  const cited: Fact[] = [];
  const text = answer.replace(/\s*\[([^\]]+)\]/g, (_, ids: string) =>
    ids
      .split(/[,\s]+/)
      .map((id) => {
        const f = facts.find((x) => x.claimId === id);
        if (!f) return "";
        if (!cited.includes(f)) cited.push(f);
        return `[${cited.indexOf(f) + 1}]`;
      })
      .join(""),
  );
  return { text, cited };
}

function AnswerText({ text, shown }: { text: string; shown: number }) {
  const tokens = text.split(/(\s+)/).slice(0, shown * 2);
  return (
    <p className="text-[15px] leading-[1.65] text-ink">
      {tokens.map((t, i) => (
        <span key={i}>
          {t.split(/(\[\d+\])/).map((part, j) =>
            /^\[\d+\]$/.test(part) ? (
              <sup key={j} className="num text-[10px] font-semibold text-agent bg-agent-soft rounded px-1 py-px ml-0.5">
                {part.slice(1, -1)}
              </sup>
            ) : (
              part
            ),
          )}
        </span>
      ))}
    </p>
  );
}

function ToolCall({ query, facts, open, onToggle }: { query: string; facts: Fact[] | null; open: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-xl border border-line bg-bg text-[13px]">
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-3 py-2 cursor-pointer text-ink-2">
        <ChevronRight size={14} className={cn("transition-transform text-faint", open && "rotate-90")} />
        <span>
          Used <span className="num text-ink">spotless.search_facts</span>
        </span>
        <span className="ml-auto text-muted">{facts ? `${facts.length} facts` : "searching..."}</span>
      </button>
      {open && (
        <div className="border-t border-line px-3 py-2.5 space-y-2">
          <div className="num text-[12px] text-muted">
            query: <span className="text-ink-2">&quot;{query}&quot;</span>
          </div>
          {facts?.map((f) => (
            <div key={f.claimId} className="flex gap-2 items-baseline">
              <span className="w-1.5 h-1.5 rounded-full bg-settled flex-none translate-y-[-1px]" />
              <div className="min-w-0">
                <span className="num text-[11.5px] text-muted">{f.claimId}</span>
                <div className="text-[12.5px] text-ink-2 truncate">{f.statement}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Citations({ cited }: { cited: Fact[] }) {
  return (
    <div className="grid gap-2 mt-3">
      {cited.map((f, i) => (
        <div key={f.claimId} className="flex gap-3 rounded-xl border border-line px-3 py-2.5">
          <span className="num text-[11px] font-semibold text-agent bg-agent-soft rounded w-5 h-5 grid place-items-center flex-none">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-ink leading-snug">{f.statement}</div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[12px] text-muted">
              <span className="text-settled">Settled by {f.settledBy}</span>
              {f.sources.map((s) => (
                <a
                  key={s.docId}
                  href={`/pdfs/${encodeURIComponent(s.fileName)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 hover:text-ink underline-offset-2 hover:underline"
                >
                  <FileText size={12} /> {s.fileName}
                </a>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Chat({ facts, ledger }: { facts: Fact[]; ledger: SettledClaim[] }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [openTool, setOpenTool] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const busy = turns.some((t) => t.answer === null || t.shown < t.answer.split(/\s+/).length);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const patch = (id: number, p: Partial<Turn>) => setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const id = turns.length + 1;
    setInput("");
    setOpenTool(id);
    setTurns((ts) => [...ts, { id, question: q, facts: null, answer: null, shown: 0, cited: [] }]);

    let pool = facts;
    let served = ledger;
    try {
      const file = (await (await fetch("/api/ledger")).json()) as { ledger: SettledClaim[] };
      if (file.ledger?.length) {
        served = file.ledger;
        pool = toFacts(served, corpus.docs, corpus.claimKeys);
      }
    } catch {}
    const hits = searchFacts(pool, q, 3);
    await new Promise((r) => setTimeout(r, 500));
    patch(id, { facts: hits });

    let answer: string | null = null;
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, ledger: served }),
      });
      answer = ((await res.json()) as { answer: string | null }).answer;
    } catch {}
    const withRefs = answer ?? (hits[0] ? `${hits[0].statement} [${hits[0].claimId}]` : null);
    const final = withRefs
      ? cite(withRefs, pool)
      : { text: "The ground truth has no settled fact for this question yet. The janitor will pick it up when a source covers it.", cited: [] };
    setOpenTool((o) => (o === id ? null : o));
    patch(id, { answer: final.text, cited: final.cited, shown: 0, facts: [...final.cited, ...hits.filter((h) => !final.cited.includes(h))] });

    const total = final.text.split(/\s+/).length;
    for (let n = 1; n <= total; n++) {
      await new Promise((r) => setTimeout(r, 28));
      patch(id, { shown: n });
    }
  };

  return (
    <div className="h-full flex flex-col rounded-2xl border border-line bg-canvas overflow-hidden">
      <div ref={scroller} className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {turns.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-2">
            <Sparkle size={22} className="text-[#d97757]" />
            <div className="text-[17px] text-ink font-medium">Ask Claude a payroll question</div>
            <div className="text-[13.5px] text-muted max-w-[380px]">Claude calls the Spotless MCP server and answers only from settled facts.</div>
          </div>
        )}
        {turns.map((t) => (
          <div key={t.id} className="space-y-3">
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-md bg-ink text-white px-4 py-2.5 text-[14.5px]">{t.question}</div>
            </div>
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-bg border border-line grid place-items-center flex-none">
                <Sparkle size={14} className="text-[#d97757]" />
              </div>
              <div className="flex-1 min-w-0 space-y-3">
                <ToolCall query={t.question} facts={t.facts} open={openTool === t.id} onToggle={() => setOpenTool((o) => (o === t.id ? null : t.id))} />
                {t.answer === null ? (
                  t.facts && <div className="text-[13px] text-muted animate-pulse">Claude is writing...</div>
                ) : (
                  <div>
                    <AnswerText text={t.answer} shown={t.shown} />
                    {t.shown >= t.answer.split(/\s+/).length && t.cited.length > 0 && <Citations cited={t.cited} />}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 pt-2">
        {turns.length === 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {EXAMPLES.map((e) => (
              <button
                key={e}
                onClick={() => send(e)}
                className="text-[12.5px] text-ink-2 bg-bg border border-line rounded-full px-3 py-1.5 hover:border-line-strong cursor-pointer"
              >
                {e}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 rounded-2xl border border-line-strong bg-bg pl-4 pr-2 py-2 shadow-card"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about pay, allowances, cut-offs..."
            className="flex-1 bg-transparent outline-none text-[14.5px] placeholder:text-faint"
          />
          <button
            type="submit"
            disabled={!input.trim() || busy}
            className="w-8 h-8 rounded-lg bg-[#d97757] text-white grid place-items-center disabled:opacity-30 cursor-pointer"
          >
            <ArrowUp size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
