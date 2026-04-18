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

function adminUsersRolesBasePath(): string {
  return resolveApiPath({
    feature: "adminV2",
    legacyPath: "/api/admin/users-roles",
    revampPath: "/api/v2/admin/users-roles"
  });
}

export function getAdminUsersRoles(token: string, query?: string): Promise<AdminUserRoleRow[]> {
  const basePath = adminUsersRolesBasePath();
  const q = query?.trim();
  const path = q ? `${basePath}?query=${encodeURIComponent(q)}` : basePath;
  return apiRequest<AdminUserRoleRow[]>(path, {}, token);
}

export function getMyAdminUsersRolesProfile(token: string): Promise<AdminUserRoleRow> {
  const basePath = adminUsersRolesBasePath();
  return apiRequest<AdminUserRoleRow>(`${basePath}/me`, {}, token);
}

export function assignAdminUserRole(
  token: string,
  payload: AdminRoleMutationPayload
): Promise<AdminUserRoleRow> {
  const basePath = adminUsersRolesBasePath();
  return apiRequest<AdminUserRoleRow>(
    `${basePath}/assign`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function revokeAdminUserRole(
  token: string,
  payload: AdminRoleMutationPayload
): Promise<AdminUserRoleRow> {
  const basePath = adminUsersRolesBasePath();
  return apiRequest<AdminUserRoleRow>(
    `${basePath}/revoke`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function createAdminUserInvite(
  token: string,
  payload: CreateAdminUserInvitePayload
): Promise<AdminUserInviteResponse> {
  const basePath = resolveApiPath({
    feature: "adminV2",
    legacyPath: "/api/admin/users",
    revampPath: "/api/v2/admin/users"
  });
  return apiRequest<AdminUserInviteResponse>(
    `${basePath}/invite`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}
