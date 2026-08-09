import { describe, expect, it } from 'vitest';

import type {
  CustomJsonProviderProfile,
  OpenAiCompatibleProviderProfile
} from '../../core/settings/schema.ts';

import { addHeaderDraft, applyProviderDraft, toProviderDraft } from './provider-draft.ts';

describe('provider form drafts', () => {
  it('does not copy saved API keys or header values into an editable draft', () => {
    const profile: OpenAiCompatibleProviderProfile = {
      id: 'gateway',
      name: 'Gateway',
      kind: 'openai-compatible',
      baseUrl: 'https://gateway.example.com/v1',
      apiKey: 'saved-api-key',
      headers: [{ name: 'X-Token', value: 'saved-header-token' }],
      selectedModelId: 'model',
      timeoutMs: 30_000,
      temperature: null,
      maxOutputTokens: null
    };

    const draft = toProviderDraft(profile);
    if (draft.kind !== 'openai-compatible') {
      throw new Error('Expected an OpenAI-compatible provider draft.');
    }

    expect(JSON.stringify(draft)).not.toContain('saved-api-key');
    expect(JSON.stringify(draft)).not.toContain('saved-header-token');
    expect(draft).toMatchObject({
      hasSavedApiKey: true,
      headers: [{ hasSavedValue: true, value: '' }]
    });
  });

  it('preserves masked values until an explicit replacement is submitted', () => {
    const profile: OpenAiCompatibleProviderProfile = {
      id: 'gateway',
      name: 'Gateway',
      kind: 'openai-compatible',
      baseUrl: 'https://gateway.example.com/v1',
      apiKey: 'saved-api-key',
      headers: [{ name: 'X-Token', value: 'saved-header-token' }],
      selectedModelId: 'model',
      timeoutMs: 30_000,
      temperature: null,
      maxOutputTokens: null
    };
    const draft = toProviderDraft(profile);
    if (draft.kind !== 'openai-compatible') {
      throw new Error('Expected an OpenAI-compatible provider draft.');
    }
    draft.name = 'Renamed gateway';
    const preserved = applyProviderDraft(profile, draft);

    expect(preserved).toMatchObject({
      name: 'Renamed gateway',
      apiKey: 'saved-api-key',
      headers: [{ name: 'X-Token', value: 'saved-header-token' }]
    });

    draft.apiKey = 'replacement-key';
    draft.headers[0]!.value = 'replacement-header';
    const replaced = applyProviderDraft(profile, draft);
    expect(replaced).toMatchObject({
      apiKey: 'replacement-key',
      headers: [{ name: 'X-Token', value: 'replacement-header' }]
    });
  });

  it('handles custom API authentication and intentionally blank new headers safely', () => {
    const profile: CustomJsonProviderProfile = {
      id: 'custom',
      name: 'Custom',
      kind: 'custom-json',
      endpoint: 'https://api.example.com/transform',
      method: 'POST',
      authentication: { kind: 'header', headerName: 'X-API-Key', value: 'saved-auth' },
      headers: [],
      modelsEndpoint: null,
      requestTemplate: '{"prompt":"{{prompt}}"}',
      responseTextPath: 'output.text',
      selectedModelId: 'model',
      timeoutMs: 30_000,
      temperature: null,
      maxOutputTokens: null
    };
    const draft = toProviderDraft(profile);
    if (draft.kind !== 'custom-json') {
      throw new Error('Expected a custom JSON provider draft.');
    }
    draft.headers = addHeaderDraft(draft.headers);
    const saved = applyProviderDraft(profile, draft);
    if (saved.kind !== 'custom-json') {
      throw new Error('Expected a custom JSON provider profile.');
    }

    expect(saved.authentication).toEqual({
      kind: 'header',
      headerName: 'X-API-Key',
      value: 'saved-auth'
    });
    expect(saved.headers).toEqual([]);
  });
});
