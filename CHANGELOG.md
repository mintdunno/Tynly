# Changelog

## Unreleased

### Added

- Up to three unique, modifier-based shortcuts for the same transform action; `Alt + A` remains the
  default binding.
- Guided quick-start presets for OpenRouter, Groq, DeepSeek, Mistral, Together AI, Fireworks,
  Perplexity, and xAI.
- A searchable provider picker with Recommended, All providers, and Advanced paths, plus compact
  saved-provider management.
- A Save & test provider action that saves first and verifies the selected model with one small
  real request. A successful check activates that provider.

### Changed

- Behavior is now the only place to choose Replace automatically or Show a preview, so field,
  selection, and shortcut transforms follow one consistent outcome.
- Provider model refresh, connection checks, and transforms read the latest persisted settings after
  a Settings save.
- The popup and Settings pages use a responsive, accessible, light/dark minimalist interface with a
  clearer provider setup flow and compact shortcut controls.
- Normal provider setup now puts the API key and model first, with roots, headers, timeouts, and custom
  connection details under Advanced connection.
- The public README now provides GitHub Release installation steps, a quick provider setup guide,
  plain-language privacy boundaries, and focused developer references.

### Verification

- On 2026-08-10, formatting, typecheck, lint, all 238 unit tests, production build, bundle audit,
  and two extension E2E workflows passed.
- Light, dark, and narrow provider-setup layouts were inspected; the production manifest and emitted
  extension-page HTML were also checked.
- Manual unpacked-Chrome verification remains required before release. Record its date, Chrome
  version, operating system, provider type, visual result, and any exception without recording
  secrets or provider diagnostics.

### Commits

- `c674c27` — `feat: simplify controls and add shortcut bindings`
- `a39fb42` — `feat: improve provider setup and connection checks`
- `ae9611b` — `feat: refine Tynly settings experience`
- `5117575` — `feat: add provider home and picker`
- `d0cc4a5` — `feat: streamline provider setup management`
- `bbfd17c` — `test: cover provider selection workflow`
- `891b213` — `docs: refresh public README`

### Important notes

- Save & test can consume one small provider request. It displays only fixed, credential-safe status
  messages; provider response bodies, API roots, headers, and secrets are not shown.
- Provider credentials remain local to trusted extension contexts. Content scripts receive only a
  redacted settings snapshot.
- GitHub Release installs require Chrome Developer mode and are updated manually. Upload built ZIP files
  as release assets rather than committing them to the repository.
