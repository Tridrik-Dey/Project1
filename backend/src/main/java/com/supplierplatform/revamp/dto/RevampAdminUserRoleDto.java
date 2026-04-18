package com.supplierplatform.revamp.dto;

import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.user.UserRole;

import java.util.List;
import java.util.UUID;

public record RevampAdminUserRoleDto(
        UUID userId,
        String email,
        String fullName,
        UserRole userRole,
        boolean active,
        List<AdminRole> adminRoles
) {
}

