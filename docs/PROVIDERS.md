# Provider Configuration

Tynly is provider-neutral: a profile selects one adapter, model, and bounded request configuration.
Content-triggered transforms happen in the background service worker only after an explicit
browser-trusted content action; Settings requests stay isolated in trusted extension pages. No provider
SDK is bundled, and provider credentials never enter a content script.

## Common workflow

1. Open **Settings** and add a provider profile.
2. Enter its base URL or endpoint, secret if required, and a model ID.
3. Use **Refresh models** when the provider exposes a model list; a manual model ID remains available
   when discovery is unavailable or intentionally disabled.
4. Save the profile, activate it, and use **Test connection**. The test sends a short `Reply with OK.`
   request with the selected model.

Profiles retain their own selected model. Saved API keys, tokens, and header values are intentionally
blanked in the editor; entering a new value replaces the saved secret, while leaving it blank preserves
the existing one.

## Built-in providers

| Provider | Default API root | Authentication | Model discovery and transform protocol | Custom headers |
| --- | --- | --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | Bearer API key | `GET /models`; `POST /chat/completions` | No |
| OpenAI-compatible | `https://api.openai.com/v1` | Bearer API key | `GET /models`; `POST /chat/completions` | Yes, except adapter-controlled headers |
| Anthropic | `https://api.anthropic.com` | `x-api-key` | `GET /models`; `POST /messages` with the required API version header | No |
| Google Gemini | `https://generativelanguage.googleapis.com` | `x-goog-api-key` | `GET /models`; `POST /models/{model}:generateContent` | No |
| Ollama | `http://localhost:11434` | None by default | `GET /api/tags`; `POST /api/chat` | Yes, including Authorization |

All built-in providers support manual model IDs, model refresh, connection tests, request cancellation,
temperature, and output-token configuration. Tynly uses the provider's non-streaming JSON response
format and returns only plain text to the content workflow.

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
- **Connection test fails:** confirm the selected model exists and the provider accepts the configured
  protocol. The test consumes one small request.
- **Ollama cannot connect:** start Ollama locally, confirm its port, and use a loopback URL such as
  `http://localhost:11434`.
- **A custom endpoint rejects the request:** verify the JSON template, chosen method, authentication,
  required custom headers, and response path against that API's documentation.
- **Settings changed but a page still shows old controls:** reload that page so its content context
  fetches the current redacted settings snapshot.
