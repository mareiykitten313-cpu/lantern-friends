import { describe, expect, it } from "vitest";
import { inviteLink, isValidUsername, normalizeUsername, safeRedirect } from "./usernames";

describe("usernames", () => {
  it("normalizes typed usernames", () => {
    expect(normalizeUsername("  @Maya.Rose! ")).toBe("mayarose");
  });
  it("requires 3 to 24 lowercase letters, digits or underscores", () => {
    expect(isValidUsername("ab")).toBe(false);
    expect(isValidUsername("maya_99")).toBe(true);
    expect(isValidUsername("a".repeat(25))).toBe(false);
  });
  it("builds invite links at /add/<username>", () => {
    expect(inviteLink("https://lantern.app/", "maya")).toBe("https://lantern.app/add/maya");
  });
  it("only allows same-site redirects after sign-in", () => {
    expect(safeRedirect("/add/maya")).toBe("/add/maya");
    expect(safeRedirect("//evil.com")).toBeUndefined();
    expect(safeRedirect("https://evil.com")).toBeUndefined();
  });
});
