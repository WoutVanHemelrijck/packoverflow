// Offline pipeline: public/pdfs -> unpdf -> local multilingual embeddings -> UMAP + k-means -> Haiku claim re-extraction -> src/data/*.json.
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { UMAP } from "umap-js";
import { embed, MODEL_ID } from "../src/lib/embed";
import { complete } from "../src/lib/llm";
import type { ClaimInstance, Cluster, CorpusData, DocPoint, EmbeddingSpace, PipelineReport } from "../src/lib/types";
import { kmeans, meanVector, mulberry32, silhouette } from "./cluster";
import { squash, valueKey } from "./values";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "src", "data");
const PDF_DIR = path.join(ROOT, "public", "pdfs");
const SKIP_LLM = process.env.SKIP_LLM === "1";
const SEED = 42;
const SPARE_COLORS = ["#ff6b6b", "#5eead4", "#fbbf24", "#a3e635"];

const t0 = Date.now();
const log = (msg: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`);
const writeJson = (file: string, data: unknown) => writeFile(path.join(DATA, file), JSON.stringify(data, null, 1) + "\n");

function chunk(text: string, size = 1000): string[] {
  const out: string[] = [];
  let cur = "";
  for (const word of text.split(/\s+/)) {
    if (cur.length + word.length + 1 > size && cur) {
      out.push(cur);
      cur = "";
    }
    cur += (cur ? " " : "") + word;
  }
  if (cur) out.push(cur);
  return out;
}

// Subtracts each group's mean vector so language and document format stop dominating the topic signal.
function centerBy(X: number[][], groups: string[]): number[][] {
  const sums = new Map<string, { v: number[]; n: number }>();
  X.forEach((x, i) => {
    const g = sums.get(groups[i]) ?? { v: new Array(x.length).fill(0), n: 0 };
    x.forEach((val, j) => (g.v[j] += val));
    g.n++;
    sums.set(groups[i], g);
  });
  return X.map((x, i) => {
    const g = sums.get(groups[i])!;
    return meanVector([x.map((val, j) => val - g.v[j] / g.n)]);
  });
}

const GIST_CACHE = path.join(ROOT, ".cache", "pipeline-gists.json");

// Haiku writes a one-sentence English gist per document; embedding it next to the original text bridges Dutch, French and English.
async function loadGists(docs: { id: string; title: string; text: string }[]): Promise<Record<string, string>> {
  const cache: Record<string, string> = await readFile(GIST_CACHE, "utf8").then(JSON.parse).catch(() => ({}));
  const todo = docs.filter((d) => !cache[d.id]);
  const rand = mulberry32(SEED);
  const shuffled = todo.map((d) => ({ d, r: rand() })).sort((a, b) => a.r - b.r).map((x) => x.d);
  const batches: (typeof docs)[] = [];
  for (let i = 0; i < shuffled.length; i += 10) batches.push(shuffled.slice(i, i + 10));
  await Promise.all(
    batches.map(async (batch) => {
      const prompt = `For each document below, write one English line of at most 25 words: first the payroll topic in 2 to 4 words, a colon, then the main rule or value it states. Do not mention the document format, language, country or author.

${batch.map((d) => `=== ${d.id}: ${d.title}\n${d.text.slice(0, 1500)}`).join("\n\n")}

Return JSON: {"<docId>": "<sentence>", ...}`;
      try {
        llmCallsTotal++;
        const res = await complete(prompt, { json: true, timeoutMs: 120_000 });
        Object.assign(cache, JSON.parse(res.text));
      } catch (err) {
        log(`gist batch failed: ${(err as Error).message.slice(0, 160)}`);
      }
    }),
  );
  if (todo.length) await writeFile(GIST_CACHE, JSON.stringify(cache, null, 1));
  log(`gists: ${docs.filter((d) => cache[d.id]).length}/${docs.length} (${todo.length} new)`);
  return cache;
}

let llmCallsTotal = 0;

interface LlmClaim {
  claimId: string;
  docId: string;
  value: string;
  quote: string;
  appliesTo?: string;
}

async function main() {
  const corpus = JSON.parse(await readFile(path.join(DATA, "corpus.json"), "utf8")) as CorpusData;
  const docByFile = new Map(corpus.docs.map((d) => [d.fileName, d]));

  const files = (await readdir(PDF_DIR)).filter((f) => f.toLowerCase().endsWith(".pdf"));
  const texts = new Map<string, string>();
  // PDF text minus the metadata header and page footer, which otherwise make docs cluster by channel and language.
  const contents = new Map<string, string>();
  const titles = new Map<string, string>();
  let pages = 0;
  let chars = 0;
  await Promise.all(
    files.map(async (file) => {
      const doc = docByFile.get(file);
      if (!doc) return console.warn(`no doc for ${file}`);
      const pdf = await getDocumentProxy(new Uint8Array(await readFile(path.join(PDF_DIR, file))));
      const { totalPages, text } = await extractText(pdf, { mergePages: true });
      const clean = text.replace(/\s+\n/g, "\n").trim();
      const lines = clean.split("\n");
      const headerEnd = lines.findIndex((l) => l.startsWith("Document ID"));
      texts.set(doc.id, clean);
      titles.set(doc.id, lines[1] ?? doc.title);
      contents.set(doc.id, lines.slice(headerEnd + 1).join("\n").replace(/DOC-\d+, page \d+ of \d+.*$/gm, "").trim());
      pages += totalPages;
      chars += clean.length;
    }),
  );
  const docs = corpus.docs.filter((d) => texts.has(d.id));
  log(`parsed ${texts.size}/${files.length} PDFs, ${pages} pages, ${chars} chars`);

  const gists = await loadGists(docs.map((d) => ({ id: d.id, title: titles.get(d.id)!, text: contents.get(d.id)! })));
  const tEmbed = Date.now();
  const pieces = docs.map((d) => [titles.get(d.id)!, ...chunk(contents.get(d.id)!)]);
  const flat = await embed(pieces.flat());
  let offset = 0;
  const contentVecs = pieces.map((p) => {
    const v = meanVector(flat.slice(offset, offset + p.length));
    offset += p.length;
    return v;
  });
  const gistVecs = await embed(docs.map((d) => gists[d.id] ?? titles.get(d.id)!));
  const X = contentVecs.map((v, i) => meanVector([v, gistVecs[i]]));
  const Xc = centerBy(centerBy(X, docs.map((d) => d.lang)), docs.map((d) => d.channel));
  const embedMs = Date.now() - tEmbed;
  log(`embedded ${flat.length} chunks into ${docs.length} vectors (${X[0].length} dims) in ${embedMs}ms`);
  await writeJson("embeddings.json", {
    model: MODEL_ID,
    dims: X[0].length,
    vectors: Object.fromEntries(docs.map((d, i) => [d.id, X[i].map((x) => Math.round(x * 1e4) / 1e4)])),
  });

  const tUmap = Date.now();
  const umap = new UMAP({ nComponents: 2, nNeighbors: 12, minDist: 0.2, random: mulberry32(SEED) });
  const xy = umap.fit(Xc);
  const umapMs = Date.now() - tUmap;
  const scale = (axis: 0 | 1) => {
    const vals = xy.map((p) => p[axis]);
    const [lo, hi] = [Math.min(...vals), Math.max(...vals)];
    return (v: number) => Math.round(70 + ((v - lo) / (hi - lo || 1)) * 860);
  };
  const [sx, sy] = [scale(0), scale(1)];
  log(`UMAP in ${umapMs}ms`);

  let best = { k: 0, labels: [] as number[], sil: -Infinity };
  for (let k = 10; k <= 14; k++) {
    const labels = kmeans(Xc, k, mulberry32(SEED + k));
    const sil = silhouette(Xc, labels);
    log(`k=${k} silhouette=${sil.toFixed(4)}`);
    if (sil > best.sil) best = { k, labels, sil };
  }

  const planted = new Map(corpus.clusters.map((c) => [c.topicId, c]));
  const counts: { real: number; topic: string; n: number }[] = [];
  for (let j = 0; j < best.k; j++) {
    const tally = new Map<string, number>();
    docs.forEach((d, i) => best.labels[i] === j && tally.set(d.topicId, (tally.get(d.topicId) ?? 0) + 1));
    for (const [topic, n] of tally) counts.push({ real: j, topic, n });
  }
  counts.sort((a, b) => b.n - a.n);
  const majorityTopic = new Map<number, string>();
  for (const { real, topic } of counts) if (!majorityTopic.has(real)) majorityTopic.set(real, topic);
  const realToTopic = new Map<number, string>();
  const usedTopics = new Set<string>();
  for (const { real, topic } of counts) {
    if (realToTopic.has(real) || usedTopics.has(topic)) continue;
    realToTopic.set(real, topic);
    usedTopics.add(topic);
  }
  let spare = 0;
  const clusters: Cluster[] = [];
  const clusterOfReal = new Map<number, Cluster>();
  const keyTopic = new Map<string, string>();
  for (let j = 0; j < best.k; j++) {
    const docIds = docs.filter((_, i) => best.labels[i] === j).map((d) => d.id);
    const topic = realToTopic.get(j);
    const base = topic ? planted.get(topic)! : null;
    const c: Cluster = base
      ? { ...base, docIds }
      : {
          id: `C-${String(corpus.clusters.length + 1 + spare).padStart(2, "0")}`,
          topicId: `extra-${spare + 1}`,
          label: `${planted.get(majorityTopic.get(j)!)?.label ?? "Other"} (split)`,
          summary: "A second group of documents on the same topic that the embedding keeps apart.",
          color: SPARE_COLORS[spare++ % SPARE_COLORS.length],
          docIds,
        };
    clusters.push(c);
    clusterOfReal.set(j, c);
    keyTopic.set(c.id, majorityTopic.get(j)!);
  }
  const plantedClusterId = new Map(corpus.clusters.map((c) => [c.topicId, c.id]));
  const purity = docs.filter((d, i) => clusterOfReal.get(best.labels[i])!.id === plantedClusterId.get(d.topicId)).length / docs.length;
  log(`k=${best.k}, purity=${(purity * 100).toFixed(1)}%`);

  const points: DocPoint[] = docs.map((d, i) => ({ docId: d.id, x: sx(xy[i][0]), y: sy(xy[i][1]), clusterId: clusterOfReal.get(best.labels[i])!.id }));
  const writeSpace = () =>
    writeJson("embedding-space.json", {
      model: MODEL_ID,
      generatedAt: new Date().toISOString(),
      points,
      clusters: [...clusters].sort((a, b) => a.id.localeCompare(b.id)),
      purity: Math.round(purity * 1000) / 1000,
    } satisfies EmbeddingSpace);
  await writeSpace();

  let llmModel: string | null = null;
  const found: (LlmClaim & { clusterId: string; quoteInPdf: boolean })[] = [];
  const covered = new Set<string>();
  const failed: string[] = [];
  if (!SKIP_LLM) {
    await Promise.all(
      clusters.map(async (c) => {
        const keys = corpus.claimKeys.filter((k) => k.topicId === keyTopic.get(c.id));
        const docBlock = c.docIds.map((id) => `=== ${id}: ${corpus.docs.find((d) => d.id === id)!.title}\n${texts.get(id)!.slice(0, 3000)}`).join("\n\n");
        const prompt = `You read Belgian payroll documents (Dutch, French or English) that an embedding model grouped into one cluster.

Task 1: give the cluster a short English label of 2 to 4 words in sentence case (capitalise only the first word, acronyms and proper nouns; no year) and a one-sentence English summary.
Task 2: for each document, extract every value it states for the claim keys below. Only report values the document states explicitly.

Claim keys:
${keys.length ? keys.map((k) => `- ${k.id}: ${k.question}${k.unit ? ` (unit: ${k.unit})` : ""}`).join("\n") : "(none, return an empty claims array)"}

Write each value in English with this format: money "€1,234.56" (add "/km" or "/hour" when the unit says so), percentages "25%", dates "1 January 2026", durations "8 weeks" / "6 months" / "360 hours", days of the month "20th of the month", pay months "December pay". quote = the exact sentence fragment from the document, copied verbatim in its original language. appliesTo = scope such as "PC 200" or a client name, only when the document limits the value to it.

Documents:
${docBlock}

Return JSON: {"label": string, "summary": string, "claims": [{"claimId": string, "docId": string, "value": string, "quote": string, "appliesTo"?: string}]}`;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            llmCallsTotal++;
            const res = await complete(prompt, { json: true, timeoutMs: 150_000 });
            llmModel = res.model;
            const out = JSON.parse(res.text) as { label?: string; summary?: string; claims?: LlmClaim[] };
            if (out.label && out.label.split(/\s+/).length <= 5) c.label = out.label.trim();
            if (out.summary) c.summary = out.summary.trim();
            const validKeys = new Set(keys.map((k) => k.id));
            for (const cl of out.claims ?? []) {
              if (!validKeys.has(cl.claimId) || !c.docIds.includes(cl.docId) || !cl.value) continue;
              found.push({ ...cl, clusterId: c.id, quoteInPdf: !!cl.quote && squash(texts.get(cl.docId)!).includes(squash(cl.quote)) });
            }
            covered.add(c.id);
            log(`${c.id} "${c.label}": ${out.claims?.length ?? 0} claims in ${res.latencyMs}ms`);
            return;
          } catch (err) {
            log(`${c.id} attempt ${attempt + 1} failed: ${(err as Error).message.slice(0, 160)}`);
          }
        }
        failed.push(c.id);
      }),
    );
    const seen = new Set<string>();
    for (const c of [...clusters].sort((a, b) => b.docIds.length - a.docIds.length)) {
      if (seen.has(c.label.toLowerCase())) c.label = `${c.label} (split)`;
      seen.add(c.label.toLowerCase());
    }
    await writeSpace();
  }

  const coveredDocs = new Set(clusters.filter((c) => covered.has(c.id)).flatMap((c) => c.docIds));
  const match = (p: ClaimInstance) => found.find((f) => f.docId === p.docId && f.claimId === p.claimId && valueKey(f.value) === valueKey(p.value));
  const matched = corpus.claims.filter((p) => match(p));
  const inScope = corpus.claims.filter((p) => coveredDocs.has(p.docId));
  const extra = found.filter((f) => !corpus.claims.some((p) => p.docId === f.docId && p.claimId === f.claimId && valueKey(f.value) === valueKey(p.value)));
  // Extra = a value the seed did not plant for that doc; consistent when the same claim carries that value in another doc.
  const extraConsistent = extra.filter((f) => corpus.claims.some((p) => p.claimId === f.claimId && valueKey(f.value) === valueKey(p.value)));
  const stats = {
    clustersCovered: covered.size,
    clustersFailed: failed,
    docsCovered: coveredDocs.size,
    planted: corpus.claims.length,
    plantedInCoveredDocs: inScope.length,
    found: found.length,
    matching: matched.length,
    recall: Math.round((matched.length / corpus.claims.length) * 1000) / 1000,
    extraConsistent: extraConsistent.length,
    extraNovel: extra.length - extraConsistent.length,
    quotesFoundVerbatimInPdf: found.filter((f) => f.quoteInPdf).length,
  };
  await writeJson("claims.real.json", {
    model: llmModel,
    generatedAt: new Date().toISOString(),
    stats,
    claims: found.map((f) => ({ ...f, matchesPlanted: !extra.includes(f), consistentExtra: extraConsistent.includes(f) })),
    missed: corpus.claims.filter((p) => !match(p)).map(({ id, claimId, docId, value }) => ({ id, claimId, docId, value })),
  });
  log(`claims: ${JSON.stringify(stats)}`);

  await writeJson("pipeline-report.json", {
    model: MODEL_ID,
    llmModel,
    docsParsed: texts.size,
    pagesParsed: pages,
    chars,
    embedMs,
    umapMs,
    k: best.k,
    purity: Math.round(purity * 1000) / 1000,
    llmCalls: llmCallsTotal,
    claimsPlanted: corpus.claims.length,
    claimsFoundByLlm: found.length,
    claimsMatching: matched.length,
    generatedAt: new Date().toISOString(),
  } satisfies PipelineReport);
  log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
