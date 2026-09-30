"use client";

import { Search } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { useJanitor } from "@/lib/store";
import { corpus, report, space } from "@/lib/data";
import { CONNECTOR_LABEL, LANG_LABEL } from "@/lib/labels";
import { Badge, Card, ConnectorIcon, Kbd, PdfIcon } from "@/flow/ui";
import { docStatus, type Hit, keywordHits, queryTerms, snippet, toHits } from "@/flow/search/rank";

const EXAMPLES = ["indexeringsplafond PC 200", "indemnité de télétravail", "home working allowance"];
const LIMIT = 8;

function highlight(text: string, terms: string[]): ReactNode {
  if (!terms.length) return text;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return text.split(re).map((part, i) => (i % 2 ? <mark key={i} className="bg-transparent text-ink font-medium">{part}</mark> : part));
}

export default function SearchPage() {
  const { sources, result } = useJanitor();
  const [query, setQuery] = useState("");
  const [asked, setAsked] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [meta, setMeta] = useState<{ model: string; ms: number; semantic: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  const pool = useMemo(() => {
    const ids = new Set(sources.flatMap((s) => (s.docId ? [s.docId] : [])));
    return ids.size ? corpus.docs.filter((d) => ids.has(d.id)) : corpus.docs;
  }, [sources]);

  async function run(q: string) {
    const text = q.trim();
    if (!text) return;
    setQuery(text);
    setLoading(true);
    const t0 = performance.now();
    const allowed = new Set(pool.map((d) => d.id));
    let found: Hit[] = [];
    let model = report.model ?? space.model ?? "keyword index";
    let semantic = false;
    try {
      const res = await fetch("/api/embed", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { neighbors: { docId: string; score: number }[]; model?: string };
      found = toHits(data.neighbors, allowed);
      model = data.model ?? model;
      semantic = true;
    } catch {}
    if (found.length < LIMIT) {
      const seen = new Set(found.map((h) => h.doc.id));
      found = [...found, ...keywordHits(text, pool.filter((d) => !seen.has(d.id)), LIMIT - found.length)];
    }
    setHits(found.slice(0, LIMIT));
    setAsked(text);
    setMeta({ model: semantic ? model : "keyword match", ms: Math.round(performance.now() - t0), semantic });
    setLoading(false);
  }

  const terms = queryTerms(asked);

  return (
    <div className="max-w-[1040px]">
      <h1 className="headline text-[32px]">Search</h1>
      <p className="mt-1.5 text-[15px] text-muted">Semantic search across your connected documents, in Dutch, French and English.</p>

      <form
        className="mt-7"
        onSubmit={(e) => {
          e.preventDefault();
          run(query);
        }}
      >
        <label className="flex items-center gap-3 h-14 px-5 rounded-xl border border-line-strong bg-bg shadow-card focus-within:border-ink transition-colors">
          <Search size={19} className="text-muted flex-none" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask in any language, for example indexeringsplafond PC 200"
            className="flex-1 bg-transparent outline-none text-[17px] placeholder:text-faint"
          />
          {loading ? <span className="text-[13px] text-muted">Searching</span> : <Kbd>Enter</Kbd>}
        </label>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-faint mr-1">Try</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => run(ex)}
            className="h-7 px-3 rounded-full border border-line bg-bg text-[13px] text-ink-2 hover:bg-canvas cursor-pointer"
          >
            {ex}
          </button>
        ))}
        <span className="ml-auto text-[13px] text-muted num">{pool.length} documents indexed</span>
      </div>

      {hits && (
        <div className="mt-7">
          {hits.length ? (
            <Card className="divide-y divide-line overflow-hidden">
              {hits.map((h) => (
                <Row key={h.doc.id} hit={h} terms={terms} query={asked} status={docStatus(h.doc.id, result)} />
              ))}
            </Card>
          ) : (
            <Card className="px-6 py-10 text-center text-[14px] text-muted">No connected document mentions this. Try another phrasing.</Card>
          )}
          {meta && (
            <p className="mt-3 text-[12px] text-faint num">
              {meta.semantic ? `Embeddings: ${meta.model}` : "Keyword match"}, {meta.ms} ms
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ hit, terms, query, status }: { hit: Hit; terms: string[]; query: string; status: ReturnType<typeof docStatus> }) {
  const { doc, score } = hit;
  const pct = score === null ? null : Math.round(Math.max(0, score) * 100);
  return (
    <div className="flex items-center gap-4 px-5 py-3 hover:bg-canvas/60">
      <PdfIcon />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <a href={`/pdfs/${doc.fileName}`} target="_blank" rel="noreferrer" className="font-medium text-[14px] truncate hover:underline">
            {doc.title}
          </a>
          <Badge className="flex-none">{LANG_LABEL[doc.lang]}</Badge>
        </div>
        <p className="mt-0.5 text-[13px] text-muted truncate">{highlight(snippet(doc, query), terms)}</p>
      </div>
      <div className="w-[150px] flex items-center gap-2 flex-none text-[13px] text-ink-2">
        <ConnectorIcon id={doc.connector} size={20} />
        <span className="truncate">{CONNECTOR_LABEL[doc.connector]}</span>
      </div>
      <div className="w-[88px] flex-none" title={pct === null ? "Keyword match" : `Cosine similarity ${score}`}>
        {pct === null ? (
          <span className="text-[12px] text-faint">keyword</span>
        ) : (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-12 rounded-full bg-canvas-2 overflow-hidden">
              <div className="h-full rounded-full bg-agent" style={{ width: `${pct}%` }} />
            </div>
            <span className="num text-[12px] text-muted">{pct}%</span>
          </div>
        )}
      </div>
      <div className="w-[170px] flex-none flex justify-end">
        {status.kind === "settled" && <Badge tone="settled" className="max-w-full truncate">{status.label}</Badge>}
        {status.kind === "superseded" && <Badge className="text-muted">{status.label}</Badge>}
        {status.kind === "conflict" && <Badge tone="conflict">{status.label}</Badge>}
        {status.kind === "none" && <span className="text-[12px] text-faint">No facts</span>}
      </div>
    </div>
  );
}
