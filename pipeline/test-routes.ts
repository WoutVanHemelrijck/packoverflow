import { readFileSync } from "node:fs";
import { POST as ask } from "../src/app/api/ask/route";
import { POST as embedRoute } from "../src/app/api/embed/route";
import type { SettledClaim } from "../src/lib/types";

const ledgerFile = process.argv[2];
const ledger: SettledClaim[] = ledgerFile ? JSON.parse(readFileSync(ledgerFile, "utf8")) : [];
const questions = [
  "Vanaf wanneer geldt het indexeringsplafond voor PC 200?",
  "Quel est le montant maximum d'un chèque-repas ?",
  "How many days of paternity leave does an employee get?",
];

const post = (body: unknown) =>
  new Request("http://x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

async function main() {
  let t0 = Date.now();
  const e = await (await embedRoute(post({ text: questions[1] }))).json();
  console.log(`embed ${Date.now() - t0}ms`, JSON.stringify(e).slice(0, 300));
  for (const question of questions) {
    t0 = Date.now();
    const r = await (await ask(post({ question, ledger }))).json();
    console.log(`\nQ: ${question}\n${Date.now() - t0}ms`, r);
  }
}

main();
