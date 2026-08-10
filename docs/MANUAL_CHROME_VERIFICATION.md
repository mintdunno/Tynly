# Manual Chrome Verification

Run this checklist against a production `dist` build loaded through `chrome://extensions` with
Developer mode enabled. It complements unit and browser automation because editor behavior and
browser permission surfaces vary by installed Chrome version and page.

## Setup

1. Run `pnpm build` and load the generated `dist` directory as an unpacked extension.
2. Confirm Chrome shows the expected `storage` and `clipboardWrite` API permissions and HTTP/HTTPS
   host access only.
3. Configure a disposable provider profile and model; use a local Ollama instance or a non-production
   test credential where possible. Do not record the credential in the verification result.

## User workflows

- [ ] Open the provider picker. Confirm **Recommended**, **All providers**, and **Advanced** have useful
      choices, All providers includes the compatible and Custom JSON choices, search finds a provider,
      and Cancel returns keyboard focus to the opener. Add a recommended preset and confirm its friendly
      provider name and HTTPS API root are filled while the key and model remain blank.
- [ ] Save a provider, reopen Settings, refresh its models, enter a manual model ID, then click
      **Save & test** immediately after changing its key or model. Confirm the visible Testing state is
      followed by Connected or a fixed safe failure; success must activate that provider and the selected
      model request must use the newly saved configuration.
- [ ] Confirm saved API keys, tokens, and custom headers remain masked after reopening Settings and
      never appear in popup text, page DOM, console output, or safe error messages.
- [ ] On an input, textarea, controlled input, and contenteditable editor, use the field control,
      selected-text control, and every saved shortcut. Each trigger should make one request and return
      the same text.
- [ ] Start with the default `Alt + A`, add or change a second and third unique modifier shortcut,
      then remove one. Confirm duplicate or bare/Shift-only shortcut attempts are rejected and IME,
      AltGraph, repeated, and synthetic keys do not transform text.
- [ ] Set Replace and Preview in **Behavior**. Confirm every trigger follows that one decision;
      Controls must not expose another Replace or Preview setting. Verify Copy, Undo, stale-result
      rejection, and normal-page selection. A normal page selection must show a result without changing
      page text.
- [ ] Verify no control or request occurs for password, OTP, payment/card, readonly, disabled, or
      unsupported editors; also test a recognized PEM private-key block and Luhn-valid card number.
      Do not treat other confidential text, including an unlabeled seed phrase, as automatically detected:
      never paste it into a provider request.

## Visual and accessibility review

- [ ] Inspect the popup and Settings in both light and dark Chrome themes. Confirm their text, cards,
      picker options, provider status, shortcut keycaps, and status messages have sufficient contrast and
      no clipped text.
- [ ] Resize Settings to 620px or narrower. Confirm the cards, provider editor, headers, shortcut
      rows, and action buttons reflow without horizontal scrolling or overlapping controls.
- [ ] Navigate the popup and Settings with the keyboard. Confirm each native control and action has a
      visible focus indicator, sensible label, and usable disabled state.

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

Record Chrome version, operating system, provider used, date, light/dark and narrow-layout result, and
any exception in the release notes. Do not record credentials, complete user text, endpoint query
strings, headers, or provider diagnostics.
