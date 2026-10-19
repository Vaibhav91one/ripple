import { describe, expect, it } from "vitest";
import { explainSentence } from "./analytics";

const nm = (t: string) => t[0].toUpperCase() + t.slice(1);
describe("explainSentence", () => {
  it("names every team tied at the cut-off", () => {
    expect(explainSentence([{ teamId: "legal", pts: 34 }, { teamId: "devrel", pts: 33 }, { teamId: "security", pts: 33 }], 100, nm)).toBe("Legal, Devrel and Security explain 100% of the 100 point gap.");
  });
  it("two teams, one team, none", () => {
    expect(explainSentence([{ teamId: "legal", pts: 40 }, { teamId: "devrel", pts: 30 }, { teamId: "sales", pts: 20 }], 90, nm)).toBe("Legal and Devrel explain 78% of the 90 point gap.");
    expect(explainSentence([{ teamId: "legal", pts: 40 }], 40, nm)).toBe("Legal explains 100% of the 40 point gap.");
    expect(explainSentence([], 0, nm)).toBe("Every affected team has been told.");
  });
});
