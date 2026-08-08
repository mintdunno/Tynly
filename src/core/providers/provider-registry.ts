import { AppError } from '../../shared/errors/index.ts';

import { isProviderKind, type ProviderKind } from '../settings/schema.ts';

import type { AIProvider, AnyAIProvider, ProviderProfileForKind } from './types.ts';

/**
 * Resolves exactly one background-only adapter for each registered provider
 * kind. Registry failures are configuration errors with fixed public messages,
 * so malformed adapter metadata cannot disclose secrets through an exception.
 */
export class ProviderRegistry {
  private readonly providersByKind: ReadonlyMap<ProviderKind, AnyAIProvider>;

  constructor(providers: readonly AnyAIProvider[]) {
    const providersByKind = new Map<ProviderKind, AnyAIProvider>();

    for (const provider of providers) {
      const kind = readProviderKind(provider);
      if (kind === null || providersByKind.has(kind)) {
        throw new AppError('CONFIGURATION');
      }

      providersByKind.set(kind, provider);
    }

    this.providersByKind = providersByKind;
  }

  get size(): number {
    return this.providersByKind.size;
  }

  /** Returns the adapter for one known provider kind or a safe configuration failure. */
  resolve<K extends ProviderKind>(kind: K): AIProvider<K> {
    if (!isProviderKind(kind)) {
      throw new AppError('CONFIGURATION');
    }

    const provider = this.providersByKind.get(kind);
    if (provider === undefined) {
      throw new AppError('CONFIGURATION');
    }

    return provider as unknown as AIProvider<K>;
  }

  /** Resolves a profile and narrows the returned adapter to that profile's kind. */
  resolveProfile<K extends ProviderKind>(profile: ProviderProfileForKind<K>): AIProvider<K> {
    return this.resolve(profile.kind);
  }
}

function readProviderKind(provider: AnyAIProvider): ProviderKind | null {
  try {
    return isProviderKind(provider.kind) ? provider.kind : null;
  } catch {
    return null;
  }
}
