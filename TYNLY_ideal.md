# TYNLY — MASTER PRODUCT & IMPLEMENTATION CONTRACT

You are the lead engineer, product-minded architect, and implementation owner for **Tynly**, a production-quality Chrome extension.

This is not a prototype and not a weekend demo.

You are responsible for:

* architecture
* implementation
* code quality
* performance
* UX correctness
* provider integrations
* extension security
* tests
* documentation
* branding implementation
* migration safety
* Git history
* progress tracking

The most important rule in this entire prompt is the planning gate below.

---

# 0. ABSOLUTE PLANNING GATE — DO NOT CODE YET

## You MUST NOT begin implementation immediately.

Your FIRST task is ONLY to inspect the repository and produce an extremely detailed implementation plan.

Before I explicitly approve your plan, you MUST NOT:

* create files
* modify files
* delete files
* install packages
* modify package.json
* modify lockfiles
* modify configuration
* generate assets
* generate the logo
* run migrations
* run formatting that changes files
* commit anything
* write implementation code
* refactor existing code
* apply patches
* make any persistent filesystem change

Read-only repository inspection is allowed.

Read-only commands are allowed.

Examples:

```text
ls
find
git status
git log
git branch
cat
sed for reading
rg
grep
git diff
```

Do not use a command if it mutates the repository.

---

# 0.1 APPROVAL PHRASE

You may begin implementation ONLY after I explicitly reply with:

```text
APPROVED PLAN
```

Do not interpret:

```text
ok
looks good
continue
nice
go ahead maybe
```

as approval unless it clearly contains the approval phrase.

The exact approval gate is:

```text
APPROVED PLAN
```

Until that phrase appears, remain in planning/revision mode.

---

# 0.2 IF I REQUEST PLAN CHANGES

If I change requirements before approval:

1. revise the plan;
2. show what changed;
3. regenerate affected phases;
4. remain in planning mode;
5. wait again for `APPROVED PLAN`.

Never silently begin coding.

---

# 1. REQUIRED FIRST RESPONSE

After inspecting the repository, your first substantive response must contain a detailed implementation plan.

It must include ALL of the following.

## A. Repository assessment

Explain:

* current repository state
* current architecture if one exists
* package manager
* framework/build system
* TypeScript configuration
* extension manifest status
* existing tests
* Git state
* useful existing code
* technical debt discovered
* constraints that will affect implementation

Do not invent repository facts.

---

## B. Proposed final architecture

Show the proposed directory tree.

Explain the responsibility of each major module.

Explain boundaries between:

```text
content scripts
background/service worker
transform domain
providers
input adapters
settings
storage
UI
undo
messaging
branding
tests
```

---

## C. Phase-by-phase implementation plan

The plan must be divided into concrete phases.

Every phase must include:

```text
Goal
Scope
Files/modules expected
Implementation details
Dependencies
Tests
Acceptance criteria
Risks
Expected Git commit(s)
```

Be specific.

Do not write vague phases such as:

```text
Phase 3: Build features
```

Instead define exactly what will exist after each phase.

---

## D. Dependency plan

List every dependency you intend to add.

For each dependency explain:

```text
why it is necessary
where it will be used
whether it enters the content-script bundle
lighter alternatives considered
```

Tynly must remain lightweight.

Avoid dependencies without strong justification.

---

## E. Performance plan

Define how you will keep:

```text
idle CPU near zero
content-script bundle small
network activity zero until user action
DOM observation minimal
UI lazy
API calls single-request
prompt short
```

Include bundle inspection strategy.

---

## F. Provider integration plan

Explain how the following will work:

```text
OpenAI
OpenAI-compatible
Anthropic
Google Gemini
Ollama
Custom third-party JSON API
```

Include:

```text
model selection
model discovery
manual model ID fallback
connection testing
custom headers
error normalization
timeouts
request cancellation
secret handling
```

---

## G. Input/editor plan

Explain support strategy for:

```text
input
textarea
contenteditable
React-controlled inputs
future rich editors
```

Explain how InputAdapter abstraction will work.

---

## H. Settings/storage plan

Explain:

```text
schema
defaults
versioning
migrations
secret storage
provider configs
selected models
custom styles
shortcut configuration
```

---

## I. Branding/logo plan

Explain how you will implement the Tynly identity and logo assets.

Include:

```text
SVG source
16px icon
32px icon
48px icon
128px icon
floating-button mark
manifest integration
asset organization
```

---

## J. Testing plan

Specify:

```text
unit tests
provider tests
input adapter tests
settings migration tests
browser/e2e tests
manual verification
```

---

