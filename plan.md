# Tynly Delivery Plan

## Status

Approved on 2026-08-08. This is the canonical working plan for every developer and agent working in this repository. The detailed immutable approval record is mirrored in docs/IMPLEMENTATION_PLAN.md; live task state belongs in docs/IMPLEMENTATION_TRACKER.md.

Current phase: Phase 16B — Progressive setup and saved-provider management.

## Operating rules

- Follow AGENTS.md for every feature: complete one phase, review it, commit it, then move on.
- Before every commit, run git status and git diff, inspect the exact staged paths, and never stage unrelated work.
- Use only conventional commit prefixes accepted by AGENTS.md: feat:, fix:, refactor:, test:, or docs:.
- Do not force-push, commit credentials, or alter unrelated files.
- Maintain the tracker continuously. A task becomes complete only after its acceptance criteria and relevant tests pass.
- Record material architecture, permission, storage, dependency, provider, or UX changes in docs/DECISIONS.md and stop for approval when the approved plan would materially change.
- At project completion, update CHANGELOG.md with changes, commits, and important notes, then push normally.

## Product outcome

Tynly is a lightweight Manifest V3 Chrome extension that transforms imperfect or mixed-language text into natural writing. Its default experience is Vietnamese to English, Natural style, auto-replace, with three equal triggers: a field icon, a selection button, and Alt + A.

The MVP includes:

- input, textarea, and contenteditable support;
- automatic replacement, compact preview, and reliable undo;
- configurable languages, styles, controls, and custom styles;
- popup and progressive settings UI;
- separate model selection per provider profile;
- OpenAI, OpenAI-compatible, Anthropic, Gemini, Ollama, and secure custom JSON API providers;
- versioned settings, migrations, tests, documentation, branding, and bundle inspection.

Explicit non-goals are continuous grammar checking, full-page translation, chat, analytics, cloud accounts, OCR, history dashboards, and other unrelated product expansion.

## Architecture commitments

1. Content scripts capture text and render isolated UI, but never receive API secrets.
2. The background service worker owns private settings, provider configuration, network calls, model discovery, cancellation, and error normalization.
3. All triggers converge on one content TransformController.
4. Provider adapters never manipulate DOM; input adapters never know provider HTTP details.
5. Prompt construction is centralized and compact. A normal transform uses one request and returns plain text.
6. Content UI uses vanilla TypeScript and Shadow DOM. Preact is limited to separately bundled popup and settings pages.
7. Idle work stays near zero: no polling, no full-page scan, no continuous language detection, and no broad mutation observers.
8. Settings are typed, local-only, versioned, and migrated. Secrets are never synced, logged, placed in the DOM, or returned to content scripts.

## Phase roadmap

### Phase 0 — Approved-plan handoff and tracking

Create this plan, the implementation plan, tracker, architecture record, and decision log. Review the documentation for completeness, commit it, and begin no application code until this phase is complete.

Acceptance: all approved work is represented by concrete tracker tasks and the documents define the working boundaries.

Expected commit: docs: record approved Tynly implementation plan

### Phase 1 — MV3 foundation and Tynly brand system

Create the pnpm/Vite/strict-TypeScript foundation; Manifest V3 entry points; lint, test, build, and browser-test commands; product metadata; original SVG mark; generated 16, 32, 48, and 128 pixel icons; and basic Chrome-load verification.

Acceptance: the extension builds, typechecks, lints, loads unpacked, and keeps content, popup, settings, and background bundles separate.

Expected commits:

- feat: initialize Tynly MV3 extension foundation
- feat: add Tynly brand asset system

### Phase 2 — Settings, messaging, security, and error model

Build typed versioned settings, defaults, migrations, private provider-secret storage, redacted content settings, browser boundaries, typed messaging, and normalized user-safe errors.

Acceptance: settings migrate without reset; content cannot obtain secrets; messages cannot carry arbitrary private configuration.

Expected commit: feat: add versioned settings and secure extension messaging

### Phase 3 — Transform domain and response safety

Build language/style types, compact prompt builder, output budget heuristic, conservative result sanitizer, operation IDs, cancellation contracts, and stale-response validation.

Acceptance: one provider-neutral request flow preserves user meaning and refuses stale results.

Expected commit: feat: add compact transform engine and response safety

