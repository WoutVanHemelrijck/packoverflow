import type { ClaimKey, SettledClaim, SourceDoc, TraceStep } from "../../lib/types";

export interface HealthNumbers {
  health: number;
  consistency: number;
  freshness: number;
  certainty: number;
  openConflicts: number;
}

export interface LedgerFile {
  ledger: SettledClaim[];
  health: HealthNumbers;
  updatedAt: string;
}

export interface FactSource {
  docId: string;
  title: string;
  fileName: string;
}

export interface Fact {
  claimId: string;
  label: string;
  statement: string;
  value: string;
  settledBy: string;
  settledAt: string;
  confidence: number;
  sources: FactSource[];
  trace: TraceStep[];
}

export function toFacts(ledger: SettledClaim[], docs: SourceDoc[], keys: ClaimKey[]): Fact[] {
  const docMap = new Map(docs.map((d) => [d.id, d]));
  const keyMap = new Map(keys.map((k) => [k.id, k]));
  return ledger.map((c) => ({
    claimId: c.claimId,
    label: keyMap.get(c.claimId)?.label ?? c.claimId,
    statement: c.statement,
    value: c.value,
    settledBy: c.vouchedBy,
    settledAt: c.settledAt,
    confidence: c.confidence,
    sources: c.sourceDocIds.map((id) => ({ docId: id, title: docMap.get(id)?.title ?? id, fileName: docMap.get(id)?.fileName ?? "" })),
    trace: c.trace,
  }));
}

const STOP = new Set(
  "the what which when where who how does for and from with this that are was per van het een voor wat wanneer vanaf geldt wie hoe welk welke les des une est quel quelle pour dans aux par qui quoi".split(" "),
);

const SYNONYMS: Record<string, string[]> = {
  plafond: ["cap"],
  indexering: ["indexation"],
  indexeringsplafond: ["indexation", "cap"],
  repas: ["meal"],
  maaltijdcheque: ["meal", "voucher"],
  cheque: ["voucher"],
  montant: ["amount", "value"],
  bedrag: ["amount", "value"],
  maximum: ["max"],
  maximaal: ["max"],
  afsluiting: ["close", "cutoff"],
  cloture: ["close", "cutoff"],
  cut: ["cutoff", "close"],
  thuiswerk: ["home", "working"],
  eindejaarspremie: ["year", "end", "bonus"],
  bedrijfswagen: ["company", "car"],
  opzeg: ["notice"],
  preavis: ["notice"],
};

export function words(text: string): string[] {
  return (
    text
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? []
  ).filter((w) => w.length >= 2 && !STOP.has(w));
}

const matches = (q: string, h: string) =>
  q === h || (q.length >= 3 && h.length >= 3 && (h.startsWith(q) || q.startsWith(h))) || (q.length >= 5 && h.includes(q));

export function searchFacts(facts: Fact[], query: string, limit = 3): Fact[] {
  const q = [...new Set(words(query))];
  const expanded = q.map((w) => [w, ...(SYNONYMS[w] ?? Object.entries(SYNONYMS).find(([k]) => w.startsWith(k))?.[1] ?? [])]);
  return facts
    .map((f) => {
      const hay = words([f.statement, f.label, f.claimId.replace(/[._]/g, " "), ...f.sources.map((s) => s.title)].join(" "));
      const inStatement = words(f.statement + " " + f.label);
      let score = 0;
      for (const alts of expanded) {
        if (alts.some((a) => hay.some((h) => matches(a, h)))) score += 1;
        if (alts.some((a) => inStatement.some((h) => matches(a, h)))) score += 0.25;
      }
      return { f, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.f);
}
