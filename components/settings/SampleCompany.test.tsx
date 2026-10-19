// The Settings sample-company card: the starters query decides the state, the button, and who may press it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SampleCompany } from "./SampleCompany";

const html = (starters?: object) => {
  const qc = new QueryClient();
  if (starters) qc.setQueryData(["starters"], { chips: [], ...starters });
  return renderToStaticMarkup(<QueryClientProvider client={qc}><SampleCompany /></QueryClientProvider>);
};

describe("SampleCompany", () => {
  it("admins can load it when it is not loaded", () => {
    const h = html({ demo: false, empty: false, sample: false, canManage: true });
    expect(h).toContain("Not loaded");
    expect(h).toContain("Load the sample company");
    expect(h).not.toContain(`disabled=""`);
  });
  it("admins can remove it when it is loaded", () => {
    const h = html({ demo: false, empty: false, sample: true, canManage: true });
    expect(h).toContain("Loaded: Ledgerly");
    expect(h).toContain("Remove the sample company");
  });
  it("non-admins get a disabled button and the reason", () => {
    const h = html({ demo: false, empty: false, sample: false, canManage: false });
    expect(h).toContain(`disabled=""`);
    expect(h).toContain("Only org admins");
  });
  it("the shared demo is read-only", () => {
    const h = html({ demo: true, empty: false, sample: false, canManage: false });
    expect(h).toContain(`disabled=""`);
    expect(h).toContain("shared demo is read-only");
  });
});
