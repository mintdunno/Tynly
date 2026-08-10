import type { Ref } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';

import type { ProviderProfile } from '../../core/settings/schema.ts';

import { PROVIDER_CATALOG, type ProviderCatalogEntry } from './provider-catalog.ts';
import type {
  ProviderConnectionStatus,
  ProviderConnectionStatuses
} from './provider-connection-status.ts';

const RECOMMENDED_PROVIDER_IDS = new Set(['openai', 'anthropic', 'gemini', 'openrouter', 'ollama']);

type ProviderPickerCategory = 'advanced' | 'all' | 'recommended';

const PICKER_CATEGORIES: readonly {
  readonly description: string;
  readonly id: ProviderPickerCategory;
  readonly name: string;
}[] = [
  {
    id: 'recommended',
    name: 'Recommended',
    description: 'A simple place to start with popular hosted and local options.'
  },
  {
    id: 'all',
    name: 'All providers',
    description: 'Browse every built-in and compatible service Tynly supports.'
  },
  {
    id: 'advanced',
    name: 'Advanced',
    description: 'Use a compatible API root or define a custom JSON request.'
  }
];

const DEFAULT_ENTRY_ID = 'openai';

export interface ProviderHomeProps {
  readonly actionButtonRef: Ref<HTMLButtonElement>;
  readonly activeProfile: ProviderProfile | null;
  readonly connectionStatuses: ProviderConnectionStatuses;
  readonly disabled: boolean;
  readonly onOpenPicker: () => void;
  readonly onSelectProfile: (profileId: string) => void;
  readonly profiles: readonly ProviderProfile[];
  readonly selectedProfileId: string | null;
}

