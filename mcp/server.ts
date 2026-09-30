// Ground-truth MCP server: Claude answers from settled facts instead of the raw documents.
// Register: claude mcp add spotless -- npx tsx /Users/tristan/Projects/Hackathons/packoverflow/Tristan/mcp/server.ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import corpusJson from "../src/data/corpus.json";
import type { CorpusData } from "../src/lib/types";
import { type Fact, type LedgerFile, searchFacts, toFacts } from "../src/flow/claude/facts";

const corpus = corpusJson as unknown as CorpusData;
const APP_URL = process.env.SPOTLESS_URL ?? "http://localhost:3100";
const CACHE = fileURLToPath(new URL("../.cache/ledger.json", import.meta.url));

async function load(): Promise<LedgerFile | null> {
  try {
    const res = await fetch(`${APP_URL}/api/ledger`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) return (await res.json()) as LedgerFile;
  } catch {}
  try {
    return JSON.parse(readFileSync(CACHE, "utf8")) as LedgerFile;
  } catch {
    return null;
  }
}

const facts = (file: LedgerFile) => toFacts(file.ledger, corpus.docs, corpus.claimKeys);
const day = (iso: string) => iso.slice(0, 10);
const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

function describe(f: Fact, withTrace = false): string {
  return [
    `[${f.claimId}] ${f.label}`,
    `Statement: ${f.statement}`,
    `Value: ${f.value}`,
    `Settled by: ${f.settledBy} on ${day(f.settledAt)} (confidence ${Math.round(f.confidence * 100)}%)`,
    `Sources: ${f.sources.map((s) => `"${s.title}" (${s.fileName})`).join("; ")}`,
    withTrace ? `Trace:\n${f.trace.map((t) => `- ${t.ruleId} ${t.outcome}: ${t.detail}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const server = new McpServer({ name: "spotless", version: "1.0.0" });

server.registerTool(
  "search_facts",
  {
    title: "Search settled facts",
    description:
      "Searches the company's ground-truth ledger of settled payroll and HR facts (Belgium). Returns the best matching facts with who settled them and the source documents. Use this before answering any payroll or HR question, and cite the fact ids.",
    inputSchema: { query: z.string().max(500).describe("The question or keywords, in any language") },
  },
  async ({ query }) => {
    const file = await load();
    if (!file) return text("The ground-truth ledger is not available. Say you cannot check the settled facts right now.");
    const hits = searchFacts(facts(file), query, 3);
    if (!hits.length) return text("No settled fact matches this question. Say it is not in the ground truth yet rather than guessing.");
    return text(hits.map((f) => describe(f)).join("\n\n"));
  },
);

server.registerTool(
  "get_fact",
  {
    title: "Get one settled fact",
    description: "Returns one settled fact by its claim id, with its sources and the trace of rules that settled it.",
    inputSchema: { claimId: z.string().describe('Claim id, e.g. "meal_vouchers.max_face_value"') },
  },
  async ({ claimId }) => {
    const file = await load();
    const fact = file && facts(file).find((f) => f.claimId === claimId);
    return text(fact ? describe(fact, true) : `No settled fact with id ${claimId}.`);
  },
);

server.registerTool(
  "health",
  {
    title: "Data health",
    description: "Returns the latest health of the ground truth: consistency (facts without an open conflict), freshness (current documents), certainty and overall health.",
    inputSchema: {},
  },
  async () => {
    const file = await load();
    if (!file) return text("The ground-truth ledger is not available.");
    const h = file.health;
    return text(
      `Health ${h.health}%\nConsistency ${h.consistency}% (${h.openConflicts} open conflicts)\nFreshness ${h.freshness}%\nCertainty ${h.certainty}%\nSettled facts: ${file.ledger.length}\nUpdated: ${file.updatedAt}`,
    );
  },
);

server.connect(new StdioServerTransport()).catch((error) => {
  console.error("Spotless MCP server failed to start:", error);
  process.exit(1);
});
