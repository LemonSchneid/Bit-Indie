import assert from "node:assert/strict";
import test from "node:test";

const coreModulePath = require.resolve("./core");

type MutableGlobal = typeof globalThis & { window?: Window & typeof globalThis };

const globalScope = globalThis as MutableGlobal;

function reloadCoreModule() {
  delete require.cache[coreModulePath];
  return require("./core") as typeof import("./core");
}

test("resolveApiBaseUrl sanitizes configured base URLs", async (t) => {
  await t.test("server-side configuration trims trailing slashes", async () => {
    const originalApiUrl = process.env.API_URL;
    const originalPublicUrl = process.env.NEXT_PUBLIC_API_URL;
    const originalWindow = globalScope.window;

    try {
      process.env.API_URL = "https://example.com////";
      delete process.env.NEXT_PUBLIC_API_URL;
      Reflect.deleteProperty(globalScope, "window");

      const core = reloadCoreModule();
      assert.equal(core.apiBaseUrl, "https://example.com");
      assert.equal(core.buildApiUrl("/status"), "https://example.com/status");
    } finally {
      if (originalApiUrl === undefined) {
        delete process.env.API_URL;
      } else {
        process.env.API_URL = originalApiUrl;
      }

      if (originalPublicUrl === undefined) {
        delete process.env.NEXT_PUBLIC_API_URL;
      } else {
        process.env.NEXT_PUBLIC_API_URL = originalPublicUrl;
      }

      if (originalWindow === undefined) {
        Reflect.deleteProperty(globalScope, "window");
      } else {
        globalScope.window = originalWindow;
      }

      reloadCoreModule();
    }
  });

  await t.test("client-side configuration trims trailing slashes", async () => {
    const originalApiUrl = process.env.API_URL;
    const originalPublicUrl = process.env.NEXT_PUBLIC_API_URL;
    const originalWindow = globalScope.window;

    try {
      delete process.env.API_URL;
      process.env.NEXT_PUBLIC_API_URL = "https://public.example.com///";
      globalScope.window = {} as Window & typeof globalThis;

      const core = reloadCoreModule();
      assert.equal(core.apiBaseUrl, "https://public.example.com");
      assert.equal(core.buildApiUrl("/games"), "https://public.example.com/games");
    } finally {
      if (originalApiUrl === undefined) {
        delete process.env.API_URL;
      } else {
        process.env.API_URL = originalApiUrl;
      }

      if (originalPublicUrl === undefined) {
        delete process.env.NEXT_PUBLIC_API_URL;
      } else {
        process.env.NEXT_PUBLIC_API_URL = originalPublicUrl;
      }

      if (originalWindow === undefined) {
        Reflect.deleteProperty(globalScope, "window");
      } else {
        globalScope.window = originalWindow;
      }

      reloadCoreModule();
    }
  });

  await t.test("blank public URLs fall back to defaults", async () => {
    const originalApiUrl = process.env.API_URL;
    const originalPublicUrl = process.env.NEXT_PUBLIC_API_URL;
    const originalWindow = globalScope.window;

    try {
      delete process.env.API_URL;
      process.env.NEXT_PUBLIC_API_URL = "   /   ";
      globalScope.window = {} as Window & typeof globalThis;

      const core = reloadCoreModule();
      assert.equal(core.apiBaseUrl, "http://localhost:8080");
    } finally {
      if (originalApiUrl === undefined) {
        delete process.env.API_URL;
      } else {
        process.env.API_URL = originalApiUrl;
      }

      if (originalPublicUrl === undefined) {
        delete process.env.NEXT_PUBLIC_API_URL;
      } else {
        process.env.NEXT_PUBLIC_API_URL = originalPublicUrl;
      }

      if (originalWindow === undefined) {
        Reflect.deleteProperty(globalScope, "window");
      } else {
        globalScope.window = originalWindow;
      }

      reloadCoreModule();
    }
  });
});
