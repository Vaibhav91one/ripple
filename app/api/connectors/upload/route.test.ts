import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const emit = vi.fn(async (..._a: unknown[]) => ({ inserted: true }));
const uploadFile = vi.fn();
vi.mock("@/lib/events/emit", () => ({ emit }));
vi.mock("@/lib/db", () => ({ db: () => ({}) }));
vi.mock("@/lib/env", () => ({ env: () => ({ DATABASE_URL: "postgres://x" }) }));
vi.mock("@/lib/ingest/upload", async (orig) => ({ ...(await orig<typeof import("@/lib/ingest/upload")>()), uploadFile }));
vi.mock("@/lib/server/route", () => ({ denyIfReadonly: async () => null }));
vi.mock("@/lib/server/context", () => ({
  getContext: async () => ({ org: { id: "org-1" }, viewer: { kind: "user", role: "admin" }, writer: () => ({}), now: 1, audit: async () => {} }),
}));

const post = (type: string) => {
  const form = new FormData();
  form.set("type", type);
  form.append("files", new File(["7.2 API. Ledgerly guarantees v1."], "msa.txt", { type: "text/plain" }));
  return new Request("http://x/api/connectors/upload", { method: "POST", body: form });
};

beforeEach(() => { emit.mockClear(); uploadFile.mockReset(); });

describe("POST /api/connectors/upload -> contract.added", () => {
  it("a contract upload emits contract.added with the new contract id", async () => {
    uploadFile.mockResolvedValue({ name: "msa.txt", ok: true, chars: 10, duplicate: false, contractId: "contract:abc", clauses: 1 });
    const { POST } = await import("./route");
    expect((await POST(post("contract"))).status).toBe(200);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0][1]).toMatchObject({ type: "contract.added", orgId: "org-1", subject: { kind: "contract", id: "contract:abc" }, payload: { contractId: "contract:abc" }, dedupeKey: "contract.added:contract:abc" });
  });
  it("a plain document upload emits nothing", async () => {
    uploadFile.mockResolvedValue({ name: "rfc.txt", ok: true, chars: 10, duplicate: false });
    const { POST } = await import("./route");
    await POST(post("document"));
    expect(emit).not.toHaveBeenCalled();
  });
  it("a failed contract upload emits nothing", async () => {
    uploadFile.mockResolvedValue({ name: "msa.txt", ok: false, error: "bad" });
    const { POST } = await import("./route");
    await POST(post("contract"));
    expect(emit).not.toHaveBeenCalled();
  });
});
