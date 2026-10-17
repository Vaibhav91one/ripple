import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  // 30s per test: these hit the shared FalkorDB (single-threaded), so under other builders' load a ~100ms test can queue for seconds. Real hangs still fail.
  test: { exclude: [...configDefaults.exclude, ".claude/**"], testTimeout: 30_000 },
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
});
