import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';

import { SettingsStore } from '../../core/settings/settings-store.ts';
import type { AppSettings } from '../../core/settings/schema.ts';
import { serializeAppError } from '../../shared/errors/index.ts';
import { PRODUCT } from '../../shared/product.ts';
import {
  formatShortcutBindings,
  getActiveProvider,
  getSourceLanguageOptions,
  getStyleOptions,
  getTargetLanguageOptions,
  parseStyleSelection,
  styleSelectionValue,
  swapLanguages,
  updateLanguage,
  updateSelectedStyle
} from '../settings/settings-utils.ts';
import '../extension-page.css';

const settingsStore = new SettingsStore();

function PopupApp() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    void settingsStore
      .get()
      .then((next) => {
        if (mounted) {
          setSettings(next);
        }
      })
      .catch((reason: unknown) => {
        if (mounted) {
          setError(serializeAppError(reason).message);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const save = async (updater: (current: AppSettings) => AppSettings): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      setSettings(await settingsStore.update(updater));
    } catch (reason) {
      setError(serializeAppError(reason).message);
    } finally {
      setSaving(false);
    }
  };

  const openSettings = () => {
    void chrome.runtime.openOptionsPage();
  };

  if (settings === null) {
    return (
      <main className="popup-shell" aria-busy="true">
        <strong>{PRODUCT.name}</strong>
        <p className="muted">Loading your preferences…</p>
      </main>
    );
  }

  const activeProvider = getActiveProvider(settings);
  const providerSummary =
    activeProvider === null
      ? 'No provider configured'
      : activeProvider.selectedModelId.trim().length === 0
        ? `${activeProvider.name} · choose a model`
        : `${activeProvider.name} · ${activeProvider.selectedModelId}`;

  return (
    <main className="popup-shell" aria-label="Tynly quick controls">
      <header className="popup-header">
        <div>
          <strong className="product-name">{PRODUCT.name}</strong>
          <p className="muted">{PRODUCT.tagline}</p>
        </div>
      </header>

      {error === null ? null : (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}

      <section className="compact-section" aria-labelledby="popup-language-title">
        <h1 id="popup-language-title">Languages</h1>
        <div className="language-row">
          <label>
            <span className="sr-only">Source language</span>
            <select
              aria-label="Source language"
              disabled={saving}
              onChange={(event) => {
                const source = (event.currentTarget as HTMLSelectElement)
                  .value as AppSettings['language']['source'];
                void save((current) => updateLanguage(current, source, current.language.target));
              }}
              value={settings.language.source}
            >
              {getSourceLanguageOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <span aria-hidden="true">→</span>
          <label>
            <span className="sr-only">Target language</span>
            <select
              aria-label="Target language"
              disabled={saving}
              onChange={(event) => {
                const target = (event.currentTarget as HTMLSelectElement)
                  .value as AppSettings['language']['target'];
                void save((current) => updateLanguage(current, current.language.source, target));
              }}
              value={settings.language.target}
            >
              {getTargetLanguageOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            aria-label="Swap source and target languages"
            className="icon-button"
            disabled={saving || settings.language.source === 'auto'}
            onClick={() => void save(swapLanguages)}
            title={
              settings.language.source === 'auto'
                ? 'Choose a source language before swapping.'
                : 'Swap languages'
            }
            type="button"
          >
            ⇄
          </button>
        </div>
      </section>

      <section className="compact-section">
        <label className="stacked-label">
          <span>Style</span>
          <select
            disabled={saving}
            onChange={(event) => {
              const value = (event.currentTarget as HTMLSelectElement).value;
              void save((current) => {
                const selection = parseStyleSelection(value, current);
                return selection === null ? current : updateSelectedStyle(current, selection);
              });
            }}
            value={styleSelectionValue(settings.styles.selected)}
          >
            {getStyleOptions(settings).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="compact-section provider-summary" aria-label="Active AI provider">
        <span>AI</span>
        <button className="text-button" onClick={openSettings} type="button">
          {providerSummary}
        </button>
      </section>

      <footer className="popup-footer">
        <span className="shortcut-hint">
          {settings.controls.shortcut.enabled
            ? formatShortcutBindings(settings.controls.shortcut.shortcuts)
            : 'Shortcuts off'}
        </span>
        <button className="text-button" onClick={openSettings} type="button">
          Settings
        </button>
      </footer>
    </main>
  );
}

const root = document.getElementById('app');

if (!root) {
  throw new Error('Tynly popup root is missing.');
}

render(<PopupApp />, root);
