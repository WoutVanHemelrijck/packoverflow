"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, cn } from "@/flow/ui";

// A real Google Drive connector: the browser asks Google for a read-only token and lists the PDFs.
// Needs NEXT_PUBLIC_GOOGLE_CLIENT_ID (an OAuth "Web application" client with http://localhost:3100 as origin).
// Without it the button imports the demo set instead, and says so.

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
/** Optional: only list PDFs inside this Drive folder id. */
const FOLDER_ID = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER;
const SCOPE = "openid email https://www.googleapis.com/auth/drive.readonly";
const STORAGE_KEY = "janitor.googleDrive";

/** What the page remembers about the Drive connection, so it stays visible after a reload. */
export interface DriveConnection {
  email: string | null;
  count: number;
  at: string;
}

export function readConnection(): DriveConnection | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DriveConnection) : null;
  } catch {
    return null;
  }
}

function saveConnection(connection: DriveConnection | null): void {
  try {
    if (connection) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(connection));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage is a convenience only
  }
  window.dispatchEvent(new Event("janitor:drive"));
}

/** Forget the Drive connection, for "Reset demo". The files themselves are cleared by the store. */
export function forgetDriveConnection(): void {
  saveConnection(null);
}

/** The live connection, updated whenever it changes in this tab. */
export function useDriveConnection(): DriveConnection | null {
  const [connection, setConnection] = useState<DriveConnection | null>(null);
  useEffect(() => {
    const refresh = () => setConnection(readConnection());
    refresh();
    window.addEventListener("janitor:drive", refresh);
    return () => window.removeEventListener("janitor:drive", refresh);
  }, []);
  return connection;
}

async function whoAmI(token: string): Promise<string | null> {
  try {
    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return null;
    return ((await response.json()) as { email?: string }).email ?? null;
  } catch {
    return null;
  }
}
const GIS_SRC = "https://accounts.google.com/gsi/client";

export interface DriveFile {
  id: string;
  name: string;
  size: number;
  modifiedTime: string;
}

interface TokenClient {
  requestAccessToken: () => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => TokenClient;
        };
      };
    };
  }
}

function loadGoogleIdentity(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Google sign-in script failed to load")));
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google sign-in script failed to load"));
    document.head.appendChild(script);
  });
}

function requestToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID!,
      scope: SCOPE,
      callback: (response) => {
        if (response.access_token) resolve(response.access_token);
        else reject(new Error(response.error ?? "Google did not grant access"));
      },
    });
    client.requestAccessToken();
  });
}

interface DriveFolder {
  id: string;
  name: string;
}

async function listFolders(token: string): Promise<DriveFolder[]> {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", "mimeType='application/vnd.google-apps.folder' and trashed=false");
  url.searchParams.set("fields", "files(id,name)");
  url.searchParams.set("pageSize", "50");
  url.searchParams.set("orderBy", "modifiedTime desc");
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Drive answered ${response.status}`);
  return ((await response.json()) as { files?: DriveFolder[] }).files ?? [];
}

async function listPdfs(token: string, folderId: string | null = FOLDER_ID ?? null): Promise<DriveFile[]> {
  const query = [`mimeType='application/pdf'`, "trashed=false", folderId ? `'${folderId}' in parents` : ""].filter(Boolean).join(" and ");
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", query);
  url.searchParams.set("fields", "files(id,name,size,modifiedTime)");
  url.searchParams.set("pageSize", "200");
  url.searchParams.set("orderBy", "name");
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Drive answered ${response.status}`);
  const data = (await response.json()) as { files?: { id: string; name: string; size?: string; modifiedTime: string }[] };
  return (data.files ?? []).map((file) => ({ id: file.id, name: file.name, size: Number(file.size ?? 0), modifiedTime: file.modifiedTime }));
}

function DriveGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 87.3 78" aria-hidden>
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47" />
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
    </svg>
  );
}

type Status = "idle" | "connecting" | "picking" | "listing" | "done" | "error";

/** "Google Drive" in the connector row. Real when a client id is configured, demo otherwise. */
export function GoogleDriveConnect({
  onFiles,
  onDemo,
  className,
}: {
  onFiles: (files: DriveFile[]) => void;
  /** what to do when no OAuth client is configured */
  onDemo: () => void;
  className?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const live = Boolean(CLIENT_ID);

  async function connect() {
    if (!live) {
      onDemo();
      return;
    }
    if (status === "connecting" || status === "listing") return;
    try {
      setStatus("connecting");
      setMessage(null);
      await loadGoogleIdentity();
      const token = await requestToken();
      setStatus("listing");
      const files = await listPdfs(token);
      onFiles(files);
      setStatus("done");
      setMessage(files.length ? `${files.length} PDFs from your Drive` : "No PDFs found in your Drive");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Google Drive did not answer");
    }
  }

  const label =
    status === "connecting" ? "Signing in to Google" : status === "listing" ? "Reading your Drive" : live ? "Google Drive" : "Google Drive (demo)";

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <button
        type="button"
        onClick={connect}
        title={live ? "Connect your Google Drive (read-only) and import its PDFs" : "Set NEXT_PUBLIC_GOOGLE_CLIENT_ID to connect a real Drive"}
        className="flex items-center gap-1.5 hover:text-ink transition-colors cursor-pointer disabled:cursor-wait"
        disabled={status === "connecting" || status === "listing"}
      >
        <DriveGlyph />
        {label}
      </button>
      {message && <span className={cn("text-[12px]", status === "error" ? "text-conflict" : "text-muted")}>{message}</span>}
    </span>
  );
}

