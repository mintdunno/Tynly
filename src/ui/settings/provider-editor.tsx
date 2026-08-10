import { useEffect, useRef, useState } from 'preact/hooks';

import type {
  ProviderConnectionTestResult,
  ProviderModelInfo
} from '../../core/providers/types.ts';
import type { ProviderProfile } from '../../core/settings/schema.ts';
import { APP_ERROR_USER_MESSAGES } from '../../shared/errors/index.ts';

import {
  addHeaderDraft,
  toProviderDraft,
  type HeaderDraft,
  type ProviderDraft
} from './provider-draft.ts';
import { PROVIDER_CAPABILITIES, PROVIDER_KIND_LABELS } from './settings-utils.ts';

export interface ProviderEditorProps {
  readonly active: boolean;
  readonly disabled: boolean;
  readonly models: readonly ProviderModelInfo[];
  readonly onActivate: (profileId: string) => Promise<void>;
  readonly onDelete: (profileId: string) => Promise<void>;
  readonly onRefreshModels: (profileId: string) => Promise<void>;
  readonly onSave: (draft: ProviderDraft) => Promise<boolean>;
  /** Checks whether the saved profile's selected model accepts a tiny request. */
  readonly onTestConnection: (profileId: string) => Promise<ProviderConnectionTestResult>;
  readonly profile: ProviderProfile | null;
  readonly status: string | null;
}

type ConnectionFeedback =
  | { readonly kind: 'testing' }
  | { readonly kind: 'connected' }
  | { readonly kind: 'failed'; readonly message: string };

const FALLBACK_CONNECTION_FAILURE =
  'Couldn’t connect. Check the API root, key, and selected model, then try again.';
const SAVE_CONNECTION_FAILURE =
  'Couldn’t save this provider, so it was not tested. Check the fields and try again.';