## K. Git strategy

Describe exactly how commits will be organized.

Commit history must remain clean and understandable.

---

## L. Risk register

List the important technical risks and mitigation strategy.

Examples:

```text
browser editor compatibility
IME interactions
provider API differences
custom API security
stale AI responses
undo behavior
CSS conflicts
Chrome permission requirements
```

---

## M. Definition of Done

Translate this specification into measurable completion criteria.

---

# 1.1 PLAN QUALITY BAR

The plan must be detailed enough that another competent engineer could implement Tynly from it without needing to redesign the system.

Do not intentionally shorten the plan.

Do not code while creating the plan.

At the end of the planning response say clearly:

```text
STATUS: WAITING FOR APPROVED PLAN
```

Then stop.

---

# 2. AFTER PLAN APPROVAL

After I send:

```text
APPROVED PLAN
```

you may begin implementation.

From that moment forward, implement strictly phase-by-phase.

Do not jump randomly between unrelated features.

---

# 3. IMPLEMENTATION TRACKING IS MANDATORY

Immediately after approval, create project tracking documentation.

At minimum:

```text
docs/IMPLEMENTATION_PLAN.md
docs/IMPLEMENTATION_TRACKER.md
docs/ARCHITECTURE.md
docs/DECISIONS.md
```

Adapt paths if the repository already has an established documentation convention.

---

# 3.1 IMPLEMENTATION_PLAN.md

Record the approved plan.

Do not silently rewrite history.

If the implementation plan changes materially, document the amendment.

---

# 3.2 IMPLEMENTATION_TRACKER.md

This is the live source of truth.

Use explicit states:

```text
[ ] Not started
[-] In progress
[x] Complete
[!] Blocked
```

Break every phase into concrete tasks.

Example:

```text
Phase 3 — Transform Core

[x] Define TransformRequest
[x] Define TransformResult
[x] Implement PromptBuilder
[-] Implement TransformService
[ ] Add stale-response protection
[ ] Add prompt tests
```

Every meaningful implementation task must appear here.

Do not mark anything complete merely because code exists.

Mark complete only when its acceptance criteria/tests pass.

Update this tracker continuously during implementation.

---

# 3.3 DECISIONS.md

Record important architectural decisions.

Examples:

```text
Why vanilla Shadow DOM UI is used in content scripts
Why provider SDKs are avoided
Why custom APIs use safe template interpolation
Why secrets do not enter content scripts
Why shortcut handling uses an in-page abstraction
```

Use short ADR-style entries.

---

# 3.4 NO HIDDEN TASKS

If you discover necessary work not present in the original plan:

1. add it to IMPLEMENTATION_TRACKER;
2. explain why;
3. place it in the correct phase;
4. implement it visibly.

Never quietly perform large untracked work.

---

# 4. PHASE EXECUTION PROTOCOL

For every phase:

## Before coding

State:

```text
PHASE N START
Goal:
Tasks being executed:
Relevant acceptance criteria:
```

Then implement.

## During implementation

Update tracking files as work progresses.

If a material architectural assumption changes, record it.

## Before finishing the phase

Run relevant:

```text
typecheck
lint
unit tests
integration tests
build
```

as appropriate.

## Phase checkpoint

Provide:

```text
PHASE N COMPLETE

Completed:
Tests:
Build status:
Tracker status:
Known limitations:
Commit:
Next phase:
```

Then create the phase's logical Git commit(s).

---

# 5. GIT DISCIPLINE

Git history matters.

Do not create meaningless commits such as:

```text
update
fix
stuff
wip
changes
final
final2
```

Use conventional, descriptive commit messages.

Examples:

```text
chore: initialize Tynly extension architecture

feat(transform): add prompt builder and transform service

feat(providers): add OpenAI-compatible provider adapter

feat(content): add editable-field transform button

feat(selection): add selection transform workflow

feat(settings): add provider and model configuration

feat(brand): add Tynly icon system

test(input): add selection replacement coverage

docs: document provider extension architecture
```

One commit should represent one coherent change.

Do not mix unrelated features in one commit.

Do not commit:

```text
API keys
.env secrets
temporary debug output
generated personal data
local-only credentials
```

Before every commit:

```text
git diff
git status
```

Inspect what will be committed.

If existing unrelated user changes are present, do not overwrite or accidentally commit them.

---

# 5.1 PLAN CHANGES DURING IMPLEMENTATION

After approval, you may handle minor implementation details autonomously.

But if a material deviation becomes necessary, such as:

```text
changing framework
changing architecture
dropping a required provider
adding a major dependency
changing storage strategy
changing permissions materially
removing a required UX flow
```

