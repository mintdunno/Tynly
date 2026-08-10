# Tynly

> Type anything. Send naturally.

Tynly is a Manifest V3 Chrome extension that turns rough, mixed-language text into natural writing.
It is designed for explicit, one-at-a-time transformations in normal browser text fields, not for
continuous grammar checking or full-page translation.

## What it does

- Supports `input`, `textarea`, and supported `contenteditable` editors.
- Provides three equivalent transform triggers: a field button, selected-text button, and one to
  three configurable modifier-based shortcuts (default: `Alt + A`).
- Defaults to Vietnamese to English, Natural style, and automatic replacement.
- Uses one shared Replace or Preview decision under **Behavior**, then supports Copy and validated
  Undo workflows consistently across every trigger.
- Supports OpenAI, Anthropic, Google Gemini, Ollama, OpenAI-compatible, and secure custom JSON APIs,
  with quick-start presets for OpenRouter, Groq, DeepSeek, Mistral, Together AI, Fireworks,
  Perplexity, and xAI.

## Use Tynly

1. Open the extension's **Settings** page and choose a Quick start, built-in, or advanced provider.
2. Enter a model ID manually or use **Refresh models**, then choose **Save & test**. It saves first
   and sends one small request to the selected model so it can verify the root, credential, and model
   together.
3. Focus an editable field, select text, or use any saved shortcut binding.
4. Choose Replace or Preview once in **Behavior**; when its notification is enabled, Undo is shown after a
   successful editable replacement.

Tynly skips password, payment, and one-time-code fields, as well as text with a PEM private-key
header or a Luhn-valid card number. It cannot identify every secret: never paste confidential text
into a provider request. A page script cannot initiate a transform because content actions require a
browser-trusted user event.

## Privacy and permissions

Provider credentials and private configuration are stored locally in the Chrome profile and are
available only to trusted extension contexts. Content scripts receive a redacted settings snapshot;
they never receive API keys, custom headers, endpoints, request templates, or provider diagnostics.

Provider traffic originates in the background service worker only after an explicit transform,
model-refresh, or connection-test action. Each normal transform makes one provider request. Tynly
does not use analytics, cloud accounts, synced credentials, history, polling, or background
monitoring. When Auto source is selected, detection happens within that single transform request,
not in a separate request.

The extension requests `storage` for local configuration and `clipboardWrite` only for an explicit
Copy action. It has HTTP/HTTPS host access and runs in normal web-page frames so it can work in
editors and call user-configured providers. Chrome-restricted pages and file URLs are not supported.

See [the provider guide](docs/PROVIDERS.md) and [architecture notes](docs/ARCHITECTURE.md) for the
full data-flow and security boundaries.

## Install from source

Requirements: Node.js 22.13.x, pnpm 10.8.x, and a Chromium-based browser for extension testing.

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm build
```

Then open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the
generated `dist` directory.

## Development checks

| Command             | Purpose                                                                   |
| ------------------- | ------------------------------------------------------------------------- |
| `pnpm format:check` | Verify repository formatting.                                             |
| `pnpm typecheck`    | Type-check without emitting files.                                        |
| `pnpm lint`         | Run static lint checks.                                                   |
| `pnpm test`         | Run unit tests.                                                           |
| `pnpm bundle:check` | Build and enforce production bundle budgets.                              |
| `pnpm test:e2e`     | Run the headed Chromium extension workflow against a local mock provider. |
| `pnpm check`        | Run typecheck, lint, unit tests, production build, and bundle audit.      |

Production size limits and current measurements are in [the bundle audit](docs/BUNDLE_AUDIT.md).

## Project references

- [Architecture](docs/ARCHITECTURE.md)
- [Provider configuration guide](docs/PROVIDERS.md)
- [Architecture decisions](docs/DECISIONS.md)
- [Live implementation tracker](docs/IMPLEMENTATION_TRACKER.md)
- [Approved delivery plan](plan.md)
- [Changelog](CHANGELOG.md)

## Known limitations

- Settings changes apply to new/reloaded page contexts. The background uses the latest saved provider
  profile immediately, but an already-open page must be reloaded to refresh its content-control UI.
- Custom providers must expose a JSON HTTP API; executable templates and arbitrary JavaScript are not
  supported.
- Tynly does not intentionally support Chrome-restricted pages, browser internal surfaces, or file
  URLs.
