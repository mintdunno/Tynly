# Tynly Approved Implementation Plan

## Approval record

The user approved the implementation plan on 2026-08-08 using the required approval phrase. The canonical operational copy is maintained at the repository root in plan.md so every developer can find it immediately. This document records the approved plan snapshot and future material amendments.

## Approved scope

Tynly will be a strict-TypeScript, Manifest V3 Chrome extension for lightweight text transformation. It will support Vietnamese-to-English defaults, language-neutral architecture, input/textarea/contenteditable editors, field/selection/shortcut triggers, replace and preview modes, Undo, settings, popup, original branding, tests, docs, and six provider types: OpenAI, OpenAI-compatible, Anthropic, Gemini, Ollama, and custom JSON APIs.

The architecture is deliberately provider-neutral: content scripts own DOM interaction and contain no credentials; the background service worker owns private configuration and provider fetches; all triggers use one TransformController; adapters isolate editor and provider differences.

## Approved phases

1. Approved-plan handoff and tracking.
2. MV3 foundation and Tynly brand system.
3. Settings, messaging, private storage, and typed errors.
4. Transform domain, prompt, sanitizer, cancellation, and stale-result safety.
5. Provider registry with OpenAI, OpenAI-compatible, and Ollama.
6. Anthropic, Gemini, and secure custom JSON APIs.
7. Input adapters, sensitive-field safety, and Undo.
8. Field, selection, and shortcut content workflows.
9. Popup and progressive settings experience.
10. E2E verification, documentation, release audit, changelog, and normal push.

For each phase, the detailed goal, scope, dependencies, tests, acceptance criteria, risks, and expected commits are in plan.md. The tracker breaks those phases into concrete work.

## Amendment policy

Minor implementation details may be resolved during a phase. A material change to architecture, framework, storage strategy, permissions, required providers, major dependency, or required user flow must be added here and to docs/DECISIONS.md, explained to the user, and approved before implementation proceeds.

## Amendment log

| Date | Change | Approval |
| --- | --- | --- |
| 2026-08-08 | Initial approved plan recorded. | APPROVED PLAN |
