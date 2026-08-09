# Tynly Implementation Tracker

## Tracker rules

- [ ] Not started
- [-] In progress
- [x] Complete
- [!] Blocked

Only mark a task complete after its stated acceptance criteria and applicable checks pass. The root plan at plan.md is the roadmap; this file is the live implementation source of truth.

## Phase 0 — Approved-plan handoff and tracking

- [x] Create root plan.md as the canonical developer roadmap.
- [x] Record the approved plan in docs/IMPLEMENTATION_PLAN.md.
- [x] Create this live tracker with all meaningful delivery tasks.
- [x] Record architecture boundaries in docs/ARCHITECTURE.md.
- [x] Record initial ADRs in docs/DECISIONS.md.
- [x] Review documentation, Git status, and Git diff.
- [x] Commit the documentation-only phase (c4fd88).

## Phase 1 — MV3 foundation and brand system

- [x] Select and pin pnpm dependencies without adding unnecessary runtime libraries.
- [x] Add strict TypeScript configuration and project scripts.
- [x] Add Vite/Manifest V3 build configuration.
- [x] Add service worker, content, popup, and settings entry-point shells.
- [x] Add linting, formatting checks, unit-test setup, and browser-test setup.
- [x] Define product identity constants and centralized UI strings.
- [x] Define minimum required Chrome permissions and document their rationale.
- [x] Create original canonical Tynly SVG assets.
- [x] Generate and validate 16, 32, 48, and 128 pixel manifest icons.
- [x] Verify typecheck, lint, unit harness, build, and unpacked extension load.
- [x] Review and commit the foundation.
- [x] Review and commit the brand asset system.

## Phase 2 — Settings, messaging, security, and errors

- [x] Define versioned AppSettings and discriminated provider-profile types.
- [x] Implement defaults for language, behavior, controls, styles, and providers.
- [x] Implement migrations with malformed-state recovery.
- [x] Restrict local storage to trusted contexts.
- [x] Separate private provider secrets from public content settings.
- [x] Add redacted provider summaries and write-only secret updates.
- [x] Add typed extension message contracts and runtime validation.
- [x] Add browser API wrappers and background message router.
- [x] Add typed user-safe error model and secret-safe logger.
- [x] Test defaults, migrations, message validation, and redaction.
- [x] Review and commit Phase 2 (a3b90cb, 1601a5f).

## Phase 3 — Transform domain and response safety

- [x] Define transform request/result, operation, and language/style types.
- [x] Implement centralized compact known-source and Auto-source prompts.
- [x] Implement built-in/custom style validation and language swap rules.
- [x] Implement output-budget heuristic and input limits.
- [x] Implement conservative result sanitizer.
- [x] Implement operation IDs, cancellation contracts, and freshness validation.
- [x] Test prompt, style, sanitizer, limit, cancellation, and stale-result behavior.
- [x] Review and commit Phase 3 (e7f0030).

## Phase 4 — Provider foundation, OpenAI-compatible APIs, and Ollama

- [x] Define AIProvider, capabilities, model, and connection-test contracts.
- [x] Implement ProviderRegistry and background-only ProviderService.
- [x] Implement fetch timeout, cancellation, redaction, and error normalization.
- [x] Implement per-profile model persistence, discovery, and manual fallback.
- [x] Implement OpenAI adapter.
- [x] Implement OpenAI-compatible adapter.
- [x] Implement Ollama adapter.
- [x] Mock and test requests, discovery, cancellation, errors, and connection checks.
- [x] Harden successful response-body timeout coverage and UTF-8 byte limits found during review.
- [x] Review and commit Phase 4 (0438b37, 6706384).

## Phase 5 — Anthropic, Gemini, and custom JSON APIs

[x] Implement Anthropic adapter and tests.
[x] Implement Gemini adapter and tests.
[x] Define custom API configuration and endpoint/header validation.
[x] Implement safe JSON-template interpolation.
[x] Implement safe response-path extraction.
[x] Implement optional custom-model discovery.
[x] Test dangerous keys, response paths, escaping, timeouts, and error cases.
[x] Review and commit provider adapter work (0d8567e, e199e9e).

## Phase 6 — Input adapters, sensitive safety, and Undo

