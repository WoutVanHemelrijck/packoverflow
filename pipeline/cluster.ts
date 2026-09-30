export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);

function normalise(v: number[]): number[] {
  const n = Math.sqrt(dot(v, v)) || 1;
  return v.map((x) => x / n);
}

export function meanVector(vs: number[][]): number[] {
  const out = new Array(vs[0].length).fill(0);
  for (const v of vs) v.forEach((x, i) => (out[i] += x));
  return normalise(out);
}

// Spherical k-means (cosine) with k-means++ seeding; returns the best of several restarts by inertia.
export function kmeans(X: number[][], k: number, rand: () => number, restarts = 12): number[] {
  let best: { labels: number[]; score: number } | null = null;
  for (let r = 0; r < restarts; r++) {
    const centers: number[][] = [X[Math.floor(rand() * X.length)]];
    while (centers.length < k) {
      const d = X.map((x) => Math.min(...centers.map((c) => 1 - dot(x, c))) ** 2);
      const total = d.reduce((s, x) => s + x, 0);
      let t = rand() * total;
      let i = 0;
      while (i < d.length - 1 && (t -= d[i]) > 0) i++;
      centers.push(X[i]);
    }
    let labels = new Array(X.length).fill(-1);
    for (let iter = 0; iter < 50; iter++) {
      const next = X.map((x) => {
        let bi = 0;
        let bs = -Infinity;
        centers.forEach((c, j) => {
          const s = dot(x, c);
          if (s > bs) [bs, bi] = [s, j];
        });
        return bi;
      });
      const changed = next.some((l, i) => l !== labels[i]);
      labels = next;
      for (let j = 0; j < k; j++) {
        const members = X.filter((_, i) => labels[i] === j);
        if (members.length) centers[j] = meanVector(members);
      }
      if (!changed) break;
    }
    const score = X.reduce((s, x, i) => s + dot(x, centers[labels[i]]), 0);
    if (!best || score > best.score) best = { labels, score };
  }
  return best!.labels;
}

export function silhouette(X: number[][], labels: number[]): number {
  const k = Math.max(...labels) + 1;
  let total = 0;
  for (let i = 0; i < X.length; i++) {
    const sums = new Array(k).fill(0);
    const counts = new Array(k).fill(0);
    for (let j = 0; j < X.length; j++) {
      if (i === j) continue;
      sums[labels[j]] += 1 - dot(X[i], X[j]);
      counts[labels[j]]++;
    }
    const own = labels[i];
    if (!counts[own]) continue;
    const a = sums[own] / counts[own];
    let b = Infinity;
    for (let c = 0; c < k; c++) if (c !== own && counts[c]) b = Math.min(b, sums[c] / counts[c]);
    total += (b - a) / Math.max(a, b);
  }
  return total / X.length;
}
