import { describe, expect, it } from 'vitest';

import {
  interpolateCustomJsonRequestTemplate,
  isSafeCustomJsonHeaderName,
  parseCustomJsonRequestTemplate,
  parseCustomJsonResponsePath,
  readCustomJsonResponseText,
  type CustomJsonTemplateValues
} from './custom-json-validation.ts';

const MAX_TEMPLATE_LENGTH = 32_768;
const MAX_RESPONSE_PATH_LENGTH = 512;

const variables: CustomJsonTemplateValues = {
  prompt: 'Rewrite the supplied text.',
  text: 'hello',
  model: 'custom-model',
  source: 'vi',
  target: 'en',
  style: 'natural and idiomatic'
};

describe('custom JSON validation', () => {
  it('interpolates only approved string-value placeholders without changing JSON structure', () => {
    const injectionLikeText = 'hello"},"injected":true,"ignored":"';
    const result = interpolateCustomJsonRequestTemplate(
      JSON.stringify({
        model: '{{model}}',
        prompt: '{{prompt}}',
        nested: { style: '{{style}}', text: '{{text}}' }
      }),
      { ...variables, text: injectionLikeText },
      MAX_TEMPLATE_LENGTH
    );

    expect(result).toEqual({
      model: 'custom-model',
      prompt: 'Rewrite the supplied text.',
      nested: { style: 'natural and idiomatic', text: injectionLikeText }
    });
    expect(result).not.toHaveProperty('injected');
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it('rejects malformed, unknown, and structurally dangerous templates', () => {
    expect(
      parseCustomJsonRequestTemplate('{"prompt":"{{unknown}}"}', MAX_TEMPLATE_LENGTH)
    ).toBeNull();
    expect(parseCustomJsonRequestTemplate('{"prompt":"{{text"}', MAX_TEMPLATE_LENGTH)).toBeNull();
    expect(
      parseCustomJsonRequestTemplate('{"__proto__":{"polluted":true}}', MAX_TEMPLATE_LENGTH)
    ).toBeNull();
    expect(parseCustomJsonRequestTemplate('{"{{model}}":"fixed"}', MAX_TEMPLATE_LENGTH)).toBeNull();
    expect(parseCustomJsonRequestTemplate('["{{prompt}}"]', MAX_TEMPLATE_LENGTH)).toBeNull();
  });

  it('bounds expanded request values before a template can amplify user text', () => {
    const oversizedVariables = { ...variables, text: 'a'.repeat(120_000) };
    const template = JSON.stringify({ content: '{{text}}{{text}}' });

    expect(
      interpolateCustomJsonRequestTemplate(template, oversizedVariables, MAX_TEMPLATE_LENGTH)
    ).toBeNull();
  });

  it('accepts safe dot paths and reads only own data properties', () => {
    const path = parseCustomJsonResponsePath('choices.0.message.content', MAX_RESPONSE_PATH_LENGTH);
    expect(path).toEqual(['choices', '0', 'message', 'content']);
    expect(
      readCustomJsonResponseText(
        { choices: [{ message: { content: 'Hello, team.' } }] },
        path ?? [],
        50_000
      )
    ).toBe('Hello, team.');

    const inheritedResponse = Object.create({ choices: [{ message: { content: 'inherited' } }] });
    expect(readCustomJsonResponseText(inheritedResponse, path ?? [], 50_000)).toBeNull();
  });

  it('blocks executable-like and prototype-traversal response paths', () => {
    for (const path of [
      '__proto__.value',
      'choices.constructor.content',
      'choices.prototype.content',
      'choices[0].message.content',
      'choices..content',
      ' choices.0.message.content'
    ]) {
      expect(parseCustomJsonResponsePath(path, MAX_RESPONSE_PATH_LENGTH)).toBeNull();
    }
  });

  it('allows explicit authentication headers but rejects browser and transport headers', () => {
    expect(isSafeCustomJsonHeaderName('X-API-Key')).toBe(true);
    expect(isSafeCustomJsonHeaderName('Authorization')).toBe(false);
    expect(isSafeCustomJsonHeaderName('Authorization', { allowAuthorization: true })).toBe(true);

    for (const header of [
      'Content-Type',
      'Cookie',
      'Host',
      'Proxy-Authorization',
      'Sec-Fetch-Site'
    ]) {
      expect(isSafeCustomJsonHeaderName(header, { allowAuthorization: true })).toBe(false);
    }
  });
});
