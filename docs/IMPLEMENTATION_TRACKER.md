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

- [-] Define versioned AppSettings and discriminated provider-profile types.
[ ] Implement defaults for language, behavior, controls, styles, and providers.
[ ] Implement migrations with malformed-state recovery.
[ ] Restrict local storage to trusted contexts.
[ ] Separate private provider secrets from public content settings.
[ ] Add redacted provider summaries and write-only secret updates.
[ ] Add typed extension message contracts and runtime validation.
[ ] Add browser API wrappers and background message router.
[ ] Add typed user-safe error model and secret-safe logger.
[ ] Test defaults, migrations, message validation, and redaction.
[ ] Review and commit Phase 2.

## Phase 3 — Transform domain and response safety

[ ] Define transform request/result, operation, and language/style types.
[ ] Implement centralized compact known-source and Auto-source prompts.
[ ] Implement built-in/custom style validation and language swap rules.
[ ] Implement output-budget heuristic and input limits.
[ ] Implement conservative result sanitizer.
[ ] Implement operation IDs, cancellation contracts, and freshness validation.
[ ] Test prompt, style, sanitizer, limit, cancellation, and stale-result behavior.
[ ] Review and commit Phase 3.

## Phase 4 — Provider foundation, OpenAI-compatible APIs, and Ollama

[ ] Define AIProvider, capabilities, model, and connection-test contracts.
[ ] Implement ProviderRegistry and background-only ProviderService.
[ ] Implement fetch timeout, cancellation, redaction, and error normalization.
[ ] Implement per-profile model persistence, discovery, and manual fallback.
[ ] Implement OpenAI adapter.
[ ] Implement OpenAI-compatible adapter.
[ ] Implement Ollama adapter.
[ ] Mock and test requests, discovery, cancellation, errors, and connection checks.
[ ] Review and commit Phase 4.

## Phase 5 — Anthropic, Gemini, and custom JSON APIs

[ ] Implement Anthropic adapter and tests.
[ ] Implement Gemini adapter and tests.
[ ] Define custom API configuration and endpoint/header validation.
[ ] Implement safe JSON-template interpolation.
[ ] Implement safe response-path extraction.
[ ] Implement optional custom-model discovery.
[ ] Test dangerous keys, response paths, escaping, timeouts, and error cases.
[ ] Review and commit provider adapter work.

## Phase 6 — Input adapters, sensitive safety, and Undo

[ ] Define InputAdapter, InputSnapshot, replacement, and undo contracts.
[ ] Implement text-input adapter and native setter/event handling.
[ ] Implement textarea adapter and selection replacement.
[ ] Implement contenteditable adapter and range validation.
[ ] Implement sensitive-target detector.
[ ] Implement validated UndoService and native-undo preference.
[ ] Test replacements, events, controlled fields, sensitive exclusions, and undo.
[ ] Review and commit Phase 6.

## Phase 7 — Content triggers and interaction UI

[ ] Implement content bootstrap and focused-target tracking.
[ ] Implement lazy isolated Shadow DOM UI host.
[ ] Implement Tynly field button and geometry lifecycle.
[ ] Implement editable and normal-page selection workflows.
[ ] Implement configurable IME-safe shortcut service.
[ ] Implement TransformController integration, loading, cancellation, and errors.
[ ] Implement toast, preview, result popover, copy, replace, and Undo actions.
[ ] Test trigger parity, page non-mutation, IME, preview, and stale responses.
[ ] Review and commit Phase 7.

## Phase 8 — Popup and settings

[ ] Implement compact popup controller.
[ ] Implement general language/style settings and safe swap.
[ ] Implement behavior and controls settings.
[ ] Implement custom-style management.
[ ] Implement provider list, editor, and capability-driven advanced fields.
[ ] Implement model search, refresh, manual ID, and connection test UI.
[ ] Implement privacy explanation and secret masking.
[ ] Test persistence, model restoration, capability UI, and accessibility.
[ ] Review and commit Phase 8.

## Phase 9 — Verification, documentation, and release

[ ] Add deterministic local mock-provider server for browser tests.
[ ] Add Playwright extension fixtures and core workflow coverage.
[ ] Add CI for typecheck, lint, unit tests, build, and E2E tests.
[ ] Add bundle-size inspection and record final sizes.
[ ] Complete README, provider guide, architecture, tracker, and decision records.
[ ] Execute manual Chrome verification checklist.
[ ] Audit permissions, secrets, Git status, Git diff, Git log, and tracker.
[ ] Update CHANGELOG.md with changes, commits, and important notes.
[ ] Commit release documentation and push normally.
