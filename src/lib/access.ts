import type { ShareRole } from "@/db/schema";

export type Role = "owner" | ShareRole;
export type Action = "view" | "edit" | "rename" | "share" | "delete";

const ALLOWED: Record<Role, readonly Action[]> = {
  owner: ["view", "edit", "rename", "share", "delete"],
  editor: ["view", "edit"],
  viewer: ["view"],
};

export function can(role: Role | null, action: Action): boolean {
  return role !== null && ALLOWED[role].includes(action);
}
