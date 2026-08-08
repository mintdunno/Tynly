import { AppError, normalizeAppError } from '../../shared/errors/index.ts';
import type { SettingsStore } from '../settings/settings-store.ts';
import type { AppSettings, ProviderProfile } from '../settings/schema.ts';
import { prepareTransform } from '../transform/transform-preparation.ts';
import { sanitizeTransformResult } from '../transform/result-sanitizer.ts';
import { resolveTransformStyle } from '../transform/style-registry.ts';
import type { TransformResult, TransformTrigger } from '../transform/types.ts';

import type { ProviderRegistry } from './provider-registry.ts';
import {
  createConnectionTestFailure,
  type ProviderConnectionTestResult,
  type ProviderModelInfo
} from './types.ts';

export interface ProviderServiceTransformInput {
  readonly operationId: string;
  readonly text: string;
  readonly trigger: TransformTrigger;
}

/**
 * Background-only provider coordinator. It reads private settings locally,
 * builds the one central prompt, and owns the AbortController for each
 * in-flight message operation. Nothing returned from this service includes
 * provider credentials or diagnostics.
 */
export class ProviderService {
  private readonly controllersByOperationId = new Map<string, AbortController>();

  constructor(
    private readonly settingsStore: SettingsStore,
    private readonly registry: ProviderRegistry
  ) {}

  async transform(input: ProviderServiceTransformInput): Promise<TransformResult> {
    const controller = this.beginOperation(input.operationId);

    try {
      const settings = await this.settingsStore.get();
      const profile = withSelectedModel(getActiveProfile(settings));

      const style = resolveTransformStyle(settings.styles.selected, settings.styles.custom);
      if (style === null) {
        throw new AppError('CONFIGURATION');
      }

      const prepared = prepareTransform(
        {
          language: settings.language,
          style,
          text: input.text,
          trigger: input.trigger
        },
        input.operationId
      );
      if (!prepared.ok) {
        throw new AppError('CONFIGURATION');
      }

      const provider = this.registry.resolveProfile(profile);
      const providerResult = await provider.transform(
        { ...prepared.value.request, prompt: prepared.value.prompt },
        profile,
        controller.signal
      );

      if (!this.isCurrentOperation(input.operationId, controller)) {
        throw new AppError('CANCELLED');
      }
      if (providerResult.operationId !== input.operationId) {
        throw new AppError('INVALID_RESPONSE');
      }

      const sanitized = sanitizeTransformResult(providerResult.text);
      if (!sanitized.ok) {
        throw new AppError('INVALID_RESPONSE');
      }

      return {
        operationId: input.operationId,
        text: sanitized.text
      };
    } catch (error) {
      throw normalizeAppError(error);
    } finally {
      this.clearOperation(input.operationId, controller);
    }
  }

  /** Aborts exactly the matching in-flight operation, if it still exists. */
  cancel(operationId: string): boolean {
    const controller = this.controllersByOperationId.get(operationId);
    if (controller === undefined) {
      return false;
    }

    this.controllersByOperationId.delete(operationId);
    controller.abort();
    return true;
  }

  async listModels(profileId: string, signal?: AbortSignal): Promise<readonly ProviderModelInfo[]> {
    try {
      const profile = await this.getProfile(profileId);
      return await this.registry.resolveProfile(profile).listModels(profile, signal);
    } catch (error) {
      throw normalizeAppError(error);
    }
  }

  async testConnection(
    profileId: string,
    signal?: AbortSignal
  ): Promise<ProviderConnectionTestResult> {
    try {
      const profile = await this.getProfile(profileId);
      const configuredProfile = withSelectedModel(profile);
      return await this.registry
        .resolveProfile(configuredProfile)
        .testConnection(configuredProfile, signal);
    } catch (error) {
      return createConnectionTestFailure(error);
    }
  }

  /**
   * Persists a manual or discovered model on its own profile only. This keeps
   * switching profiles from losing the model choice associated with each one.
   */
  async setSelectedModel(profileId: string, modelId: string): Promise<void> {
    const normalizedModelId = normalizeModelId(modelId);
    if (normalizedModelId === null) {
      throw new AppError('CONFIGURATION');
    }

    await this.settingsStore.update((settings) => {
      let found = false;
      const profiles = settings.providers.profiles.map((profile) => {
        if (profile.id !== profileId) {
          return profile;
        }

        found = true;
        return { ...profile, selectedModelId: normalizedModelId };
      });

      if (!found) {
        throw new AppError('CONFIGURATION');
      }

      return {
        ...settings,
        providers: {
          ...settings.providers,
          profiles
        }
      };
    });
  }

  get activeOperationCount(): number {
    return this.controllersByOperationId.size;
  }

  private beginOperation(operationId: string): AbortController {
    const previous = this.controllersByOperationId.get(operationId);
    if (previous !== undefined) {
      previous.abort();
    }

    const controller = new AbortController();
    this.controllersByOperationId.set(operationId, controller);
    return controller;
  }

  private isCurrentOperation(operationId: string, controller: AbortController): boolean {
    return (
      this.controllersByOperationId.get(operationId) === controller && !controller.signal.aborted
    );
  }

  private clearOperation(operationId: string, controller: AbortController): void {
    if (this.controllersByOperationId.get(operationId) === controller) {
      this.controllersByOperationId.delete(operationId);
    }
  }

  private async getProfile(profileId: string): Promise<ProviderProfile> {
    const settings = await this.settingsStore.get();
    const profile = settings.providers.profiles.find((candidate) => candidate.id === profileId);
    if (profile === undefined) {
      throw new AppError('CONFIGURATION');
    }

    return profile;
  }
}

function getActiveProfile(settings: AppSettings): ProviderProfile {
  const activeProfileId = settings.providers.activeProfileId;
  if (activeProfileId === null) {
    throw new AppError('CONFIGURATION');
  }

  const profile = settings.providers.profiles.find((candidate) => candidate.id === activeProfileId);
  if (profile === undefined) {
    throw new AppError('CONFIGURATION');
  }

  return profile;
}

function withSelectedModel(profile: ProviderProfile): ProviderProfile {
  const selectedModelId = normalizeModelId(profile.selectedModelId);
  if (selectedModelId === null) {
    throw new AppError('CONFIGURATION');
  }

  return { ...profile, selectedModelId };
}

function normalizeModelId(modelId: string): string | null {
  const normalized = modelId.trim();
  return normalized.length > 0 && normalized.length <= 256 && !/[\r\n]/u.test(normalized)
    ? normalized
    : null;
}
