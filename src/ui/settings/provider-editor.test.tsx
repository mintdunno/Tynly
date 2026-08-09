import { render } from 'preact';
import { afterEach, describe, expect, it } from 'vitest';

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
        onTestConnection={async () => undefined}
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
});
