import { AppError } from '../../shared/errors/index.ts';
import {
  SETTINGS_STORAGE_KEY,
  createChromeLocalStorage,
  type ExtensionLocalStorage
} from '../../shared/browser/local-storage.ts';
import { migrateAppSettings } from './migrations.ts';
import {
  toContentSettingsSnapshot,
  validateAppSettings,
  type AppSettings,
  type ContentSettingsSnapshot
} from './schema.ts';

export type SettingsUpdater = (current: AppSettings) => AppSettings;

/**
 * The only settings access point used by extension contexts. Content scripts
 * receive a redacted projection through background messaging rather than
 * accessing Chrome storage themselves.
 */
export class SettingsStore {
  private cachedSettings: AppSettings | null = null;
  private cacheGeneration = 0;
  private initialization: Promise<AppSettings> | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly storage: ExtensionLocalStorage = createChromeLocalStorage()) {
    this.storage.subscribeToChanges?.((changedKeys) => {
      if (changedKeys.includes(SETTINGS_STORAGE_KEY)) {
        this.invalidateCache();
      }
    });
  }

  async initialize(): Promise<AppSettings> {
    if (this.cachedSettings !== null) {
      return cloneSettings(this.cachedSettings);
    }

    const generation = this.cacheGeneration;
    if (this.initialization === null) {
      const initialization = this.initializeInternal().then(
        (settings) => {
          if (this.cacheGeneration === generation) {
            this.cachedSettings = cloneSettings(settings);
          }
          return settings;
        },
        (error: unknown) => {
          if (this.initialization === initialization) {
            this.initialization = null;
          }
          throw error;
        }
      );
      this.initialization = initialization;
    }

    const settings = await this.initialization;
    return this.cacheGeneration === generation ? cloneSettings(settings) : this.initialize();
  }

  async get(): Promise<AppSettings> {
    return this.initialize();
  }

  async getContentSettings(): Promise<ContentSettingsSnapshot> {
    return toContentSettingsSnapshot(await this.get());
  }

  replace(next: AppSettings): Promise<AppSettings> {
    return this.enqueueWrite(async () => {
      const safeNext = this.validateNext(next);
      await this.initialize();
      return this.persist(safeNext);
    });
  }

  update(updater: SettingsUpdater): Promise<AppSettings> {
    return this.enqueueWrite(async () => {
      const current = await this.get();
      return this.persist(this.validateNext(updater(cloneSettings(current))));
    });
  }

  private validateNext(next: AppSettings): AppSettings {
    const validated = validateAppSettings(next);

    if (!validated.ok) {
      throw new AppError('CONFIGURATION', 'Tynly settings are invalid.', {
        details: {
          issueCount: validated.issues.length,
          paths: validated.issues.map((issue) => issue.path)
        }
      });
    }

    return cloneSettings(validated.value);
  }

  private async persist(settings: AppSettings): Promise<AppSettings> {
    await this.write(settings);
    this.cachedSettings = cloneSettings(settings);
    return cloneSettings(settings);
  }

  private enqueueWrite<T>(work: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(work, work);
    this.writeQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  private async initializeInternal(): Promise<AppSettings> {
    try {
      await this.storage.restrictToTrustedContexts();
      const raw = await this.storage.get(SETTINGS_STORAGE_KEY);
      const migration = migrateAppSettings(raw);

      if (raw === undefined || migration.migrated || migration.recovered) {
        await this.write(migration.settings);
      }

      return cloneSettings(migration.settings);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError('CONFIGURATION', 'Tynly settings could not be loaded.');
    }
  }

  private async write(settings: AppSettings): Promise<void> {
    try {
      await this.storage.set(SETTINGS_STORAGE_KEY, cloneSettings(settings));
    } catch {
      throw new AppError('CONFIGURATION', 'Tynly settings could not be saved.');
    }
  }

  private invalidateCache(): void {
    this.cacheGeneration += 1;
    this.cachedSettings = null;
    this.initialization = null;
  }
}

function cloneSettings(settings: AppSettings): AppSettings {
  return structuredClone(settings);
}
