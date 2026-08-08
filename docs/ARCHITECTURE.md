# Tynly Architecture

## System boundary

Tynly is a Manifest V3 Chrome extension with four execution boundaries:

1. Content scripts capture editable text, observe focused/selected targets, and render isolated controls.
2. The background service worker owns private settings, provider selection, network calls, timeout/cancellation, and normalized errors.
3. Popup and settings pages are trusted extension UI. They use background messaging and never expose saved secrets after persistence.
4. Provider APIs receive an explicit user-initiated compact transformation request only.

## Transform flow

1. A field icon, selection control, or shortcut calls the same content TransformController.
2. The controller resolves a safe adapter, captures text/range/target revision, and creates an operation ID.
3. It sends a credential-free transform message to the background.
4. The background reads the active profile and its private secrets, builds the centralized prompt, calls the provider adapter, sanitizes the result, and returns plain text or a typed error.
5. The controller rejects stale/disconnected/changed targets. A valid result is replaced, previewed, or displayed in a page-selection popover.
6. A successful editable replacement creates a short-lived, validated Undo record.

## Transform safety rules

- Prompt construction is centralized and provider-neutral. A single compact prompt names the source/target language, applies the resolved style, fixes ordinary text issues, preserves meaning, and asks for text-only output. Auto source detection is part of that same request; the input is appended once beneath an unambiguous `Text:` delimiter.
- There is one active transform operation per stable editor or selection scope. Starting a newer operation aborts the earlier signal. A result is consumed only once when its scope and operation ID still match; cancelled, superseded, wrong-scope, and already-consumed results cannot apply. Target revision checks remain the final DOM safety gate.
- Provider output is sanitized conservatively. Tynly trims outer whitespace and removes only an unmistakable full-output label, one enclosing code fence, or simple enclosing quotes. It rejects empty/non-text output and preserves potentially meaningful prose, labels, quotes, and multiple fences.

## Provider flow

- The background `ProviderService` reads the active private profile, resolves one adapter through `ProviderRegistry`, prepares the centralized prompt, and returns only a sanitized operation-bound result.
- OpenAI, OpenAI-compatible, and Ollama adapters own protocol mapping only. They use API-root URL joining, bounded JSON parsing, safe model discovery, manual model persistence, and capability metadata; they never manipulate DOM or rebuild prompts.
- `HttpClient` is the only provider fetch boundary. It enforces configured timeout bounds, forwards cancellation, maps status metadata to fixed application errors, and never reads failed response bodies.
- Custom headers are validated case-insensitively. Adapter-required authentication and content headers win; Ollama may accept a local custom authorization header, while browser/transport headers are rejected.

## Security and privacy

- Content scripts never receive API keys or raw provider configuration.
- Provider fetches happen only in the service worker.
- Chrome local storage is restricted to trusted extension contexts and is never synced.
- Content receives only a redacted settings projection.
- Secrets never enter page DOM, URLs, logs, analytics, error messages, exports, or tests.
- Custom JSON APIs use data-only templates and safe paths; no eval or arbitrary JavaScript.
- Browser host access is used only because Tynly must operate in text fields across normal web pages. No background network activity occurs until a user action.

## Settings and message boundary

- Persisted settings are versioned and validated as exact own data fields. Migration reconstructs only recognized values and recovers malformed portions without exposing unknown fields.
- Settings writes are serialized so concurrent updates cannot overwrite one another.
- The background produces content settings through an explicit allow-list projection. It includes only the behavior, language, controls, selected style, public custom-style names/IDs, and active-provider summary needed by content UI; it omits custom-style instructions, endpoints, headers, templates, paths, and credentials.
- Runtime message schemas have bounded, exact request shapes. Transform errors cross the boundary only as a fixed per-code user message and retryability flag, never caller-supplied text or diagnostics.
- Provider endpoints are HTTPS-only, except loopback HTTP for a local Ollama profile. URLs with credentials, query strings, or fragments are rejected before provider services exist.

## Initial Manifest permissions

- storage: required for local-only settings and provider configuration.
- clipboardWrite: required only after an explicit Copy action in a Tynly result UI.
- http and https host access: required to show Tynly controls in normal browser text fields and to call user-configured provider endpoints. Chrome-restricted pages and file URLs are intentionally outside the initial scope.

Tynly does not request tabs, activeTab, commands, notifications, identity, history, downloads, scripting, or externally connectable access in the initial manifest.

## Extension boundaries

- The content bundle uses vanilla TypeScript and Shadow DOM; it cannot import provider SDKs or Preact.
- Popup/settings may use Preact in their own bundles.
- Provider adapters own protocol mapping only and never manipulate DOM.
- Input adapters own editor quirks only and never call providers.
- Chrome APIs are accessed through small browser abstractions.

## Brand asset system

The canonical mark is assets/brand/tynly-mark.svg. A deterministic build script renders the manifest's 16, 32, 48, and 128 pixel PNG assets under public/icons. The monochrome SVG preserves the same geometry for future UI contexts. Content controls will reuse the canonical mark rather than Unicode emoji.

## Performance rules

- No polling, full-page scan, continuous AI checks, or automatic language detection.
- Event delegation is used for focus, selection, and keyboard handling.
- Injected UI is lazy and geometry work runs only while visible.
- A normal transform makes one concise API request.
- Bundle size is checked before release, especially the content entry point.
