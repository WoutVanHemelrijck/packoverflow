"use client";

import clsx from "clsx";
import { ArrowRight, BookOpen, Cloud, FolderLock, Mail, MessagesSquare, Share2 } from "lucide-react";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { corpus } from "@/lib/data";
import type { ConnectorId } from "@/lib/types";

export { clsx as cn };

// ---------- buttons ----------

type ButtonVariant = "primary" | "secondary" | "ghost" | "agent";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-ink text-white hover:bg-ink-2",
  secondary: "bg-bg text-ink border border-line-strong hover:bg-canvas",
  ghost: "text-ink-2 hover:bg-canvas",
  agent: "bg-agent text-white hover:brightness-110",
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-md",
  md: "h-10 px-4 text-[14px] gap-2 rounded-lg",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-agent",
        BUTTON_VARIANT[variant],
        BUTTON_SIZE[size],
        className,
      )}
      {...props}
    />
  );
}

// ---------- surfaces ----------

/* White card with a hairline border. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("bg-bg border border-line rounded-xl shadow-card", className)} {...props} />;
}

/* Light-gray canvas panel that frames product UI, like the hero panels on the reference site. */
export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("bg-canvas border border-line rounded-2xl", className)} {...props} />;
}

// ---------- text ----------

/* Small gray section label with an arrow: "Sources ->". */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex items-center gap-1.5 text-[13px] text-muted", className)}>
      {children} <ArrowRight size={13} />
    </div>
  );
}

/* Two-tone headline: gray lead-in, black emphasis. <Headline lead="Add your">sources</Headline> */
export function Headline({ lead, children, className }: { lead?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <h1 className={clsx("headline text-[44px]", className)}>
      {lead && <span className="text-faint">{lead} </span>}
      {children}
    </h1>
  );
}

export function StepHeader({ label, lead, title, sub, actions }: { label: string; lead?: ReactNode; title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-10 mb-8">
      <div className="max-w-[880px]">
        <SectionLabel className="mb-4">{label}</SectionLabel>
        <Headline lead={lead}>{title}</Headline>
        {sub && <p className="mt-4 text-[16px] text-muted leading-relaxed max-w-[600px]">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2.5 flex-none pb-1">{actions}</div>}
    </div>
  );
}

/* Big light number with a label above and caption below. */
export function Stat({ label, value, caption, className }: { label: string; value: ReactNode; caption?: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-[13px] text-muted mb-2">{label}</div>
      <div className="stat text-[56px]">{value}</div>
      {caption && <div className="text-[14px] text-muted mt-2">{caption}</div>}
    </div>
  );
}

// ---------- badges & bits ----------

export type Tone = "neutral" | "agent" | "settled" | "conflict" | "warn" | "ink";

const BADGE_TONE: Record<Tone, string> = {
  neutral: "bg-canvas text-ink-2 border border-line",
  agent: "bg-agent-soft text-agent",
  settled: "bg-settled-soft text-settled",
  conflict: "bg-conflict-soft text-conflict",
  warn: "bg-warn-soft text-warn",
  ink: "bg-ink text-white",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-medium whitespace-nowrap", BADGE_TONE[tone], className)}>
      {children}
    </span>
  );
}

