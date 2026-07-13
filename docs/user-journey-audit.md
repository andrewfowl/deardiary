# DearDiary — user journey audit

Walkthrough of the full journey from discovery to renewal, with findings and the
fixes shipped in this iteration. ✅ = fixed in this change, ▶ = future work.

## 1. Discover & evaluate

| Finding | Severity | Fix |
|---|---|---|
| No marketing presence: nothing explains the product, pricing, or privacy story before install. | High | ✅ Static marketing site (`website/`) with features, how-it-works, privacy section, pricing, FAQ, and docs. |
| No stated business model; users can't tell if/what they'll pay. | High | ✅ Pricing: 14-day free trial → $49 lifetime (one-time) or $19/year subscription. Shown on site and in-app. |

## 2. Install & first run

| Finding | Severity | Fix |
|---|---|---|
| First launch dropped users on an empty Timeline with a small hint buried in the empty state. The app was silently capturing screenshots *before* the user understood or consented to what it does. | **Critical** | ✅ First-run **onboarding wizard**: (1) what DearDiary does + privacy explainer, (2) AI provider setup with connection test, (3) how recording works, with an explicit "Start recording" step. Capture does not start until onboarding completes. |
| Provider setup required discovering Settings unprompted; without it the app records forever but produces nothing. | High | ✅ Onboarding step 2 sets up the provider up front; a persistent sidebar warning links to Settings if it's ever unconfigured. |
| No trial framing at first run. | Medium | ✅ Onboarding states the trial terms; trial countdown appears in the sidebar. |

## 3. The first hour ("is it working?")

| Finding | Severity | Fix |
|---|---|---|
| Up to 15 minutes of dead air before the first timeline card. Users can't tell recording from a hang. | High | ✅ Status footer already showed pending screenshot count; now the empty state explains the batch cadence and the **Analyze now** button is surfaced in the status footer whenever shots are pending, not only in the empty state. |
| Emoji nav icons render inconsistently on Windows (colored, mixed metrics) and look unpolished. | Low | ✅ Replaced with monochrome inline SVG icons. |

## 4. Daily use

| Finding | Severity | Fix |
|---|---|---|
| Timeline, Journal, Standup and Chat all work off the same day selector but each view resets context — acceptable; day selection is already shared app-wide. | — | (no change) |
| No keyboard/scroll affordances audit: default scrollbars look heavy on the dark theme. | Low | ✅ Styled scrollbars + focus-visible rings. |
| Recording state only visible in the app. | Medium | ✅ Tray tooltip now reflects paused/recording state; tray menu already offered pause/resume. |

## 5. Getting value (the point of the product)

| Finding | Severity | Fix |
|---|---|---|
| Journal/Standup/Chat exist but nothing teaches them. | Medium | ✅ Onboarding final step previews the three payoff features; docs cover each. |
| Standup only covers yesterday+today. | Low | ▶ Date-range standups / weekly summaries (roadmap). |

## 6. Trial → purchase → activation

| Finding | Severity | Fix |
|---|---|---|
| No licensing at all. | High | ✅ Offline-verifiable Ed25519-signed license keys; 14-day trial tracked locally; **lifetime** and **annual** plans. Keys validate entirely offline — no license server dependency at runtime. |
| — | | ✅ Activation UI in Settings (paste key → instant feedback), trial banner with days remaining and a Buy link, graceful expiry: recording/analysis pause but **all recorded history stays viewable** — we never hold a user's own data hostage. |
| Purchase flow | | ✅ Stripe-based issuing service (`server/`): webhook-driven key generation + post-checkout retrieval page (`website/activate.html`). |

## 7. Renewal & expiry

| Finding | Severity | Fix |
|---|---|---|
| Annual expiry needs warning, not a cliff. | Medium | ✅ Renewal banner appears 14 days before expiry; after expiry the app behaves like trial-expiry (history remains accessible, recording pauses) with a Renew link. |

## 8. Leaving

| Finding | Severity | Fix |
|---|---|---|
| Users should be able to take data with them. | Low | ▶ Markdown/Obsidian export (roadmap). Data is plain SQLite + JPEGs in `%APPDATA%`, documented in docs/privacy. |

## Design principles applied

- **Consent before capture** — nothing is recorded until onboarding is completed.
- **Never punish with data loss** — expired trial/license pauses *future* recording only.
- **Always answer "is it working?"** — persistent recording dot, pending count, analyze-now.
- **One accent, few colors** — category palette is the only splash of color; chrome stays neutral.
