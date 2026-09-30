"use client";

import { Check, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { corpus } from "@/lib/data";
import { CONNECTOR_LABEL } from "@/lib/labels";
import { type SourceFile, useJanitor } from "@/lib/store";
import type { ConnectorId, SourceDoc } from "@/lib/types";
import { Button, cn, ConnectorIcon, PdfIcon, ProgressBar } from "@/flow/ui";
import { type DriveFile, DriveConnectedBanner, GoogleDriveCard } from "@/flow/sources/GoogleDriveConnect";

export const CONNECTORS: ConnectorId[] = ["sharepoint", "teams", "outlook", "onedrive", "confluence", "mysdworx"];

const DESCRIPTION: Record<ConnectorId, string> = {
  sharepoint: "Policies and procedures",
  teams: "Answers in channels and chats",
  outlook: "Circulars in shared mailboxes",
  onedrive: "Working files and copies",
  confluence: "Team wikis and how-tos",
  mysdworx: "Client docs and payroll guides",
};

const SYNC_MS = 1400;

const docByFile = new Map<string, SourceDoc>(corpus.docs.map((d) => [d.fileName, d]));
const docCount = Object.fromEntries(CONNECTORS.map((id) => [id, corpus.docs.filter((d) => d.connector === id).length])) as Record<ConnectorId, number>;

function toSource(file: File): SourceFile {
  return { name: file.name, sizeKb: Math.max(1, Math.round(file.size / 1024)), docId: docByFile.get(file.name)?.id ?? null, origin: "upload" };
}

export function Sources() {
  const { sources, addSources, addDemoSources } = useJanitor();
  const input = useRef<HTMLInputElement>(null);
  const [syncing, setSyncing] = useState<Partial<Record<ConnectorId, number>>>({});
  const [now, setNow] = useState(0);

  const connected = useMemo(() => {
    const c = {} as Record<ConnectorId, number>;
    for (const s of sources) if (s.origin === "connector" && s.connector) c[s.connector] = (c[s.connector] ?? 0) + 1;
    return c;
  }, [sources]);
  const uploads = sources.filter((s) => s.origin === "upload").length;

  const active = Object.keys(syncing).length > 0;
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      const t = performance.now();
      setNow(t);
      const done = (Object.entries(syncing) as [ConnectorId, number][]).filter(([, start]) => t - start >= SYNC_MS);
      if (done.length) {
        done.forEach(([id]) => addDemoSources(id));
        setSyncing((s) => {
          const next = { ...s };
          done.forEach(([id]) => delete next[id]);
          return next;
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, syncing, addDemoSources]);

  const connect = (id: ConnectorId, delay = 0) => setSyncing((s) => (s[id] !== undefined ? s : { ...s, [id]: performance.now() + delay }));
  const pending = CONNECTORS.filter((id) => !connected[id] && syncing[id] === undefined);

  // PDFs listed from a real Google Drive; the ones from the demo set are recognised by name.
  const addDriveFiles = (files: DriveFile[]) =>
    addSources(files.map((f) => ({ name: f.name, sizeKb: Math.max(1, Math.round(f.size / 1024)), docId: docByFile.get(f.name)?.id ?? null, origin: "connector" as const })));

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    addSources([...files].filter((f) => f.name.toLowerCase().endsWith(".pdf")).map(toSource));
  };

  return (
    <section>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-[17px] font-medium tracking-[-0.02em]">Sources</h2>
          <p className="text-[13px] text-muted">The janitor reads every file it can reach.</p>
        </div>
        {pending.length > 0 && (
          <Button variant="ghost" size="sm" className="-mt-1" onClick={() => pending.forEach((id, i) => connect(id, i * 200))}>
            Connect all
          </Button>
        )}
      </div>

      <DriveConnectedBanner />
      <div className="grid grid-cols-3 gap-3">
        <GoogleDriveCard onFiles={addDriveFiles} />
        {CONNECTORS.map((id) => {
          const start = syncing[id];
          const count = connected[id];
          const progress = start === undefined ? 0 : Math.max(0, Math.min(1, (now - start) / SYNC_MS));
          return (
            <div key={id} className={cn("rounded-xl border bg-bg p-4 flex flex-col h-[148px] transition-colors", count ? "border-settled/40" : "border-line")}>
              <div className="flex items-center gap-2.5">
                <ConnectorIcon id={id} size={28} />
                <div className="text-[14px] font-medium tracking-[-0.01em] leading-tight">{CONNECTOR_LABEL[id]}</div>
              </div>
              <div className="mt-2 text-[12px] text-muted leading-snug">{DESCRIPTION[id]}</div>
              <div className="mt-auto">
                {count ? (
                  <div className="h-8 flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-1.5 text-settled font-medium">
                      <span className="w-4 h-4 rounded-full bg-settled text-white grid place-items-center">
                        <Check size={10} strokeWidth={3} />
                      </span>
                      Connected
                    </span>
                    <span className="tabular-nums text-muted">{count} files</span>
                  </div>
                ) : start !== undefined ? (
                  <div className="h-8 flex flex-col justify-center gap-1.5">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-ink-2">Syncing</span>
                      <span className="tabular-nums text-muted">
                        {Math.round(progress * docCount[id])} / {docCount[id]} files
                      </span>
                    </div>
                    <ProgressBar value={progress * 100} className="[&>div]:transition-none" />
                  </div>
                ) : (
                  <Button variant="secondary" size="sm" className="w-full" onClick={() => connect(id)}>
                    Connect
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
        className="mt-3 w-full rounded-xl border border-dashed border-line-strong bg-canvas hover:bg-canvas-2 transition-colors px-4 py-3.5 flex items-center gap-3 text-left cursor-pointer"
      >
        <PdfIcon />
        <div className="flex-1">
          <div className="text-[14px] font-medium">Upload PDFs</div>
          <div className="text-[12px] text-muted">Drop files here or pick them from your computer</div>
        </div>
        {uploads ? (
          <span className="flex items-center gap-1.5 text-[13px] text-settled font-medium">
            <Check size={14} strokeWidth={3} /> {uploads} files uploaded
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-line-strong bg-bg text-[13px] font-medium">
            <Upload size={14} /> Choose files
          </span>
        )}
      </button>
    </section>
  );
}
