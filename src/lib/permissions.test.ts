import { describe, expect, it } from "vitest";

import {
  ALL_ROLES,
  ROLE_RANK,
  canAccessDeveloperSettings,
  canAccessRoute,
  canEditPlatformSettings,
  canManageDevelopers,
  canManageTarget,
  canManageUsers,
  canPromoteToDeveloper,
  getVisibleNav,
  isAdminOrAbove,
  isDeveloper,
  NAV,
} from "@/lib/permissions";

describe("role predicates", () => {
  it("isDeveloper matches only developer", () => {
    expect(isDeveloper("developer")).toBe(true);
    expect(isDeveloper("admin")).toBe(false);
    expect(isDeveloper("user")).toBe(false);
    expect(isDeveloper(null)).toBe(false);
  });

  it("isAdminOrAbove is true for admin and developer only", () => {
    expect(isAdminOrAbove("admin")).toBe(true);
    expect(isAdminOrAbove("developer")).toBe(true);
    expect(isAdminOrAbove("user")).toBe(false);
    expect(isAdminOrAbove(null)).toBe(false);
  });
});

describe("user management permissions", () => {
  it("canManageUsers: admin+ only", () => {
    expect(canManageUsers("admin")).toBe(true);
    expect(canManageUsers("developer")).toBe(true);
    expect(canManageUsers("user")).toBe(false);
  });

  it("canManageDevelopers / canPromoteToDeveloper: developer only", () => {
    expect(canManageDevelopers("developer")).toBe(true);
    expect(canManageDevelopers("admin")).toBe(false);
    expect(canPromoteToDeveloper("developer")).toBe(true);
    expect(canPromoteToDeveloper("admin")).toBe(false);
    expect(canPromoteToDeveloper("user")).toBe(false);
  });

  it("canEditPlatformSettings / canAccessDeveloperSettings: developer only", () => {
    expect(canEditPlatformSettings("developer")).toBe(true);
    expect(canEditPlatformSettings("admin")).toBe(false);
    expect(canAccessDeveloperSettings("developer")).toBe(true);
    expect(canAccessDeveloperSettings("admin")).toBe(false);
  });

  it("canManageTarget: admin cannot manage developers; developer can manage all", () => {
    expect(canManageTarget("developer", "developer")).toBe(true);
    expect(canManageTarget("developer", "admin")).toBe(true);
    expect(canManageTarget("developer", "user")).toBe(true);
    // Admins may manage users and other admins, but NOT developers.
    expect(canManageTarget("admin", "user")).toBe(true);
    expect(canManageTarget("admin", "admin")).toBe(true);
    expect(canManageTarget("admin", "developer")).toBe(false);
    expect(canManageTarget("user", "user")).toBe(false);
  });

  it("a user cannot promote themselves (no manage rights at all)", () => {
    expect(canManageUsers("user")).toBe(false);
    expect(canPromoteToDeveloper("user")).toBe(false);
    expect(canManageDevelopers("user")).toBe(false);
  });
});

describe("navigation visibility", () => {
  it("user sees core modules but not Users/Settings/Developer Settings", () => {
    const visible = getVisibleNav("user").map((n) => n.to);
    expect(visible).toContain("/");
    expect(visible).toContain("/affiliates");
    expect(visible).toContain("/contacts");
    expect(visible).not.toContain("/users");
    expect(visible).not.toContain("/settings");
    expect(visible).not.toContain("/developer-settings");
  });

  it("admin sees Users and Settings but not Developer Settings", () => {
    const visible = getVisibleNav("admin").map((n) => n.to);
    expect(visible).toContain("/users");
    expect(visible).toContain("/settings");
    expect(visible).not.toContain("/developer-settings");
  });

  it("developer sees everything including Developer Settings", () => {
    const visible = getVisibleNav("developer").map((n) => n.to);
    expect(visible).toContain("/developer-settings");
    expect(visible).toContain("/users");
    expect(visible).toContain("/settings");
  });

  it("no role shows no nav", () => {
    expect(getVisibleNav(null)).toEqual([]);
  });
});

describe("route access enforcement", () => {
  it("developer-settings is only accessible to developer", () => {
    expect(canAccessRoute("developer", "/developer-settings")).toBe(true);
    expect(canAccessRoute("admin", "/developer-settings")).toBe(false);
    expect(canAccessRoute("user", "/developer-settings")).toBe(false);
  });

  it("users route is accessible to admin and developer, not user", () => {
    expect(canAccessRoute("admin", "/users")).toBe(true);
    expect(canAccessRoute("developer", "/users")).toBe(true);
    expect(canAccessRoute("user", "/users")).toBe(false);
  });

  it("settings route is accessible to admin and developer, not user", () => {
    expect(canAccessRoute("admin", "/settings")).toBe(true);
    expect(canAccessRoute("user", "/settings")).toBe(false);
  });

  it("core modules are accessible to all roles", () => {
    for (const r of ALL_ROLES) {
      expect(canAccessRoute(r, "/affiliates")).toBe(true);
      expect(canAccessRoute(r, "/activity")).toBe(true);
      expect(canAccessRoute(r, "/")).toBe(true);
    }
  });

  it("unknown paths are not nav-gated", () => {
    expect(canAccessRoute("user", "/some/unknown/path")).toBe(true);
  });
});

describe("role rank", () => {
  it("orders user < admin < developer", () => {
    expect(ROLE_RANK.user).toBeLessThan(ROLE_RANK.admin);
    expect(ROLE_RANK.admin).toBeLessThan(ROLE_RANK.developer);
  });
});

describe("nav definition invariants", () => {
  it("every nav item has a valid role set", () => {
    for (const item of NAV) {
      for (const r of item.roles) {
        expect(ALL_ROLES).toContain(r);
      }
    }
  });
});
