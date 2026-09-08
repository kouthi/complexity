import type { PublicPlugins } from "@/entrypoints/services/plugins/types";

type EnabledPluginSettings = {
  enabled: boolean;
};

export const personalProfilePublicPluginIds = [
  "thread:customThreadContainerWidth",
  "thread:toc",
  "queryBox:languageModelSelector",
  "queryBox:submitOnCtrlEnter",
] as const satisfies readonly (keyof PublicPlugins)[];

const personalProfilePublicPluginIdSet = new Set<string>(
  personalProfilePublicPluginIds,
);

export function isPersonalProfilePublicPlugin(
  pluginId: string,
): pluginId is (typeof personalProfilePublicPluginIds)[number] {
  return personalProfilePublicPluginIdSet.has(pluginId);
}

export function sanitizePluginSettingsForPersonalProfile<T>(
  pluginId: string,
  settings: T,
  {
    enforceAllowlist = true,
  }: {
    enforceAllowlist?: boolean;
  } = {},
): T {
  if (
    !enforceAllowlist ||
    isPersonalProfilePublicPlugin(pluginId) ||
    !hasEnabledFlag(settings) ||
    !settings.enabled
  ) {
    return settings;
  }

  return {
    ...settings,
    enabled: false,
  };
}

function hasEnabledFlag(value: unknown): value is EnabledPluginSettings {
  return (
    typeof value === "object" &&
    value != null &&
    "enabled" in value &&
    typeof value.enabled === "boolean"
  );
}
