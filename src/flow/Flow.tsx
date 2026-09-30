"use client";

import { AnimatePresence, motion } from "motion/react";
import { type Step, useJanitor } from "@/lib/store";
import { Sidebar } from "./shell/Sidebar";
import { useJanitorLoop } from "./janitor/loop";
import JanitorPage from "./pages/JanitorPage";
import SearchPage from "./pages/SearchPage";
import AgentPage from "./pages/AgentPage";
import ConnectorsPage from "./pages/ConnectorsPage";
import RulesPage from "./pages/RulesPage";

const VIEW: Record<Step, () => React.ReactNode> = {
  janitor: JanitorPage,
  search: SearchPage,
  agent: AgentPage,
  connectors: ConnectorsPage,
  rules: RulesPage,
};

export function Flow() {
  const { step } = useJanitor();
  useJanitorLoop();
  // Old saved state or links can still carry a removed step name such as "health".
  const View = VIEW[step] ?? JanitorPage;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 h-screen overflow-y-auto bg-bg">
        <AnimatePresence mode="wait">
          <motion.main
            key={step}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-full max-w-[1200px] mx-auto px-10 pt-9 pb-8"
          >
            <View />
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}
