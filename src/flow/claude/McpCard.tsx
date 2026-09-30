"use client";

import { useState } from "react";
import { Check, Copy, Wrench } from "lucide-react";
import { Card } from "@/flow/ui";

export const REGISTER_CMD = "claude mcp add spotless -- npx tsx /Users/tristan/Projects/Hackathons/packoverflow/Tristan/mcp/server.ts";

const TOOLS = [
  { name: "search_facts", desc: "Finds the settled facts that match a question" },
  { name: "get_fact", desc: "Returns one fact with its sources and trace" },
  { name: "health", desc: "Returns consistency, freshness and certainty" },
];

export function McpCard({ facts, health }: { facts: number | null; health: { health: number; certainty: number } }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(REGISTER_CMD);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <Card className="p-5 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[12px] text-muted mb-1">MCP server</div>
          <div className="num text-[17px] font-medium">spotless</div>
        </div>
        <span className="flex items-center gap-2 text-[13px] text-settled font-medium">
          <span className="relative flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-settled animate-ping opacity-60" />
            <span className="relative w-2 h-2 rounded-full bg-settled" />
          </span>
          Connected
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 border-y border-line py-4">
        <div>
          <div className="text-[12px] text-muted">Facts served</div>
          <div className="stat text-[34px] mt-1">{facts ?? "-"}</div>
        </div>
        <div>
          <div className="text-[12px] text-muted">Data health</div>
          <div className="stat text-[34px] mt-1">{health.health}%</div>
          <div className="text-[12px] text-muted mt-0.5">certainty {health.certainty}%</div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {TOOLS.map((t) => (
          <div key={t.name} className="flex items-start gap-2.5">
            <Wrench size={13} className="text-faint mt-1 flex-none" />
            <div>
              <div className="num text-[13px] text-ink">{t.name}</div>
              <div className="text-[12.5px] text-muted">{t.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <div className="text-[12px] text-muted mb-1.5">Add it to Claude Code</div>
        <button
          onClick={copy}
          className="group w-full text-left rounded-lg bg-canvas border border-line px-3 py-2.5 flex gap-2 items-start cursor-pointer hover:border-line-strong"
        >
          <code className="font-mono text-[11.5px] leading-[1.5] text-ink-2 break-all min-w-0 flex-1">{REGISTER_CMD}</code>
          {copied ? <Check size={14} className="text-settled flex-none mt-0.5" /> : <Copy size={14} className="text-faint group-hover:text-ink flex-none mt-0.5" />}
        </button>
      </div>
    </Card>
  );
}