/** The Google Drive tile in the Sources grid: the one connector that is real. */
export function GoogleDriveCard({ onFiles }: { onFiles: (files: DriveFile[]) => void }) {
  const remembered = useDriveConnection();
  const [status, setStatus] = useState<Status>("idle");
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [folderId, setFolderId] = useState<string>("");
  const live = Boolean(CLIENT_ID);
  const busy = status === "connecting" || status === "listing";


  async function importFrom(accessToken: string, folder: string | null) {
    try {
      setStatus("listing");
      const [files, email] = await Promise.all([listPdfs(accessToken, folder), whoAmI(accessToken)]);
      onFiles(files);
      setCount(files.length);
      setStatus("done");
      saveConnection({ email, count: files.length, at: new Date().toISOString() });
      if (!files.length) setMessage("No PDFs in this folder");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Google Drive did not answer");
    }
  }

  // Sign in, then let the user pick which Drive folder the janitor reads (unless one is fixed in the env).
  async function connect() {
    if (busy) return;
    try {
      setStatus("connecting");
      setMessage(null);
      await loadGoogleIdentity();
      const accessToken = await requestToken();
      setToken(accessToken);
      if (FOLDER_ID) return importFrom(accessToken, FOLDER_ID);
      const found = await listFolders(accessToken);
      setFolders(found);
      setFolderId(found[0]?.id ?? "");
      setStatus("picking");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Google Drive did not answer");
    }
  }

  // A connection remembered from earlier in this tab counts as done, so the card survives a reload.
  const shownCount = status === "idle" && remembered ? remembered.count : count;
  const done = (status === "done" || (status === "idle" && Boolean(remembered))) && shownCount > 0;
  return (
    <div className={cn("rounded-xl border bg-bg p-4 flex flex-col h-[148px] transition-colors", done ? "border-settled/40" : "border-line")}>
      <div className="flex items-center gap-2.5">
        <span className="grid place-items-center rounded-[8px] border border-line bg-bg flex-none" style={{ width: 28, height: 28 }}>
          <DriveGlyph size={16} />
        </span>
        <div className="text-[14px] font-medium tracking-[-0.01em] leading-tight">Google Drive</div>
      </div>
      <div className="mt-2 text-[12px] text-muted leading-snug">
        {live ? "Your own Drive, read-only. Real sign-in." : "Needs NEXT_PUBLIC_GOOGLE_CLIENT_ID"}
      </div>
      <div className="mt-auto">
        {done ? (
          <div className="h-8 flex items-center justify-between text-[13px]">
            <span className="flex items-center gap-1.5 text-settled font-medium">
              <span className="w-4 h-4 rounded-full bg-settled text-white grid place-items-center">
                <Check size={10} strokeWidth={3} />
              </span>
              Connected
            </span>
            <span className="tabular-nums text-muted">{shownCount} files</span>
          </div>
        ) : status === "picking" && token ? (
          <div className="flex items-center gap-1.5">
            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              className="h-8 min-w-0 flex-1 rounded-md border border-line-strong bg-bg px-2 text-[12px]"
              aria-label="Drive folder to read"
            >
              <option value="">All of My Drive</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={() => importFrom(token, folderId || null)}>
              Import
            </Button>
          </div>
        ) : busy ? (
          <div className="h-8 flex items-center text-[12px] text-ink-2">{status === "connecting" ? "Signing in to Google" : "Reading your Drive"}</div>
        ) : (
          <div className="flex flex-col gap-1">
            <Button variant="secondary" size="sm" className="w-full" onClick={connect} disabled={!live}>
              Connect
            </Button>
            {message && <span className="text-[11px] text-conflict truncate">{message}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/** The strip above the source cards once a Drive is connected. */
export function DriveConnectedBanner() {
  const connection = useDriveConnection();
  if (!connection) return null;
  const time = new Date(connection.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="mb-3 flex items-center gap-3 rounded-xl border border-settled/40 bg-settled/5 px-4 py-2.5 text-[13px]">
      <span className="grid place-items-center rounded-[8px] border border-line bg-bg flex-none" style={{ width: 28, height: 28 }}>
        <DriveGlyph size={16} />
      </span>
      <div className="flex-1 min-w-0">
        <span className="font-medium text-settled">Connected to Google Drive</span>
        <span className="text-muted">
          {connection.email ? ` as ${connection.email}` : ""} · {connection.count} PDFs imported at {time}, read-only
        </span>
      </div>
      <button type="button" onClick={() => saveConnection(null)} className="text-muted hover:text-ink transition-colors">
        Disconnect
      </button>
    </div>
  );
}
