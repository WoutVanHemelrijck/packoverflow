"use client";

import { ArrowRight, Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import { useJanitor } from "@/lib/store";
import { JanitorAvatar } from "@/flow/ui";
import { PageTitle } from "@/flow/shell/PageTitle";
import { Sources } from "@/flow/setup/Sources";

function JanitorHint() {
  const { sources, processed, setStep } = useJanitor();
  const queued = useMemo(() => {
    const done = new Set(processed);
    return new Set(sources.map((s) => s.docId).filter((d): d is string => !!d && !done.has(d))).size;
  }, [sources, processed]);
  if (!sources.length) return null;
  return (
    <AnimatePresence mode="wait">
      <motion.button
        key={queued ? "busy" : "idle"}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        onClick={() => setStep("janitor")}
        className="h-9 pl-2.5 pr-3 rounded-full border border-line bg-canvas hover:bg-canvas-2 flex items-center gap-2 text-[13px] cursor-pointer"
      >
        {queued ? <JanitorAvatar size={18} className="animate-pulse" /> : <Check size={15} className="text-settled" strokeWidth={2.5} />}
        <span className="text-ink-2">{queued ? `The janitor is cleaning ${queued} new ${queued === 1 ? "file" : "files"}` : `All ${sources.length} files are clean`}</span>
        <ArrowRight size={14} className="text-muted" />
      </motion.button>
    </AnimatePresence>
  );
}

export default function ConnectorsPage() {
  return (
    <div>
      <PageTitle title="Connectors" sub="Connect where your knowledge lives. The janitor cleans every new file on its own." actions={<JanitorHint />} />
      <Sources />
    </div>
  );
}
