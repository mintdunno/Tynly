# Tynly Bundle Audit

Run `pnpm bundle:check` before a release or `pnpm bundle:inspect` after an existing production build.
The inspection follows each emitted entry point and its local dependencies, reports raw unpacked
sizes, and fails when a budget is exceeded. Raw sizes make the result reproducible regardless of
the ZIP implementation used to package the extension.

The audit also confirms that the content-script graph excludes the popup/settings entry assets and
the Preact JSX runtime. Shared data-only chunks, such as settings schemas and message contracts,
may be used by more than one context.

## Current production build

Measured after `pnpm bundle:check` on 2026-08-09:

| Load group | Raw emitted size | Budget |
| --- | ---: | ---: |
| Content scripts | 61.6 KiB | 75 KiB |
| Service worker | 56.7 KiB | 80 KiB |
| Popup page | 53.3 KiB | 80 KiB |
| Settings page | 79.7 KiB | 110 KiB |
| Complete unpacked extension | 151.9 KiB | 250 KiB |

The table is updated whenever an intentional production bundle change is accepted.