export function ProgressBar({ value, color = "var(--ink)", className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={clsx("h-1.5 rounded-full bg-canvas-2 overflow-hidden", className)}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="num text-[11px] px-1.5 py-0.5 rounded border border-line bg-bg text-muted">{children}</kbd>;
}

const GHOST_BODY =
  "M14 4c5.2 0 8.6 3.7 8.6 8.9v11.6c0 1.4-1.4 2.1-2.4 1.3l-1.3-1-1.6 1.5a1.4 1.4 0 0 1-1.9 0L14 24.7l-1.4 1.6a1.4 1.4 0 0 1-1.9 0l-1.6-1.5-1.3 1c-1 .8-2.4.1-2.4-1.3V12.9C5.4 7.7 8.8 4 14 4Z";

/* The janitor: a violet ghost holding a broom. The mascot next to anything the agent did or says, and the logo. */
export function JanitorAvatar({ size = 28, color = "var(--agent)", sparkle = false, className }: { size?: number; color?: string; sparkle?: boolean; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M28.5 3.5 19 22" stroke="#0b0b0c" strokeWidth="1.9" strokeLinecap="round" />
      <path d={GHOST_BODY} fill={color} />
      <path d="M21.6 15.2c1.5-.5 2.6 0 3.1 1" stroke={color} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d="M17.3 20.2l5.6 2.6-3 6.6-6.6-3.1Z" fill="#f5a524" />
      <path d="M16.6 23.7l3.8 1.8M15.6 25.8l3.6 1.7" stroke="#b45309" strokeWidth=".9" strokeLinecap="round" />
      <ellipse cx="11.2" cy="12.6" rx="1.9" ry="2.4" fill="#fff" />
      <ellipse cx="16.6" cy="12.6" rx="1.9" ry="2.4" fill="#fff" />
      <circle cx="11.9" cy="13" r="1" fill="#0b0b0c" />
      <circle cx="17.3" cy="13" r="1" fill="#0b0b0c" />
      {sparkle && <path d="M4 2.5c.3 1.8.9 2.4 2.7 2.7-1.8.3-2.4.9-2.7 2.7-.3-1.8-.9-2.4-2.7-2.7 1.8-.3 2.4-.9 2.7-2.7Z" fill="#f5a524" />}
    </svg>
  );
}

/* Spotless logo mark: the janitor ghost with its broom and a small sparkle. */
export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  return <JanitorAvatar size={size} sparkle className={className} />;
}

/* Small colourful blob cluster, used as a decorative mark above empty states. */
export function BlobCluster({ className }: { className?: string }) {
  return (
    <div className={clsx("flex items-center -space-x-1", className)} aria-hidden>
      <span className="w-5 h-5 rounded-[7px] bg-agent rotate-12" />
      <span className="w-6 h-6 rounded-full bg-green" />
      <span className="w-5 h-6 rounded-[8px] bg-blue -rotate-6" />
      <span className="w-4 h-4 rounded-[5px] bg-orange rotate-45" />
    </div>
  );
}

// ---------- topics & connectors ----------

export const TOPIC_PALETTE = ["#7c3aed", "#ec4899", "#2563eb", "#f97316", "#16a34a", "#ca8a04", "#0891b2", "#e11d48", "#4f46e5", "#0d9488", "#d97706", "#c026d3"];

const topicIndex = new Map(corpus.clusters.map((c, i) => [c.id, i]));

/* Stable colour per cluster id on the light theme (the seed's own colours are tuned for dark backgrounds). */
export function topicColor(clusterId: string): string {
  return TOPIC_PALETTE[(topicIndex.get(clusterId) ?? 0) % TOPIC_PALETTE.length];
}

export function TopicDot({ clusterId, className }: { clusterId: string; className?: string }) {
  return <span className={clsx("inline-block w-2 h-2 rounded-full flex-none", className)} style={{ background: topicColor(clusterId) }} />;
}

const CONNECTOR_STYLE: Record<ConnectorId, { color: string; Icon: typeof Share2 }> = {
  sharepoint: { color: "#0e8a7e", Icon: Share2 },
  teams: { color: "#5b5fc7", Icon: MessagesSquare },
  outlook: { color: "#0f6cbd", Icon: Mail },
  onedrive: { color: "#38a0f0", Icon: Cloud },
  confluence: { color: "#1d4ed8", Icon: BookOpen },
  mysdworx: { color: "#e5484d", Icon: FolderLock },
};

/* App-style rounded square with the connector's icon. */
export function ConnectorIcon({ id, size = 28 }: { id: ConnectorId; size?: number }) {
  const { color, Icon } = CONNECTOR_STYLE[id];
  return (
    <span className="grid place-items-center rounded-[8px] text-white flex-none" style={{ width: size, height: size, background: color }}>
      <Icon size={Math.round(size * 0.52)} strokeWidth={2.2} />
    </span>
  );
}

/* Tiny PDF file glyph. */
export function PdfIcon({ className }: { className?: string }) {
  return (
    <span className={clsx("relative inline-grid place-items-center w-6 h-7 rounded-[4px] border border-line bg-bg flex-none", className)} aria-hidden>
      <span className="absolute bottom-1 text-[7px] font-bold tracking-tight text-conflict">PDF</span>
    </span>
  );
}