[x] Define InputAdapter, InputSnapshot, replacement, and undo contracts.
[x] Implement text-input adapter and native setter/event handling.
[x] Implement textarea adapter and selection replacement.
[x] Implement contenteditable adapter and range validation.
[x] Implement sensitive-target detector.
[x] Implement validated UndoService and native-undo preference.
[x] Test replacements, events, controlled fields, sensitive exclusions, and undo.
[x] Review and commit Phase 6 (8fb45ac).

## Phase 7 — Content triggers and interaction UI

[x] Implement content bootstrap and focused-target tracking.
[x] Implement lazy isolated Shadow DOM UI host.
[x] Implement Tynly field button and geometry lifecycle.
[x] Implement editable and normal-page selection workflows.
[x] Implement configurable IME-safe shortcut service.
[x] Implement TransformController integration, loading, cancellation, and errors.
[x] Implement toast, preview, result popover, copy, replace, and Undo actions.
[x] Test trigger parity, page non-mutation, IME, preview, and stale responses.
[x] Review and commit Phase 7 (44de658).

## Phase 8 — Popup and settings

[x] Add trusted settings-page provider-operation bridge without exposing it to content scripts.
[x] Implement compact popup controller.
[x] Implement general language/style settings and safe swap.
[x] Implement behavior and controls settings.
[x] Implement custom-style management.
[x] Implement provider list, editor, and capability-driven advanced fields.
[x] Implement model search, refresh, manual ID, and connection test UI.
[x] Implement privacy explanation and secret masking.
[x] Test persistence, model restoration, capability UI, and accessibility.
[x] Review and commit Phase 8 (463a384).

## Phase 9 — Verification, documentation, and release

[x] Add deterministic local mock-provider server for browser tests.
[x] Add Playwright extension fixtures and core workflow coverage.
[x] Add CI for typecheck, lint, unit tests, build, and E2E tests.
[x] Add bundle-size inspection and record final sizes.
[x] Require trusted user events before content transform actions and isolate the interaction UI from page scripts.
[x] Complete README, provider guide, architecture, tracker, and decision records.
[-] Execute manual Chrome verification checklist.
[x] Audit permissions, secrets, Git status, Git diff, Git log, and tracker.
[ ] Update CHANGELOG.md with changes, commits, and important notes.
[ ] Commit release documentation and push normally.

## Phase 10 — One behavior setting and three safe shortcut bindings

[x] Record the approved scope, migration, and acceptance criteria in the working plan.
[ ] Bump and migrate the settings format without resetting existing user preferences.
[ ] Make Behavior the only editable replace/preview decision.
[ ] Remove per-control outcome fields from the settings schema, defaults, snapshots, UI, and runtime.
[ ] Support one to three unique keyboard bindings for the same transform action.
[ ] Preserve trusted-event, IME, AltGraph, repeat-event, and browser-conflict safeguards.
[ ] Add migration, validation, settings, content, and shortcut regression coverage.
[ ] Review and commit the coherent phase.

## Phase 11 — Friendly provider quick-start and reliable connectivity checks

[ ] Add safe OpenAI-compatible presets for OpenRouter, Groq, DeepSeek, Mistral, Together AI, Fireworks, Perplexity, and xAI.
[ ] Make preset selection and provider configuration understandable without editing a raw API root.
[ ] Ensure model refresh and connection testing read the freshly saved provider configuration.
[ ] Present a clearly scoped Save & test state with credential-safe success and failure feedback.
[ ] Add preset, connectivity, stale-cache, and provider-editor regression coverage.
[ ] Review and commit the coherent phase.

## Phase 12 — Minimalist popup and settings design

[ ] Establish the refined visual tokens, hierarchy, surfaces, controls, and responsive behavior.
[ ] Redesign the popup for fast, legible everyday changes.
[ ] Redesign Settings around concise sections and a guided provider workflow.
[ ] Preserve semantic labels, focus indicators, contrast, keyboard navigation, and dark mode.
[ ] Run UI-focused automated checks and manual Chrome visual verification.
[ ] Review and commit the coherent phase.

## Phase 13 — Regression verification and release handoff

[ ] Run format, typecheck, lint, unit, build, bundle, and E2E checks.
[ ] Update provider, shortcut, manual-verification, and release documentation.
[ ] Complete and record the manual Chrome verification result.
[ ] Update CHANGELOG.md with changes, commits, and important notes.
[ ] Review Git state, commit release notes, and push normally.
