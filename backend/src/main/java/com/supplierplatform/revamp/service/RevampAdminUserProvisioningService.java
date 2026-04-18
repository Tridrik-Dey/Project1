package com.supplierplatform.revamp.service;

import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.revamp.dto.AdminUserInviteDto;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRepository;
import com.supplierplatform.user.UserService;
import com.supplierplatform.validation.EmailValidators;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RevampAdminUserProvisioningService {

    private final UserRepository userRepository;
    private final UserService userService;
    private final RevampAdminRoleService adminRoleService;
    private final RevampAdminInviteMailService inviteMailService;

    @Transactional
    public AdminUserInviteDto inviteAdminUser(
            String email,
            String fullName,
            com.supplierplatform.revamp.enums.AdminRole adminRole,
            int expiresInDays,
            UUID actorUserId
    ) {
        adminRoleService.requireSuperAdmin(actorUserId);
        String normalizedEmail = EmailValidators.normalize(email).toLowerCase();
        if (!EmailValidators.hasValidDomainSuffix(normalizedEmail)) {
            throw new IllegalArgumentException("Email must include a valid domain suffix (e.g. .com, .it)");
        }
        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new IllegalStateException("Email is already in use: " + normalizedEmail);
        }

        LocalDateTime expiresAt = LocalDateTime.now().plusDays(Math.max(1, Math.min(expiresInDays, 30)));
        User invited = userService.createInvitedUser(normalizedEmail, fullName.trim(), actorUserId, expiresAt);
        adminRoleService.assign(invited.getId(), adminRole, actorUserId);

        String inviteToken = userRepository.findById(invited.getId())
                .map(User::getInviteToken)
                .orElseThrow(() -> new EntityNotFoundException("User", invited.getId()));
        AdminUserInviteDto draft = new AdminUserInviteDto(
                invited.getId(),
                invited.getEmail(),
                invited.getFullName(),
                adminRole,
                invited.getInviteExpiresAt()
        );
        RevampAdminInviteMailService.InviteDispatchResult dispatch = inviteMailService.sendInvite(draft, inviteToken);
        return new AdminUserInviteDto(
                invited.getId(),
                invited.getEmail(),
                invited.getFullName(),
                adminRole,
                invited.getInviteExpiresAt(),
                dispatch.sent(),
                dispatch.activationUrl()
        );
    }
}