/** Progressive, secret-masked editor for one persisted provider profile. */
export function ProviderEditor({
  active,
  disabled,
  models,
  onActivate,
  onDelete,
  onRefreshModels,
  onSave,
  onTestConnection,
  profile,
  status
}: ProviderEditorProps) {
  const [draft, setDraft] = useState<ProviderDraft | null>(
    profile === null ? null : toProviderDraft(profile)
  );
  const [working, setWorking] = useState(false);
  const [connectionFeedback, setConnectionFeedback] = useState<ConnectionFeedback | null>(null);
  const connectionAttempt = useRef(0);
  const currentProfileId = useRef<string | null>(profile?.id ?? null);

  useEffect(() => {
    setDraft(profile === null ? null : toProviderDraft(profile));
  }, [profile]);

  useEffect(() => {
    const nextProfileId = profile?.id ?? null;
    if (currentProfileId.current === nextProfileId) {
      return;
    }
    currentProfileId.current = nextProfileId;
    connectionAttempt.current += 1;
    setConnectionFeedback(null);
  }, [profile?.id]);

  if (draft === null || profile === null) {
    return <p className="muted">Add a provider to configure Tynly.</p>;
  }

  const capabilities = PROVIDER_CAPABILITIES[draft.kind];
  const fieldPrefix = `provider-${draft.id}`;
  const unavailable = disabled || working;

  const clearConnectionFeedback = () => {
    connectionAttempt.current += 1;
    setConnectionFeedback(null);
  };

  const updateDraft = (
    next: ProviderDraft | ((current: ProviderDraft | null) => ProviderDraft | null)
  ) => {
    clearConnectionFeedback();
    setDraft(next);
  };

  const saveDraft = async (): Promise<boolean> => {
    setWorking(true);
    try {
      return await onSave(draft);
    } finally {
      setWorking(false);
    }
  };

  const refreshModels = async (): Promise<void> => {
    setWorking(true);
    try {
      if (await onSave(draft)) {
        await onRefreshModels(draft.id);
      }
    } finally {
      setWorking(false);
    }
  };

  const activateProvider = async (): Promise<void> => {
    setWorking(true);
    try {
      if (await onSave(draft)) {
        await onActivate(draft.id);
      }
    } finally {
      setWorking(false);
    }
  };

  const isCurrentConnectionAttempt = (attempt: number, profileId: string) =>
    connectionAttempt.current === attempt && currentProfileId.current === profileId;

  const testConnection = async (): Promise<void> => {
    const profileId = draft.id;
    const attempt = connectionAttempt.current + 1;
    connectionAttempt.current = attempt;
    setConnectionFeedback({ kind: 'testing' });
    setWorking(true);
    try {
      if (!(await onSave(draft))) {
        if (isCurrentConnectionAttempt(attempt, profileId)) {
          setConnectionFeedback({ kind: 'failed', message: SAVE_CONNECTION_FAILURE });
        }
        return;
      }
      const result = await onTestConnection(profileId);
      if (isCurrentConnectionAttempt(attempt, profileId)) {
        setConnectionFeedback(
          result.ok
            ? { kind: 'connected' }
            : { kind: 'failed', message: APP_ERROR_USER_MESSAGES[result.error.code] }
        );
      }
    } catch {
      if (isCurrentConnectionAttempt(attempt, profileId)) {
        setConnectionFeedback({ kind: 'failed', message: FALLBACK_CONNECTION_FAILURE });
      }
    } finally {
      setWorking(false);
    }
  };

  const updateCommon = (
    field: 'name' | 'selectedModelId' | 'timeoutMs' | 'temperature' | 'maxOutputTokens',
    value: string
  ) => {
    updateDraft((current) => (current === null ? null : { ...current, [field]: value }));
  };

  const updateHeaders = (index: number, field: 'name' | 'value', value: string) => {
    updateDraft((current) => {
      if (current === null || !hasHeaders(current)) {
        return current;
      }
      return {
        ...current,
        headers: current.headers.map((header, currentIndex) =>
          currentIndex === index ? { ...header, [field]: value } : header
        )
      };
    });
  };

  const addHeader = () => {
    updateDraft((current) =>
      current === null || !hasHeaders(current)
        ? current
        : { ...current, headers: addHeaderDraft(current.headers) }
    );
  };

  const removeHeader = (index: number) => {
    updateDraft((current) =>
      current === null || !hasHeaders(current)
        ? current
        : {
            ...current,
            headers: current.headers.filter((_, currentIndex) => currentIndex !== index)
          }
    );
  };

  return (
    <section
      aria-label={`${PROVIDER_KIND_LABELS[draft.kind]} configuration`}
      className={`provider-editor${active ? ' provider-editor--active' : ''}`}
    >
      <div className="provider-editor-heading">
        <div>
          <h3>{draft.name}</h3>
          <p className="muted">
            {PROVIDER_KIND_LABELS[draft.kind]} · secrets are masked after saving and never appear in
            this form.
          </p>
        </div>
        <button
          className="text-button"
          disabled={unavailable || active}
          onClick={() => void activateProvider()}
          type="button"
        >
          {active ? 'Active provider' : 'Use this provider'}
        </button>
      </div>

      {status === null ? null : (
        <p className="notice" role="status">
          {status}
        </p>
      )}

      <div className="form-grid">
        <label>
          <span>Provider name</span>
          <input
            id={`${fieldPrefix}-name`}
            disabled={unavailable}
            onInput={(event) =>
              updateCommon('name', (event.currentTarget as HTMLInputElement).value)
            }
            value={draft.name}
          />
        </label>
        <label>
          <span>Model ID</span>
          <input
            aria-describedby={`${fieldPrefix}-model-help`}
            disabled={unavailable}
            list={`${fieldPrefix}-models`}
            onInput={(event) =>
              updateCommon('selectedModelId', (event.currentTarget as HTMLInputElement).value)
            }
            placeholder="Enter a model ID"
            value={draft.selectedModelId}
          />
          <small id={`${fieldPrefix}-model-help`}>
            Manual model IDs work even when refresh is unavailable.
          </small>
          <datalist id={`${fieldPrefix}-models`}>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </datalist>
        </label>
      </div>

      {renderProviderConnectionFields(draft, updateDraft, unavailable)}

      <details className="advanced-settings">
        <summary>Advanced</summary>
        <div className="form-grid">
          <label>
            <span>Timeout (ms)</span>
            <input
              disabled={unavailable}
              min="1000"
              onInput={(event) =>
                updateCommon('timeoutMs', (event.currentTarget as HTMLInputElement).value)
              }
              step="1000"
              type="number"
              value={draft.timeoutMs}
            />
          </label>
          {capabilities.temperature ? (
            <label>
              <span>Temperature</span>
              <input
                disabled={unavailable}
                max="2"
                min="0"
                onInput={(event) =>
                  updateCommon('temperature', (event.currentTarget as HTMLInputElement).value)
                }
                placeholder="Provider default"
                step="0.1"
                type="number"
                value={draft.temperature}
              />
            </label>
          ) : null}
          {capabilities.maxOutputTokens ? (
            <label>
              <span>Max output tokens</span>
              <input
                disabled={unavailable}
                min="1"
                onInput={(event) =>
                  updateCommon('maxOutputTokens', (event.currentTarget as HTMLInputElement).value)
                }
                placeholder="Provider default"
                type="number"
                value={draft.maxOutputTokens}
              />
            </label>
          ) : null}
        </div>
        {capabilities.customHeaders && hasHeaders(draft) ? (
          <HeaderEditor
            disabled={unavailable}
            headers={draft.headers}
            onAdd={addHeader}
            onRemove={removeHeader}
            onUpdate={updateHeaders}
          />
        ) : null}
        {draft.kind === 'custom-json' ? (
          <CustomJsonEditor disabled={unavailable} draft={draft} onChange={updateDraft} />
        ) : null}
      </details>

      <div className="button-row provider-actions">
        <button disabled={unavailable} onClick={() => void saveDraft()} type="button">
          Save provider
        </button>
        {capabilities.modelDiscovery ? (
          <button
            className="secondary-button"
            disabled={unavailable}
            onClick={() => void refreshModels()}
            type="button"
          >
            Refresh models
          </button>
        ) : null}
        {capabilities.connectionTest ? (
          <div aria-label="Connection check" className="connection-check">
            <small id={`${fieldPrefix}-connection-test-help`}>
              Saves this provider, then sends one tiny request to the selected model.
            </small>
            <button
              aria-describedby={`${fieldPrefix}-connection-test-help`}
              className="secondary-button"
              disabled={unavailable}
              onClick={() => void testConnection()}
              type="button"
            >
              {connectionFeedback?.kind === 'testing' ? 'Testing…' : 'Save & test'}
            </button>
            <ConnectionFeedbackStatus feedback={connectionFeedback} />
          </div>
        ) : null}
        <button
          className="danger-button"
          disabled={unavailable}
          onClick={() => {
            if (
              globalThis.confirm(`Remove ${profile.name}? This deletes its local configuration.`)
            ) {
              void onDelete(profile.id);
            }
          }}
          type="button"
        >
          Remove
        </button>
      </div>
    </section>
  );
}