STOP.

Explain:

```text
Original plan
Problem discovered
Proposed change
Impact
```

Wait for approval before making the material deviation.

---

# 6. PRODUCT IDENTITY

Product name:

# Tynly

Brand concept:

```text
Type Naturally
```

Primary tagline:

```text
Type anything. Send naturally.
```

Chrome Web Store-facing name:

```text
Tynly – AI Translate & Rewrite
```

Short description:

```text
Transform messy, mixed-language text into natural writing instantly.
```

Do not rename Tynly.

Do not make branding provider-specific.

Never call it:

```text
GPT Translator
Claude Translator
Gemini Translator
OpenAI Translator
```

Tynly must remain provider-neutral.

---

# 7. TYNLY LOGO

Create an original minimal logo for Tynly.

The logo should feel:

```text
modern
fast
minimal
recognizable
professional
compact
```

Core visual concept:

```text
a stylized T
+
a subtle visual suggestion of transformation/direction
```

Do not make the logo complicated.

Avoid:

```text
national flags
chatbot robots
provider logos
large "AI" lettering
sparkle-only icon
complex illustration
photorealistic assets
heavy gradients
tiny unreadable details
```

The Chrome 16×16 icon must still be recognizable.

---

# 7.1 LOGO DELIVERABLES

Create a canonical vector source.

Prefer:

```text
assets/brand/tynly-mark.svg
```

Then produce extension icon assets:

```text
icon-16.png
icon-32.png
icon-48.png
icon-128.png
```

Also create, if architecturally useful:

```text
tynly-wordmark.svg
tynly-mark-mono.svg
```

Use the same core mark for the tiny floating transform control.

Do not make the floating UI rely solely on the Unicode sparkle emoji.

---

# 7.2 LOGO IMPLEMENTATION RULES

The logo must be original geometric artwork.

It can be generated directly as SVG code.

Keep SVG clean.

Avoid unnecessary metadata or gigantic paths.

Assets should be replaceable without changing business logic.

Centralize branding metadata.

For example:

```ts
export const PRODUCT = {
  name: "Tynly",
  tagline: "Type anything. Send naturally.",
}
```

Do not hardcode product strings independently throughout dozens of files.

---

# 8. PRODUCT GOAL

Tynly is a lightweight AI translation/rewrite layer for browser text fields.

Primary initial user:

```text
Vietnamese speaker → English communication
```

But architecture must be language-neutral.

Default:

```text
Source: Vietnamese
Target: English
Style: Natural
Behavior: Replace automatically
Text-field icon: ON
Selection button: ON
Shortcut: Alt + A
```

---

# 9. CORE EXPERIENCE

The user can type messy input such as:

```text
mai t ko join meeting dc
```

Tynly transforms it to:

```text
I won't be able to join the meeting tomorrow.
```

Input may contain:

```text
Vietnamese without accents
typos
slang
abbreviations
incorrect grammar
bad English
mixed Vietnamese and English
other languages
technical terms
incomplete phrasing
```

The AI must infer intended meaning.

Tynly is not primarily a literal translation tool.

---

# 10. ONE PRIMARY ACTION

The normal user-facing action is:

```text
Transform
```

Do not force normal users to select:

```text
Fix
Translate
Grammar
Rewrite
Improve
```

before acting.

Conceptually:

```text
messy input
↓
understand
↓
correct
↓
translate if necessary
↓
naturalize
↓
apply style
↓
output
```

Normally using ONE API request.

---

# 11. SOURCE AND TARGET LANGUAGES

Users must choose:

```text
Source language
Target language
```

Source includes:

```text
Auto
Vietnamese
English
Japanese
Korean
Chinese
French
German
Spanish
and extensible others
```

Target is explicit.

Default:

```text
Vietnamese → English
```

Support:

```text
Auto → English
English → English
Vietnamese → Vietnamese
```

Same-language transforms should correct and naturalize rather than translate.

Provide:

```text
⇄ Swap
```

Do not allow an invalid Auto target after swapping.

---

# 12. MIXED-LANGUAGE INPUT

`Auto` source must understand multi-language input as one semantic unit.

Example:

```text
t nghĩ solution này not stable lắm maybe cần test thêm
```

English output:

```text
I don't think this solution is stable enough yet. We may need to test it further.
```

Do not separately translate fragments word-by-word.

---

# 13. THREE EQUAL TRANSFORM TRIGGERS

Tynly MUST work through:

```text
1. keyboard shortcut
2. text-field icon
3. selection floating button
```

Keyboard is optional convenience.

