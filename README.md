<div align="center">
  <img src="assets/brand/tynly-mark.svg" alt="Tynly" width="72" />

  <h1>Tynly</h1>

  <p><strong>Type anything. Send naturally.</strong></p>

  <p>
    A local-first, provider-neutral Chrome extension that turns rough or mixed-language text into clear,
    natural writing - right where you write.
  </p>

  <p>
    <a href="#install">Install from GitHub</a> ·
    <a href="#your-first-setup">Set up a provider</a> ·
    <a href="#privacy-first">Privacy</a> ·
    <a href="#development">Developer guide</a>
  </p>
</div>

---

## Write naturally, without changing how you work

Tynly transforms text only when you ask it to. Use the field button, select text on a page, or press a
shortcut. For editable text, you decide whether the result replaces your text immediately or appears as
a preview; normal page selections always show a copyable result without changing the page.

- Works in normal `input`, `textarea`, and supported `contenteditable` editors.
- Lets you choose one behavior for editable text: **Replace automatically** or **Show a preview**.
- Supports one to three configurable shortcuts; `Alt + A` is the default.
- Each shortcut uses `Alt`, `Ctrl`, or `Cmd` to avoid ordinary typing conflicts.
- Lets you bring your own AI provider, model, and credentials.
- Includes Copy and safe Undo for editable-field replacements.

## Install

### Install from a GitHub Release

This is the easiest way to use Tynly without installing Node.js or building the project yourself.
Tynly requires Chrome 102 or newer.

1. Open the [Releases page](../../releases) and download the latest
   `tynly-extension-v*.zip` asset. Do **not** use GitHub's automatic “Source code” ZIP.
2. Extract the downloaded ZIP to a folder you will keep on your computer.
3. Open `chrome://extensions` in Chrome.
4. Turn on **Developer mode**.
5. Select **Load unpacked** and choose the extracted folder containing `manifest.json`.
6. Pin Tynly from Chrome's extensions menu, then open **Settings** to configure it.

> GitHub installs are manual: Chrome will not update the extension automatically. Download and load a
> newer release when one is available. Some managed work or school browsers may block Developer mode.

### Build it yourself

For a local build, install Node.js `22.13.x`, pnpm `10.8.x`, and a Chromium-based browser.

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm build
```

Then load the generated `dist` folder with the same **Load unpacked** steps above.

## Your first setup

1. Open **Tynly Settings** and select a provider from **Recommended**, **All providers**, or
   **Advanced**.
2. Enter the API key if the provider needs one, then choose a model. You can enter a model ID manually
   or use **Refresh models** when it is available.
3. Select **Save & test**. Tynly saves the profile first, sends one small test request, and activates
   the provider only after the check succeeds.
4. Write in any supported editor and use Tynly's field button, selected-text action, or shortcut.

Most people only need an API key and model ID. **Advanced connection** keeps API roots, headers,
timeouts, and custom API fields out of the normal path.

> **Save & test** can use a small amount of your provider's quota. Choose **Save without testing** if
> you only want to store a draft.

## Providers

Choose the service that fits how you work:

- **Direct providers:** OpenAI, Anthropic, Google Gemini, and Ollama.
- **Compatible providers:** OpenRouter, Groq, DeepSeek, Mistral, Together AI, Fireworks, Perplexity,
  xAI, or another OpenAI-compatible API.
- **Advanced setup:** a custom JSON HTTP API with a request template and defined response path.

Each saved provider keeps its own model and private configuration. See the
[provider configuration guide](docs/PROVIDERS.md) for supported protocols and troubleshooting.

## Privacy first

- Your API keys, headers, endpoints, and provider configuration stay in local Chrome storage.
- Text is sent only after an explicit Tynly action, model refresh, or connection test.
- Provider requests run in the extension's background service worker - never in a webpage.
- Tynly has no analytics, account system, cloud sync, background polling, or continuous AI checking.
- Saved secrets are masked in Settings and never exposed to page scripts.

Tynly skips password, payment, and one-time-code fields, plus recognized PEM private keys and
Luhn-valid card numbers. It cannot recognize every secret, so never send confidential text to a
provider unless you are comfortable with that provider's privacy policy.

When you use a provider, Tynly sends the selected text and the credentials required to authenticate that
request directly to the provider you configured. That provider's own privacy policy and terms apply.

### Permissions and boundaries

Tynly requests `storage` for local settings and `clipboardWrite` only after you explicitly choose
**Copy**. It has HTTP/HTTPS host access so it can work in text editors on normal webpages and contact
your chosen provider. Chrome-internal pages and file URLs are not supported.

## Development

| Command             | What it checks                                                |
| ------------------- | ------------------------------------------------------------- |
| `pnpm format:check` | Formatting                                                    |
| `pnpm typecheck`    | TypeScript types                                              |
| `pnpm lint`         | Static lint rules                                             |
| `pnpm test`         | Unit tests                                                    |
| `pnpm bundle:check` | Production build and bundle-size limits                       |
| `pnpm test:e2e`     | Headed Chromium extension workflow with a local mock provider |
| `pnpm check`        | Typecheck, lint, unit tests, build, and bundle audit          |

Before publishing a release, follow the [manual Chrome verification checklist](docs/MANUAL_CHROME_VERIFICATION.md).

## Learn more

- [Provider configuration](docs/PROVIDERS.md)
- [Architecture and security boundaries](docs/ARCHITECTURE.md)
- [Bundle audit](docs/BUNDLE_AUDIT.md)
- [Changelog](CHANGELOG.md)

## Known limits

- Settings changes apply immediately to the background service worker; reload an already-open webpage
  before expecting its Tynly controls to reflect a settings change.
- Custom providers must expose a JSON HTTP API. Executable templates and arbitrary JavaScript are not
  supported.
- Chrome-restricted pages, browser internal surfaces, and file URLs are intentionally unsupported.
