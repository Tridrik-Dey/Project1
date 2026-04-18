package com.supplierplatform.revamp.api;

import com.supplierplatform.common.ApiResponse;
import com.supplierplatform.config.RevampAccessGuard;
import com.supplierplatform.revamp.api.dto.CreateInviteRequest;
import com.supplierplatform.revamp.api.dto.RenewInviteRequest;
import com.supplierplatform.revamp.dto.RevampInviteMonitorDto;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.model.RevampInvite;
import com.supplierplatform.revamp.service.RevampGovernanceAuthorizationService;
import com.supplierplatform.revamp.service.RevampInviteService;
import com.supplierplatform.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping({"/api/v2/invites", "/api/invites"})
@RequiredArgsConstructor
public class RevampInviteController {

    private final RevampInviteService inviteService;
    private final RevampAccessGuard revampAccessGuard;
    private final RevampGovernanceAuthorizationService governanceAuthorizationService;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createInvite(@Valid @RequestBody CreateInviteRequest request) {
        revampAccessGuard.requireWriteEnabled();
        User currentUser = getCurrentUser();
        governanceAuthorizationService.requireAnyRole(
                currentUser == null ? null : currentUser.getId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO
        );
        int expiresInDays = request.getExpiresInDays() != null ? Math.max(1, request.getExpiresInDays()) : 30;

        RevampInvite invite = inviteService.createInvite(
                request.getRegistryType(),
                request.getInvitedEmail(),
                request.getInvitedName(),
                currentUser != null ? currentUser.getId() : null,
                LocalDateTime.now().plusDays(expiresInDays),
                request.getNote()
        );

        Map<String, Object> payload = Map.of(
                "id", invite.getId(),
                "token", invite.getToken(),
                "status", invite.getStatus().name(),
                "registryType", invite.getRegistryType().name(),
                "invitedEmail", invite.getInvitedEmail(),
                "expiresAt", invite.getExpiresAt()
        );
        return ResponseEntity.ok(ApiResponse.ok("Invite created", payload));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<RevampInviteMonitorDto>> monitorInvites() {
        revampAccessGuard.requireReadEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO,
                AdminRole.REVISORE,
                AdminRole.VIEWER
        );
        return ResponseEntity.ok(ApiResponse.ok(inviteService.monitorInvites()));
    }

    @PostMapping("/{inviteId}/renew")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> renewInvite(
            @PathVariable UUID inviteId,
            @Valid @RequestBody(required = false) RenewInviteRequest request
    ) {
        revampAccessGuard.requireWriteEnabled();
        User currentUser = getCurrentUser();
        governanceAuthorizationService.requireAnyRole(
                currentUser == null ? null : currentUser.getId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO
        );
        int expiresInDays = request != null && request.getExpiresInDays() != null
                ? Math.max(1, request.getExpiresInDays())
                : 30;
        RevampInvite invite = inviteService.renewInvite(
                inviteId,
                currentUser != null ? currentUser.getId() : null,
                expiresInDays
        );
        Map<String, Object> payload = Map.of(
                "id", invite.getId(),
                "token", invite.getToken(),
                "status", invite.getStatus().name(),
                "registryType", invite.getRegistryType().name(),
                "invitedEmail", invite.getInvitedEmail(),
                "expiresAt", invite.getExpiresAt()
        );
        return ResponseEntity.ok(ApiResponse.ok("Invite renewed", payload));
    }

    @GetMapping("/token/{token}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getByToken(@PathVariable String token) {
        revampAccessGuard.requireReadEnabled();
        RevampInvite invite = inviteService.markOpened(token);
        if (invite == null) {
            invite = inviteService.getByToken(token);
        }
        Map<String, Object> payload = Map.of(
                "id", invite.getId(),
                "status", invite.getStatus().name(),
                "registryType", invite.getRegistryType().name(),
                "invitedEmail", invite.getInvitedEmail(),
                "expiresAt", invite.getExpiresAt()
        );
        return ResponseEntity.ok(ApiResponse.ok(payload));
    }

    private User getCurrentUser() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof User user) {
            return user;
        }
        return null;
    }

    private UUID getCurrentUserId() {
        User user = getCurrentUser();
        return user != null ? user.getId() : null;
    }
}


