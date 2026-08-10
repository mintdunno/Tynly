import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createProviderProfile } from './settings-utils.ts';
import type { ProviderCatalogEntry } from './provider-catalog.ts';
import { ProviderHome, ProviderPicker } from './provider-picker.tsx';

afterEach(() => {
  document.body.replaceChildren();
});

describe('ProviderHome', () => {
  it('gives an unconfigured user one clear provider choice', () => {
    const onOpenPicker = vi.fn();
    const root = document.createElement('div');
    document.body.append(root);

    render(
      <ProviderHome
        actionButtonRef={null}
        activeProfile={null}
        connectionStatuses={{}}
        disabled={false}
        onOpenPicker={onOpenPicker}
        onSelectProfile={() => undefined}
        profiles={[]}
        selectedProfileId={null}
      />,
      root
    );

    expect(root.textContent).toContain('No provider selected');
    expect(root.textContent).toContain('Not set up');
    findButton(root, 'Choose a provider').click();
    expect(onOpenPicker).toHaveBeenCalledOnce();
  });

  it('keeps saved profiles available without returning to a native select', () => {
    const primary = {
      ...createProviderProfile('openai', 'primary'),
      name: 'OpenAI primary',
      selectedModelId: 'gpt-4.1-mini'
    };
    const local = {
      ...createProviderProfile('ollama', 'local'),
      name: 'Local Ollama',
      selectedModelId: 'llama3.2'
    };
    const onSelectProfile = vi.fn();
    const root = document.createElement('div');
    document.body.append(root);

    render(
      <ProviderHome
        actionButtonRef={null}
        activeProfile={primary}
        connectionStatuses={{}}
        disabled={false}
        onOpenPicker={() => undefined}
        onSelectProfile={onSelectProfile}
        profiles={[primary, local]}
        selectedProfileId={primary.id}
      />,
      root
    );

    const details = root.querySelector('details');
    if (!(details instanceof HTMLDetailsElement)) {
      throw new Error('Expected the saved-provider disclosure.');
    }
    details.open = true;
    const localButton = findButtonContaining(root, 'Local Ollama');
    expect(localButton.getAttribute('aria-label')).toBe('Edit Local Ollama. Ready to test.');
    expect(root.textContent).toContain('Needs API key');
    localButton.click();
    expect(onSelectProfile).toHaveBeenCalledWith(local.id);
    expect(root.querySelector('select')).toBeNull();
  });

  it('shows connection-safe feedback for the active provider', () => {
    const profile = {
      ...createProviderProfile('openai', 'primary'),
      selectedModelId: 'gpt-4.1-mini'
    };
    const root = document.createElement('div');
    document.body.append(root);

    render(
      <ProviderHome
        actionButtonRef={null}
        activeProfile={profile}
        connectionStatuses={{ [profile.id]: 'connected' }}
        disabled={false}
        onOpenPicker={() => undefined}
        onSelectProfile={() => undefined}
        profiles={[profile]}
        selectedProfileId={profile.id}
      />,
      root
    );

    expect(root.textContent).toContain('Connected');
    expect(root.textContent).not.toContain('gpt-4.1-mini. Test the connection when ready.');
  });

  it('keeps custom API profiles visibly marked as advanced before testing', () => {
    const profile = {
      ...createProviderProfile('custom-json', 'custom'),
      selectedModelId: 'custom-model'
    };
    const root = document.createElement('div');
    document.body.append(root);

    render(
      <ProviderHome
        actionButtonRef={null}
        activeProfile={profile}
        connectionStatuses={{}}
        disabled={false}
        onOpenPicker={() => undefined}
        onSelectProfile={() => undefined}
        profiles={[profile]}
        selectedProfileId={profile.id}
      />,
      root
    );

    expect(root.textContent).toContain('Advanced setup required');
    expect(root.textContent).not.toContain('https://api.example.com/transform');
  });
});

describe('ProviderPicker', () => {
  it('searches provider choices and only creates the explicitly confirmed choice', async () => {
    const onChoose = vi.fn(async (_entry: ProviderCatalogEntry) => true);
    const root = document.createElement('div');
    document.body.append(root);

    render(<ProviderPicker disabled={false} onChoose={onChoose} onClose={() => undefined} />, root);

    const search = root.querySelector('input[type="search"]');
    if (!(search instanceof HTMLInputElement)) {
      throw new Error('Expected the provider search input.');
    }
    await act(async () => {
      search.value = 'Ollama';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      await Promise.resolve();
    });

    expect(root.textContent).toContain('Ollama');
    expect(root.textContent).not.toContain('OpenAI-compatible API');
    selectRadio(root, 'provider-picker-entry', 'ollama');
    const continueButton = findButton(root, 'Continue with Ollama');
    await act(async () => {
      continueButton.click();
      await Promise.resolve();
    });

    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose.mock.calls[0]?.[0]).toMatchObject({ id: 'ollama', name: 'Ollama' });
    expect(root.textContent).not.toContain('http://localhost:11434');
  });

  it('keeps manual interfaces in a separate advanced category', async () => {
    const root = document.createElement('div');
    document.body.append(root);

    render(
      <ProviderPicker disabled={false} onChoose={async () => true} onClose={() => undefined} />,
      root
    );

    await act(async () => {
      selectRadio(root, 'provider-picker-category', 'advanced');
      await Promise.resolve();
    });

    expect(root.textContent).toContain('OpenAI-compatible API');
    expect(root.textContent).toContain('Custom JSON API');
    expect(root.textContent).not.toContain('OllamaRuns on your own machine');
    expect(root.querySelector('.provider-picker-category--selected')?.textContent).toContain(
      'Advanced'
    );
  });

  it('includes every catalog choice when browsing all providers', async () => {
    const root = document.createElement('div');
    document.body.append(root);

    render(
      <ProviderPicker disabled={false} onChoose={async () => true} onClose={() => undefined} />,
      root
    );

    await act(async () => {
      selectRadio(root, 'provider-picker-category', 'all');
      await Promise.resolve();
    });

    expect(root.textContent).toContain('OpenAI-compatible API');
    expect(root.textContent).toContain('Custom JSON API');
    expect(root.textContent).toContain('Ollama');
  });

  it('does not allow a hidden provider choice when a search has no results', async () => {
    const onChoose = vi.fn(async (_entry: ProviderCatalogEntry) => true);
    const root = document.createElement('div');
    document.body.append(root);

    render(<ProviderPicker disabled={false} onChoose={onChoose} onClose={() => undefined} />, root);

    const search = root.querySelector('input[type="search"]');
    if (!(search instanceof HTMLInputElement)) {
      throw new Error('Expected the provider search input.');
    }
    await act(async () => {
      search.value = 'not-a-provider';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      await Promise.resolve();
    });

    expect(root.textContent).toContain('No providers match');
    expect(findButton(root, 'Choose a provider').disabled).toBe(true);
    expect(onChoose).not.toHaveBeenCalled();
  });
});

function findButton(root: Element, label: string): HTMLButtonElement {
  const button = Array.from(root.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.trim() === label
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Could not find the ${label} button.`);
  }
  return button;
}

function findButtonContaining(root: Element, text: string): HTMLButtonElement {
  const button = Array.from(root.querySelectorAll('button')).find((candidate) =>
    candidate.textContent?.includes(text)
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Could not find a button containing ${text}.`);
  }
  return button;
}

function selectRadio(root: Element, name: string, value: string): void {
  const control = root.querySelector(`input[type="radio"][name="${name}"][value="${value}"]`);
  if (!(control instanceof HTMLInputElement)) {
    throw new Error(`Could not find the ${value} radio option.`);
  }
  control.click();
}