The product must remain fully usable without keyboard shortcuts.

All triggers MUST converge into the same TransformController.

No duplicated transform pipelines.

---

# 14. TEXT-FIELD ICON

When a supported editable field receives focus, show a tiny Tynly transform control.

Example:

```text
┌───────────────────────────────────┐
│ mai t ko join meeting dc       ◉ │
└───────────────────────────────────┘
```

Use the simplified Tynly mark.

Default click behavior:

```text
click
→ transform immediately
→ auto replace
```

Do not open a menu first.

Requirements:

```text
small
subtle
no layout shift
no page CSS pollution
isolated styles
lazy
optional
configurable position
```

User may disable it.

---

# 15. TEXT SELECTION

When text is selected, show a minimal Tynly floating button near the selection.

## Editable selection

Transform only selected text.

Example:

```text
I think [cái deadline này hơi gấp] because...
```

becomes:

```text
I think [this deadline is a bit tight] because...
```

Never replace unrelated surrounding text.

## Normal webpage selection

Never modify normal page content.

Show a compact result popover.

Actions:

```text
Copy
Close
```

Optional secondary actions may remain behind a small More control.

---

# 16. SHORTCUT

Default:

```text
Alt + A
```

It must be customizable from Settings.

Avoid Ctrl+Shift as default due to Vietnamese input-method conflicts.

Create a dedicated shortcut module.

Respect:

```text
compositionstart
compositionend
KeyboardEvent.isComposing
```

Do not transform while IME composition is active.

Ignore inappropriate repeat events.

Handle browser-reserved conflicts gracefully.

Shortcut must never be mandatory.

---

# 17. RESULT BEHAVIOR

Two modes:

```text
Replace automatically
Show preview
```

Default:

```text
Replace automatically
```

---

# 17.1 AUTO REPLACE

Example:

```text
mai t ko join dc
```

trigger →

```text
I won't be able to join.
```

Then subtle toast:

```text
✓ Transformed · Undo
```

No unnecessary popup.

---

# 17.2 PREVIEW

Optional setting.

Show compact result:

```text
Vietnamese → English · Natural

I won't be able to join tomorrow.

Replace   Copy   ⋯
```

Do not create a giant modal.

---

# 18. UNDO

Mandatory.

Automatic replacement without reliable Undo is unacceptable.

Track enough data to restore:

```text
target
original text
replacement text
range
timestamp
operation ID
```

Use native browser undo semantics where possible.

Also expose:

```text
Undo
```

from the Tynly success toast.

Never destroy original text after an API error.

---

# 19. TRANSLATION STYLES

Built-in:

```text
Natural
Professional
Casual
Formal
Concise
Literal
Custom
```

Default:

```text
Natural
```

Internal instructions should remain short.

Suggested mappings:

```text
Natural:
natural and idiomatic

Professional:
professional and concise

Casual:
casual and natural

Formal:
formal and polished

Concise:
concise; remove unnecessary words

Literal:
stay close to original wording
```

Custom styles:

```text
Name
Short instruction
```

Warn/restrict overly long custom instructions.

---

# 20. PROMPT ENGINE — PERFORMANCE CRITICAL

Prompt quality and latency are core features.

Do not use giant prompts.

Do not ask for chain-of-thought.

Do not ask for analysis.

Do not make separate language detection, spellchecking, translation, and rewrite calls.

Normal Transform:

```text
ONE request
ONE result
```

No JSON output unless a future feature specifically requires it.

---

# 20.1 KNOWN SOURCE PROMPT

Keep close to:

```text
Rewrite {source} as natural {target}.
Fix errors, slang, missing diacritics, and mixed-language text.
Preserve meaning; add nothing.
Style: {style}.
Output only the text.
```

---

# 20.2 AUTO SOURCE PROMPT

Keep close to:

```text
Detect the source and write natural {target}.
Fix errors, slang, missing diacritics, and mixed-language text.
Preserve meaning; add nothing.
Style: {style}.
Output only the text.
```

Optimize if you can make it shorter without losing required behavior.

Do not turn it into a huge system message.

---

# 20.3 PRESERVATION RULES

Preserve:

```text
meaning
names
numbers
URLs
technical terms
important formatting
line breaks when meaningful
```

Do not invent:

```text
facts
dates
reasons
promises
deadlines
commitments
```

---

# 20.4 OUTPUT LIMITS

Use a lightweight approximation to set sensible output limits.

Do not add a huge tokenizer dependency solely for this.

Small input → small output budget.

Longer input → proportional safe budget.

Set an absolute maximum.

---

# 20.5 STALE RESPONSE PROTECTION

