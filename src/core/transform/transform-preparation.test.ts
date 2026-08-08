import { describe, expect, it } from 'vitest';

import { BUILT_IN_STYLES } from './style-registry.ts';
import { MAX_TRANSFORM_INPUT_CHARACTERS } from './limits.ts';
import { prepareTransform } from './transform-preparation.ts';

describe('prepareTransform', () => {
  it('builds one provider-neutral request with a bounded output budget', () => {
    const prepared = prepareTransform(
      {
        language: { source: 'vi', target: 'en' },
        style: BUILT_IN_STYLES.natural,
        text: 'mai t ko join meeting dc',
        trigger: 'shortcut'
      },
      'operation-1'
    );

    expect(prepared).toMatchObject({
      ok: true,
      value: {
        request: {
          operationId: 'operation-1',
          text: 'mai t ko join meeting dc',
          trigger: 'shortcut'
        }
      }
    });
    expect(prepared).toMatchObject({
      ok: true,
      value: { prompt: expect.stringContaining('mai t ko join meeting dc') }
    });
  });

  it('refuses invalid input before a prompt or provider request can be built', () => {
    const prepared = prepareTransform(
      {
        language: { source: 'vi', target: 'en' },
        style: BUILT_IN_STYLES.natural,
        text: 'x'.repeat(MAX_TRANSFORM_INPUT_CHARACTERS + 1),
        trigger: 'field-button'
      },
      'operation-1'
    );

    expect(prepared).toEqual({
      ok: false,
      input: {
        ok: false,
        reason: 'too-long',
        characterCount: MAX_TRANSFORM_INPUT_CHARACTERS + 1,
        maxCharacters: MAX_TRANSFORM_INPUT_CHARACTERS
      }
    });
  });
});