function ConnectionFeedbackStatus({ feedback }: { readonly feedback: ConnectionFeedback | null }) {
  if (feedback === null) {
    return null;
  }

  const message =
    feedback.kind === 'testing'
      ? 'Testing the selected model…'
      : feedback.kind === 'connected'
        ? 'Connected — selected model is usable.'
        : feedback.message;

  return (
    <p
      aria-atomic="true"
      aria-live="polite"
      className={
        feedback.kind === 'connected' || feedback.kind === 'testing' ? 'notice' : 'notice error'
      }
      role="status"
    >
      {message}
    </p>
  );
}

function renderProviderConnectionFields(
  draft: ProviderDraft,
  setDraft: (
    next: ProviderDraft | ((current: ProviderDraft | null) => ProviderDraft | null)
  ) => void,
  disabled: boolean
) {
  switch (draft.kind) {
    case 'openai':
    case 'anthropic':
    case 'gemini':
      return (
        <div className="form-grid">
          <label>
            <span>Base URL</span>
            <input
              disabled={disabled}
              onInput={(event) =>
                setDraft({ ...draft, baseUrl: (event.currentTarget as HTMLInputElement).value })
              }
              type="url"
              value={draft.baseUrl}
            />
          </label>
          <label>
            <span>API key</span>
            <input
              autoComplete="new-password"
              disabled={disabled}
              onInput={(event) =>
                setDraft({ ...draft, apiKey: (event.currentTarget as HTMLInputElement).value })
              }
              placeholder={draft.hasSavedApiKey ? 'Saved — enter a replacement' : 'Enter API key'}
              type="password"
              value={draft.apiKey}
            />
          </label>
        </div>
      );
    case 'openai-compatible':
      return (
        <div className="form-grid">
          <label>
            <span>Base URL</span>
            <input
              disabled={disabled}
              onInput={(event) =>
                setDraft({ ...draft, baseUrl: (event.currentTarget as HTMLInputElement).value })
              }
              type="url"
              value={draft.baseUrl}
            />
          </label>
          <label>
            <span>API key</span>
            <input
              autoComplete="new-password"
              disabled={disabled}
              onInput={(event) =>
                setDraft({ ...draft, apiKey: (event.currentTarget as HTMLInputElement).value })
              }
              placeholder={draft.hasSavedApiKey ? 'Saved — enter a replacement' : 'Enter API key'}
              type="password"
              value={draft.apiKey}
            />
          </label>
        </div>
      );
    case 'ollama':
      return (
        <label className="stacked-label">
          <span>Base URL</span>
          <input
            disabled={disabled}
            onInput={(event) =>
              setDraft({ ...draft, baseUrl: (event.currentTarget as HTMLInputElement).value })
            }
            type="url"
            value={draft.baseUrl}
          />
        </label>
      );
    case 'custom-json':
      return (
        <div className="form-grid">
          <label>
            <span>Endpoint</span>
            <input
              disabled={disabled}
              onInput={(event) =>
                setDraft({ ...draft, endpoint: (event.currentTarget as HTMLInputElement).value })
              }
              type="url"
              value={draft.endpoint}
            />
          </label>
          <label>
            <span>HTTP method</span>
            <select
              disabled={disabled}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  method: (event.currentTarget as HTMLSelectElement).value as ProviderDraft &
                    {
                      method: 'PATCH' | 'POST' | 'PUT';
                    }['method']
                })
              }
              value={draft.method}
            >
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
            </select>
          </label>
        </div>
      );
  }
}

