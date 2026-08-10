# Changelog

## Unreleased

### Added

- Up to three unique, modifier-based shortcuts for the same transform action; `Alt + A` remains the
  default binding.
- Guided quick-start presets for OpenRouter, Groq, DeepSeek, Mistral, Together AI, Fireworks,
  Perplexity, and xAI.
- A Save & test provider action that saves first and verifies the selected model with one small
  real request.

### Changed

- Behavior is now the only place to choose Replace automatically or Show a preview, so field,
  selection, and shortcut transforms follow one consistent outcome.
- Provider model refresh, connection checks, and transforms read the latest persisted settings after
  a Settings save.
- The popup and Settings pages use a responsive, accessible, light/dark minimalist interface with a
  clearer provider setup flow and compact shortcut controls.

### Verification

- On 2026-08-10, formatting, typecheck, lint, all 226 unit tests, production build, bundle audit,
  and the extension E2E workflow passed.
- Manual unpacked-Chrome verification remains required before release. Record its date, Chrome
  version, operating system, provider type, visual result, and any exception without recording
  secrets or provider diagnostics.

### Commits

- `c674c27` — `feat: simplify controls and add shortcut bindings`
- `a39fb42` — `feat: improve provider setup and connection checks`
- `ae9611b` — `feat: refine Tynly settings experience`

### Important notes

- Save & test can consume one small provider request. It displays only fixed, credential-safe status
  messages; provider response bodies, API roots, headers, and secrets are not shown.
- Provider credentials remain local to trusted extension contexts. Content scripts receive only a
  redacted settings snapshot.
