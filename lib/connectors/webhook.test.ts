import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Octo } from "./github/sync";

vi.mock("server-only", () => ({}));
vi.mock("../queue", () => ({ enqueue: vi.fn(async () => "job") }));

const keys = new Set<string>();
const row = { id: "00000000-0000-4000-8000-000000000001", orgId: "org-1", kind: "github", externalId: "99", tokenEnc: null, scopes: [] };
vi.mock("../db", () => ({
  db: () => ({
    select: () => ({ from: () => ({ where: async () => [row] }) }),
    insert: () => ({ values: (v: { dedupeKey: string }) => ({ onConflictDoNothing: () => ({ returning: async () => (keys.has(v.dedupeKey) ? [] : (keys.add(v.dedupeKey), [{ id: "e1" }])) }) }) }),
  }),
}));
let octo: Octo;
vi.mock("./github/client", async (orig) => ({
  ...(await orig<typeof import("./github/client")>()),
  githubApp: () => ({ getInstallationOctokit: async () => octo }),
}));

const SECRET = "whsec_test";
const body = JSON.stringify({ action: "synchronize", number: 7, repository: { full_name: "acme/shop" }, pull_request: { html_url: "https://github.com/acme/shop/pull/7", title: "T", body: null, user: { login: "a" } } });
const post = (sig = `sha256=${createHmac("sha256", SECRET).update(body).digest("hex")}`) =>
  new Request("http://t/w", { method: "POST", body, headers: { "x-github-event": "pull_request", "x-github-delivery": "d-1", "x-hub-signature-256": sig } });

afterEach(() => { vi.unstubAllEnvs(); keys.clear(); });

describe("handleWebhook failure modes", () => {
  it("bad signature is 400 bad_signature; a failed files API is 502 processing_failed with nothing emitted; the redelivery emits once", async () => {
    vi.stubEnv("GITHUB_APP_WEBHOOK_SECRET", SECRET);
    vi.stubEnv("DATABASE_URL", "postgres://unused");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { handleWebhook } = await import("./webhook");
    const { github } = await import("./github");

    const bad = await handleWebhook(github, row.id, post("sha256=00"));
    expect([bad.status, (await bad.json()).error]).toEqual([400, "bad_signature"]);

    octo = { request: async () => { throw Object.assign(new Error("Bad Gateway"), { status: 502 }); } };
    const failed = await handleWebhook(github, row.id, post());
    expect([failed.status, (await failed.json()).error]).toEqual([502, "processing_failed"]);
    expect(keys.size).toBe(0);

    octo = { request: async () => ({ data: [{ filename: "a.ts" }] }) };
    expect((await (await handleWebhook(github, row.id, post())).json()).inserted).toBe(1);
    expect((await (await handleWebhook(github, row.id, post())).json()).inserted).toBe(0);
    expect(keys.size).toBe(1);
  });
});