/** Shows the only provider decision a normal user needs to make before setup. */
export function ProviderHome({
  actionButtonRef,
  activeProfile,
  connectionStatuses,
  disabled,
  onOpenPicker,
  onSelectProfile,
  profiles,
  selectedProfileId
}: ProviderHomeProps) {
  const selectedProfile =
    profiles.find((profile) => profile.id === selectedProfileId) ?? profiles[0] ?? null;
  const displayProfile = activeProfile ?? selectedProfile;
  const readiness = getProviderReadiness(
    displayProfile,
    displayProfile === null ? undefined : connectionStatuses[displayProfile.id]
  );

  return (
    <div className="provider-home">
      <div className="provider-home-main">
        <span className="provider-home-eyebrow">
          {activeProfile === null && displayProfile !== null
            ? 'Provider setup'
            : 'Current provider'}
        </span>
        <h3>{displayProfile?.name ?? 'No provider selected'}</h3>
        <p className="muted">{readiness.description}</p>
      </div>
      <div className="provider-home-actions">
        <span className={`provider-readiness provider-readiness--${readiness.tone}`}>
          {readiness.label}
        </span>
        <button disabled={disabled} onClick={onOpenPicker} ref={actionButtonRef} type="button">
          {displayProfile === null ? 'Choose a provider' : 'Add another provider'}
        </button>
      </div>

      {profiles.length > 1 ? (
        <details className="saved-provider-list">
          <summary>Saved providers ({profiles.length})</summary>
          <div aria-label="Saved providers" className="saved-provider-options" role="list">
            {profiles.map((profile) => {
              const selected = profile.id === selectedProfileId;
              const active = profile.id === activeProfile?.id;
              const savedStatus = getSavedProviderStatus(
                profile,
                active,
                selected,
                connectionStatuses[profile.id]
              );
              return (
                <div key={profile.id} role="listitem">
                  <button
                    aria-label={`Edit ${profile.name}. ${savedStatus}.`}
                    className={`saved-provider-option${selected ? ' saved-provider-option--selected' : ''}`}
                    disabled={disabled}
                    onClick={() => onSelectProfile(profile.id)}
                    type="button"
                  >
                    <span className="saved-provider-copy">
                      <strong>{profile.name}</strong>
                      <small>{savedStatus}</small>
                    </span>
                    <span aria-hidden="true" className="saved-provider-edit">
                      Edit
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function getProviderReadiness(
  profile: ProviderProfile | null,
  connectionStatus: ProviderConnectionStatus | undefined
): {
  readonly description: string;
  readonly label: string;
  readonly tone: 'connected' | 'empty' | 'needs-attention' | 'ready' | 'testing';
} {
  if (profile === null) {
    return {
      description: 'Choose a provider, then add its key and model.',
      label: 'Not set up',
      tone: 'empty'
    };
  }

  if (connectionStatus === 'testing') {
    return {
      description: 'Checking the selected model now. This uses one small provider request.',
      label: 'Testing',
      tone: 'testing'
    };
  }
  if (connectionStatus === 'connected') {
    return {
      description: `Connected with ${profile.selectedModelId.trim() || 'the selected model'}.`,
      label: 'Connected',
      tone: 'connected'
    };
  }
  if (connectionStatus === 'needs-attention') {
    return {
      description:
        'The last connection check needs attention. Review the key and model, then test again.',
      label: 'Needs attention',
      tone: 'needs-attention'
    };
  }

  if (profile.kind === 'custom-json') {
    return {
      description:
        'Custom API setup is required. Complete the endpoint and request details under Advanced connection.',
      label: 'Advanced setup required',
      tone: 'empty'
    };
  }
  if (hasRequiredApiKey(profile) === false) {
    return {
      description: 'Add an API key, choose a model, then test the connection.',
      label: 'Needs API key',
      tone: 'empty'
    };
  }

  const selectedModelId = profile.selectedModelId.trim();
  if (selectedModelId.length === 0) {
    return {
      description: 'Finish setup by choosing a model, then test the connection.',
      label: 'Needs a model',
      tone: 'empty'
    };
  }
  return {
    description: `Model: ${selectedModelId}. Test the connection when ready.`,
    label: 'Ready to test',
    tone: 'ready'
  };
}

function hasRequiredApiKey(profile: ProviderProfile): boolean {
  switch (profile.kind) {
    case 'openai':
    case 'openai-compatible':
    case 'anthropic':
    case 'gemini':
      return profile.apiKey.trim().length > 0;
    case 'ollama':
    case 'custom-json':
      return true;
  }
}

function getSavedProviderStatus(
  profile: ProviderProfile,
  active: boolean,
  selected: boolean,
  connectionStatus: ProviderConnectionStatus | undefined
): string {
  const connectionLabel = getProviderReadiness(profile, connectionStatus).label;
  if (active) {
    return `Active · ${connectionLabel}`;
  }
  return selected ? `Editing · ${connectionLabel}` : connectionLabel;
}

export interface ProviderPickerProps {
  readonly disabled: boolean;
  readonly onChoose: (entry: ProviderCatalogEntry) => Promise<boolean>;
  readonly onClose: () => void;
}

/** A searchable, grouped catalogue that delays profile creation until the user confirms. */
export function ProviderPicker({ disabled, onChoose, onClose }: ProviderPickerProps) {
  const [category, setCategory] = useState<ProviderPickerCategory>('recommended');
  const [query, setQuery] = useState('');
  const [selectedEntryId, setSelectedEntryId] = useState(DEFAULT_ENTRY_ID);
  const [working, setWorking] = useState(false);

  const selectedEntry =
    PROVIDER_CATALOG.find((entry) => entry.id === selectedEntryId) ?? PROVIDER_CATALOG[0];
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleEntries = useMemo(
    () =>
      PROVIDER_CATALOG.filter((entry) => {
        if (normalizedQuery.length > 0) {
          return `${entry.name} ${entry.description}`.toLocaleLowerCase().includes(normalizedQuery);
        }
        if (category === 'recommended') {
          return RECOMMENDED_PROVIDER_IDS.has(entry.id);
        }
        if (category === 'all') {
          return true;
        }
        return entry.group === 'advanced';
      }),
    [category, normalizedQuery]
  );
  const unavailable = disabled || working;
  const canChoose =
    selectedEntry !== undefined && visibleEntries.some((entry) => entry.id === selectedEntry.id);

  useEffect(() => {
    if (visibleEntries.some((entry) => entry.id === selectedEntryId)) {
      return;
    }
    setSelectedEntryId(visibleEntries[0]?.id ?? DEFAULT_ENTRY_ID);
  }, [selectedEntryId, visibleEntries]);

  const choose = async (): Promise<void> => {
    if (!canChoose || selectedEntry === undefined) {
      return;
    }
    setWorking(true);
    try {
      await onChoose(selectedEntry);
    } finally {
      setWorking(false);
    }
  };

  const heading = normalizedQuery.length > 0 ? 'Search results' : 'Choose a provider';
  const activeCategory = PICKER_CATEGORIES.find((candidate) => candidate.id === category);

  return (
    <section aria-labelledby="provider-picker-title" className="provider-picker-panel">
      <div className="provider-picker-heading">
        <div>
          <span className="provider-home-eyebrow">Provider setup</span>
          <h3 id="provider-picker-title">{heading}</h3>
          <p className="muted">
            {normalizedQuery.length > 0
              ? 'Searches provider names and setup descriptions.'
              : activeCategory?.description}
          </p>
        </div>
        <button
          aria-label="Close provider picker"
          className="text-button"
          disabled={unavailable}
          onClick={onClose}
          type="button"
        >
          Cancel
        </button>
      </div>

      <label className="provider-search">
        <span className="sr-only">Search providers</span>
        <input
          autoFocus
          disabled={unavailable}
          onInput={(event) => setQuery((event.currentTarget as HTMLInputElement).value)}
          placeholder="Search providers"
          type="search"
          value={query}
        />
      </label>

      <div
        aria-label="Provider categories"
        className="provider-picker-categories"
        role="radiogroup"
      >
        {PICKER_CATEGORIES.map((candidate) => {
          const selected = category === candidate.id;
          return (
            <label
              className={`provider-picker-category${selected ? ' provider-picker-category--selected' : ''}`}
              key={candidate.id}
            >
              <input
                checked={selected}
                className="sr-only provider-option-input"
                disabled={unavailable}
                name="provider-picker-category"
                onChange={() => {
                  setCategory(candidate.id);
                  setQuery('');
                }}
                type="radio"
                value={candidate.id}
              />
              {candidate.name}
            </label>
          );
        })}
      </div>

      <div
        aria-label={heading}
        className="provider-catalog-grid"
        id="provider-picker-results"
        role="radiogroup"
      >
        {visibleEntries.map((entry) => {
          const selected = entry.id === selectedEntryId;
          return (
            <div key={entry.id}>
              <label
                className={`provider-catalog-card${selected ? ' provider-catalog-card--selected' : ''}`}
              >
                <input
                  checked={selected}
                  className="sr-only provider-option-input"
                  disabled={unavailable}
                  name="provider-picker-entry"
                  onChange={() => setSelectedEntryId(entry.id)}
                  type="radio"
                  value={entry.id}
                />
                <span aria-hidden="true" className="provider-catalog-mark">
                  {getProviderInitials(entry.name)}
                </span>
                <span className="provider-catalog-content">
                  <strong>{entry.name}</strong>
                  <small>{entry.description}</small>
                </span>
                <span className="provider-catalog-hint">{getSetupHint(entry)}</span>
              </label>
            </div>
          );
        })}
      </div>

      {visibleEntries.length === 0 ? (
        <p className="provider-picker-empty" role="status">
          No providers match “{query}”. Try another name or choose a category.
        </p>
      ) : null}

      <div className="provider-picker-footer">
        <p className="muted">
          {!canChoose || selectedEntry === undefined
            ? 'Choose a provider to continue.'
            : `${selectedEntry.name}: ${getSetupHint(selectedEntry)}. You can enter the key and model next.`}
        </p>
        <button disabled={unavailable || !canChoose} onClick={() => void choose()} type="button">
          {working
            ? 'Adding provider…'
            : !canChoose || selectedEntry === undefined
              ? 'Choose a provider'
              : `Continue with ${selectedEntry.name}`}
        </button>
      </div>
    </section>
  );
}

function getProviderInitials(name: string): string {
  return name
    .split(/\s+/u)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toLocaleUpperCase();
}

function getSetupHint(entry: ProviderCatalogEntry): string {
  if (entry.id === 'ollama') {
    return 'Runs locally';
  }
  if (entry.group === 'advanced') {
    return 'Advanced setup';
  }
  return 'API key required';
}
