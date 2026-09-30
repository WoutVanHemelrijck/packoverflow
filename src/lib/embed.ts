import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import type { CorpusData, DocPoint, EmbeddingSpace, Person, SourceDoc } from "./types";

export const MODEL_ID = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";

env.cacheDir = path.join(process.cwd(), ".cache", "models");

const g = globalThis as unknown as { __janitorExtractor?: Promise<FeatureExtractionPipeline> };

function extractor(): Promise<FeatureExtractionPipeline> {
  g.__janitorExtractor ??= pipeline("feature-extraction", MODEL_ID, { dtype: "q8" }).catch((err) => {
    g.__janitorExtractor = undefined;
    throw err;
  }) as Promise<FeatureExtractionPipeline>;
  return g.__janitorExtractor;
}

export async function embed(texts: string[], batchSize = 16): Promise<number[][]> {
  if (!texts.length) return [];
  const fe = await extractor();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const tensor = await fe(texts.slice(i, i + batchSize), { pooling: "mean", normalize: true });
    out.push(...(tensor.tolist() as number[][]));
  }
  return out;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

interface DocIndex {
  docs: SourceDoc[];
  people: Person[];
  vectors: Map<string, number[]>;
  points: DocPoint[];
}

const DATA_DIR = path.join(process.cwd(), "src", "data");

async function readJson<T>(file: string): Promise<{ data: T; mtime: number } | null> {
  try {
    const full = path.join(DATA_DIR, file);
    const [raw, st] = await Promise.all([readFile(full, "utf8"), stat(full)]);
    return { data: JSON.parse(raw) as T, mtime: st.mtimeMs };
  } catch {
    return null;
  }
}

const idx = globalThis as unknown as { __janitorDocIndex?: { key: string; index: Promise<DocIndex> } };
const computedVectors = new Map<string, number[]>();

// Re-reads the data files whenever their mtimes change, so pipeline rewrites show up without a restart.
export async function loadDocIndex(): Promise<DocIndex> {
  const [corpusFile, embFile, spaceFile] = await Promise.all([
    readJson<CorpusData>("corpus.json"),
    readJson<{ model?: string; vectors?: Record<string, number[]> }>("embeddings.json"),
    readJson<EmbeddingSpace>("embedding-space.json"),
  ]);
  const key = [corpusFile?.mtime, embFile?.mtime, spaceFile?.mtime].join("|");
  if (idx.__janitorDocIndex?.key === key) return idx.__janitorDocIndex.index;

  const build = async (): Promise<DocIndex> => {
    const docs = corpusFile?.data.docs ?? [];
    const people = corpusFile?.data.people ?? [];
    const pre = embFile?.data.model === MODEL_ID ? (embFile.data.vectors ?? {}) : {};
    const vectors = new Map<string, number[]>();
    const missing: SourceDoc[] = [];
    for (const d of docs) {
      const v = pre[d.id] ?? computedVectors.get(`${d.id}:${d.updatedAt}:${d.title}`);
      if (v) vectors.set(d.id, v);
      else missing.push(d);
    }
    if (missing.length) {
      const vs = await embed(missing.map((d) => `${d.title}\n\n${d.body.slice(0, 1500)}`));
      missing.forEach((d, i) => {
        vectors.set(d.id, vs[i]);
        computedVectors.set(`${d.id}:${d.updatedAt}:${d.title}`, vs[i]);
      });
    }
    const spacePoints = spaceFile?.data.points ?? [];
    return { docs, people, vectors, points: spacePoints.length ? spacePoints : (corpusFile?.data.points ?? []) };
  };
  const index = build();
  idx.__janitorDocIndex = { key, index };
  index.catch(() => {
    if (idx.__janitorDocIndex?.index === index) idx.__janitorDocIndex = undefined;
  });
  return index;
}

export function nearestDocs(index: DocIndex, query: number[], k: number): { docId: string; score: number }[] {
  return [...index.vectors]
    .map(([docId, v]) => ({ docId, score: cosine(query, v) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
