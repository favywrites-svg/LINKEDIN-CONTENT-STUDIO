import { describe, expect, it } from "vitest";
import {
  CONTENT_PILLARS,
  MONTHLY_POST_TARGET,
  PRIMARY_NAV_ITEMS,
  getGreetingForHour,
  getSafeRuntimeStatus,
} from "./constants";

describe("constants, personalised greeting, and safe runtime status", () => {
  it("matches the monthly target of 12 posts across 4 pillars", () => {
    expect(CONTENT_PILLARS).toHaveLength(4);
    expect(MONTHLY_POST_TARGET).toBe(12);
  });

  it("includes all 9 workspace navigation sections including Editorial Memory", () => {
    const labels = PRIMARY_NAV_ITEMS.map((item) => item.label);
    expect(labels).toEqual([
      "Dashboard",
      "Content Ideas",
      "Research",
      "Drafts",
      "Content Calendar",
      "Approved",
      "Editorial Memory",
      "Archive",
      "Settings",
    ]);
  });

  it("generates time-appropriate greetings for Efe", () => {
    expect(getGreetingForHour(9).headline).toBe("Good morning, Efe!");
    expect(getGreetingForHour(14).headline).toBe("Good afternoon, Efe!");
    expect(getGreetingForHour(20).headline).toBe("Good evening, Efe!");
  });

  it("reports unconfigured AI cleanly without exposing secret values", () => {
    const empty = getSafeRuntimeStatus({});
    expect(empty.aiConfigured).toBe(false);
    expect(empty.aiProvider).toBe("unconfigured");

    const fakeSecret = "super-secret-key-do-not-expose";
    const configured = getSafeRuntimeStatus({
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: fakeSecret,
      GEMINI_MODEL: "gemini-2.5-flash",
      APP_ACCESS_PASSWORD: fakeSecret,
    });

    expect(configured.aiConfigured).toBe(true);
    expect(configured.aiModel).toBe("gemini-2.5-flash");
    expect(JSON.stringify(configured)).not.toContain(fakeSecret);
  });
});
