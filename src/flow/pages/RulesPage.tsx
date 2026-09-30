"use client";

import { PageTitle } from "@/flow/shell/PageTitle";
import { Rules } from "@/flow/setup/Rules";

export default function RulesPage() {
  return (
    <div>
      <PageTitle title="Rules" sub="Reorder or switch off an article and every verdict in the janitor updates at once." />
      <div className="max-w-[760px]">
        <Rules />
      </div>
    </div>
  );
}
