# Manual Chrome Verification

Run this checklist against a production `dist` build loaded through `chrome://extensions` with
Developer mode enabled. It complements unit and browser automation because editor behavior and
browser permission surfaces vary by installed Chrome version and page.

## Setup

1. Run `pnpm build` and load the generated `dist` directory as an unpacked extension.
2. Confirm Chrome shows the expected `storage` and `clipboardWrite` API permissions and HTTP/HTTPS
   host access only.
3. Configure a disposable provider profile and model; use a local Ollama instance or a non-production
   test credential where possible.

## User workflows

- [ ] Save a provider, reopen Settings, refresh its models, enter a manual model ID, and run a
  connection test.
- [ ] Confirm saved API keys, tokens, and custom headers remain masked after reopening Settings and
  never appear in popup text, page DOM, console output, or safe error messages.
- [ ] On an input, textarea, controlled input, and contenteditable editor, use the field control,
  selected-text control, and shortcut. Each trigger should make one request and return the same text.
- [ ] Verify Replace, Preview, Copy, Undo, stale-result rejection, and normal-page selection. A normal
  page selection must show a result without changing page text.
- [ ] Verify IME composition and repeated shortcut keys do not transform text.
- [ ] Verify no control or request occurs for password, OTP, payment/card, readonly, disabled, or
  unsupported editors; also test a recognized PEM private-key block and Luhn-valid card number.
  Do not treat other confidential text, including an unlabeled seed phrase, as automatically detected:
  never paste it into a provider request.

## Safety and recovery

- [ ] Trigger a timeout, authentication failure, malformed provider response, cancellation, and page
  navigation. Only generic safe errors should be visible.
- [ ] From page DevTools, attempt a programmatic control click, a matching synthetic `KeyboardEvent`,
  and scripted selection activation. Expected result: zero provider requests.
- [ ] Inspect the Tynly host from page JavaScript. Its `shadowRoot` must be `null`; page scripts must
  not be able to read result text or find action buttons.
- [ ] Test intentional behavior in same-origin and cross-origin iframes, because content scripts use
  `all_frames: true`.
- [ ] Change controls or language in Settings while a page is already open. Reload the page before
  expecting its content UI to reflect the new snapshot.
- [ ] Confirm Copy affects the clipboard only after an explicit Copy click on both HTTP fallback and
  HTTPS pages.
- [ ] Stop and restart the extension service worker in Extensions DevTools, then confirm settings
  persist and a new transform works.
- [ ] Confirm Chrome-restricted pages and file URLs remain unsupported as documented.

## Recording a run

Record Chrome version, operating system, provider used, date, and any exception in the release notes.
Do not record credentials, complete user text, endpoint query strings, headers, or provider diagnostics.
