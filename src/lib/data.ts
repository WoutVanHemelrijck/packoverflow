import mock from "@/data/corpus.json";
import spaceJson from "@/data/embedding-space.json";
import reportJson from "@/data/pipeline-report.json";
import type { CorpusData, EmbeddingSpace, Person, PipelineReport, SourceDoc } from "./types";

// scripts/seed.ts writes corpus.json; pipeline/run.ts writes embedding-space.json and pipeline-report.json.
export const corpus = mock as CorpusData;

// Real embedding map when the pipeline has run, else the planted layout from the seed.
const realSpace = spaceJson as EmbeddingSpace;
export const space: EmbeddingSpace = realSpace.points.length
  ? realSpace
  : { model: null, generatedAt: null, points: corpus.points, clusters: corpus.clusters, purity: null };

export const report = reportJson as PipelineReport;

export const docById = new Map<string, SourceDoc>(corpus.docs.map((d) => [d.id, d]));
export const personById = new Map<string, Person>(corpus.people.map((p) => [p.id, p]));