### Phase 4 — Provider foundation, OpenAI-compatible APIs, and Ollama

Build provider registry, capabilities, direct-fetch service, model handling, connection tests, OpenAI, OpenAI-compatible, and Ollama adapters.

Acceptance: multiple profiles retain independent model choices; discovery failure still permits manual models.

Expected commit: feat: add provider registry and compatible provider adapters

### Phase 5 — Anthropic, Gemini, and secure custom JSON APIs

Add the remaining built-in providers plus safe JSON template interpolation, response-path extraction, advanced configuration validation, and provider tests.

Acceptance: all required provider kinds work through the same service without eval, unsafe paths, or secret leakage.

Expected commits:

- feat: add Anthropic and Gemini provider adapters
- feat: add secure custom JSON provider support

### Phase 6 — Input adapters, sensitive safety, and undo

Implement adapter registry, input/textarea/contenteditable replacement, controlled-input events, sensitive-field exclusion, selection snapshots, and validated undo.

Acceptance: only intended text changes; sensitive fields never send data; Undo never overwrites later user edits.

Expected commit: feat: add safe input adapters and undo support

### Phase 7 — Content triggers and compact interaction UI

Implement focus/selection tracking, tiny field icon, selection button, normal-page result popover, shortcut service, toast, preview, loading/error state, and controller integration.

Acceptance: all three triggers invoke one transform path with isolated, lazy, accessible UI.

Expected commit: feat: add content transform controls and workflows

### Phase 8 — Popup and settings experience

Implement the compact popup plus progressive settings: languages, swap, styles, behavior, controls, provider manager, per-profile models, model refresh/manual entry, connection tests, and privacy information.

Acceptance: all required configuration is available without showing API keys in the popup or leaking secrets.

Expected commit: feat: add popup and provider management settings

### Phase 9 — E2E verification, documentation, release audit, and handoff

Add mock-provider browser tests, CI, bundle audit, README/provider documentation, manual verification, tracker reconciliation, changelog, Git audit, and normal push.

Acceptance: build, typecheck, lint, unit tests, E2E tests, Chrome smoke test, documentation, and bundle review pass with a clean Git state.

Expected commits:

- test: add Tynly browser extension coverage
- docs: complete Tynly architecture and provider guides
- docs: update changelog and release notes

### Phase 10 — One behavior setting and three safe shortcut bindings

Remove the duplicate per-control replace/preview choices. The global Behavior setting becomes the
single source of truth for every editable transform, while normal-page selections remain copy-only.
Replace the single keyboard binding with up to three user-configurable bindings for that same action.
Preserve browser-trusted-event, IME, AltGraph, repeat-event, and prevent-default safeguards.

Acceptance: existing settings migrate without losing their chosen behavior or first shortcut; each
enabled unique binding invokes the same behavior; field-button and selection controls contain only
trigger-specific settings; and migration, validation, content, settings, and shortcut tests pass.

Expected commit:

- feat: simplify controls and add shortcut bindings

### Phase 11 — Friendly provider quick-start and reliable connectivity checks

Keep the proven built-in adapters and add clearly named, preconfigured OpenAI-compatible profiles
for OpenRouter, Groq, DeepSeek, Mistral, Together AI, Fireworks, Perplexity, and xAI. Make provider setup a guided flow:
one click supplies a safe API root, the user adds a key and model, and a visible Save & test action
checks the actual saved configuration with a tiny model request. Provider operations must fetch fresh
settings so an immediately saved secret/model cannot be tested from a stale background cache.

Acceptance: each preset creates the correct safe profile without embedding a secret; model refresh
and connection testing use the saved profile; success and safe failure states are visible in the
editor; stale-cache regression coverage, preset coverage, and provider tests pass.

Expected commit:

- feat: improve provider setup and connection checks

### Phase 12 — Minimalist popup and settings design

Redesign the popup and settings pages around clear hierarchy, restrained surfaces, concise helper
copy, accessible status feedback, responsive layout, and a coherent light/dark palette. Preserve
keyboard navigation, semantic labels, focus visibility, native controls, privacy copy, and all
functional behavior added in Phases 10–11.

Acceptance: the new pages are visually consistent and usable at popup and narrow settings widths;
controls remain accessible; the provider workflow is understandable without advanced knowledge; and
UI tests, formatting, typecheck, lint, build, and a manual Chrome visual check pass.