This is mandatory.

Scenario:

```text
request starts
user edits text
old response arrives
```

Tynly must not overwrite the newly edited text.

Use:

```text
operation IDs
current target validation
AbortController where supported
```

Newest valid operation wins.

---

# 21. AI PROVIDERS

Provider flexibility is a first-class Tynly feature.

Every provider must allow MODEL SELECTION.

Users must not be locked to one vendor.

Initial provider support:

```text
OpenAI
OpenAI-compatible
Anthropic
Google Gemini
Ollama
Custom JSON HTTP API
```

---

# 22. PROVIDER ABSTRACTION

Create a clean interface similar to:

```ts
interface AIProvider {
  readonly id: string
  readonly name: string

  testConnection(
    config: ProviderConfig
  ): Promise<TestResult>

  listModels(
    config: ProviderConfig
  ): Promise<ModelInfo[]>

  transform(
    request: TransformRequest,
    config: ProviderConfig,
    signal?: AbortSignal
  ): Promise<TransformResult>
}
```

Do not scatter:

```ts
if (provider === ...)
```

through business logic.

Use:

```text
ProviderRegistry
ProviderService
provider adapters
capabilities
```

---

# 23. MODEL SELECTION

Every provider configuration owns its selected model.

Do not store one global model shared by all providers.

Example:

```text
OpenAI
→ model A

Gemini
→ model B

Work Gateway
→ model C

Ollama
→ model D
```

Switching providers restores the last model selected for that provider.

Provide:

```text
searchable model selector
Refresh models
manual model ID fallback
```

If model discovery fails:

```text
Enter model ID manually
```

must remain usable.

---

# 24. OPENAI-COMPATIBLE THIRD-PARTY APIS

This is especially important.

Configuration:

```text
Provider name
Base URL
API Key
Model
Custom headers
```

OpenAI-compatible third-party APIs must be treated as real providers, not hacks.

Do not assume `/models` always works.

Support manual model IDs.

---

# 25. CUSTOM JSON HTTP API

Tynly must also support non-OpenAI-compatible third-party APIs.

Advanced Custom API config:

```text
Provider name
Endpoint
HTTP method
Authentication
API key
Custom headers
Model
Optional models endpoint
Request JSON template
Response text path
Timeout
```

Template variables may include:

```text
{{prompt}}
{{text}}
{{model}}
{{source}}
{{target}}
{{style}}
```

No arbitrary JS.

No eval.

Only safe interpolation.

Response extraction should support safe dot paths, for example:

```text
choices.0.message.content
```

Block dangerous path components:

```text
__proto__
prototype
constructor
```

---

# 26. MULTIPLE CUSTOM PROVIDERS

Users can configure:

```text
OpenAI
Gemini
Work Gateway
Cheap Gateway
Local Ollama
+ Add provider
```

Each maintains independent configuration and model selection.

---

# 27. PROVIDER CAPABILITIES

Use capabilities.

Example:

```ts
interface ProviderCapabilities {
  modelDiscovery: boolean
  temperature: boolean
  maxOutputTokens: boolean
  cancellation: boolean
}
```

Settings UI should adapt rather than assume every API behaves identically.

---

# 28. TEST CONNECTION

Every configured provider needs:

```text
Test connection
```

Use a tiny, low-token request.

Verify the selected model works.

Differentiate:

```text
authentication failed
model unavailable
timeout
invalid response
network failure
```

Never expose secrets.

---

# 29. API SECURITY

API secrets must never reach normal webpage JavaScript.

Architecture:

```text
content script
↓ message
extension-controlled provider service
↓
AI API
```

Do not place API keys in DOM.

Do not print secrets.

Do not send secrets to analytics.

Do not sync API keys by default.

---

# 30. SETTINGS UI

Settings must be powerful but feel simple.

Use progressive disclosure.

Main sections:

```text
General
Behavior
Controls
Translation Style
AI Providers
Privacy
Advanced
```

Do not create a dashboard full of cards and graphs.

---

# 31. GENERAL SETTINGS

```text
Source language
[ Vietnamese ▼ ]

Target language
[ English ▼ ]

[ ⇄ Swap ]

Translation style
[ Natural ▼ ]
```

---

# 32. BEHAVIOR SETTINGS

```text
After transformation

● Replace automatically
○ Show preview
```

Default auto replace.

Also:

```text
Show Undo notification
ON
```

Architecture should support trigger-specific behavior.

---

# 33. CONTROLS SETTINGS

## Shortcut

```text
Keyboard shortcut
ON

Alt + A

[ Change ]
```

