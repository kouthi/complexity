import { beforeAll, describe, expect, it, vi } from "vitest";

function createStorageArea() {
  const values = new Map<string, unknown>();

  return {
    async get(keys?: string | string[] | Record<string, unknown> | null) {
      if (typeof keys === "string") {
        return { [keys]: values.get(keys) };
      }

      const requestedKeys = Array.isArray(keys)
        ? keys
        : keys == null
          ? Array.from(values.keys())
          : Object.keys(keys);

      return Object.fromEntries(
        requestedKeys.map((key) => [key, values.get(key)]),
      );
    },
    async set(items: Record<string, unknown>) {
      Object.entries(items).forEach(([key, value]) => {
        values.set(key, value);
      });
    },
    async remove(keys: string | string[]) {
      (Array.isArray(keys) ? keys : [keys]).forEach((key) => values.delete(key));
    },
    async clear() {
      values.clear();
    },
  };
}

beforeAll(() => {
  const browser = {
    runtime: {
      id: "test-extension",
    },
    storage: {
      local: createStorageArea(),
      sync: createStorageArea(),
      managed: createStorageArea(),
      session: createStorageArea(),
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  };

  vi.stubGlobal("browser", browser);
  vi.stubGlobal("chrome", browser);
});

describe("personal profile plugin allowlist", () => {
  it("filters plugin dashboard manifests to the personal profile allowlist", async () => {
    const { getPersonalProfilePublicPluginManifests } = await import(
      "@/entrypoints/services/plugins/utils"
    );

    const manifests = getPersonalProfilePublicPluginManifests();
    const pluginIds = Object.keys(manifests);

    expect(pluginIds).toEqual(
      expect.arrayContaining([
        "queryBox:submitOnCtrlEnter",
        "thread:customThreadContainerWidth",
        "thread:toc",
      ]),
    );
    expect(pluginIds).not.toContain("promptHistory");
    expect(pluginIds).not.toContain("thread:exportThread");
  });

  it("forces disallowed public plugins off in runtime enable states", async () => {
    const [{ initializeLocalEnableStates }, { getPublicPluginManifests }] =
      await Promise.all([
        import("@/entrypoints/services/externals/cplx-api/plugins-states/utils"),
        import("@/entrypoints/services/plugins/utils"),
      ]);

    const pluginSnapshots = Object.fromEntries(
      Object.keys(getPublicPluginManifests()).map((pluginId) => [
        pluginId,
        { enabled: false },
      ]),
    ) as Record<string, { enabled: boolean }>;

    pluginSnapshots.promptHistory = { enabled: true };
    pluginSnapshots["thread:toc"] = { enabled: true };

    const localEnableStates = await initializeLocalEnableStates(
      pluginSnapshots as never,
    );

    expect(localEnableStates.promptHistory).toBe(false);
    expect(localEnableStates["thread:toc"]).toBe(true);
    expect(localEnableStates.customTheme).toBe(true);
  });
});
