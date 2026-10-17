import { afterEach, expect, it, vi } from "vitest";
import { env } from "./env";

afterEach(() => vi.restoreAllMocks());

it("applies defaults and treats empty strings as unset", () => {
  const e = env({ LLM_API_KEY: "" });
  expect(e).toMatchObject({ FALKORDB_HOST: "localhost", FALKORDB_PORT: 6379, DAILY_TOKEN_BUDGET: 2_000_000 });
  expect(e.LLM_API_KEY).toBeUndefined();
});

it("warn mode: invalid var logs one line, falls back to default, never throws", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const e = env({ FALKORDB_PORT: "nope", LLM_PROVIDER: "bogus" });
  expect(e.FALKORDB_PORT).toBe(6379);
  expect(e.LLM_PROVIDER).toBeUndefined();
  expect(warn.mock.calls.map((c) => c[0]).join("\n")).toMatch(/FALKORDB_PORT[\s\S]*LLM_PROVIDER/);
  env({ FALKORDB_PORT: "nope" }); // same problem is not logged twice
  expect(warn).toHaveBeenCalledTimes(2);
});

it("warn mode: missing prod secrets warn only", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(() => env({ NODE_ENV: "production" })).not.toThrow();
  expect(warn.mock.calls.map((c) => c[0]).join("\n")).toMatch(/RESET_TOKEN: required in production/);
});

it("strict mode throws naming the var", () => {
  expect(() => env({ ENV_STRICT: "1", FALKORDB_PORT: "nope" })).toThrow(/FALKORDB_PORT/);
  expect(() => env({ ENV_STRICT: "1", NODE_ENV: "production" })).toThrow(/ACK_TOKEN_SECRET/);
});

it("SKIP_ENV_VALIDATION skips even in strict mode", () => {
  expect(env({ ENV_STRICT: "1", SKIP_ENV_VALIDATION: "1", FALKORDB_PORT: "nope" }).FALKORDB_PORT).toBe(6379);
});
