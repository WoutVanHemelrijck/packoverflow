import type { ActionKind, Channel, ConnectorId, Country, IssueKind, Lang } from "./types";

export const CHANNEL_LABEL: Record<Channel, string> = {
  legal: "Legal text",
  policy: "Policy",
  procedure: "Procedure",
  faq: "FAQ",
  slides: "Slide deck",
  email: "Email",
  teams: "Teams chat",
};

export const CONNECTOR_LABEL: Record<ConnectorId, string> = {
  sharepoint: "SharePoint",
  teams: "Microsoft Teams",
  outlook: "Outlook",
  onedrive: "OneDrive",
  confluence: "Confluence",
  mysdworx: "mysdworx Documents",
};

export const LANG_LABEL: Record<Lang, string> = { nl: "NL", fr: "FR", en: "EN" };

export const COUNTRY_LABEL: Record<Country, string> = { BE: "Belgium", NL: "Netherlands", FR: "France", LU: "Luxembourg" };

export const ISSUE_LABEL: Record<IssueKind, string> = {
  conflict: "Conflicting claims",
  duplicate: "Duplicates",
  stale: "Past review date",
  orphan: "No owner",
  scope: "Wrong country",
};

export const ACTION_LABEL: Record<ActionKind, string> = {
  archive: "Archive",
  assign_owner: "Assign owner",
  notify_owner: "Ask owner to review",
  tag_scope: "Tag country scope",
  settle: "Settle claim",
};