interface HeaderEditorProps {
  readonly disabled: boolean;
  readonly headers: readonly HeaderDraft[];
  readonly onAdd: () => void;
  readonly onRemove: (index: number) => void;
  readonly onUpdate: (index: number, field: 'name' | 'value', value: string) => void;
}

function HeaderEditor({ disabled, headers, onAdd, onRemove, onUpdate }: HeaderEditorProps) {
  return (
    <fieldset className="header-editor">
      <legend>Custom headers</legend>
      <p className="muted">Saved header values remain hidden until you replace them.</p>
      {headers.map((header, index) => (
        <div className="header-row" key={`${header.originalName ?? 'new'}-${index}`}>
          <input
            aria-label={`Header ${index + 1} name`}
            disabled={disabled}
            onInput={(event) =>
              onUpdate(index, 'name', (event.currentTarget as HTMLInputElement).value)
            }
            placeholder="Header name"
            value={header.name}
          />
          <input
            aria-label={`Header ${index + 1} value`}
            autoComplete="new-password"
            disabled={disabled}
            onInput={(event) =>
              onUpdate(index, 'value', (event.currentTarget as HTMLInputElement).value)
            }
            placeholder={header.hasSavedValue ? 'Saved — enter a replacement' : 'Header value'}
            type="password"
            value={header.value}
          />
          <button
            aria-label={`Remove header ${index + 1}`}
            className="icon-button"
            disabled={disabled}
            onClick={() => onRemove(index)}
            type="button"
          >
            ×
          </button>
        </div>
      ))}
      <button className="text-button" disabled={disabled} onClick={onAdd} type="button">
        Add header
      </button>
    </fieldset>
  );
}

