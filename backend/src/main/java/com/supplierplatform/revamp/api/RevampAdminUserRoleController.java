package com.supplierplatform.revamp.api;

import com.supplierplatform.common.ApiResponse;
import com.supplierplatform.config.RevampAccessGuard;
import com.supplierplatform.revamp.api.dto.AdminRoleMutationRequest;
import com.supplierplatform.revamp.dto.RevampAdminUserRoleDto;
import com.supplierplatform.revamp.service.RevampAdminRoleService;
import com.supplierplatform.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping({"/api/v2/admin/users-roles", "/api/admin/users-roles"})
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class RevampAdminUserRoleController {

    private final RevampAdminRoleService adminRoleService;
    private final RevampAccessGuard revampAccessGuard;

    @GetMapping
    public ResponseEntity<ApiResponse<List<RevampAdminUserRoleDto>>> list(
            @RequestParam(value = "query", required = false) String query
    ) {
        revampAccessGuard.requireReadEnabled();
        User currentUser = getCurrentUser();
        adminRoleService.requireSuperAdmin(currentUser == null ? null : currentUser.getId());
        return ResponseEntity.ok(ApiResponse.ok(adminRoleService.listAdminUsersWithRoles(query)));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<RevampAdminUserRoleDto>> me() {
        revampAccessGuard.requireReadEnabled();
        User currentUser = getCurrentUser();
        UUID userId = currentUser == null ? null : currentUser.getId();
        if (userId == null) {
            throw new org.springframework.security.access.AccessDeniedException("Access denied");
        }
        return ResponseEntity.ok(ApiResponse.ok(adminRoleService.getAdminUserWithRoles(userId)));
    }

    @PostMapping("/assign")
    public ResponseEntity<ApiResponse<RevampAdminUserRoleDto>> assign(
            @Valid @RequestBody AdminRoleMutationRequest request
    ) {
        revampAccessGuard.requireWriteEnabled();
        User currentUser = getCurrentUser();
        UUID actorId = currentUser == null ? null : currentUser.getId();
        adminRoleService.requireSuperAdmin(actorId);
        adminRoleService.assign(request.getTargetUserId(), request.getAdminRole(), actorId);
        RevampAdminUserRoleDto dto = adminRoleService.getAdminUserWithRoles(request.getTargetUserId());
        return ResponseEntity.ok(ApiResponse.ok("Admin role assigned", dto));
    }

    @PostMapping("/revoke")
    public ResponseEntity<ApiResponse<RevampAdminUserRoleDto>> revoke(
            @Valid @RequestBody AdminRoleMutationRequest request
    ) {
        revampAccessGuard.requireWriteEnabled();
        User currentUser = getCurrentUser();
        UUID actorId = currentUser == null ? null : currentUser.getId();
        adminRoleService.requireSuperAdmin(actorId);
        adminRoleService.revoke(request.getTargetUserId(), request.getAdminRole(), actorId);
        RevampAdminUserRoleDto dto = adminRoleService.getAdminUserWithRoles(request.getTargetUserId());
        return ResponseEntity.ok(ApiResponse.ok("Admin role revoked", dto));
    }

    private User getCurrentUser() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof User user) {
            return user;
        }
        return null;
    }
}
