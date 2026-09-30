import { embed, loadDocIndex, MODEL_ID, nearestDocs } from "@/lib/embed";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let text = "";
  try {
    text = String(((await req.json()) as { text?: unknown }).text ?? "").trim();
  } catch {}
  if (!text) return Response.json({ error: "Missing text" }, { status: 400 });

  try {
    const [[vec], index] = await Promise.all([embed([text]), loadDocIndex()]);
    const neighbors = nearestDocs(index, vec, 8);
    const pointById = new Map(index.points.map((p) => [p.docId, p]));
    let wx = 0;
    let wy = 0;
    let w = 0;
    for (const n of neighbors.slice(0, 5)) {
      const p = pointById.get(n.docId);
      const weight = Math.max(n.score, 0) ** 2;
      if (!p || !weight) continue;
      wx += p.x * weight;
      wy += p.y * weight;
      w += weight;
    }
    return Response.json({
      x: w ? wx / w : 500,
      y: w ? wy / w : 500,
      neighbors: neighbors.map((n) => ({ docId: n.docId, score: Math.round(n.score * 1000) / 1000 })),
      model: MODEL_ID,
    });
  } catch (err) {
    console.error("[api/embed]", err);
    return Response.json({ error: "Embedding failed" }, { status: 503 });
  }
}
