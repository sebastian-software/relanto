import { describe, expect, it } from "vitest";

import {
  isCreateAdminSubmitDisabled,
  isCreateApplicationSubmitDisabled,
  isCreateTokenSubmitDisabled,
  isRenameSubmitDisabled,
} from "./dashboard-form-state";

describe("dashboard form submit guards", () => {
  it("disables create admin submission until the label is non-empty", () => {
    expect(isCreateAdminSubmitDisabled("")).toBe(true);
    expect(isCreateAdminSubmitDisabled("   ")).toBe(true);
    expect(isCreateAdminSubmitDisabled("Admin One")).toBe(false);
  });

  it("disables create application submission until all required values are present", () => {
    expect(
      isCreateApplicationSubmitDisabled({
        adminCount: 0,
        applicationAdminId: "",
        label: "",
      }),
    ).toBe(true);

    expect(
      isCreateApplicationSubmitDisabled({
        adminCount: 1,
        applicationAdminId: "",
        label: "Mailer App",
      }),
    ).toBe(true);

    expect(
      isCreateApplicationSubmitDisabled({
        adminCount: 1,
        applicationAdminId: "admin_1",
        label: "   ",
      }),
    ).toBe(true);

    expect(
      isCreateApplicationSubmitDisabled({
        adminCount: 1,
        applicationAdminId: "admin_1",
        label: "Mailer App",
      }),
    ).toBe(false);
  });

  it("disables token creation until the label is present, scopes are selected and the form is enabled", () => {
    expect(
      isCreateTokenSubmitDisabled({
        disabled: false,
        label: "",
        scopes: ["send"],
      }),
    ).toBe(true);

    expect(
      isCreateTokenSubmitDisabled({
        disabled: false,
        label: "Mailer Token",
        scopes: [],
      }),
    ).toBe(true);

    expect(
      isCreateTokenSubmitDisabled({
        disabled: true,
        label: "Mailer Token",
        scopes: ["send"],
      }),
    ).toBe(true);

    expect(
      isCreateTokenSubmitDisabled({
        disabled: false,
        label: "Mailer Token",
        scopes: ["send"],
      }),
    ).toBe(false);
  });

  it("disables rename submission while the draft is empty or unchanged", () => {
    expect(isRenameSubmitDisabled("Mailer App", "")).toBe(true);
    expect(isRenameSubmitDisabled("Mailer App", "   ")).toBe(true);
    expect(isRenameSubmitDisabled("Mailer App", "Mailer App")).toBe(true);
    expect(isRenameSubmitDisabled("Mailer App", "  Mailer App  ")).toBe(true);
    expect(isRenameSubmitDisabled("Mailer App", "Reports App")).toBe(false);
  });
});
