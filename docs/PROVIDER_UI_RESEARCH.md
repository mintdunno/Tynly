# Provider Selection UX Research

Research completed 2026-08-10 after feedback that Tynly's provider area is difficult to use.
This is evidence for the next UI phase, not a claim that either reference product's private
implementation should be copied.

## What was reviewed

### Immersive Translate

- Its public site presents one simple user outcome first: translation across web pages, files,
  video, and books. It describes support for more than 20 AI translation engines without making
  the entire catalogue the primary task.
- Its official service documentation has a distinct **Translation Service** concept and separate,
  provider-specific setup guides. The OpenAI-compatible guide instructs the user to select a
  service first, then add the key, model, and optional custom URL.
- Advanced connection data is deliberately separated: its custom-interface route lives under
  beta/developer settings rather than next to common service selection. Its documentation also
  makes cost and provider ownership explicit.

Relevant public sources:

- [Immersive Translate site](https://immersivetranslate.com/)
- [Translation-service documentation](https://immersivetranslate.com/en/docs/services/)
- [AI-service setup documentation](https://immersivetranslate.com/en/docs/services/ai/)
- [OpenAI setup documentation](https://immersivetranslate.com/en/docs/services/openai/)
- [Custom-interface documentation](https://immersivetranslate.com/en/docs/services/custom/)
- [Chrome Web Store listing](https://chromewebstore.google.com/detail/immersive-translate-ai-we/bpoadfkcbjbfhfodiogcnhhhpibjhbnh)

### Trancy

- Its public product and Chrome Web Store positioning are feature-led: bilingual subtitles,
  translation, and language learning. The user is invited to choose an outcome, not an AI vendor.
- I found no public provider-picker or API-key configuration guide in the product page, store
  listing, or public navigation reviewed. That does not prove it has none; it means it is not the
  visible first-run experience.

Relevant public sources:

- [Trancy site](https://www.trancy.org/)
- [Chrome Web Store listing](https://chromewebstore.google.com/detail/trancy-ai-translator-dual/mjdbhokoopacimoekfgkcoogikbfgngb)

## Design conclusion

Tynly must retain bring-your-own-provider support, so it cannot hide provider choice as fully as
Trancy. It should borrow Trancy's outcome-first simplicity and Immersive Translate's separation
between service choice, normal setup, and advanced configuration.

The current UI asks a new user to understand two concepts at once: a configured profile and a new
provider catalogue entry. It uses two native selects side by side, then exposes a full technical
editor. This is accurate but not a friendly first task. It also makes the selected profile and the
active profile feel like competing concepts.

## Recommended Tynly flow

1. **Provider home** — show one current-provider card. With no setup, it says “Choose a provider”
   and has one primary action. With a setup, it shows provider, model, connection state, and
   “Change provider”.
2. **Provider picker** — open a focused panel with search and three visual groups:
   Recommended (OpenAI, Anthropic, Gemini, OpenRouter, Ollama), all supported providers, and
   Advanced setup. Each item states the useful decision fact: API key required, local, or custom.
   It must be keyboard navigable and not rely on a vendor logo.
3. **Setup step** — after one provider is chosen, present only the necessary key and model fields.
   Keep a safe API root prefilled for presets; move URL, headers, and JSON templates into an
   explicit Advanced connection disclosure. The existing Save & test action remains the primary
   completion step.
4. **Ready state** — on a successful test, make that provider active automatically and show a
   credential-safe “Connected” state. Possible visible states are Not set up, Ready to test,
   Testing, Connected, and Needs attention.
5. **Manage providers** — put additional saved providers in a compact secondary list or
   disclosure. A row can be made active, edited, or removed, but the first-run path never starts
   with profile management.

## Boundaries for implementation

- Preserve every existing profile, key, model, and active-provider choice without a migration.
- Do not expose API keys, URLs, headers, or provider response bodies outside trusted extension
  pages.
- Keep all current built-in and OpenAI-compatible presets; this is a presentation redesign, not a
  reduction in provider support.
- Keep model refresh, manual model entry, Save & test, connection error normalization, and the
  three shortcut settings working.
- Test empty state, picker search/category selection, existing-profile management, save/test
  feedback, narrow layout, focus order, and dark mode.
