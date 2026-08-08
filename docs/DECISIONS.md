# Tynly Architecture Decisions

## ADR-001 — Use Manifest V3, pnpm, Vite, and strict TypeScript

Status: accepted.

Tynly starts from an empty repository. pnpm is chosen because the product contract prefers it where no package-manager convention exists. Vite plus a Chrome-extension Vite plugin provides separate MV3 entry points. Strict TypeScript makes cross-context messages, provider profiles, migrations, and editor replacements safer.

## ADR-002 — Keep content UI framework-free

Status: accepted.

Content scripts will use small vanilla TypeScript DOM helpers inside Shadow DOM. Preact is permitted only for separately built popup and settings pages. This prevents a UI framework from becoming part of every visited page's runtime cost.

## ADR-003 — Background owns provider fetches and secrets

Status: accepted.

The content script never receives API keys. It sends only a typed transform request to the background service worker, which reads private provider configuration and performs fetch. Storage is local-only and restricted to trusted contexts; settings exposed to content are redacted.

## ADR-004 — Use native fetch rather than provider SDKs

Status: accepted.

Provider SDKs add bundle weight and blur protocol behavior. Small provider adapters using fetch keep requests, cancellation, model discovery, and error mapping explicit and independently testable.

## ADR-005 — Support custom APIs with data-only templates

Status: accepted.

Custom JSON request templates are parsed as JSON and only approved variables are interpolated into string values. Response paths reject prototype-pollution components. Arbitrary JavaScript, eval, and executable templates are prohibited.

## ADR-006 — Preserve user text over convenience

Status: accepted.

Every replacement is guarded by operation IDs and target revision validation. Sensitive fields are excluded. Undo is mandatory and must not overwrite edits made after the transform. The normal path uses one request and no automatic retry.

## ADR-007 — Maintain visible phase governance

Status: accepted.

The root plan, approved-plan record, live tracker, and ADR log are required project artifacts. Each implementation phase is reviewed and committed independently under AGENTS.md rules.

## ADR-008 — Use the minimum practical initial Manifest permissions

Status: accepted.

Tynly needs storage for local configuration, clipboardWrite for an explicit copy action, and HTTP/HTTPS host access because it must render controls in normal browser text fields and call user-selected providers. It deliberately omits tabs, activeTab, commands, notifications, and broad unrelated APIs. The permission rationale is maintained in docs/ARCHITECTURE.md.