Implement a shortcut recorder.

## Text-field button

```text
Show in editable fields
ON

Position
[ Bottom right ▼ ]

Appearance
[ Tynly icon ▼ ]

Click
[ Transform immediately ▼ ]
```

## Selection

```text
Show on text selection
ON

Editable selection
[ Replace automatically ▼ ]

Normal webpage selection
[ Show result ▼ ]
```

All three trigger types may be enabled/disabled independently.

---

# 34. AI PROVIDER SETTINGS

Main UI:

```text
AI Provider
[ Work Gateway ▼ ]

Model
[ model-name ▼ ]

[ Configure ]
```

Full configuration only inside provider editor.

Simple first:

```text
Provider type
Base URL if relevant
API key
Model
Refresh models
Test connection
```

Then:

```text
Advanced ▸
```

for:

```text
headers
timeout
temperature
token limits
templates
response paths
```

---

# 35. EXTENSION POPUP

Popup is a quick controller, not a translation textbox.

Keep it compact.

Example:

```text
Tynly

Vietnamese ▼ → English ▼
              ⇄

Style
Natural ▼

AI
Work Gateway · model-name >

Alt + A

Settings ⚙
```

Do not expose API keys here.

---

# 36. INPUT ADAPTER ARCHITECTURE

Create an adapter boundary.

Something like:

```ts
interface InputAdapter {
  canHandle(target: Element): boolean
  getText(): string
  getSelection(): TextRange | null
  replace(
    range: TextRange | null,
    value: string
  ): ReplacementResult
}
```

Create:

```text
InputAdapterRegistry
```

Initial high-quality support:

```text
input
textarea
contenteditable
```

Architecture must allow future support for:

```text
ProseMirror
Lexical
Slate
Quill
CodeMirror
Monaco
```

Do not place editor hacks in TransformController.

---

# 37. CONTROLLED INPUTS

React and similar frameworks may not react correctly to direct `.value =`.

Use appropriate native setters/events.

Dispatch correct input events where needed.

Test controlled input behavior.

---

# 38. SENSITIVE INPUT SAFETY

Never transform obvious sensitive fields.

At minimum exclude:

```text
password
OTP/security code
credit card fields when detectable
private key / seed phrase fields when detectable
```

Do not send password values to providers.

---

# 39. TRANSFORM CONTROLLER

All triggers converge here:

```text
shortcut ───────┐
                │
field icon ─────┼──→ TransformController
                │
selection ──────┘
```

Responsibilities:

```text
resolve target
capture selected/current text
validate
read settings
build request
start operation
loading state
call TransformService
validate operation freshness
replace or preview
register undo
success/error state
```

No provider-specific HTTP logic here.

---

# 40. RECOMMENDED PROJECT STRUCTURE

Prefer a domain-oriented structure similar to:

```text
src/
├── background/
│   ├── service-worker.ts
│   └── messaging/
│
├── content/
│   ├── bootstrap.ts
│   ├── focus/
│   ├── selection/
│   ├── shortcut/
│   └── ui-host/
│
├── core/
│   ├── transform/
│   │   ├── transform-controller.ts
│   │   ├── transform-service.ts
│   │   ├── prompt-builder.ts
│   │   └── types.ts
│   │
│   ├── input/
│   │   ├── input-adapter.ts
│   │   ├── adapter-registry.ts
│   │   └── adapters/
│   │
│   ├── providers/
│   │   ├── provider.ts
│   │   ├── provider-registry.ts
│   │   ├── provider-service.ts
│   │   └── adapters/
│   │
│   ├── settings/
│   │   ├── schema.ts
│   │   ├── defaults.ts
│   │   ├── storage.ts
│   │   └── migrations.ts
│   │
│   └── undo/
│
├── ui/
│   ├── floating-button/
│   ├── selection-button/
│   ├── result-popover/
│   ├── toast/
│   ├── popup/
│   └── settings/
│
├── shared/
│   ├── browser/
│   ├── errors/
│   ├── messaging/
│   ├── constants/
│   ├── logger/
│   └── utils/
│
└── assets/
    └── brand/
```

Improve only when justified.

---

# 41. TECHNOLOGY PRINCIPLES

Use:

```text
TypeScript strict
Manifest V3
```

Injected content UI should favor:

```text
vanilla TypeScript
small DOM helpers
Shadow DOM
```

Popup/settings may use Preact or another lightweight approach if it materially improves maintainability.

Do NOT inject React or another heavy framework into every page merely to display a tiny icon.

Prefer `fetch` instead of giant provider SDKs when practical.

---

# 42. PERFORMANCE BUDGET

