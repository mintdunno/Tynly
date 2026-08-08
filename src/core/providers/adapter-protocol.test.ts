import { describe, expect, it } from 'vitest';

import { AppError } from '../../shared/errors/index.ts';

import {
  effectiveOutputTokens,
  joinProviderUrl,
  mergeProviderHeaders,
  readChatText,
  readJsonResponse
} from './adapter-protocol.ts';

describe('adapter protocol helpers', () => {
  it('joins static API paths without losing a configured API root', () => {
    expect(joinProviderUrl('https://api.example/v1/', '/chat/completions', 'https')).toBe(
      'https://api.example/v1/chat/completions'
    );
    expect(joinProviderUrl('http://localhost:11434/', '/api/tags', 'ollama')).toBe(
      'http://localhost:11434/api/tags'
    );
  });

  it('rejects unsafe provider URL forms before a request starts', () => {
    expect(() => joinProviderUrl('http://provider.example', '/models', 'https')).toThrow(AppError);
    expect(() =>
      joinProviderUrl('https://provider.example?api_key=secret', '/models', 'https')
    ).toThrow(AppError);
    expect(() => joinProviderUrl('http://provider.example:11434', '/api/tags', 'ollama')).toThrow(
      AppError
    );
  });

  it('merges custom headers deterministically and rejects duplicate/reserved names', () => {
    expect(
      mergeProviderHeaders({ Accept: 'application/json', Authorization: 'Bearer configured' }, [
        { name: 'X-Tenant', value: 'team-a' }
      ])
    ).toEqual({
      Accept: 'application/json',
      Authorization: 'Bearer configured',
      'X-Tenant': 'team-a'
    });

    expect(() =>
      mergeProviderHeaders({ Authorization: 'Bearer configured' }, [
        { name: 'authorization', value: 'Bearer spoofed' }
      ])
    ).toThrow(AppError);
    expect(() =>
      mergeProviderHeaders({}, [
        { name: 'X-Duplicate', value: 'one' },
        { name: 'x-duplicate', value: 'two' }
      ])
    ).toThrow(AppError);
    expect(
      mergeProviderHeaders({}, [{ name: 'Authorization', value: 'Bearer local' }], {
        allowAuthorization: true
      })
    ).toEqual({ Authorization: 'Bearer local' });
  });

  it('keeps output budgets within the Phase 3 heuristic envelope', () => {
    expect(effectiveOutputTokens(300, null)).toBe(300);
    expect(effectiveOutputTokens(3_072, 128)).toBe(128);
    expect(effectiveOutputTokens(16_384, 16_384)).toBe(3_072);
  });

  it('accepts only bounded text response shapes', async () => {
    await expect(
      readJsonResponse(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    ).resolves.toEqual({ ok: true });
    expect(readChatText({ choices: [{ message: { content: 'Hello\nworld' } }] }, 'openai')).toBe(
      'Hello\nworld'
    );
    expect(() => readChatText({ message: { content: 3 } }, 'ollama')).toThrow(AppError);
  });

  it('rejects oversized successful JSON responses before parsing', async () => {
    const response = new Response('{}', {
      headers: { 'content-length': '1000001' },
      status: 200
    });

    await expect(readJsonResponse(response)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
