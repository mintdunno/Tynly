# Provider Configuration

Tynly is provider-neutral: a profile selects one adapter, model, and bounded request configuration.
Content-triggered transforms happen in the background service worker only after an explicit
browser-trusted content action; Settings requests stay isolated in trusted extension pages. No provider
SDK is bundled, and provider credentials never enter a content script.

## Common workflow

1. Open **Settings** and choose a **Quick start**, **Built-in provider**, or **Advanced setup**
   profile type.
2. Quick-start choices fill a safe API root for a popular compatible provider. Enter the required
   secret and model ID; a manual model ID is always valid when discovery is unavailable.
3. Use **Refresh models** when the provider exposes a model list.
4. Choose **Save & test**. Tynly saves that profile first, then sends one small `Reply with OK.`
   request to its selected model. This verifies the API root, credential, and model together and
   can consume provider usage.
5. Choose **Use this provider** when the saved profile should handle future transforms.

Profiles retain their own selected model. Saved API keys, tokens, and header values are intentionally
blanked in the editor; entering a new value replaces the saved secret, while leaving it blank preserves
the existing one. Save & test reports **Testing**, **Connected**, or a fixed safe failure. It never
renders provider diagnostics, endpoints, headers, or secrets, and it reads the just-saved persisted
profile rather than a stale background cache.

## Quick-start compatible presets

These presets share Tynly's existing OpenAI-compatible chat adapter. Each creates a new local profile
with the listed HTTPS API root and friendly name, but never fills a credential or model. Use its
provider documentation to obtain a key and model ID.

| Preset      | Prefilled API root                      |
| ----------- | --------------------------------------- |
| OpenRouter  | `https://openrouter.ai/api/v1`          |
| Groq        | `https://api.groq.com/openai/v1`        |
| DeepSeek    | `https://api.deepseek.com/v1`           |
| Mistral     | `https://api.mistral.ai/v1`             |
| Together AI | `https://api.together.xyz/v1`           |
| Fireworks   | `https://api.fireworks.ai/inference/v1` |
| Perplexity  | `https://api.perplexity.ai`             |
| xAI         | `https://api.x.ai/v1`                   |

The **OpenAI-compatible API** advanced choice remains available for another compatible API root.

## Built-in providers

| Provider          | Default API root                            | Authentication   | Model discovery and transform protocol                               | Custom headers                         |
| ----------------- | ------------------------------------------- | ---------------- | -------------------------------------------------------------------- | -------------------------------------- |
| OpenAI            | `https://api.openai.com/v1`                 | Bearer API key   | `GET /models`; `POST /chat/completions`                              | No                                     |
| OpenAI-compatible | `https://api.openai.com/v1`                 | Bearer API key   | `GET /models`; `POST /chat/completions`                              | Yes, except adapter-controlled headers |
| Anthropic         | `https://api.anthropic.com`                 | `x-api-key`      | `GET /models`; `POST /messages` with the required API version header | No                                     |
| Google Gemini     | `https://generativelanguage.googleapis.com` | `x-goog-api-key` | `GET /models`; `POST /models/{model}:generateContent`                | No                                     |
| Ollama            | `http://localhost:11434`                    | None by default  | `GET /api/tags`; `POST /api/chat`                                    | Yes, including Authorization           |

Built-in and compatible profiles support manual model IDs, model refresh where the provider exposes it,
connection checks, request cancellation, and their supported generation settings. Tynly uses the
provider's non-streaming JSON response format and returns only plain text to the content workflow.

Use an API root, not a complete operation endpoint, for the built-in adapters. URLs must not contain
credentials, query parameters, or fragments. HTTPS is required except for an Ollama server on
`localhost`, `127.0.0.0/8`, or `[::1]`; local HTTP is intentionally limited to that loopback case.

## Custom JSON APIs

The **Custom JSON API** profile is for a JSON HTTP endpoint that cannot use one of the built-in
protocols. It supports `POST`, `PUT`, and `PATCH`, optional Bearer or custom-header authentication,
optional custom headers, an optional model-list endpoint, a request JSON template, and a dot-path to
the response text.

The request template must be a JSON object. Only string values can interpolate these placeholders:

```text
{{prompt}}  {{text}}  {{model}}  {{source}}  {{target}}  {{style}}
```

For example, the default OpenAI-shaped template is:

```json
{
  "model": "{{model}}",
  "prompt": "{{prompt}}"
}
```

Use a dot-only response path such as `choices.0.message.content`. Object properties and numeric array
indexes are supported. Prototype-related path components and executable configuration are rejected.
The optional model endpoint may return a top-level array or a `data` or `models` array of IDs, strings,
or objects with an `id`, `name`, or `model` field.

Custom templates are data only: Tynly does not execute JavaScript, evaluate expressions, or interpolate
object keys. Browser- and transport-controlled headers such as `Cookie`, `Host`, `Origin`,
`Content-Type`, and `User-Agent` are rejected. The adapter sets JSON `Accept` and `Content-Type`
itself; authentication headers cannot be silently overwritten by a duplicate custom header.

## Timeouts, cancellation, and errors

Each profile has a timeout from 1 to 120 seconds (30 seconds by default). Cancellation from a newer
transform is forwarded to the active provider request. Successful response bodies are size-bounded;
failed response bodies are never read because they can contain sensitive diagnostics.

The UI reports fixed safe errors such as authentication failure, unavailable model, timeout, network
failure, or invalid response. Provider response bodies, endpoint URLs, request text, headers, and
credentials are not shown in the UI or passed across the extension message boundary.

## Troubleshooting

- **Model refresh fails:** save or re-check the base URL and credentials, then enter a supported model
  ID manually if the provider does not grant model-list access.
- **Save & test fails:** confirm the selected model exists and the provider accepts the configured
  protocol. The test consumes one small request; only a safe fixed failure is shown, so use the
  provider's own dashboard or documentation for detailed diagnostics.
- **Ollama cannot connect:** start Ollama locally, confirm its port, and use a loopback URL such as
  `http://localhost:11434`.
- **A custom endpoint rejects the request:** verify the JSON template, chosen method, authentication,
  required custom headers, and response path against that API's documentation.
- **Settings changed but a page still shows old controls:** reload that page so its content context
  fetches the current redacted settings snapshot.
