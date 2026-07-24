# DearDiary

**An automatic work journal for Windows** — inspired by [Dayflow](https://www.dayflow.so/) for macOS.

DearDiary quietly records what you do on your computer and uses AI to turn it into a readable timeline of your day. No timers, no manual tagging. Then it helps you *use* that record: daily journal summaries, instant standup updates, and a chat interface for asking questions about your own day.

This repository contains the full product:

| Directory | What it is |
|---|---|
| `src/` | The Electron + React desktop app |
| `website/` | Static marketing site + docs + post-checkout activation page |
| `server/` | Licensing service (Cloudflare Worker + Stripe webhooks) |
| `scripts/` | Icon generation, license keygen, manual license issuance |
| `docs/` | Internal docs, including the [user journey audit](docs/user-journey-audit.md) |

## Features

- **Automatic recording** — a screenshot of your screen every 30 seconds (configurable). Capture pauses automatically when you're idle or your screen is locked, and can be paused any time from the tray.
- **AI timeline** — every ~15 minutes, a batch of screenshots is analyzed by the AI provider you choose and merged into timeline cards: *"09:10–10:25 · Editing billing service in VS Code"*, categorized (deep work, meetings, communication, research, admin, break, distraction).
- **Journal** — one-click AI-written daily summary, plus focus/distraction stats and a category time breakdown.
- **Standup** — a Yesterday / Today / Blockers update drafted from what you actually did, with optional AI polish. Copy, paste, done.
- **Ask your day** — chat over your recorded timeline: *"What was I doing at 3pm?"*, *"How much time did I spend in meetings?"*
- **System tray** — runs in the background; closing the window keeps recording.

## Privacy

- **Everything is stored locally**: screenshots, the timeline database, summaries — all in your user profile on your PC.
- Screenshots are only sent to the AI provider **you** configure, and are deleted from disk after a retention period (default 7 days). The derived journal (cards, summaries) is kept forever.
- Use **Ollama** (or LM Studio via the OpenAI-compatible provider) with a local vision model and nothing ever leaves your machine.

## AI providers

| Provider | Notes |
|---|---|
| **Google Gemini** (default) | Free tier available — easiest way to start |
| **Anthropic Claude** | Highest-quality summaries and chat (official `@anthropic-ai/sdk`, structured outputs) |
| **OpenAI / compatible** | Any OpenAI-compatible endpoint with a vision model |
| **Ollama** | Fully local/offline (needs a vision model, e.g. `qwen2.5vl`) |

Configure the provider and API key in **Settings** (or during first-run onboarding), then hit *Save & test connection*.

## Licensing

The app ships with a 14-day full-featured trial (no account), then requires a license:

- **Lifetime** — $49 one-time
- **Annual** — $19/year subscription

Keys are Ed25519-signed (`DDRY-…`) and **verified offline** by the app against the public key in `src/main/license.ts`. When a trial/license expires, recording pauses but all recorded history stays accessible. The purchase flow (Stripe → webhook → key issuance → activation page) lives in [`server/`](server/README.md); manual issuance is `node scripts/issue-license.mjs --email x@y.com --plan lifetime`.

> ⚠️ The repo contains a **development keypair** (`server/dev-keys/`) so the flow works out of the box. Generate a production keypair with `node scripts/license-keygen.mjs` and replace both halves before selling anything.

## Website & docs

`website/` is a dependency-free static site — landing page with pricing, user docs (`website/docs/`), and the post-checkout key retrieval page (`activate.html`). Deploy it anywhere static (GitHub Pages, Cloudflare Pages); replace the Stripe Payment Link placeholders in `index.html` and the worker URL in `activate.html`.

## Getting started (development)

Requirements: Node.js ≥ 22.13, Windows 10/11 (the app targets Windows; the UI and pipeline also run on macOS/Linux for development).

```bash
npm install
npm run dev        # launches Electron with hot reload
npm test           # unit tests (vitest)
npm run typecheck  # tsc --noEmit
```

Build a Windows installer locally:

```bash
npm run dist:win   # NSIS installer in dist/
```

## Releasing & distribution

Downloads are distributed from **the website** (`deardiary.app/download.html`), not GitHub Releases: tagging `v*` runs `.github/workflows/release.yml`, which builds the installer on Windows (code-signed when Azure Trusted Signing secrets are configured), refuses to ship a build that still trusts the committed dev license key, and publishes the versioned installer + stable-URL alias + `latest.json`/`latest.yml` to the download bucket. The website deploys via `.github/workflows/deploy-website.yml`. Full runbook — key rotation, hosting, signing, Stripe: [RELEASING.md](RELEASING.md).

## How it works

```
┌──────────────┐   every 30s    ┌────────────────┐
│ CaptureService│ ─────────────▶ │ JPEG + SQLite  │   (local only)
└──────────────┘                └───────┬────────┘
                                        │ every ~15 min, sampled batch
                                        ▼
                                ┌────────────────┐
                                │  AI provider    │  screenshots → JSON observations
                                └───────┬────────┘
                                        ▼
                            deterministic merge → timeline cards
                                        ▼
                    Timeline · Journal summary · Standup · Chat
```

- **Main process** (`src/main`): screenshot capture (`desktopCapturer`), idle/lock detection (`powerMonitor`), SQLite storage via Node's built-in `node:sqlite` (no native npm modules to compile), the analysis pipeline, retention cleanup, tray, and IPC.
- **Shared core** (`src/shared`): pure, unit-tested logic — prompt building, response parsing/validation, observation→card merging, day stats, standup drafting.
- **Renderer** (`src/renderer`): React UI (Timeline, Journal, Chat, Standup, Settings) over a typed `window.api` bridge.

Data lives in the Electron `userData` directory: `deardiary.db` (journal), `screenshots/` (retention-limited), `settings.json`.

## Roadmap ideas

- Weekly summaries and trends
- Active-window titles as an extra signal
- Search across all days
- Export (Markdown / Obsidian)
- Auto-start on login

## License

MIT
