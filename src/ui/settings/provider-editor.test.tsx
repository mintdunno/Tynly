import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ProviderConnectionTestResult } from '../../core/providers/types.ts';
import type { OpenAiCompatibleProviderProfile } from '../../core/settings/schema.ts';

import { ProviderEditor } from './provider-editor.tsx';

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
        onActivate={async () => undefined}
        onDelete={async () => undefined}
        onRefreshModels={async () => undefined}
        onSave={async () => true}
        onTestConnection={async () => ({ ok: true })}
        profile={profile}
        status={null}
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
    expect(root.querySelector('button')?.textContent).toBe('Use this provider');
  });

  it('saves before testing and gives local progress and success feedback', async () => {
    const profile = createProfile();
    let resolveConnectionTest: ((result: ProviderConnectionTestResult) => void) | undefined;
    const connectionTest = new Promise<ProviderConnectionTestResult>((resolve) => {
      resolveConnectionTest = resolve;
    });
    const onSave = vi.fn(async () => true);
    const onTestConnection = vi.fn(async () => connectionTest);
    const root = document.createElement('div');
    document.body.append(root);

    render(
      <ProviderEditor
        active={false}
        disabled={false}
        models={[]}
        onActivate={async () => undefined}
        onDelete={async () => undefined}
        onRefreshModels={async () => undefined}
        onSave={onSave}
        onTestConnection={onTestConnection}
        profile={profile}
        status={null}
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

    expect(root.textContent).toContain('Connected — selected model is usable.');
    expect(root.querySelector('[aria-live="polite"][role="status"]')).not.toBeNull();
  });

  it('shows a fixed specific failure without exposing a returned error message', async () => {
    const profile = createProfile();
    const root = document.createElement('div');
    document.body.append(root);

    render(
      <ProviderEditor
        active={false}
        disabled={false}
        models={[]}
        onActivate={async () => undefined}
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
        status={null}
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
