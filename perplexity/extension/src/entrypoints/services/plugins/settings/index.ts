import {
  storage,
  type WxtStorageItem,
  type WxtStorageItemOptions,
} from "@wxt-dev/storage";
import { create, type Draft } from "mutative";
import { type z, type ZodObject } from "zod";

import { migrateLegacyPluginSettings } from "@/entrypoints/services/data-migration/utils";
import { sanitizePluginSettingsForPersonalProfile } from "@/entrypoints/services/plugins/personal-profile";
import type {
  IPluginSettingsService,
  PluginSettingsMetadata,
} from "@/entrypoints/services/plugins/settings/types";
import type {
  PluginId,
  PluginSettingsSchemas,
} from "@/entrypoints/services/plugins/types";
import { safeMerge } from "@/utils/misc/safe-merge";

export class PluginSettingsService<
  TValue,
  TMetadata = Record<string, unknown>,
  TSchemasVersions = Record<number, z.ZodSchema>,
> implements IPluginSettingsService<TValue, TMetadata> {
  settingsSchemas: PluginSettingsSchemas<TSchemasVersions>;

  storageItem: WxtStorageItem<TValue, PluginSettingsMetadata<TMetadata>>;

  public id: PluginId;
  public enforcePersonalProfileAllowlist: boolean;

  constructor({
    id,
    settingsSchemas,
    options,
    enforcePersonalProfileAllowlist = true,
  }: {
    id: PluginId;
    settingsSchemas: PluginSettingsSchemas<TSchemasVersions>;
    options?: WxtStorageItemOptions<TValue>;
    enforcePersonalProfileAllowlist?: boolean;
  }) {
    this.id = id;
    this.settingsSchemas = settingsSchemas;
    this.enforcePersonalProfileAllowlist = enforcePersonalProfileAllowlist;
    this.storageItem = this.createStorageItem({ id, settingsSchemas, options });
  }

  private createStorageItem({
    id,
    settingsSchemas,
    options,
  }: ConstructorParameters<
    typeof PluginSettingsService<TValue, TMetadata, TSchemasVersions>
  >[0]): typeof this.storageItem {
    const migrations: WxtStorageItemOptions<TValue>["migrations"] = {};

    const sortedVersions = Object.keys(settingsSchemas)
      .map(Number)
      .sort((a, b) => a - b);

    invariant(
      sortedVersions.length > 0,
      `[PluginSettingsService] No versions found for plugin ${id}`,
    );

    for (const version of sortedVersions) {
      const schemaEntry = settingsSchemas[version as keyof TSchemasVersions];

      if (schemaEntry.upgrade) {
        migrations[version] = schemaEntry.upgrade;
      } else {
        migrations[version] = (previousData: unknown) =>
          safeMerge(
            schemaEntry.schema as unknown as ZodObject,
            previousData,
            schemaEntry.fallback as Record<string, unknown>,
          );
      }
    }

    const latestVersion = Number(sortedVersions.pop());

    return storage.defineItem(`local:plugin:${id}:settings`, {
      version: latestVersion,
      init: async () => {
        const migrated = await migrateLegacyPluginSettings<
          TValue,
          TSchemasVersions
        >({
          id,
          settingsSchemas,
          latestVersion,
        });

        if (migrated != null) {
          return this.normalizeValue(migrated);
        }

        return this.normalizeValue(
          settingsSchemas[latestVersion as keyof TSchemasVersions]
            .fallback as TValue,
        );
      },
      fallback: settingsSchemas[latestVersion as keyof TSchemasVersions]
        .fallback as TValue,
      migrations: {
        ...migrations,
        ...options?.migrations,
      },
      ...options,
    });
  }

  normalizeValue(value: TValue): TValue {
    return sanitizePluginSettingsForPersonalProfile(this.id, value, {
      enforceAllowlist: this.enforcePersonalProfileAllowlist,
    });
  }

  async getValue(): Promise<TValue> {
    return this.storageItem.getValue();
  }

  async getMeta(): Promise<PluginSettingsMetadata<TMetadata>> {
    return this.storageItem.getMeta();
  }

  async setValue(value: TValue): Promise<void> {
    return this.storageItem.setValue(this.normalizeValue(value));
  }

  async setMeta(meta: PluginSettingsMetadata<TMetadata>): Promise<void> {
    return this.storageItem.setMeta(meta);
  }

  async updateValue(
    updateFn: (draft: Draft<Awaited<TValue>>) => Awaited<TValue> | void,
  ): Promise<TValue> {
    const draft = await this.storageItem.getValue();
    const newSettings = create(draft, updateFn) as Awaited<TValue>;
    const normalizedSettings = this.normalizeValue(newSettings);
    await this.storageItem.setValue(normalizedSettings);
    return normalizedSettings;
  }
}
