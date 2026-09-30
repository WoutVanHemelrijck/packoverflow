import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface Completion {
  text: string;
  model: string;
  latencyMs: number;
}

interface CompleteOpts {
  json?: boolean;
  timeoutMs?: number;
}

const CLAUDE_MODEL = "haiku";
const CODEX_MODEL = "gpt-6-luna";
const MAX_PARALLEL = 4;
const SYSTEM = "You are a precise assistant inside an HR knowledge tool. Answer directly with no preamble.";

let active = 0;
const queue: (() => void)[] = [];

async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_PARALLEL) await new Promise<void>((r) => queue.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    queue.shift()?.();
  }
}

function run(cmd: string, args: string[], timeoutMs: number, cwd = os.tmpdir()): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"], env: process.env });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${cmd} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`${cmd} exited ${code}: ${err.slice(-400) || out.slice(-400)}`));
    });
  });
}

async function viaClaude(prompt: string, timeoutMs: number): Promise<{ text: string; model: string }> {
  // --setting-sources "" skips user/project settings (hooks, plugins); disabling thinking cuts latency from ~5s to ~2.5s.
  const raw = await run(
    "claude",
    [
      "-p",
      "--model", CLAUDE_MODEL,
      "--tools", "",
      "--no-session-persistence",
      "--setting-sources", "",
      "--settings", '{"alwaysThinkingEnabled":false}',
      "--strict-mcp-config",
      "--disable-slash-commands",
      "--system-prompt", SYSTEM,
      "--output-format", "json",
      prompt,
    ],
    timeoutMs,
  );
  const res = JSON.parse(raw) as { result?: string; is_error?: boolean; modelUsage?: Record<string, unknown> };
  if (res.is_error || typeof res.result !== "string") throw new Error(`claude error: ${raw.slice(0, 300)}`);
  return { text: res.result, model: Object.keys(res.modelUsage ?? {})[0] ?? `claude-${CLAUDE_MODEL}` };
}

async function viaCodex(prompt: string, timeoutMs: number): Promise<{ text: string; model: string }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "janitor-codex-"));
  const outFile = path.join(dir, "last.txt");
  try {
    await run(
      "codex",
      [
        "exec",
        "--skip-git-repo-check",
        "--ephemeral",
        "--sandbox", "read-only",
        "--ignore-rules",
        "-m", CODEX_MODEL,
        "-c", 'model_reasoning_effort="low"',
        "-o", outFile,
        `${SYSTEM}\n\n${prompt}`,
      ],
      timeoutMs,
      dir,
    );
    return { text: await readFile(outFile, "utf8"), model: CODEX_MODEL };
  } finally {
    rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function cleanJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.search(/[[{]/);
  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

export function complete(prompt: string, opts: CompleteOpts = {}): Promise<Completion> {
  const timeoutMs = opts.timeoutMs ?? 25_000;
  const full = opts.json ? `${prompt}\n\nRespond with valid JSON only, no code fences, no commentary.` : prompt;
  return limited(async () => {
    const t0 = Date.now();
    let res: { text: string; model: string };
    try {
      res = await viaClaude(full, timeoutMs);
    } catch (err) {
      console.warn("[llm] claude failed, falling back to codex:", (err as Error).message);
      res = await viaCodex(full, Math.max(1000, timeoutMs - (Date.now() - t0)));
    }
    const text = opts.json ? cleanJson(res.text) : res.text.trim();
    return { text, model: res.model, latencyMs: Date.now() - t0 };
  });
}
