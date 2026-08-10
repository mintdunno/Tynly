import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

import type {
  ProviderConnectionTestResult,
  ProviderModelInfo
} from '../../core/providers/types.ts';
import { SettingsStore } from '../../core/settings/settings-store.ts';
import type { AppSettings, CustomStyle } from '../../core/settings/schema.ts';
import { serializeAppError } from '../../shared/errors/index.ts';
import { PRODUCT } from '../../shared/product.ts';
import { ProviderEditor } from './provider-editor.tsx';
import { applyProviderDraft, type ProviderDraft } from './provider-draft.ts';
import { createProviderProfileFromCatalog, type ProviderCatalogEntry } from './provider-catalog.ts';
import type {
  ProviderConnectionStatus,
  ProviderConnectionStatuses
} from './provider-connection-status.ts';
import { ProviderHome, ProviderPicker } from './provider-picker.tsx';
import { ProviderOperationClient } from './provider-operation-client.ts';
import {
  MAX_SHORTCUT_BINDINGS,
  addShortcutBinding,
  createSettingsIdentifier,
  formatShortcut,
  getSourceLanguageOptions,
  getStyleOptions,
  getTargetLanguageOptions,
  parseStyleSelection,
  removeShortcutBinding,
  replaceShortcutBinding,
  shortcutFromKeyboardEvent,
  styleSelectionValue,
  swapLanguages,
  updateLanguage,
  updateSelectedStyle
} from './settings-utils.ts';
import '../extension-page.css';

const settingsStore = new SettingsStore();
const providerOperations = new ProviderOperationClient();

type ShortcutRecordingTarget = number | 'new' | null;