function CustomJsonEditor({
  disabled,
  draft,
  onChange
}: {
  readonly disabled: boolean;
  readonly draft: Extract<ProviderDraft, { kind: 'custom-json' }>;
  readonly onChange: (
    next: ProviderDraft | ((current: ProviderDraft | null) => ProviderDraft | null)
  ) => void;
}) {
  const updateAuthentication = (field: 'headerName' | 'kind' | 'secret', value: string) => {
    onChange({
      ...draft,
      authentication: {
        ...draft.authentication,
        [field]: value
      } as typeof draft.authentication
    });
  };

  return (
    <div className="custom-api-fields">
      <label>
        <span>Authentication</span>
        <select
          disabled={disabled}
          onChange={(event) =>
            updateAuthentication('kind', (event.currentTarget as HTMLSelectElement).value)
          }
          value={draft.authentication.kind}
        >
          <option value="none">None</option>
          <option value="bearer">Bearer token</option>
          <option value="header">Custom header</option>
        </select>
      </label>
      {draft.authentication.kind === 'header' ? (
        <label>
          <span>Authentication header name</span>
          <input
            disabled={disabled}
            onInput={(event) =>
              updateAuthentication('headerName', (event.currentTarget as HTMLInputElement).value)
            }
            value={draft.authentication.headerName}
          />
        </label>
      ) : null}
      {draft.authentication.kind === 'none' ? null : (
        <label>
          <span>
            {draft.authentication.kind === 'bearer' ? 'Bearer token' : 'Authentication value'}
          </span>
          <input
            autoComplete="new-password"
            disabled={disabled}
            onInput={(event) =>
              updateAuthentication('secret', (event.currentTarget as HTMLInputElement).value)
            }
            placeholder={
              draft.authentication.hasSavedSecret ? 'Saved — enter a replacement' : 'Enter a value'
            }
            type="password"
            value={draft.authentication.secret}
          />
        </label>
      )}
      <label>
        <span>Optional models endpoint</span>
        <input
          disabled={disabled}
          onInput={(event) =>
            onChange({ ...draft, modelsEndpoint: (event.currentTarget as HTMLInputElement).value })
          }
          placeholder="https://api.example.com/models"
          type="url"
          value={draft.modelsEndpoint}
        />
      </label>
      <label>
        <span>Request JSON template</span>
        <textarea
          disabled={disabled}
          onInput={(event) => onChange({ ...draft, requestTemplate: event.currentTarget.value })}
          rows={5}
          value={draft.requestTemplate}
        />
      </label>
      <label>
        <span>Response text path</span>
        <input
          disabled={disabled}
          onInput={(event) =>
            onChange({
              ...draft,
              responseTextPath: (event.currentTarget as HTMLInputElement).value
            })
          }
          placeholder="choices.0.message.content"
          value={draft.responseTextPath}
        />
      </label>
    </div>
  );
}

function hasHeaders(
  draft: ProviderDraft
): draft is Extract<ProviderDraft, { headers: HeaderDraft[] }> {
  return (
    draft.kind === 'custom-json' || draft.kind === 'ollama' || draft.kind === 'openai-compatible'
  );
}