Expected commit:

- feat: refine Tynly settings experience

### Phase 13 — Regression verification and release handoff

Run the complete automated suite, update documentation and the manual Chrome checklist for the new
controls and provider presets, complete the outstanding manual verification, update CHANGELOG.md,
review Git state, commit release notes, and push normally.

Acceptance: all automated checks pass, the manual Chrome result is recorded, release documents list
the new commits and operational notes, and no unrelated user-owned file is staged.

Expected commits:

- test: cover settings and provider improvements
- docs: update controls and provider release notes

### Phase 14 — Extension-page preload compatibility

Remove Vite's speculative module-preload tags from extension HTML pages. Chromium can associate
those requests with a different extension world and emit misleading preload-mismatch warnings,
even though the extension continues to run. Keep native ESM loading intact and verify the emitted
popup and Settings pages contain no module-preload links.

Acceptance: production output has no `rel="modulepreload"` tags, popup and Settings still load
their module graphs normally, automated checks pass, and unpacked Chrome no longer reports the
preload mismatch warnings.

Expected commit:

- fix: avoid extension preload-world warnings

### Phase 15 — Provider UX research and redesign proposal

Research how established translation extensions present provider choice, audit Tynly's current
provider workflow, and record an evidence-based redesign proposal before changing source code.

Acceptance: the research distinguishes verified evidence from design inference, explains the
current provider-flow friction, preserves Tynly's security and multi-provider requirements, and
gives every developer a concrete approved implementation target.

Expected commit:

- docs: record provider selection UX research

### Phase 16 — Provider selection redesign

Replace the paired provider dropdowns with a clear provider home,
searchable/category-based picker, progressive setup, meaningful connection state, and compact
saved-provider management. The normal path must favor a single setup decision; technical
connection fields remain available but do not dominate the screen.

Acceptance: a new user can choose, configure, test, and activate a recommended provider without
encountering raw advanced fields; existing saved providers remain intact and manageable; all
provider operations stay trusted and secret-safe; and accessibility, responsive UI, unit, E2E,
bundle, and manual Chrome checks pass.

Expected commits:

- feat: add provider home and picker (Phase 16A complete)
- feat: streamline provider setup management
- test: cover provider selection workflow

Execution slices:

1. **Phase 16A — Provider home and picker.** Build a single current-provider home and a searchable,
   category-based selection surface. Reuse the current catalog and creation rules so profiles remain
   valid without a migration.
2. **Phase 16B — Progressive setup and saved-provider management.** Simplify the normal credential
   path, keep raw connection fields under an explicit advanced disclosure, make a successful test
   activate the selected provider, and place saved-profile actions in a compact secondary view.
3. **Phase 16C — Coverage and release verification.** Add focused functional and accessibility
   tests, run the complete checks, inspect light/dark/narrow UI, and record the manual Chrome
   verification result.

## Phase transition checklist

Before implementation in each phase:

1. Announce the phase goal, tasks, and acceptance criteria.
2. Mark its tracker task in progress.
3. Implement only that phase's scoped work.
4. Update tracker and decision records as work progresses.
5. Run the relevant typecheck, lint, unit, integration, browser, and build checks.
6. Review git status and git diff before staging explicit paths.
7. Commit the coherent phase result.
8. Report completion, test status, tracker state, limitations, commit, and next phase.

## Current handoff

Phase 0 was completed in commit c4fd88. Phase 1 was completed in commits 3565685 and 6d71072. Phase 2 was implemented in a3b90cb and security-hardened in 1601a5f. Phase 3 was completed in e7f0030. Phase 4 was completed in 0438b37 and review-hardened in 6706384. Phase 5 was completed in 0d8567e and e199e9e. Phase 6 was completed in 8fb45ac. Phase 7 was completed in 44de658. Phase 8 was completed in 463a384. Phase 9's manual Chrome and changelog gates remain pending and will be repeated after the new work. Phase 10 was completed in c674c27. Phase 11 was completed in a39fb42. Phase 12 was completed in ae9611b. Phase 13 remains pending its manual Chrome release verification. Phase 14 was committed in 123e9cd and remains pending its manual Chrome recheck. Phase 15 research was completed in 6b2e55f. Phase 16 was approved on 2026-08-10; Phase 16A is complete and Phase 16B is next.