function SettingsApp() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [modelsByProfile, setModelsByProfile] = useState<
    Readonly<Record<string, readonly ProviderModelInfo[]>>
  >({});
  const [providerPickerOpen, setProviderPickerOpen] = useState(false);
  const [recordingShortcut, setRecordingShortcut] = useState<ShortcutRecordingTarget>(null);
  const [providerConnectionStatuses, setProviderConnectionStatuses] =
    useState<ProviderConnectionStatuses>({});
  const providerHomeActionRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let mounted = true;
    void settingsStore
      .get()
      .then((next) => {
        if (!mounted) {
          return;
        }
        setSettings(next);
        setSelectedProfileId(
          next.providers.activeProfileId ?? next.providers.profiles[0]?.id ?? null
        );
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

  const persist = async (
    updater: (current: AppSettings) => AppSettings,
    successNotice?: string
  ): Promise<AppSettings | null> => {
    setSaving(true);
    setError(null);
    try {
      const next = await settingsStore.update(updater);
      setSettings(next);
      if (successNotice !== undefined) {
        setNotice(successNotice);
      }
      return next;
    } catch (reason) {
      setError(serializeAppError(reason).message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  if (settings === null) {
    return (
      <main className="settings-shell" aria-busy="true">
        <h1>{PRODUCT.name} settings</h1>
        <p className="muted">Loading your preferences…</p>
      </main>
    );
  }

  const profiles = settings.providers.profiles;
  const selectedProfile =
    profiles.find((profile) => profile.id === selectedProfileId) ?? profiles[0] ?? null;
  const selectedModels =
    selectedProfile === null ? [] : (modelsByProfile[selectedProfile.id] ?? []);
  const activeProfile =
    profiles.find((profile) => profile.id === settings.providers.activeProfileId) ?? null;
  const saveProvider = async (draft: ProviderDraft): Promise<boolean> => {
    const next = await persist((current) => {
      const previous = current.providers.profiles.find((profile) => profile.id === draft.id);
      if (previous === undefined) {
        return current;
      }
      const updated = applyProviderDraft(previous, draft);
      return {
        ...current,
        providers: {
          ...current.providers,
          profiles: current.providers.profiles.map((profile) =>
            profile.id === draft.id ? updated : profile
          )
        }
      };
    }, 'Provider saved.');
    return next !== null;
  };

  const activateProvider = async (profileId: string): Promise<boolean> => {
    const next = await persist((current) =>
      current.providers.profiles.some((profile) => profile.id === profileId)
        ? {
            ...current,
            providers: { ...current.providers, activeProfileId: profileId }
          }
        : current
    );
    const activated = next?.providers.activeProfileId === profileId;
    if (activated) {
      setNotice('Active provider updated.');
    }
    return activated;
  };

  const updateProviderConnectionStatus = (
    profileId: string,
    status: ProviderConnectionStatus | null
  ): void => {
    setProviderConnectionStatuses((current) => {
      if (status === null) {
        if (current[profileId] === undefined) {
          return current;
        }
        const { [profileId]: _removed, ...remaining } = current;
        return remaining;
      }
      return current[profileId] === status ? current : { ...current, [profileId]: status };
    });
  };

  const deleteProvider = async (profileId: string): Promise<void> => {
    const next = await persist((current) => {
      const profilesAfterDelete = current.providers.profiles.filter(
        (profile) => profile.id !== profileId
      );
      return {
        ...current,
        providers: {
          activeProfileId:
            current.providers.activeProfileId === profileId
              ? (profilesAfterDelete[0]?.id ?? null)
              : current.providers.activeProfileId,
          profiles: profilesAfterDelete
        }
      };
    }, 'Provider removed.');
    if (next !== null) {
      setSelectedProfileId(
        next.providers.activeProfileId ?? next.providers.profiles[0]?.id ?? null
      );
      updateProviderConnectionStatus(profileId, null);
    }
  };

  const refreshModels = async (profileId: string): Promise<void> => {
    setError(null);
    const result = await providerOperations.listModels(profileId);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setModelsByProfile((current) => ({ ...current, [profileId]: result.value }));
    setNotice(
      result.value.length === 0
        ? 'No models were returned. You can still enter a model ID manually.'
        : `Loaded ${result.value.length} model${result.value.length === 1 ? '' : 's'}.`
    );
  };

  const testConnection = async (profileId: string): Promise<ProviderConnectionTestResult> => {
    const result = await providerOperations.testConnection(profileId);
    if (!result.ok) {
      return { error: result.error, ok: false };
    }
    return result.value;
  };

  const addProvider = async (entry: ProviderCatalogEntry): Promise<boolean> => {
    const profile = createProviderProfileFromCatalog(entry, createSettingsIdentifier('profile'));
    const next = await persist(
      (current) => ({
        ...current,
        providers: {
          activeProfileId: current.providers.activeProfileId,
          profiles: [...current.providers.profiles, profile]
        }
      }),
      'Provider added. Enter its key and model, then test the connection.'
    );
    if (next === null) {
      return false;
    }
    setSelectedProfileId(profile.id);
    setProviderPickerOpen(false);
    globalThis.requestAnimationFrame(() => {
      const primaryField = document.getElementById(`provider-${profile.id}-primary`);
      if (primaryField instanceof HTMLInputElement) {
        primaryField.focus();
      }
    });
    return true;
  };

  const closeProviderPicker = (): void => {
    setProviderPickerOpen(false);
    globalThis.requestAnimationFrame(() => providerHomeActionRef.current?.focus());
  };

  const updateCustomStyle = async (style: CustomStyle): Promise<void> => {
    await persist(
      (current) => ({
        ...current,
        styles: {
          ...current.styles,
          custom: current.styles.custom.map((candidate) =>
            candidate.id === style.id ? style : candidate
          )
        }
      }),
      'Custom style saved.'
    );
  };

  const removeCustomStyle = async (styleId: string): Promise<void> => {
    await persist(
      (current) => ({
        ...current,
        styles: {
          custom: current.styles.custom.filter((style) => style.id !== styleId),
          selected:
            current.styles.selected.kind === 'custom' && current.styles.selected.id === styleId
              ? { id: 'natural', kind: 'built-in' }
              : current.styles.selected
        }
      }),
      'Custom style removed.'
    );
  };

  const addCustomStyle = async (name: string, instruction: string): Promise<boolean> => {
    const trimmedName = name.trim();
    const trimmedInstruction = instruction.trim();
    if (trimmedName.length === 0 || trimmedInstruction.length === 0) {
      setError('Enter a name and instruction for the custom style.');
      return false;
    }
    if (settings.styles.custom.length >= 30) {
      setError('You can save up to 30 custom styles.');
      return false;
    }
    const style: CustomStyle = {
      id: createSettingsIdentifier('style'),
      name: trimmedName,
      instruction: trimmedInstruction
    };
    const next = await persist(
      (current) => ({
        ...current,
        styles: { ...current.styles, custom: [...current.styles.custom, style] }
      }),
      'Custom style added.'
    );
    return next !== null;
  };

  const recordKeyboardShortcut = (
    event: KeyboardEvent,
    target: Exclude<ShortcutRecordingTarget, null>
  ): void => {
    const shortcut = shortcutFromKeyboardEvent(event);
    if (shortcut === null) {
      return;
    }
    event.preventDefault();

    const currentBindings = settings.controls.shortcut.shortcuts;
    const nextBindings =
      target === 'new'
        ? addShortcutBinding(currentBindings, shortcut)
        : replaceShortcutBinding(currentBindings, target, shortcut);
    if (nextBindings === null) {
      setError(
        target === 'new' && currentBindings.length >= MAX_SHORTCUT_BINDINGS
          ? `You can save up to ${MAX_SHORTCUT_BINDINGS} keyboard shortcuts.`
          : 'That keyboard shortcut is already in use. Choose a different combination.'
      );
      return;
    }

    setRecordingShortcut(null);
    void persist((current) => {
      const bindings = current.controls.shortcut.shortcuts;
      const updated =
        target === 'new'
          ? addShortcutBinding(bindings, shortcut)
          : replaceShortcutBinding(bindings, target, shortcut);
      if (updated === null) {
        return current;
      }
      return {
        ...current,
        controls: {
          ...current.controls,
          shortcut: { ...current.controls.shortcut, shortcuts: updated }
        }
      };
    });
  };

  const removeKeyboardShortcut = (index: number): void => {
    if (removeShortcutBinding(settings.controls.shortcut.shortcuts, index) === null) {
      return;
    }
    setRecordingShortcut((target) => {
      if (target === 'new' || target === null || target < index) {
        return target;
      }
      return target === index ? null : target - 1;
    });
    void persist((current) => {
      const shortcuts = removeShortcutBinding(current.controls.shortcut.shortcuts, index);
      if (shortcuts === null) {
        return current;
      }
      return {
        ...current,
        controls: {
          ...current.controls,
          shortcut: { ...current.controls.shortcut, shortcuts }
        }
      };
    });
  };

  return (
    <main className="settings-shell" aria-label="Tynly settings">
      <header className="settings-header">
        <div className="settings-header-copy">
          <p className="eyebrow">{PRODUCT.name}</p>
          <h1>Type anything. Send naturally.</h1>
          <p className="muted">Your settings stay local to this browser profile.</p>
        </div>
        <nav aria-label="Settings sections" className="settings-nav">
          <a href="#general">General</a>
          <a href="#behavior">Behavior</a>
          <a href="#controls">Controls</a>
          <a href="#providers">Providers</a>
        </nav>
      </header>

      {error === null ? null : (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {notice === null ? null : (
        <p className="notice" role="status">
          {notice}
        </p>
      )}

      <div className="settings-grid">
        <section
          className="settings-section settings-section--general"
          aria-labelledby="general-title"
          id="general"
        >
          <div className="section-heading">
            <div>
              <h2 id="general-title">General</h2>
              <p>Choose the language pair and writing style used for every transform.</p>
            </div>
          </div>
          <div className="form-grid">
            <label>
              <span>Source language</span>
              <select
                disabled={saving}
                onChange={(event) => {
                  const source = (event.currentTarget as HTMLSelectElement)
                    .value as AppSettings['language']['source'];
                  void persist((current) =>
                    updateLanguage(current, source, current.language.target)
                  );
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
            <label>
              <span>Target language</span>
              <select
                disabled={saving}
                onChange={(event) => {
                  const target = (event.currentTarget as HTMLSelectElement)
                    .value as AppSettings['language']['target'];
                  void persist((current) =>
                    updateLanguage(current, current.language.source, target)
                  );
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
          </div>
          <button
            className="secondary-button"
            disabled={saving || settings.language.source === 'auto'}
            onClick={() => void persist(swapLanguages)}
            type="button"
          >
            Swap languages
          </button>
          <label className="stacked-label">
            <span>Translation style</span>
            <select
              disabled={saving}
              onChange={(event) => {
                const value = (event.currentTarget as HTMLSelectElement).value;
                void persist((current) => {
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

        <section
          className="settings-section settings-section--behavior"
          aria-labelledby="behavior-title"
          id="behavior"
        >
          <div className="section-heading">
            <div>
              <h2 id="behavior-title">Behavior</h2>
              <p>Choose whether Tynly replaces text immediately or asks first.</p>
            </div>
          </div>
          <fieldset className="choice-list">
            <legend>After transformation</legend>
            <label>
              <input
                checked={settings.behavior.afterTransform === 'replace'}
                disabled={saving}
                name="after-transform"
                onChange={() =>
                  void persist((current) => ({
                    ...current,
                    behavior: { ...current.behavior, afterTransform: 'replace' }
                  }))
                }
                type="radio"
              />
              Replace automatically
            </label>
            <label>
              <input
                checked={settings.behavior.afterTransform === 'preview'}
                disabled={saving}
                name="after-transform"
                onChange={() =>
                  void persist((current) => ({
                    ...current,
                    behavior: { ...current.behavior, afterTransform: 'preview' }
                  }))
                }
                type="radio"
              />
              Show a preview
            </label>
          </fieldset>
          <label className="toggle-row">
            <input
              checked={settings.behavior.showUndoNotification}
              disabled={saving}
              onChange={(event) => {
                const showUndoNotification = (event.currentTarget as HTMLInputElement).checked;
                void persist((current) => ({
                  ...current,
                  behavior: { ...current.behavior, showUndoNotification }
                }));
              }}
              type="checkbox"
            />
            Show an Undo notification after automatic replacement
          </label>
        </section>

        <section
          className="settings-section settings-section--controls"
          aria-labelledby="controls-title"
          id="controls"
        >
          <div className="section-heading">
            <div>
              <h2 id="controls-title">Controls</h2>
              <p>Each trigger can be enabled independently.</p>
            </div>
          </div>
          <div className="control-group control-group--shortcuts">
            <label className="toggle-row">
              <input
                checked={settings.controls.shortcut.enabled}
                disabled={saving}
                onChange={(event) => {
                  const enabled = (event.currentTarget as HTMLInputElement).checked;
                  void persist((current) => ({
                    ...current,
                    controls: {
                      ...current.controls,
                      shortcut: { ...current.controls.shortcut, enabled }
                    }
                  }));
                }}
                type="checkbox"
              />
              Enable keyboard shortcut
            </label>
            <p className="muted" id="keyboard-shortcut-help">
              Save up to {MAX_SHORTCUT_BINDINGS} shortcuts. Each shortcut must include Alt, Ctrl, or
              Cmd.
            </p>
            <div
              aria-describedby="keyboard-shortcut-help"
              aria-label="Keyboard shortcut bindings"
              className="shortcut-bindings"
              role="list"
            >
              {settings.controls.shortcut.shortcuts.map((shortcut, index) => {
                const isRecording = recordingShortcut === index;
                const formattedShortcut = formatShortcut(shortcut);
                return (
                  <div className="shortcut-binding" key={formattedShortcut} role="listitem">
                    <span className="shortcut-binding-name">Shortcut {index + 1}</span>
                    <kbd className="shortcut-binding-value">{formattedShortcut}</kbd>
                    <button
                      aria-label={
                        isRecording
                          ? `Record keyboard shortcut ${index + 1}`
                          : `Change keyboard shortcut ${index + 1}, currently ${formattedShortcut}`
                      }
                      aria-pressed={isRecording}
                      className="secondary-button"
                      disabled={saving}
                      onClick={() => {
                        setError(null);
                        setRecordingShortcut((target) => (target === index ? null : index));
                      }}
                      onKeyDown={(event) => {
                        if (isRecording) {
                          if (event.code === 'Escape') {
                            event.preventDefault();
                            setRecordingShortcut(null);
                            return;
                          }
                          recordKeyboardShortcut(event, index);
                        }
                      }}
                      type="button"
                    >
                      {isRecording ? 'Press a key combination' : 'Change'}
                    </button>
                    <button
                      aria-label={`Remove keyboard shortcut ${index + 1}`}
                      className="danger-button"
                      disabled={saving || settings.controls.shortcut.shortcuts.length === 1}
                      onClick={() => removeKeyboardShortcut(index)}
                      title={
                        settings.controls.shortcut.shortcuts.length === 1
                          ? 'At least one keyboard shortcut is required.'
                          : undefined
                      }
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
            {settings.controls.shortcut.shortcuts.length < MAX_SHORTCUT_BINDINGS ? (
              <button
                aria-label={
                  recordingShortcut === 'new'
                    ? 'Record new keyboard shortcut'
                    : 'Add keyboard shortcut'
                }
                aria-pressed={recordingShortcut === 'new'}
                className="secondary-button"
                disabled={saving}
                onClick={() => {
                  setError(null);
                  setRecordingShortcut((target) => (target === 'new' ? null : 'new'));
                }}
                onKeyDown={(event) => {
                  if (recordingShortcut === 'new') {
                    if (event.code === 'Escape') {
                      event.preventDefault();
                      setRecordingShortcut(null);
                      return;
                    }
                    recordKeyboardShortcut(event, 'new');
                  }
                }}
                type="button"
              >
                {recordingShortcut === 'new' ? 'Press a key combination' : 'Add keyboard shortcut'}
              </button>
            ) : null}
            <p aria-live="polite" className="sr-only">
              {recordingShortcut === null
                ? ''
                : recordingShortcut === 'new'
                  ? 'Recording a new keyboard shortcut. Press Alt, Ctrl, or Cmd with another key, or Escape to cancel.'
                  : `Recording keyboard shortcut ${recordingShortcut + 1}. Press Alt, Ctrl, or Cmd with another key, or Escape to cancel.`}
            </p>
          </div>
          <div className="control-group control-group--field form-grid">
            <label className="toggle-row">
              <input
                checked={settings.controls.fieldButton.enabled}
                disabled={saving}
                onChange={(event) => {
                  const enabled = (event.currentTarget as HTMLInputElement).checked;
                  void persist((current) => ({
                    ...current,
                    controls: {
                      ...current.controls,
                      fieldButton: { ...current.controls.fieldButton, enabled }
                    }
                  }));
                }}
                type="checkbox"
              />
              Show a Tynly button in editable fields
            </label>
            <label>
              <span>Field-button position</span>
              <select
                disabled={saving}
                onChange={(event) => {
                  const position = (event.currentTarget as HTMLSelectElement)
                    .value as AppSettings['controls']['fieldButton']['position'];
                  void persist((current) => ({
                    ...current,
                    controls: {
                      ...current.controls,
                      fieldButton: { ...current.controls.fieldButton, position }
                    }
                  }));
                }}
                value={settings.controls.fieldButton.position}
              >
                <option value="bottom-right">Bottom right</option>
                <option value="bottom-left">Bottom left</option>
                <option value="top-right">Top right</option>
                <option value="top-left">Top left</option>
              </select>
            </label>
            <label>
              <span>Field-button appearance</span>
              <select
                disabled={saving}
                onChange={(event) => {
                  const appearance = (event.currentTarget as HTMLSelectElement)
                    .value as AppSettings['controls']['fieldButton']['appearance'];
                  void persist((current) => ({
                    ...current,
                    controls: {
                      ...current.controls,
                      fieldButton: { ...current.controls.fieldButton, appearance }
                    }
                  }));
                }}
                value={settings.controls.fieldButton.appearance}
              >
                <option value="tynly-icon">Tynly icon</option>
                <option value="monochrome-icon">Monochrome icon</option>
              </select>
            </label>
          </div>
          <div className="control-group control-group--selection form-grid">
            <label className="toggle-row">
              <input
                checked={settings.controls.selection.enabled}
                disabled={saving}
                onChange={(event) => {
                  const enabled = (event.currentTarget as HTMLInputElement).checked;
                  void persist((current) => ({
                    ...current,
                    controls: {
                      ...current.controls,
                      selection: { ...current.controls.selection, enabled }
                    }
                  }));
                }}
                type="checkbox"
              />
              Show a button on text selection
            </label>
            <p className="muted">
              Normal webpage selections always show a copyable result and never change the page.
            </p>
          </div>
        </section>

        <section
          className="settings-section settings-section--styles"
          aria-labelledby="styles-title"
          id="styles"
        >
          <div className="section-heading">
            <div>
              <h2 id="styles-title">Custom styles</h2>
              <p>Add your own short writing instructions.</p>
            </div>
          </div>
          <CustomStyles
            disabled={saving}
            onAdd={addCustomStyle}
            onDelete={removeCustomStyle}
            onSave={updateCustomStyle}
            styles={settings.styles.custom}
          />
        </section>

        <section
          className="settings-section settings-section--providers"
          aria-labelledby="providers-title"
          id="providers"
        >
          <div className="section-heading">
            <div>
              <h2 id="providers-title">AI providers</h2>
              <p>Each provider retains its own model selection and private configuration.</p>
            </div>
          </div>
          <ProviderHome
            actionButtonRef={providerHomeActionRef}
            activeProfile={activeProfile}
            connectionStatuses={providerConnectionStatuses}
            disabled={saving}
            onOpenPicker={() => setProviderPickerOpen(true)}
            onSelectProfile={setSelectedProfileId}
            profiles={profiles}
            selectedProfileId={selectedProfile?.id ?? null}
          />
          {providerPickerOpen ? (
            <ProviderPicker
              disabled={saving}
              onChoose={addProvider}
              onClose={closeProviderPicker}
            />
          ) : null}
          {selectedProfile === null ? null : (
            <ProviderEditor
              active={selectedProfile.id === settings.providers.activeProfileId}
              disabled={saving}
              models={selectedModels}
              onActivate={activateProvider}
              onConnectionStatusChange={updateProviderConnectionStatus}
              onDelete={deleteProvider}
              onRefreshModels={(profileId) => refreshModels(profileId)}
              onSave={saveProvider}
              onTestConnection={(profileId) => testConnection(profileId)}
              profile={selectedProfile}
            />
          )}
        </section>

        <section
          className="settings-section settings-section--privacy privacy-section"
          aria-labelledby="privacy-title"
          id="privacy"
        >
          <div className="section-heading">
            <div>
              <h2 id="privacy-title">Privacy</h2>
              <p>
                Provider keys, headers, and tokens stay in local extension storage. They are never
                sent to webpages, inserted into the page, synchronized, or logged by Tynly.
              </p>
            </div>
          </div>
          <p className="muted">
            Text is sent only after you explicitly use a Tynly control. Sensitive fields such as
            passwords and payment inputs are excluded before any provider request is made.
          </p>
        </section>
      </div>
    </main>
  );
}

interface CustomStylesProps {
  readonly disabled: boolean;
  readonly onAdd: (name: string, instruction: string) => Promise<boolean>;
  readonly onDelete: (styleId: string) => Promise<void>;
  readonly onSave: (style: CustomStyle) => Promise<void>;
  readonly styles: readonly CustomStyle[];
}

function CustomStyles({ disabled, onAdd, onDelete, onSave, styles }: CustomStylesProps) {
  const [name, setName] = useState('');
  const [instruction, setInstruction] = useState('');
  const [working, setWorking] = useState(false);

  const add = async () => {
    setWorking(true);
    try {
      if (await onAdd(name, instruction)) {
        setName('');
        setInstruction('');
      }
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="custom-styles">
      {styles.map((style) => (
        <CustomStyleEditor
          disabled={disabled || working}
          key={style.id}
          onDelete={onDelete}
          onSave={onSave}
          style={style}
        />
      ))}
      <div className="custom-style-new">
        <label>
          <span>New style name</span>
          <input
            disabled={disabled || working}
            onInput={(event) => setName((event.currentTarget as HTMLInputElement).value)}
            placeholder="e.g. Friendly support"
            value={name}
          />
        </label>
        <label>
          <span>Instruction</span>
          <textarea
            disabled={disabled || working}
            onInput={(event) => setInstruction(event.currentTarget.value)}
            placeholder="e.g. Warm, helpful, and concise."
            rows={3}
            value={instruction}
          />
        </label>
        <button disabled={disabled || working} onClick={() => void add()} type="button">
          Add custom style
        </button>
      </div>
    </div>
  );
}

function CustomStyleEditor({
  disabled,
  onDelete,
  onSave,
  style
}: {
  readonly disabled: boolean;
  readonly onDelete: (styleId: string) => Promise<void>;
  readonly onSave: (style: CustomStyle) => Promise<void>;
  readonly style: CustomStyle;
}) {
  const [name, setName] = useState(style.name);
  const [instruction, setInstruction] = useState(style.instruction);

  useEffect(() => {
    setName(style.name);
    setInstruction(style.instruction);
  }, [style]);

  return (
    <div className="custom-style-row">
      <label>
        <span>Style name</span>
        <input
          disabled={disabled}
          onInput={(event) => setName((event.currentTarget as HTMLInputElement).value)}
          value={name}
        />
      </label>
      <label>
        <span>Instruction</span>
        <textarea
          disabled={disabled}
          onInput={(event) => setInstruction(event.currentTarget.value)}
          rows={2}
          value={instruction}
        />
      </label>
      <div className="button-row">
        <button
          className="secondary-button"
          disabled={disabled}
          onClick={() =>
            void onSave({ ...style, name: name.trim(), instruction: instruction.trim() })
          }
          type="button"
        >
          Save style
        </button>
        <button
          className="danger-button"
          disabled={disabled}
          onClick={() => {
            if (globalThis.confirm(`Remove ${style.name}?`)) {
              void onDelete(style.id);
            }
          }}
          type="button"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

const root = document.getElementById('app');

if (!root) {
  throw new Error('Tynly settings root is missing.');
}

render(<SettingsApp />, root);
