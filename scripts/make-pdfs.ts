import { mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";
import type { ConnectorId, CorpusData, SourceDoc } from "../src/lib/types";

const ROOT = join(__dirname, "..");
const PDF_DIR = join(ROOT, "public/pdfs");
const A4: [number, number] = [595.28, 841.89];
const A4_LANDSCAPE: [number, number] = [841.89, 595.28];
const M = 50;

const hex = (h: string): RGB => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const INK = hex("#1b2230");
const GREY = hex("#6b7280");
const RULE = hex("#d5d9e0");
const FILL = hex("#f2f4f7");

const BRAND: Record<ConnectorId, { name: string; color: RGB }> = {
  sharepoint: { name: "SharePoint", color: hex("#036c70") },
  teams: { name: "Microsoft Teams", color: hex("#4b53bc") },
  outlook: { name: "Outlook", color: hex("#0f6cbd") },
  onedrive: { name: "OneDrive", color: hex("#0364b8") },
  confluence: { name: "Confluence", color: hex("#1868db") },
  mysdworx: { name: "mysdworx Documents", color: hex("#c8102e") },
};
const LANG_NAME = { nl: "Dutch", fr: "French", en: "English" };
const COUNTRY_NAME = { BE: "Belgium", NL: "Netherlands", FR: "France", LU: "Luxembourg" };

interface Fonts { reg: PDFFont; bold: PDFFont }

const encodable = new Map<string, boolean>();
function safe(font: PDFFont, text: string): string {
  let out = "";
  for (const ch of text) {
    if (!encodable.has(ch)) {
      try { font.encodeText(ch); encodable.set(ch, true); } catch { encodable.set(ch, false); }
    }
    out += encodable.get(ch) ? ch : ch.normalize("NFD").replace(/[^\x20-\x7e]/g, "") || "?";
  }
  return out;
}

function wrap(font: PDFFont, size: number, text: string, width: number): string[] {
  const lines: string[] = [];
  for (const raw of text.split("\n")) {
    let line = "";
    for (const word of safe(font, raw).split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) { lines.push(line); line = word; } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

class Writer {
  page!: PDFPage;
  y = 0;
  constructor(private pdf: PDFDocument, private f: Fonts, private doc: SourceDoc, private size: [number, number]) {}

  newPage(withBand: boolean) {
    this.page = this.pdf.addPage(this.size);
    const [w, h] = this.size;
    const band = BRAND[this.doc.connector];
    if (withBand) {
      this.page.drawRectangle({ x: 0, y: h - 46, width: w, height: 46, color: band.color });
      this.page.drawText(band.name, { x: M, y: h - 29, size: 11, font: this.f.bold, color: rgb(1, 1, 1) });
      const path = safe(this.f.reg, this.doc.path);
      const pw = this.f.reg.widthOfTextAtSize(path, 9);
      this.page.drawText(path, { x: w - M - pw, y: h - 28, size: 9, font: this.f.reg, color: rgb(1, 1, 1) });
      this.y = h - 80;
    } else {
      this.page.drawRectangle({ x: 0, y: h - 6, width: w, height: 6, color: band.color });
      this.y = h - 50;
    }
  }

  ensure(height: number) {
    if (this.y - height < 60) this.newPage(false);
  }

  text(text: string, opts: { size?: number; bold?: boolean; color?: RGB; indent?: number; leading?: number; after?: number } = {}) {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.f.bold : this.f.reg;
    const leading = opts.leading ?? size * 1.45;
    const indent = opts.indent ?? 0;
    const width = this.size[0] - 2 * M - indent;
    for (const line of wrap(font, size, text, width)) {
      this.ensure(leading);
      this.page.drawText(line, { x: M + indent, y: this.y - size, size, font, color: opts.color ?? INK });
      this.y -= leading;
    }
    this.y -= opts.after ?? 0;
  }

  metaTable() {
    const d = this.doc;
    const people = peopleById;
    const rows: [string, string, string, string][] = [
      ["Owner", d.ownerId ? people.get(d.ownerId)! : "No owner", "Author", people.get(d.authorId)!],
      ["Updated", d.updatedAt, "Effective date", d.effectiveDate ?? "Not stated"],
      ["Country", COUNTRY_NAME[d.country], "Language", LANG_NAME[d.lang]],
      ["Document ID", d.id, "Review by", d.reviewBy ?? "Not reviewed"],
    ];
    const w = this.size[0] - 2 * M;
    const colW = [w * 0.16, w * 0.34, w * 0.16, w * 0.34];
    const rowH = 18;
    for (const row of rows) {
      let x = M;
      row.forEach((cell, i) => {
        const isLabel = i % 2 === 0;
        this.page.drawRectangle({
          x, y: this.y - rowH, width: colW[i], height: rowH,
          color: isLabel ? FILL : rgb(1, 1, 1), borderColor: RULE, borderWidth: 0.6,
        });
        const noOwner = cell === "No owner";
        this.page.drawText(safe(this.f.reg, cell), {
          x: x + 6, y: this.y - 12.5, size: 8.5, font: isLabel || noOwner ? this.f.bold : this.f.reg,
          color: isLabel ? GREY : noOwner ? hex("#b42318") : INK,
        });
        x += colW[i];
      });
      this.y -= rowH;
    }
    this.y -= 20;
  }

  headerBox(lines: string[]) {
    const size = 9.5, leading = 14;
    const h = lines.length * leading + 14;
    this.ensure(h);
    const w = this.size[0] - 2 * M;
    this.page.drawRectangle({ x: M, y: this.y - h, width: w, height: h, color: FILL, borderColor: RULE, borderWidth: 0.6 });
    let y = this.y - 7;
    for (const line of lines) {
      const i = line.indexOf(":");
      const label = i > 0 ? line.slice(0, i + 1) : "";
      const rest = i > 0 ? line.slice(i + 1) : line;
      if (label) this.page.drawText(safe(this.f.bold, label), { x: M + 8, y: y - size, size, font: this.f.bold, color: GREY });
      this.page.drawText(safe(this.f.reg, rest.trim()), { x: M + 8 + (label ? 62 : 0), y: y - size, size, font: this.f.reg, color: INK });
      y -= leading;
    }
    this.y -= h + 16;
  }
}

let peopleById = new Map<string, string>();

function renderDocument(w: Writer, doc: SourceDoc) {
  w.newPage(true);
  w.text(doc.title, { size: 17, bold: true, leading: 22, after: 10 });
  w.metaTable();
  const paras = doc.body.split("\n\n");
  if (doc.channel === "email") {
    w.headerBox(paras[0].split("\n"));
    for (const p of paras.slice(1)) {
      const quoted = p.startsWith(">");
      w.text(p, { color: quoted ? GREY : INK, indent: quoted ? 10 : 0, after: 8 });
    }
    return;
  }
  if (doc.channel === "teams") {
    w.headerBox(paras[0].split("\n"));
    for (const line of paras.slice(1).join("\n").split("\n")) {
      const m = line.match(/^\[(\d\d:\d\d)\] ([^:]+): (.*)$/);
      if (!m) { w.text(line); continue; }
      w.ensure(34);
      w.text(`${m[2]}   ${m[1]}`, { size: 9, bold: true, color: BRAND.teams.color, leading: 13 });
      w.text(m[3], { indent: 0, after: 9 });
    }
    return;
  }
  for (const p of paras) {
    const m = p.match(/^([A-Z][\p{L} -]{2,30}\.) (.*)$/su);
    if (m && m[1].split(" ").length <= 4) {
      w.ensure(40);
      w.text(m[1].replace(/\.$/, ""), { size: 10.5, bold: true, leading: 15 });
      w.text(m[2], { after: 9 });
    } else w.text(p, { after: 9 });
  }
}

function renderSlides(w: Writer, doc: SourceDoc, f: Fonts) {
  w.newPage(true);
  w.y -= 40;
  w.text(doc.title, { size: 26, bold: true, leading: 32, after: 18 });
  w.metaTable();
  for (const p of doc.body.split("\n\n")) {
    const m = p.match(/^Slide (\d+)\. (.*)$/s);
    w.newPage(true);
    const page = w.page;
    const [width, height] = A4_LANDSCAPE;
    page.drawText(`${m ? m[1] : ""}`, { x: M, y: height - 120, size: 64, font: f.bold, color: FILL });
    w.y = height - 150;
    w.text(m ? m[2] : p, { size: 24, bold: m?.[1] === "1", leading: 32 });
    page.drawLine({ start: { x: M, y: 70 }, end: { x: width - M, y: 70 }, thickness: 0.6, color: RULE });
  }
}

export async function makePdfs(corpus: CorpusData) {
  peopleById = new Map(corpus.people.map((p) => [p.id, `${p.name}, ${p.team}`]));
  mkdirSync(PDF_DIR, { recursive: true });
  const keep = new Set(corpus.docs.map((d) => d.fileName));
  for (const f of readdirSync(PDF_DIR)) if (f.endsWith(".pdf") && !keep.has(f)) unlinkSync(join(PDF_DIR, f));

  for (const doc of corpus.docs) {
    const pdf = await PDFDocument.create();
    const f: Fonts = { reg: await pdf.embedFont(StandardFonts.Helvetica), bold: await pdf.embedFont(StandardFonts.HelveticaBold) };
    const author = corpus.people.find((p) => p.id === doc.authorId)!.name;
    pdf.setTitle(safe(f.reg, doc.title));
    pdf.setAuthor(safe(f.reg, author));
    pdf.setCreator(BRAND[doc.connector].name);
    pdf.setProducer("SD Worx document export");
    pdf.setCreationDate(new Date(doc.createdAt + "T09:00:00Z"));
    pdf.setModificationDate(new Date(doc.updatedAt + "T09:00:00Z"));

    const slides = doc.channel === "slides";
    const w = new Writer(pdf, f, doc, slides ? A4_LANDSCAPE : A4);
    if (slides) renderSlides(w, doc, f); else renderDocument(w, doc);

    const pages = pdf.getPages();
    pages.forEach((page, i) => {
      const { width } = page.getSize();
      const label = `${doc.id}, page ${i + 1} of ${pages.length}`;
      page.drawText(label, { x: width - M - f.reg.widthOfTextAtSize(label, 8), y: 32, size: 8, font: f.reg, color: GREY });
      page.drawText(safe(f.reg, doc.fileName), { x: M, y: 32, size: 8, font: f.reg, color: GREY });
    });

    const bytes = await pdf.save({ useObjectStreams: false });
    writeFileSync(join(PDF_DIR, doc.fileName), bytes);
    doc.pages = pages.length;
    doc.sizeKb = Math.max(1, Math.round(bytes.length / 1024));
  }
  console.log(`wrote ${corpus.docs.length} PDFs to ${PDF_DIR}`);
}

if (process.argv[1]?.endsWith("make-pdfs.ts")) {
  const file = join(ROOT, "src/data/corpus.json");
  const corpus = JSON.parse(readFileSync(file, "utf8")) as CorpusData;
  makePdfs(corpus).then(() => writeFileSync(file, JSON.stringify(corpus, null, 2) + "\n"));
}
