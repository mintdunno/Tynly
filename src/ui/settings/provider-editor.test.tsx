import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ProviderConnectionTestResult } from '../../core/providers/types.ts';
import type { OpenAiCompatibleProviderProfile } from '../../core/settings/schema.ts';

import { ProviderEditor } from './provider-editor.tsx';
import { createProviderProfile } from './settings-utils.ts';

afterEach(() => {
  document.body.replaceChildren();
});

describe('ProviderEditor', () => {
  it('keeps saved provider secrets out of the rendered form while retaining accessible controls', () => {
    const profile: OpenAiCompatibleProviderProfile = {
      id: 'gateway',
      name: 'Gateway',
      kind: 'openai-compatible',
      baseUrl: 'https://gateway.example.com/v1',
      apiKey: 'saved-api-key',
      headers: [{ name: 'X-Workspace-Token', value: 'saved-header-token' }],
      selectedModelId: 'model',
      timeoutMs: 30_000,
      temperature: null,
      maxOutputTokens: null
    };
    const root = document.createElement('div');
    document.body.append(root);

    render(
      <ProviderEditor
        active={false}
        disabled={false}
        models={[]}
        onActivate={async () => true}
        onConnectionStatusChange={() => undefined}
        onDelete={async () => undefined}
        onRefreshModels={async () => undefined}
        onSave={async () => true}
        onTestConnection={async () => ({ ok: true })}
        profile={profile}
      />,
      root
    );

    expect(root.textContent).not.toContain('saved-api-key');
    expect(root.textContent).not.toContain('saved-header-token');
    expect(
      root.querySelector('section[aria-label="OpenAI-compatible configuration"]')
    ).not.toBeNull();
    expect(root.querySelector('input[placeholder="Saved — enter a replacement"]')).toHaveProperty(
      'value',
      ''
    );
    const advanced = root.querySelector('details.advanced-settings');
    if (!(advanced instanceof HTMLDetailsElement)) {
      throw new Error('Expected the advanced connection disclosure.');
    }
    expect(advanced.open).toBe(false);
    expect(advanced.contains(root.querySelector('input[type="password"]'))).toBe(false);
    expect(advanced.contains(root.querySelector('input[type="url"]'))).toBe(true);
    expect(root.textContent).toContain('Finish setup');
    expect(root.querySelector('button')?.textContent).toBe('Use this provider');
  });

  it('opens the explicit advanced connection setup for custom APIs', () => {
    const profile = createProviderProfile('custom-json', 'custom');
    const root = document.createElement('div');
    document.body.append(root);

    render(
      <ProviderEditor
        active={false}
        disabled={false}
        models={[]}
        onActivate={async () => true}
        onConnectionStatusChange={() => undefined}
        onDelete={async () => undefined}
        onRefreshModels={async () => undefined}
        onSave={async () => true}
        onTestConnection={async () => ({ ok: true })}
        profile={profile}
      />,
      root
    );

    const advanced = root.querySelector('details.advanced-settings');
    if (!(advanced instanceof HTMLDetailsElement)) {
      throw new Error('Expected the advanced connection disclosure.');
    }
    expect(advanced.open).toBe(true);
    expect(advanced.textContent).toContain('Endpoint');
    expect(root.textContent).toContain('Custom JSON profiles need the connection fields');
  });

  it('saves before testing and gives local progress and success feedback', async () => {
    const profile = createProfile();
    let resolveConnectionTest: ((result: ProviderConnectionTestResult) => void) | undefined;
    const connectionTest = new Promise<ProviderConnectionTestResult>((resolve) => {
      resolveConnectionTest = resolve;
    });
    const onSave = vi.fn(async () => true);
    const onTestConnection = vi.fn(async () => connectionTest);
    const onActivate = vi.fn(async () => true);
    const onConnectionStatusChange = vi.fn();
    const root = document.createElement('div');
    document.body.append(root);

    render(
      <ProviderEditor
        active={false}
        disabled={false}
        models={[]}
        onActivate={onActivate}
        onConnectionStatusChange={onConnectionStatusChange}
        onDelete={async () => undefined}
        onRefreshModels={async () => undefined}
        onSave={onSave}
        onTestConnection={onTestConnection}
        profile={profile}
      />,
      root
    );

    const saveAndTest = findButton(root, 'Save & test');
    await act(() => {
      saveAndTest.click();
    });

    expect(onSave).toHaveBeenCalledOnce();
    expect(onTestConnection).toHaveBeenCalledWith(profile.id);
    expect(onSave.mock.invocationCallOrder[0]!).toBeLessThan(
      onTestConnection.mock.invocationCallOrder[0]!
    );
    expect(saveAndTest.disabled).toBe(true);
    expect(root.textContent).toContain('Testing the selected model…');
    expect(root.textContent).toContain(
      'Saves this provider, then sends one tiny request to the selected model.'
    );

    resolveConnectionTest?.({ ok: true });
    await act(async () => {
      await connectionTest;
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onActivate).toHaveBeenCalledWith(profile.id);
    expect(onTestConnection.mock.invocationCallOrder[0]!).toBeLessThan(
      onActivate.mock.invocationCallOrder[0]!
    );
    expect(onConnectionStatusChange).toHaveBeenCalledWith(profile.id, 'testing');
    expect(onConnectionStatusChange).toHaveBeenLastCalledWith(profile.id, 'connected');
    expect(root.textContent).toContain('Connected — this provider is now active.');
    expect(root.querySelector('[aria-live="polite"][role="status"]')).not.toBeNull();
  });

  it('shows a fixed specific failure without exposing a returned error message', async () => {
    const profile = createProfile();
    const root = document.createElement('div');
    document.body.append(root);
    const onActivate = vi.fn(async () => true);
    const onConnectionStatusChange = vi.fn();

    render(
      <ProviderEditor
        active={false}
        disabled={false}
        models={[]}
        onActivate={onActivate}
        onConnectionStatusChange={onConnectionStatusChange}
        onDelete={async () => undefined}
        onRefreshModels={async () => undefined}
        onSave={async () => true}
        onTestConnection={async () => ({
          ok: false,
          error: {
            code: 'MODEL_UNAVAILABLE',
            message: 'Authorization: Bearer private-connection-token',
            retryable: false
          }
        })}
        profile={profile}
      />,
      root
    );

    await act(async () => {
      findButton(root, 'Save & test').click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(root.textContent).toContain('The selected model is not available.');
    expect(root.textContent).not.toContain('private-connection-token');
    expect(onActivate).not.toHaveBeenCalled();
    expect(onConnectionStatusChange).toHaveBeenLastCalledWith(profile.id, 'needs-attention');
  });

  it('does not claim an active connection when activation cannot be saved', async () => {
    const profile = createProfile();
    const onActivate = vi.fn(async () => false);
    const onConnectionStatusChange = vi.fn();
    const root = document.createElement('div');
    document.body.append(root);

    render(
      <ProviderEditor
        active={false}
        disabled={false}
        models={[]}
        onActivate={onActivate}
        onConnectionStatusChange={onConnectionStatusChange}
        onDelete={async () => undefined}
        onRefreshModels={async () => undefined}
        onSave={async () => true}
        onTestConnection={async () => ({ ok: true })}
        profile={profile}
      />,
      root
    );

    await act(async () => {
      findButton(root, 'Save & test').click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onActivate).toHaveBeenCalledWith(profile.id);
    expect(root.textContent).toContain('could not make this provider active');
    expect(root.textContent).not.toContain('this provider is now active');
  });

  it('does not activate a stale connection attempt after the draft changes', async () => {
    const profile = createProfile();
    let resolveConnectionTest: ((result: ProviderConnectionTestResult) => void) | undefined;
    const connectionTest = new Promise<ProviderConnectionTestResult>((resolve) => {
      resolveConnectionTest = resolve;
    });
    const onActivate = vi.fn(async () => true);
    const onConnectionStatusChange = vi.fn();
    const root = document.createElement('div');
    document.body.append(root);

    render(
      <ProviderEditor
        active={false}
        disabled={false}
        models={[]}
        onActivate={onActivate}
        onConnectionStatusChange={onConnectionStatusChange}
        onDelete={async () => undefined}
        onRefreshModels={async () => undefined}
        onSave={async () => true}
        onTestConnection={async () => connectionTest}
        profile={profile}
      />,
      root
    );

    await act(() => {
      findButton(root, 'Save & test').click();
    });
    const modelInput = root.querySelector('input[placeholder="Enter a model ID"]');
    if (!(modelInput instanceof HTMLInputElement)) {
      throw new Error('Expected the model input.');
    }
    await act(async () => {
      modelInput.value = 'changed-model';
      modelInput.dispatchEvent(new Event('input', { bubbles: true }));
      await Promise.resolve();
    });
    resolveConnectionTest?.({ ok: true });
    await act(async () => {
      await connectionTest;
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onActivate).not.toHaveBeenCalled();
    expect(onConnectionStatusChange).toHaveBeenLastCalledWith(profile.id, null);
  });

  it('does not activate a stale connection attempt after selecting another provider', async () => {
    const profile = createProfile();
    const nextProfile = { ...createProfile(), id: 'next-provider', name: 'Next provider' };
    let resolveConnectionTest: ((result: ProviderConnectionTestResult) => void) | undefined;
    const connectionTest = new Promise<ProviderConnectionTestResult>((resolve) => {
      resolveConnectionTest = resolve;
    });
    const onActivate = vi.fn(async () => true);
    const onConnectionStatusChange = vi.fn();
    const root = document.createElement('div');
    document.body.append(root);

    const renderEditor = (currentProfile: OpenAiCompatibleProviderProfile) =>
      render(
        <ProviderEditor
          active={false}
          disabled={false}
          models={[]}
          onActivate={onActivate}
          onConnectionStatusChange={onConnectionStatusChange}
          onDelete={async () => undefined}
          onRefreshModels={async () => undefined}
          onSave={async () => true}
          onTestConnection={async () => connectionTest}
          profile={currentProfile}
        />,
        root
      );

    renderEditor(profile);
    await act(() => {
      findButton(root, 'Save & test').click();
    });
    await act(async () => {
      renderEditor(nextProfile);
      await Promise.resolve();
    });
    expect(findButton(root, 'Save & test').disabled).toBe(false);
    resolveConnectionTest?.({ ok: true });
    await act(async () => {
      await connectionTest;
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onActivate).not.toHaveBeenCalled();
    expect(onConnectionStatusChange).toHaveBeenLastCalledWith(profile.id, null);
  });
});

function createProfile(): OpenAiCompatibleProviderProfile {
  return {
    id: 'gateway',
    name: 'Gateway',
    kind: 'openai-compatible',
    baseUrl: 'https://gateway.example.com/v1',
    apiKey: 'saved-api-key',
    headers: [{ name: 'X-Workspace-Token', value: 'saved-header-token' }],
    selectedModelId: 'model',
    timeoutMs: 30_000,
    temperature: null,
    maxOutputTokens: null
  };
}

function findButton(root: Element, label: string): HTMLButtonElement {
  const button = Array.from(root.querySelectorAll('button')).find(
    (candidate) => candidate.textContent === label
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Could not find the ${label} button.`);
  }
  return button;
}
