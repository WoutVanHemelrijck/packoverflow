# Spotless: not one conflicting fact left

Spotless is the Pack Overflow team's answer to the SD Worx challenge "How might we turn fragmented organisational knowledge into a trusted shared resource?". A janitor agent reads every document you connect, settles conflicting facts by a constitution you control, and asks a person only when it cannot decide. Claude and other agents read the settled facts through an MCP server.

## Views

The left sidebar shows the live data health score and switches between four views.

- **Janitor** (home): the janitor cleans every connected file that it has not processed yet, one by one, without a start button. The page shows the health score and its history, the queue with the outcome per file, how often each constitution article fired, and the conflicts. Opening a conflict shows both sources side by side with the AI jury's suggestion; accepting it or picking a value settles the fact. The sidebar badge counts the conflicts that need a person.
- **Search**: semantic search over the connected documents with multilingual embeddings (`/api/embed`), so a Dutch query finds French and English documents. Each hit shows whether its facts are settled, superseded or in conflict.
- **Agent**: Claude connected to the `spotless` MCP server, answering in Dutch, French or English from settled facts only, with a citation per fact.
- **Setup**: the connectors (SharePoint, Teams, Outlook, OneDrive, Confluence, mysdworx Documents, PDF upload) and the constitution.

## Health model

Health covers the connected documents only and is the mean of two parts.

- Consistency: the share of facts without an open conflict. A conflict is open until the janitor has processed all its documents, and stays open while it needs a person.
- Freshness: the share of connected documents that are current. Stale, superseded and duplicate documents count against it until the janitor archives or flags them.

Certainty is the average confidence of the settled facts: 1.0 when all sources agree or a person decided, 0.9 when a rule decided, 0.8 when the AI jury decided. Confirming a janitor decision raises that fact to 1.0.

## Constitution

The constitution is an ordered list of articles the janitor applies when sources disagree: scope match, source authority, effective date, payroll data agreement, owner present and author seniority. Users reorder them and switch them on or off in Setup. Ties go to a three-juror AI jury, and a split jury goes to a person. The engine is `src/lib/janitor.ts`.

## MCP server

`mcp/server.ts` exposes `search_facts`, `get_fact` and `health`. It reads the ledger from the running app (`/api/ledger`) and falls back to `.cache/ledger.json`. Register it with Claude Code:

```bash
claude mcp add spotless -- npx tsx /absolute/path/to/packoverflow/mcp/server.ts
```

## Run

```bash
npm install
npm run dev          # http://localhost:3100 (the origin registered for Google Drive sign-in)
```

URL shortcuts: `?reset` clears state, `?demo` connects every demo source with all files queued, `?clean` connects everything already cleaned, and `?step=<janitor|search|agent|setup>` opens a view.

The Agent view and the pipeline call the local Claude Code CLI (`claude -p --model haiku`), falling back to `codex exec`. The app stores no API key.

## Data and pipeline

- `scripts/seed.ts` generates the synthetic corpus (`src/data/corpus.json`) and 100 real PDFs (`public/pdfs`). All names, clients and values are fictional.
- `pipeline/run.ts` reads the PDFs with unpdf, embeds them with `Xenova/paraphrase-multilingual-MiniLM-L12-v2`, projects them with UMAP, clusters them with k-means and asks Haiku to re-extract the claims. Last run: 100 PDFs, 150 pages, cluster purity 87%, 48 of 61 planted claims re-found.
