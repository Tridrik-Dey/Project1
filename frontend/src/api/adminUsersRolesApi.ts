import { resolveApiPath } from "./pathResolver";
import { apiRequest } from "./http";
import type { AdminUserInviteResponse } from "../types/api";

export type AdminRole = "SUPER_ADMIN" | "RESPONSABILE_ALBO" | "REVISORE" | "VIEWER";
export type UserRole = "ADMIN" | "SUPPLIER";

export interface AdminUserRoleRow {
  userId: string;
  email: string;
  fullName: string;
  userRole: UserRole;
  active: boolean;
  adminRoles: AdminRole[];
}

interface AdminRoleMutationPayload {
  targetUserId: string;
  adminRole: AdminRole;
}

export interface CreateAdminUserInvitePayload {
  email: string;
  fullName: string;
  adminRole: AdminRole;
  expiresInDays?: number;
}

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths)];
}

function adminUsersRolesBasePaths(): string[] {
  const resolved = resolveApiPath({
    feature: "adminV2",
    legacyPath: "/api/admin/users-roles",
    revampPath: "/api/v2/admin/users-roles"
  });
  return uniquePaths(["/api/v2/admin/users-roles", resolved, "/api/admin/users-roles"]);
}

function adminUsersBasePaths(): string[] {
  const resolved = resolveApiPath({
    feature: "adminV2",
    legacyPath: "/api/admin/users",
    revampPath: "/api/v2/admin/users"
  });
  return uniquePaths(["/api/v2/admin/users", resolved, "/api/admin/users"]);
}

async function apiRequestWithFallback<T>(
  paths: string[],
  buildPath: (basePath: string) => string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  let lastError: unknown;
  for (const basePath of paths) {
    try {
      return await apiRequest<T>(buildPath(basePath), options, token);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export function getAdminUsersRoles(token: string, query?: string): Promise<AdminUserRoleRow[]> {
  const q = query?.trim();
  return apiRequestWithFallback<AdminUserRoleRow[]>(
    adminUsersRolesBasePaths(),
    (basePath) => (q ? `${basePath}?query=${encodeURIComponent(q)}` : basePath),
    token
  );
}

export function getMyAdminUsersRolesProfile(token: string): Promise<AdminUserRoleRow> {
  return apiRequestWithFallback<AdminUserRoleRow>(
    adminUsersRolesBasePaths(),
    (basePath) => `${basePath}/me`,
    token
  );
}

export function assignAdminUserRole(
  token: string,
  payload: AdminRoleMutationPayload
): Promise<AdminUserRoleRow> {
  return apiRequestWithFallback<AdminUserRoleRow>(
    adminUsersRolesBasePaths(),
    (basePath) => `${basePath}/assign`,
    token,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export function revokeAdminUserRole(
  token: string,
  payload: AdminRoleMutationPayload
): Promise<AdminUserRoleRow> {
  return apiRequestWithFallback<AdminUserRoleRow>(
    adminUsersRolesBasePaths(),
    (basePath) => `${basePath}/revoke`,
    token,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export function createAdminUserInvite(
  token: string,
  payload: CreateAdminUserInvitePayload
): Promise<AdminUserInviteResponse> {
  return apiRequestWithFallback<AdminUserInviteResponse>(
    adminUsersBasePaths(),
    (basePath) => `${basePath}/invite`,
    token,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}
