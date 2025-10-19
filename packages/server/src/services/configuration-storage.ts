// Configuration storage service for MongoDB
import { database } from './database.js';
import type { Configuration } from './database.js';

// Default configuration settings
const DEFAULT_SETTINGS: Omit<Configuration, '_id' | 'createdAt' | 'updatedAt'>[] = [
  {
    key: 'DEFAULT_RULE_SET',
    value: 'dod',
    category: 'analysis',
    description: 'Default ruleset for template analysis',
  },
  {
    key: 'REQUIRE_AUTH_FOR_RESULTS',
    value: 'false',
    category: 'security',
    description: 'Require authentication to view analysis results',
  },
  {
    key: 'AUTO_SAVE_RESULTS',
    value: 'false',
    category: 'workflow',
    description: 'Automatically save analysis results to repository',
  },
  {
    key: 'ARCHIVE_ENABLED',
    value: 'true',
    category: 'archive',
    description: 'Enable template archiving functionality',
  },
  {
    key: 'ARCHIVE_COLLECTION',
    value: 'gallery',
    category: 'archive',
    description: 'Target collection for archived templates',
  },
  {
    key: 'ARCHIVE_REPO_SLUG',
    value: 'Template-Doctor/centralized-collections-archive',
    category: 'archive',
    description: 'Repository for centralized template archives',
  },
  {
    key: 'ISSUE_AI_ENABLED',
    value: 'false',
    category: 'features',
    description: 'Enable AI-powered issue assistance',
  },
  {
    key: 'DISPATCH_TARGET_REPO',
    value: '',
    category: 'workflow',
    description: 'Target repository for workflow dispatch events',
  },
];

export class ConfigurationStorage {
  /**
   * Initialize configuration collection with default settings
   */
  static async initializeDefaults(): Promise<void> {
    const collection = database.configuration;

    // Create index on key (unique)
    await collection.createIndex({ key: 1 }, { unique: true });

    const now = new Date();

    for (const setting of DEFAULT_SETTINGS) {
      await collection.updateOne(
        { key: setting.key },
        {
          $setOnInsert: {
            ...setting,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true },
      );
    }

    console.log('[ConfigurationStorage] Defaults initialized');
  }

  /**
   * Get all configuration settings
   */
  static async getAll(): Promise<Configuration[]> {
    const collection = database.configuration;
    return await collection.find({}).toArray();
  }

  /**
   * Get a single configuration value by key
   */
  static async get(key: string): Promise<string | boolean | number | null> {
    const collection = database.configuration;
    const setting = await collection.findOne({ key });
    return setting?.value ?? null;
  }

  /**
   * Set/update a configuration value
   */
  static async set(
    key: string,
    value: string | boolean | number,
    updatedBy?: string,
  ): Promise<void> {
    const collection = database.configuration;
    const now = new Date();

    await collection.updateOne(
      { key },
      {
        $set: {
          value,
          updatedBy,
          updatedAt: now,
        },
        $setOnInsert: {
          key,
          category: 'custom',
          description: 'Custom setting',
          createdAt: now,
        },
      },
      { upsert: true },
    );
  }

  /**
   * Set multiple configuration values
   */
  static async setMany(
    settings: Record<string, string | boolean | number>,
    updatedBy?: string,
  ): Promise<void> {
    const collection = database.configuration;
    const now = new Date();

    const operations = Object.entries(settings).map(([key, value]) => ({
      updateOne: {
        filter: { key },
        update: {
          $set: {
            value,
            updatedBy,
            updatedAt: now,
          },
          $setOnInsert: {
            key,
            category: 'custom',
            description: 'Custom setting',
            createdAt: now,
          },
        },
        upsert: true,
      },
    }));

    if (operations.length > 0) {
      await collection.bulkWrite(operations);
    }
  }

  /**
   * Delete a configuration setting
   */
  static async delete(key: string): Promise<boolean> {
    const collection = database.configuration;
    const result = await collection.deleteOne({ key });
    return result.deletedCount > 0;
  }

  /**
   * Get configuration as key-value object (for client-settings endpoint)
   */
  static async getAsObject(): Promise<Record<string, string | boolean | number>> {
    const settings = await this.getAll();
    return settings.reduce(
      (acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      },
      {} as Record<string, string | boolean | number>,
    );
  }

  /**
   * Merge database settings with environment variables (env vars take precedence)
   */
  static async getMergedConfig(): Promise<Record<string, string>> {
    const dbSettings = await this.getAsObject();
    
    // Environment variables override database settings
    const merged: Record<string, string> = {};
    
    for (const [key, dbValue] of Object.entries(dbSettings)) {
      const envValue = process.env[key];
      merged[key] = envValue ?? String(dbValue);
    }
    
    return merged;
  }
}
