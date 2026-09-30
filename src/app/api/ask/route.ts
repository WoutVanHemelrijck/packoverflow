import { cosine, embed, loadDocIndex, nearestDocs } from "@/lib/embed";
import { complete } from "@/lib/llm";
import type { SettledClaim } from "@/lib/types";

export const runtime = "nodejs";

const BUDGET_MS = 25_000;
const statementVectors = new Map<string, number[]>();

interface AskResponse {
  answer: string | null;
  claimIds: string[];
  docIds: string[];
  model: string;
  latencyMs: number;
}

async function answer(question: string, ledger: SettledClaim[], t0: number): Promise<AskResponse> {
  const fresh = [...new Set(ledger.map((c) => c.statement))].filter((s) => !statementVectors.has(s));
  const [[qVec, ...freshVecs], index] = await Promise.all([embed([question, ...fresh]), loadDocIndex()]);
  fresh.forEach((s, i) => statementVectors.set(s, freshVecs[i]));

  const top = ledger
    .map((c) => ({ c, score: cosine(qVec, statementVectors.get(c.statement)!) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const closestDoc = index.docs.find((d) => d.id === nearestDocs(index, qVec, 1)[0]?.docId);
  const expert = index.people.find((p) => p.id === closestDoc?.authorId);
  const expertLine = expert
    ? `${expert.name}, ${expert.role} (${expert.team}), author of "${closestDoc!.title}"`
    : "the payroll team";

  const claimsBlock = top.length
    ? top
        .map(
          ({ c }) =>
            `- id: ${c.claimId}\n  statement: ${c.statement}\n  vouched by: ${c.vouchedBy}\n  settled on: ${c.settledAt.slice(0, 10)}`,
        )
        .join("\n")
    : "(the ground truth ledger is empty)";

  const prompt = `A colleague asks a question. Answer it using ONLY the settled claims from the ground truth ledger below. Do not use outside knowledge.

Question: ${question}

Settled claims:
${claimsBlock}

Rules:
- Write the answer in the same language as the question.
- 2 to 4 sentences, plain text, no markdown.
- Cite each claim you use by its id in square brackets, e.g. [${top[0]?.c.claimId ?? "claim.id"}].
- Say who vouched for the claim and on which date (write the date in words, e.g. 1 March 2026).
- If none of the claims answers the question, say that this is not in the ground truth yet and suggest asking ${expertLine}. Use an empty claimIds list in that case.

Return JSON: {"answer": string, "claimIds": string[]}`;

  const remaining = BUDGET_MS - (Date.now() - t0);
  const res = await complete(prompt, { json: true, timeoutMs: Math.max(2000, remaining) });
  const parsed = JSON.parse(res.text) as { answer?: unknown; claimIds?: unknown };
  const known = new Map(top.map(({ c }) => [c.claimId, c]));
  const claimIds = (Array.isArray(parsed.claimIds) ? parsed.claimIds : []).filter(
    (id): id is string => typeof id === "string" && known.has(id),
  );
  return {
    answer: typeof parsed.answer === "string" && parsed.answer.trim() ? parsed.answer.trim() : null,
    claimIds,
    docIds: [...new Set(claimIds.flatMap((id) => known.get(id)!.sourceDocIds))],
    model: res.model,
    latencyMs: Date.now() - t0,
  };
}

export async function POST(req: Request) {
  const t0 = Date.now();
  let question = "";
  let ledger: SettledClaim[] = [];
  try {
    const body = (await req.json()) as { question?: unknown; ledger?: unknown };
    question = String(body.question ?? "").trim();
    ledger = Array.isArray(body.ledger)
      ? (body.ledger as SettledClaim[]).filter((c) => c && typeof c.statement === "string" && c.claimId)
      : [];
  } catch {}
  if (!question) return Response.json({ answer: null, claimIds: [], docIds: [], model: "", latencyMs: Date.now() - t0 } satisfies AskResponse);

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("ask timed out")), BUDGET_MS);
    });
    return Response.json(await Promise.race([answer(question, ledger, t0), timeout]));
  } catch (err) {
    console.error("[api/ask]", (err as Error).message);
    return Response.json({ answer: null, claimIds: [], docIds: [], model: "", latencyMs: Date.now() - t0 } satisfies AskResponse);
  } finally {
    clearTimeout(timer);
  }
}
