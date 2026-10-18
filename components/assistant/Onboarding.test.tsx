// #274: the empty-org onboarding renders the three connect links, and the sample button only for admins.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Onboarding, SampleNote } from "./Onboarding";

const html = (el: React.ReactElement) => renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}>{el}</QueryClientProvider>);

describe("Onboarding", () => {
  it("shows the empty state with Connect GitHub, Connect Slack, Import a CSV and Load the sample company", () => {
    const h = html(<Onboarding canManage />);
    expect(h).toContain("Your company brain is empty");
    for (const href of ["/connections/github", "/connections/slack", "/connections/csv"]) expect(h).toContain(`href="${href}"`);
    expect(h).toContain("Load the sample company");
  });
  it("members see who can load it instead of the button", () => {
    const h = html(<Onboarding canManage={false} />);
    expect(h).not.toContain("Load the sample company</button>");
    expect(h).toContain("Ask an admin");
  });
  it("the sample note offers removal to admins only", () => {
    expect(html(<SampleNote canManage />)).toContain("Remove the sample");
    expect(html(<SampleNote canManage={false} />)).not.toContain("Remove the sample");
  });
});
