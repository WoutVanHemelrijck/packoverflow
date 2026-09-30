import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { corpus } from "@/lib/data";
import { DEFAULT_RULES, runJanitor, syntheticDecisions } from "@/lib/janitor";
import type { LedgerFile } from "@/flow/claude/facts";
import { measureHealth } from "@/lib/health";

export const runtime = "nodejs";

const FILE = path.join(process.cwd(), ".cache", "ledger.json");

function cleanLedger(): LedgerFile {
  const raw = runJanitor(corpus, DEFAULT_RULES, [], []);
  const all = raw.actions.map((a) => a.id);
  const done = runJanitor(corpus, DEFAULT_RULES, syntheticDecisions(corpus, raw), all);
  const h = measureHealth(done, []);
  return {
    ledger: done.ledger,
    health: { health: h.score, consistency: h.consistency, freshness: h.freshness, certainty: h.certainty, openConflicts: h.openConflicts },
    updatedAt: corpus.generatedAt,
  };
}

export async function GET() {
  try {
    return Response.json(JSON.parse(await readFile(FILE, "utf8")) as LedgerFile);
  } catch {
    return Response.json(cleanLedger());
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<LedgerFile>;
  if (!Array.isArray(body.ledger) || !body.health) return Response.json({ error: "ledger and health required" }, { status: 400 });
  const file: LedgerFile = { ledger: body.ledger, health: body.health, updatedAt: new Date().toISOString() };
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(file, null, 2));
  return Response.json(file);
}