Tynly must feel extremely light.

When idle:

```text
no API request
no background text processing
no continuous language detection
no grammar checking
no full-page scanning
near-zero CPU work
```

Avoid broad MutationObservers.

Use event delegation.

Lazy-create injected UI.

Do not mount popup/settings code into content scripts.

Inspect generated bundles before release.

Track bundle sizes.

---

# 43. API PERFORMANCE

Transform path:

```text
trigger
↓
capture text
↓
build very short prompt
↓
one API call
↓
plain text response
↓
replace
```

Do not create unnecessary intermediate pipelines.

Use cancellation and sensible timeouts.

---

# 44. RESULT SANITIZATION

Providers sometimes return:

```text
"Translation:"
quotes
code fences
extra wrapper text
```

Implement a conservative small sanitizer.

Do not corrupt legitimate user content.

Prompt instruction:

```text
Output only the text.
```

remains the main defense.

---

# 45. SETTINGS SCHEMA

Settings must be typed and versioned.

Conceptually:

```ts
interface AppSettings {
  version: number
  language: ...
  behavior: ...
  controls: ...
  styles: ...
  providers: ...
}
```

Use migrations.

Never reset user configuration just because settings evolve.

---

# 46. BROWSER API BOUNDARIES

Do not scatter raw Chrome APIs everywhere.

Create abstractions such as:

```text
ExtensionMessenger
SettingsStore
ShortcutService
PermissionService
```

This also makes future Edge/Firefox work easier.

---

# 47. PERMISSIONS

Use the minimum Chrome permissions necessary.

Do not request broad permissions without reason.

Document every permission.

---

# 48. ERROR MODEL

Create typed errors.

Examples:

```text
AuthenticationError
ModelUnavailableError
TimeoutError
InvalidProviderResponseError
NetworkError
ConfigurationError
```

UI should display understandable messages.

Never delete user text after errors.

---

# 49. UI DESIGN

Tynly visual language:

```text
minimal
compact
calm
fast
modern
clean
```

Avoid:

```text
giant gradients
huge dashboard cards
excess animations
oversized controls
unnecessary menus
```

Dark/light support where reasonable.

Accessible focus states.

Centralized UI strings.

---

# 50. TESTING

Minimum unit coverage:

```text
PromptBuilder
style mappings
Auto source logic
settings defaults
migrations
provider config validation
safe template interpolation
safe response path extraction
shortcut normalization
result sanitizer
```

Provider adapter tests must mock network.

Input tests:

```text
input
textarea
contenteditable
selected-range replacement
whole-text replacement
events
undo metadata
controlled inputs where practical
```

Browser/e2e fixture tests:

```text
floating field button
selection button
auto replacement
preview
undo
normal webpage selection
sensitive field exclusion
shortcut
settings persistence
provider switch
```

Do not make paid external API calls in CI tests.

---

# 51. DOCUMENTATION

Final project must include:

```text
README.md
docs/ARCHITECTURE.md
docs/PROVIDERS.md
docs/IMPLEMENTATION_PLAN.md
docs/IMPLEMENTATION_TRACKER.md
docs/DECISIONS.md
```

README:

```text
setup
development
build
load unpacked
tests
provider configuration
```

PROVIDERS:

```text
provider interface
adding a new provider
model discovery
manual model support
custom API templates
security rules
```

Documentation must match the real implementation.

---

# 52. DEVELOPMENT COMMANDS

Provide convenient scripts such as:

```text
dev
build
typecheck
lint
test
test:e2e
```

If the repository has no package-manager convention, prefer pnpm.

---

# 53. DO NOT BUILD THESE NOW

Tynly is not Grammarly.

Do not add:

```text
real-time grammar underlines
continuous AI analysis
full-page translation
AI chat sidebar
agents
cloud accounts
team dashboards
voice transcription
OCR
image features
analytics
social features
large history dashboards
```

Keep MVP focused.

---

# 54. MVP REQUIRED FEATURES

The implementation is not complete without:

```text
Manifest V3

Tynly branding
Tynly logo assets

Vietnamese → English defaults

Source selector
Source Auto
Target selector
Language swap

Styles
Custom style

Auto Replace default
Preview option
Undo

Text-field Tynly button
Selection Tynly button
Configurable shortcut

input support
textarea support
contenteditable support

Popup
Settings

Provider manager

Model selection PER provider

OpenAI
OpenAI-compatible
Anthropic
Gemini
Ollama
Custom JSON third-party API

Multiple custom provider configs

Model discovery when supported
Manual model ID fallback
Test connection

Short prompt engine

Request cancellation
Stale response protection

Safe secrets handling

Settings schema + migrations

Tests
Documentation
Clean Git history
```

