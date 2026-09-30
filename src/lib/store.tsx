"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { corpus } from "./data";
import { DEFAULT_RULES, runJanitor } from "./janitor";
import type { ConnectorId, HumanDecision, JanitorResult, RulesConfig } from "./types";

export const CURRENT_USER = { name: "Lotte Peeters", initials: "LP", role: "Knowledge lead, Payroll BE" };

export const STEPS = ["janitor", "search", "agent", "connectors", "rules"] as const;
export type Step = (typeof STEPS)[number];

export interface SourceFile {
  name: string;
  sizeKb: number;
  docId: string | null; // matched corpus doc by file name; null = file outside the demo set
  origin: "upload" | "connector";
  connector?: ConnectorId;
}

interface JanitorState {
  step: Step;
  sources: SourceFile[];
  imported: boolean;
  janitorRan: boolean; // analyse step finished
  rules: RulesConfig;
  decisions: HumanDecision[];
  appliedActionIds: string[];
  reviewed: string[]; // claim ids a person has looked at and confirmed; raises certainty
  processed: string[]; // doc ids the janitor has already cleaned; connected docs not in here are the queue
  sourceDialog: boolean; // the "Add source" dialog is open
}

interface JanitorStore extends JanitorState {
  result: JanitorResult;
  setStep: (s: Step) => void;
  addSources: (files: SourceFile[]) => void;
  removeSource: (name: string) => void;
  addDemoSources: (connector?: ConnectorId) => void;
  setImported: (v: boolean) => void;
  setJanitorRan: (v: boolean) => void;
  setRules: (r: RulesConfig) => void;
  decide: (d: Omit<HumanDecision, "by" | "at">) => void;
  undoDecision: (claimId: string) => void;
  applyActions: (ids: string[]) => void;
  undoAction: (id: string) => void;
  review: (claimId: string) => void;
  markProcessed: (docIds: string[]) => void;
  setSourceDialog: (open: boolean) => void;
  reset: () => void;
}

const KEY = "pack-overflow-datalayer-v3";
const INITIAL: JanitorState = {
  step: "janitor",
  sources: [],
  imported: false,
  janitorRan: false,
  rules: DEFAULT_RULES,
  decisions: [],
  appliedActionIds: [],
  reviewed: [],
  processed: [],
  sourceDialog: false,
};

export function demoSources(connector?: ConnectorId): SourceFile[] {
  return corpus.docs
    .filter((d) => !connector || d.connector === connector)
    .map((d) => ({ name: d.fileName, sizeKb: d.sizeKb, docId: d.id, origin: "connector" as const, connector: d.connector }));
}

const Ctx = createContext<JanitorStore | null>(null);

export function JanitorProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<JanitorState>(INITIAL);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let next = INITIAL;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw && !params.has("reset")) next = { ...INITIAL, ...JSON.parse(raw) };
    } catch {}
    // Presenter shortcuts, applied after hydration so stored state cannot overwrite them:
    // ?demo connects every demo source (files queued), ?clean also marks them processed, ?step=<view> opens a view.
    const asked = params.get("step");
    const wanted = (asked === "setup" ? "connectors" : asked) as Step | null;
    const clean = params.has("clean") || wanted === "search" || wanted === "agent";
    if ((params.has("demo") || clean) && next.sources.length === 0) next = { ...next, sources: demoSources() };
    if (clean) next = { ...next, processed: next.sources.map((f) => f.docId).filter((d): d is string => !!d), janitorRan: true };
    if (wanted && STEPS.includes(wanted)) next = { ...next, step: wanted };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate once from localStorage after mount
    setState(next);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  }, [state, loaded]);

  const result = useMemo(
    () => runJanitor(corpus, state.rules, state.decisions, state.appliedActionIds),
    [state.rules, state.decisions, state.appliedActionIds],
  );

  const setStep = useCallback((step: Step) => setState((s) => ({ ...s, step })), []);
  const addSources = useCallback(
    (files: SourceFile[]) =>
      setState((s) => {
        const seen = new Set(s.sources.map((f) => f.name));
        return { ...s, sources: [...s.sources, ...files.filter((f) => !seen.has(f.name))] };
      }),
    [],
  );
  const removeSource = useCallback(
    (name: string) => setState((s) => ({ ...s, sources: s.sources.filter((f) => f.name !== name) })),
    [],
  );
  const addDemoSources = useCallback((connector?: ConnectorId) => addSources(demoSources(connector)), [addSources]);
  const setImported = useCallback((v: boolean) => setState((s) => ({ ...s, imported: v })), []);
  const setJanitorRan = useCallback((v: boolean) => setState((s) => ({ ...s, janitorRan: v })), []);
  const setRules = useCallback((r: RulesConfig) => setState((s) => ({ ...s, rules: r })), []);
  const decide = useCallback(
    (d: Omit<HumanDecision, "by" | "at">) =>
      setState((s) => ({
        ...s,
        decisions: [
          ...s.decisions.filter((x) => x.claimId !== d.claimId),
          { ...d, by: CURRENT_USER.name, at: new Date().toISOString() },
        ],
      })),
    [],
  );
  const undoDecision = useCallback(
    (claimId: string) => setState((s) => ({ ...s, decisions: s.decisions.filter((x) => x.claimId !== claimId) })),
    [],
  );
  const applyActions = useCallback(
    (ids: string[]) =>
      setState((s) => ({ ...s, appliedActionIds: [...new Set([...s.appliedActionIds, ...ids])] })),
    [],
  );
  const undoAction = useCallback(
    (id: string) => setState((s) => ({ ...s, appliedActionIds: s.appliedActionIds.filter((x) => x !== id) })),
    [],
  );
  const review = useCallback(
    (claimId: string) => setState((s) => (s.reviewed.includes(claimId) ? s : { ...s, reviewed: [...s.reviewed, claimId] })),
    [],
  );
  const markProcessed = useCallback(
    (docIds: string[]) => setState((s) => ({ ...s, processed: [...new Set([...s.processed, ...docIds])] })),
    [],
  );
  const setSourceDialog = useCallback((open: boolean) => setState((s) => ({ ...s, sourceDialog: open })), []);
  const reset = useCallback(() => setState(INITIAL), []);

  const value = useMemo<JanitorStore>(
    () => ({
      ...state,
      result,
      setStep,
      addSources,
      removeSource,
      addDemoSources,
      setImported,
      setJanitorRan,
      setRules,
      decide,
      undoDecision,
      applyActions,
      undoAction,
      review,
      markProcessed,
      setSourceDialog,
      reset,
    }),
    [state, result, setStep, addSources, removeSource, addDemoSources, setImported, setJanitorRan, setRules, decide, undoDecision, applyActions, undoAction, review, markProcessed, setSourceDialog, reset],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useJanitor(): JanitorStore {
  const v = useContext(Ctx);
  if (!v) throw new Error("useJanitor must be used inside JanitorProvider");
  return v;
}
