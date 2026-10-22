import { describe, expect, it } from "vitest";
import { can, type Action, type Role } from "./access";

const matrix: Record<Role, Action[]> = {
  owner: ["view", "edit", "rename", "share", "delete"],
  editor: ["view", "edit"],
  viewer: ["view"],
};
const actions: Action[] = ["view", "edit", "rename", "share", "delete"];

describe("can", () => {
  for (const [role, allowed] of Object.entries(matrix) as [Role, Action[]][]) {
    it.each(actions)(`${role} -> %s`, (action) => {
      expect(can(role, action)).toBe(allowed.includes(action));
    });
  }

  it("denies everything without a role", () => {
    expect(actions.some((action) => can(null, action))).toBe(false);
  });
});
