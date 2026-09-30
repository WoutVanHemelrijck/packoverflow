import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_RULES, conflictStatusLabel, healthStages, runJanitor } from "../src/lib/janitor";
import type { CorpusData, RulesConfig } from "../src/lib/types";

const corpus = JSON.parse(readFileSync(join(__dirname, "../src/data/corpus.json"), "utf8")) as CorpusData;
console.log(`Corpus: ${corpus.docs.length} docs, ${corpus.claimKeys.length} claim keys, ${corpus.claims.length} claims, ${corpus.debates.length} debates`);

const res = runJanitor(corpus, DEFAULT_RULES, [], []);
const t0 = performance.now();
for (let i = 0; i < 50; i++) runJanitor(corpus, DEFAULT_RULES, [], []);
const ms = (performance.now() - t0) / 50;

const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n));
console.log(`\n${pad("claim", 46)} ${pad("status", 9)} ${pad("label", 26)} winner`);
for (const c of res.conflicts) {
  console.log(`${pad(c.claimId, 46)} ${pad(c.status, 9)} ${pad(conflictStatusLabel(c), 26)} ${c.winningValue ?? "-"}   [${c.values.map((v) => v.value).join(" | ")}]`);
}
const count = (s: string) => res.conflicts.filter((c) => c.status === s).length;
const agreed = res.ledger.filter((l) => l.vouchedBy.startsWith("Agreed")).length;
console.log(`\nauto ${count("auto")}  debate ${count("debate")}  human ${count("human")}  agreed ${agreed}  ledger ${res.ledger.length}`);
console.log(`issues ${res.issues.length}`, res.health.breakdown, `actions ${res.actions.length}`);
console.log("health stages", healthStages(corpus, DEFAULT_RULES));
console.log(`runJanitor ${ms.toFixed(2)} ms (warm average)`);

const order = [...DEFAULT_RULES.order];
const ia = order.findIndex((r) => r.id === "authority");
const ir = order.findIndex((r) => r.id === "recency");
[order[ia], order[ir]] = [order[ir], order[ia]];
const recencyFirst: RulesConfig = { ...DEFAULT_RULES, order };
const alt = runJanitor(corpus, recencyFirst, [], []);
const flips = alt.conflicts.filter((c) => {
  const before = res.conflicts.find((x) => x.claimId === c.claimId);
  return before && (before.winningValue !== c.winningValue || before.status !== c.status);
});
console.log(`\nRecency above authority: ${flips.length} verdicts change`);
for (const c of flips) {
  const before = res.conflicts.find((x) => x.claimId === c.claimId)!;
  console.log(`  ${c.claimId}: ${before.winningValue ?? before.status} -> ${c.winningValue ?? c.status}`);
}

const hero = res.conflicts.filter((c) => c.claimId.startsWith("indexation_cap"));
for (const c of hero) {
  console.log(`\n${c.claimId} (${c.status})`);
  for (const s of c.trace) console.log(`  ${s.ruleId.padEnd(9)} ${s.outcome.padEnd(8)} ${s.detail}`);
}
const bad = JSON.stringify(res).match(/undefined|NaN|null null/g);
if (bad) console.log("\nWARNING: output contains", [...new Set(bad)]);
