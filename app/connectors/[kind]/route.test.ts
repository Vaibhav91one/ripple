import { describe, expect, it } from "vitest";
import { GET } from "./route";

const call = (path: string, kind: string) => GET(new Request(`http://x${path}`), { params: Promise.resolve({ kind }) });

describe("/connectors/[kind] -> /connections/[kind]", () => {
  it("keeps the query string", async () => {
    const res = await call("/connectors/github?connected=1", "github");
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("/connections/github?connected=1");
  });
  it("404s an unknown kind", async () => expect((await call("/connectors/nope", "nope")).status).toBe(404));
});
