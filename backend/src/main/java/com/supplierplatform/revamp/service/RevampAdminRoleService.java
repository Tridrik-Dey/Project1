package com.supplierplatform.revamp.service;

import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.revamp.dto.RevampAuditEventInputDto;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.model.RevampUserAdminRole;
import com.supplierplatform.revamp.repository.RevampUserAdminRoleRepository;
import com.supplierplatform.revamp.dto.RevampAdminUserRoleDto;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRepository;
import com.supplierplatform.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RevampAdminRoleService {

    private final RevampUserAdminRoleRepository userAdminRoleRepository;
    private final UserRepository userRepository;
    private final RevampAuditService auditService;

    @Transactional(readOnly = true)
    public void requireSuperAdmin(UUID actorUserId) {
        if (actorUserId == null) {
            throw new AccessDeniedException("Only SUPER_ADMIN can perform this action");
        }
        User actor = userRepository.findById(actorUserId)
                .orElseThrow(() -> new EntityNotFoundException("User", actorUserId));
        if (actor.getRole() != UserRole.ADMIN) {
            throw new AccessDeniedException("Only SUPER_ADMIN can perform this action");
        }
        if (!userAdminRoleRepository.existsByUserIdAndAdminRole(actorUserId, AdminRole.SUPER_ADMIN)) {
            throw new AccessDeniedException("Only SUPER_ADMIN can perform this action");
        }
    }

    @Transactional
    public RevampUserAdminRole assign(UUID targetUserId, AdminRole role, UUID actorUserId) {
        List<RevampUserAdminRole> existingAssignments = userAdminRoleRepository.findByUserId(targetUserId);
        if (existingAssignments.size() == 1 && existingAssignments.get(0).getAdminRole() == role) {
            throw new IllegalStateException("Admin role already assigned");
        }

        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new EntityNotFoundException("User", targetUserId));
        if (target.getRole() != UserRole.ADMIN) {
            throw new IllegalArgumentException("Governance roles can be assigned only to ADMIN users");
        }
        User actor = actorUserId == null ? null : userRepository.findById(actorUserId)
                .orElseThrow(() -> new EntityNotFoundException("User", actorUserId));

        String previousRoleJson = existingAssignments.isEmpty()
                ? "{\"role\":null}"
                : "{\"role\":\"" + existingAssignments.get(0).getAdminRole().name() + "\"}";
        if (!existingAssignments.isEmpty()) {
            userAdminRoleRepository.deleteByUserId(targetUserId);
        }

        RevampUserAdminRole assignment = new RevampUserAdminRole();
        assignment.setUser(target);
        assignment.setAdminRole(role);
        assignment.setCreatedByUser(actor);
        RevampUserAdminRole saved = userAdminRoleRepository.save(assignment);

        auditService.append(new RevampAuditEventInputDto(
                "revamp.admin-role.assigned",
                "REVAMP_USER_ADMIN_ROLE",
                targetUserId,
                actorUserId,
                actor != null && actor.getRole() != null ? actor.getRole().name() : null,
                null,
                "assign admin role",
                previousRoleJson,
                "{\"role\":\"" + role.name() + "\"}",
                "{\"assignmentId\":\"" + saved.getId() + "\"}"
        ));
        return saved;
    }

    @Transactional(readOnly = true)
    public List<RevampUserAdminRole> listByUser(UUID userId) {
        return userAdminRoleRepository.findByUserId(userId);
    }

    @Transactional
    public void revoke(UUID targetUserId, AdminRole role, UUID actorUserId) {
        User actor = actorUserId == null ? null : userRepository.findById(actorUserId)
                .orElseThrow(() -> new EntityNotFoundException("User", actorUserId));
        long affected = userAdminRoleRepository.deleteByUserIdAndAdminRole(targetUserId, role);
        if (affected == 0) {
            throw new EntityNotFoundException("User admin role", targetUserId);
        }
        auditService.append(new RevampAuditEventInputDto(
                "revamp.admin-role.revoked",
                "REVAMP_USER_ADMIN_ROLE",
                targetUserId,
                actorUserId,
                actor != null && actor.getRole() != null ? actor.getRole().name() : null,
                null,
                "revoke admin role",
                "{\"role\":\"" + role.name() + "\"}",
                "{\"role\":null}",
                "{}"
        ));
    }

    @Transactional(readOnly = true)
    public List<RevampAdminUserRoleDto> listAdminUsersWithRoles(String query) {
        List<User> users = userRepository.findByRoleIn(EnumSet.of(UserRole.ADMIN));
        Map<UUID, List<AdminRole>> roleMap = new HashMap<>();
        for (RevampUserAdminRole assignment : userAdminRoleRepository.findAll()) {
            UUID userId = assignment.getUser().getId();
            roleMap.computeIfAbsent(userId, ignored -> new ArrayList<>()).add(assignment.getAdminRole());
        }

        String normalizedQuery = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        return users.stream()
                .filter(user -> normalizedQuery.isBlank() || matchesQuery(user, normalizedQuery))
                .sorted(Comparator.comparing(User::getFullName, String.CASE_INSENSITIVE_ORDER))
                .map(user -> toDto(user, roleMap.getOrDefault(user.getId(), List.of())))
                .toList();
    }

    @Transactional(readOnly = true)
    public RevampAdminUserRoleDto getAdminUserWithRoles(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User", userId));
        List<AdminRole> roles = userAdminRoleRepository.findByUserId(userId).stream()
                .map(RevampUserAdminRole::getAdminRole)
                .sorted()
                .toList();
        return toDto(user, roles);
    }

    private boolean matchesQuery(User user, String query) {
        String fullName = user.getFullName() == null ? "" : user.getFullName().toLowerCase(Locale.ROOT);
        String email = user.getEmail() == null ? "" : user.getEmail().toLowerCase(Locale.ROOT);
        return fullName.contains(query) || email.contains(query);
    }

    private RevampAdminUserRoleDto toDto(User user, List<AdminRole> roles) {
        List<AdminRole> sortedRoles = roles.stream().sorted().toList();
        return new RevampAdminUserRoleDto(
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                user.getRole(),
                Boolean.TRUE.equals(user.getIsActive()),
                sortedRoles
        );
    }
}
