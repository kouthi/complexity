import { describe, expect, it } from "vitest";

import { initializeLocalEnableStates } from "@/entrypoints/services/externals/cplx-api/plugins-states/utils";
import { PluginsSettingSnapshotsService } from "@/entrypoints/services/plugins/settings/snapshots";
import { getPersonalProfilePublicPluginManifests } from "@/entrypoints/services/plugins/utils";

describe("personal profile plugin allowlist", () => {
  it("filters plugin dashboard manifests to the personal profile allowlist", () => {
    const manifests = getPersonalProfilePublicPluginManifests();

    expect(Object.keys(manifests).sort()).toEqual([
      "queryBox:submitOnCtrlEnter",
      "thread:customThreadContainerWidth",
      "thread:toc",
    ]);
    expect(manifests.promptHistory).toBeUndefined();
  });

  it("forces disallowed public plugins off in runtime enable states", async () => {
    const pluginSnapshots = structuredClone(
      PluginsSettingSnapshotsService.getPluginsFallbackValues(),
    );

    pluginSnapshots.promptHistory.enabled = true;
    pluginSnapshots["thread:toc"].enabled = true;

    const localEnableStates = await initializeLocalEnableStates(pluginSnapshots);

    expect(localEnableStates.promptHistory).toBe(false);
    expect(localEnableStates["thread:toc"]).toBe(true);
    expect(localEnableStates.customTheme).toBe(true);
  });
});
