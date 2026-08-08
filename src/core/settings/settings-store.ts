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
  private initialization: Promise<AppSettings> | null = null;

  constructor(private readonly storage: ExtensionLocalStorage = createChromeLocalStorage()) {}

  async initialize(): Promise<AppSettings> {
    if (this.initialization === null) {
      this.initialization = this.initializeInternal().finally(() => {
        this.initialization = null;
      });
    }

    return cloneSettings(await this.initialization);
  }

  async get(): Promise<AppSettings> {
    return this.initialize();
  }

  async getContentSettings(): Promise<ContentSettingsSnapshot> {
    return toContentSettingsSnapshot(await this.get());
  }

  async replace(next: AppSettings): Promise<AppSettings> {
    const validated = validateAppSettings(next);

    if (!validated.ok) {
      throw new AppError('CONFIGURATION', 'Tynly settings are invalid.', {
        details: {
          issueCount: validated.issues.length,
          paths: validated.issues.map((issue) => issue.path)
        }
      });
    }

    const safeNext = cloneSettings(validated.value);
    await this.write(safeNext);
    return cloneSettings(safeNext);
  }

  async update(updater: SettingsUpdater): Promise<AppSettings> {
    const current = await this.get();
    return this.replace(updater(cloneSettings(current)));
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
}

function cloneSettings(settings: AppSettings): AppSettings {
  return structuredClone(settings);
}