---

# 55. PRODUCT EXAMPLES

## Vietnamese → English

Input:

```text
mai t ko join meeting dc
```

Natural:

```text
I won't be able to join the meeting tomorrow.
```

---

## Auto mixed language

Input:

```text
t think deadline này hơi gấp because team chưa ready
```

Output:

```text
I think this deadline is a bit tight because the team isn't ready yet.
```

---

## English → English

Input:

```text
I no think this can works
```

Output:

```text
I don't think this will work.
```

---

## Selection

Input:

```text
I think [cái này chưa ổn] because...
```

Only selection becomes:

```text
I think [this isn't quite right yet] because...
```

---

## Webpage selection

Selected:

```text
The deployment has been postponed.
```

Target Vietnamese:

```text
Việc triển khai đã bị hoãn.
```

Show result. Do not edit webpage.

---

# 56. ARCHITECTURAL INVARIANTS

These rules must remain true.

### Provider invariant

Adding a provider must not require modifying TransformController.

### Editor invariant

Adding an editor adapter must not require modifying AI provider code.

### Trigger invariant

Adding a trigger must call the existing transform flow.

### Style invariant

Adding a style must not require modifying every provider.

### UI invariant

UI does not know provider HTTP details.

### Provider invariant

Provider adapters do not manipulate DOM.

### Secret invariant

Content scripts never receive API secrets.

### Prompt invariant

Prompt construction is centralized.

### Browser invariant

Chrome-specific APIs are isolated behind small boundaries.

### Performance invariant

Idle activity stays extremely low.

---

# 57. DEFINITION OF DONE

Tynly is not done because it compiles.

It is done when:

```text
approved phases completed
tracker fully reconciled
no unexplained incomplete tasks

build succeeds
typecheck succeeds
lint succeeds
unit tests pass
e2e core tests pass

extension loads in Chrome

field icon works
selection icon works
shortcut works

auto replace works
preview works
undo works

languages persist
styles persist

provider selection works
model selection per provider works

OpenAI-compatible provider works
custom third-party provider architecture works

API secrets stay out of content scripts

prompt stays compact

stale responses cannot overwrite newer text

settings migrations work

Tynly logo appears correctly
16px icon remains recognizable

bundle sizes inspected

README accurate
architecture docs accurate
provider docs accurate

Git history clean
```

---

# 58. FINAL AUDIT

Before finishing the entire project:

## Audit the tracker

Every item must be:

```text
[x] Complete
```

or explicitly listed as an approved known limitation.

No silent unfinished items.

## Audit Git

Review:

```text
git status
git log --oneline
git diff
```

No accidental files.

No secrets.

No random generated junk.

## Audit bundles

Record final bundle sizes.

Ensure content script did not accidentally absorb:

```text
settings UI
large provider SDKs
test libraries
unused framework runtime
```

## Audit UX

Manually verify all major workflows.

---

# 59. FINAL PROJECT REPORT

When all phases are completed, give me a concise but concrete report:

```text
TYNLY IMPLEMENTATION COMPLETE

Phases completed:
Commits:
Core architecture:
Providers implemented:
Editor support:
Settings:
Brand assets:
Tests:
Build:
Bundle sizes:
Known limitations:
Recommended next steps:
```

Reference the tracker.

Do not claim something was completed if it is not tracked and verified.

---

# 60. MOST IMPORTANT ENGINEERING PRIORITIES

When there is a tradeoff, use this order:

```text
1. User text safety
2. Correctness
3. Speed
4. Lightweight runtime
5. Simplicity
6. Maintainability
7. Privacy/security
8. Provider flexibility
9. Visual polish
10. Additional features
```

Do not sacrifice core reliability for feature count.

---

# 61. FINAL PRODUCT PRINCIPLE

Tynly should feel like this:

```text
type badly
→ click tiny Tynly icon
→ done
```

or:

```text
select text
→ click Tynly
→ done
```

or:

```text
type
→ Alt+A
→ done
```

No copying into an AI chat.

No switching tabs.

No complicated menus.

No unnecessary steps.

The codebase should feel just as clean as the product.

---

# 62. YOUR ACTION RIGHT NOW

Do NOT implement anything yet.

Inspect the repository READ-ONLY.

Then produce the complete detailed implementation plan required by Section 1.

Do not modify the filesystem.

Do not install dependencies.

Do not create a commit.

Do not generate logo files yet.

End your response with exactly:

STATUS: WAITING FOR APPROVED PLAN
