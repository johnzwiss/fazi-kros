import { describe, expect, it } from "vitest";
import { buildTrainingUrl, clearTrainingUrl, parseTrainingDeepLink } from "../deepLink";

describe("training deep links", () => {
  it("defaults calendar event links to Day view", () => {
    expect(parseTrainingDeepLink("?plan=plan-1&date=2026-07-04")).toEqual({ planId: "plan-1", date: "2026-07-04", view: "day" });
  });

  it("rejects malformed dates and incomplete links", () => {
    expect(() => parseTrainingDeepLink("?plan=plan-1&date=2026-02-31")).toThrow("invalid");
    expect(() => parseTrainingDeepLink("?date=2026-07-04")).toThrow("invalid");
    expect(parseTrainingDeepLink("")).toBeNull();
  });

  it("builds repository-relative links without losing the base path", () => {
    const value = buildTrainingUrl("https://johnzwiss.github.io/fazi-kros/", { planId: "p 1", date: "2026-07-04", view: "day" });
    expect(value).toBe("https://johnzwiss.github.io/fazi-kros/?plan=p+1&date=2026-07-04&view=day");
    expect(clearTrainingUrl(value)).toBe("https://johnzwiss.github.io/fazi-kros/");
  });
});
