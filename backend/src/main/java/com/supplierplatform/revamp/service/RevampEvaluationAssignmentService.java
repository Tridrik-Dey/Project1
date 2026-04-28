package com.supplierplatform.revamp.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.revamp.api.dto.SaveEvaluationDraftRequest;
import com.supplierplatform.revamp.dto.RevampAuditEventInputDto;
import com.supplierplatform.revamp.dto.RevampEligibleEvaluatorDto;
import com.supplierplatform.revamp.dto.RevampEvaluationAssignmentDto;
import com.supplierplatform.revamp.dto.RevampEvaluationAssignmentRowDto;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.enums.EvaluationAssignmentStatus;
import com.supplierplatform.revamp.enums.RegistryProfileStatus;
import com.supplierplatform.revamp.model.RevampEvaluation;
import com.supplierplatform.revamp.model.RevampSupplierEvaluatorAssignment;
import com.supplierplatform.revamp.model.RevampSupplierRegistryProfile;
import com.supplierplatform.revamp.model.RevampUserAdminRole;
import com.supplierplatform.revamp.repository.RevampSupplierEvaluatorAssignmentRepository;
import com.supplierplatform.revamp.repository.RevampSupplierRegistryProfileRepository;
import com.supplierplatform.revamp.repository.RevampUserAdminRoleRepository;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRepository;
import com.supplierplatform.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RevampEvaluationAssignmentService {

    private final RevampSupplierEvaluatorAssignmentRepository assignmentRepository;
    private final RevampSupplierRegistryProfileRepository supplierRegistryProfileRepository;
    private final RevampUserAdminRoleRepository userAdminRoleRepository;
    private final UserRepository userRepository;
    private final RevampGovernanceAuthorizationService governanceAuthorizationService;
    private final RevampAuditService auditService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public RevampEvaluationAssignmentDto currentAssignment(UUID supplierRegistryProfileId) {
        supplierRegistryProfileRepository.findById(supplierRegistryProfileId)
                .orElseThrow(() -> new EntityNotFoundException("RevampSupplierRegistryProfile", supplierRegistryProfileId));
        return assignmentRepository.findBySupplierRegistryProfileIdAndActiveTrue(supplierRegistryProfileId)
                .map(this::toDto)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public List<RevampEligibleEvaluatorDto> eligibleEvaluators(UUID actorUserId) {
        AdminRole actorRole = governanceAuthorizationService.requireAnyRole(
                actorUserId,
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO
        );
        Set<AdminRole> allowed = assignableRoles(actorRole);
        return userAdminRoleRepository.findAll().stream()
                .filter(role -> allowed.contains(role.getAdminRole()))
                .filter(role -> role.getUser() != null)
                .filter(role -> role.getUser().getRole() == UserRole.ADMIN)
                .filter(role -> Boolean.TRUE.equals(role.getUser().getIsActive()))
                .filter(role -> role.getUser().getDeletedAt() == null)
                .map(role -> new RevampEligibleEvaluatorDto(
                        role.getUser().getId(),
                        role.getUser().getFullName(),
                        role.getUser().getEmail(),
                        role.getAdminRole()
                ))
                .sorted(Comparator.comparing(RevampEligibleEvaluatorDto::fullName, Comparator.nullsLast(String::compareToIgnoreCase)))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RevampEvaluationAssignmentRowDto> listAssignments(String scope, UUID actorUserId) {
        AdminRole actorRole = governanceAuthorizationService.requireAnyRole(
                actorUserId,
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO,
                AdminRole.REVISORE,
                AdminRole.VIEWER
        );
        String normalizedScope = scope == null || scope.isBlank() ? "ALL" : scope.trim().toUpperCase();
        Map<UUID, RevampSupplierEvaluatorAssignment> latestBySupplier = assignmentRepository.findAll().stream()
                .filter(assignment -> assignment.getSupplierRegistryProfile() != null && assignment.getSupplierRegistryProfile().getId() != null)
                .collect(Collectors.toMap(
                        assignment -> assignment.getSupplierRegistryProfile().getId(),
                        Function.identity(),
                        (a, b) -> a.getAssignedAt() != null && b.getAssignedAt() != null && a.getAssignedAt().isAfter(b.getAssignedAt()) ? a : b
                ));
        Map<UUID, RevampSupplierEvaluatorAssignment> activeBySupplier = latestBySupplier.values().stream()
                .filter(assignment -> Boolean.TRUE.equals(assignment.getActive()))
                .collect(Collectors.toMap(
                        assignment -> assignment.getSupplierRegistryProfile().getId(),
                        Function.identity()
                ));

        return supplierRegistryProfileRepository.findByStatus(RegistryProfileStatus.APPROVED).stream()
                .map(profile -> {
                    RevampSupplierEvaluatorAssignment activeAssignment = activeBySupplier.get(profile.getId());
                    RevampSupplierEvaluatorAssignment latestAssignment = latestBySupplier.get(profile.getId());
                    return toRow(profile, activeAssignment != null ? activeAssignment : latestAssignment);
                })
                .filter(row -> filterByScope(row, normalizedScope, actorUserId, actorRole))
                .sorted(Comparator
                        .comparing((RevampEvaluationAssignmentRowDto row) -> row.status() == EvaluationAssignmentStatus.DA_ASSEGNARE ? 0 : 1)
                        .thenComparing(RevampEvaluationAssignmentRowDto::dueAt, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(RevampEvaluationAssignmentRowDto::supplierName, Comparator.nullsLast(String::compareToIgnoreCase)))
                .toList();
    }

    @Transactional
    public RevampEvaluationAssignmentDto assign(UUID supplierRegistryProfileId, UUID evaluatorUserId, UUID actorUserId, String reason, LocalDateTime dueAt) {
        AdminRole actorRole = governanceAuthorizationService.requireAnyRole(
                actorUserId,
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO
        );
        AdminRole evaluatorRole = resolveSingleAdminRole(evaluatorUserId);
        if (!assignableRoles(actorRole).contains(evaluatorRole)) {
            throw new AccessDeniedException("Evaluator role cannot be assigned by current actor");
        }

        RevampSupplierRegistryProfile profile = supplierRegistryProfileRepository.findById(supplierRegistryProfileId)
                .orElseThrow(() -> new EntityNotFoundException("RevampSupplierRegistryProfile", supplierRegistryProfileId));
        boolean hasCompletedCycle = assignmentRepository.findBySupplierRegistryProfileIdOrderByAssignedAtDesc(supplierRegistryProfileId).stream()
                .anyMatch(existing -> existing.getStatus() == EvaluationAssignmentStatus.COMPLETATA || existing.getCompletedEvaluation() != null);
        if (hasCompletedCycle && actorRole != AdminRole.SUPER_ADMIN) {
            throw new AccessDeniedException("Only Super Admin can create a new evaluation cycle after a value is registered");
        }
        User evaluator = activeAdminUser(evaluatorUserId);
        User actor = activeAdminUser(actorUserId);

        RevampEvaluationAssignmentDto before = assignmentRepository.findBySupplierRegistryProfileIdAndActiveTrue(supplierRegistryProfileId)
                .map(this::toDto)
                .orElse(null);
        assignmentRepository.findBySupplierRegistryProfileIdOrderByAssignedAtDesc(supplierRegistryProfileId).stream()
                .filter(existing -> Boolean.TRUE.equals(existing.getActive()))
                .forEach(existing -> {
                    existing.setActive(false);
                    existing.setStatus(EvaluationAssignmentStatus.RIASSEGNATA);
                    existing.setReassignmentReason(reason == null || reason.isBlank() ? "Nuova assegnazione" : reason.trim());
                });

        RevampSupplierEvaluatorAssignment assignment = new RevampSupplierEvaluatorAssignment();
        assignment.setSupplierRegistryProfile(profile);
        assignment.setAssignedEvaluatorUser(evaluator);
        assignment.setAssignedByUser(actor);
        assignment.setReason(reason == null || reason.isBlank() ? null : reason.trim());
        assignment.setDueAt(dueAt);
        if (before != null && before.assignedEvaluatorUserId() != null) {
            assignment.setReassignedFromUser(userRepository.findById(before.assignedEvaluatorUserId()).orElse(null));
            assignment.setReassignmentReason(reason == null || reason.isBlank() ? null : reason.trim());
        }
        assignment.setStatus(EvaluationAssignmentStatus.ASSEGNATA);
        assignment.setActive(true);
        RevampEvaluationAssignmentDto after = toDto(assignmentRepository.save(assignment));

        auditService.append(new RevampAuditEventInputDto(
                before == null ? "revamp.evaluation.assigned" : "revamp.evaluation.reassigned",
                "REVAMP_SUPPLIER_REGISTRY_PROFILE",
                supplierRegistryProfileId,
                actorUserId,
                actorRole.name(),
                null,
                assignment.getReason(),
                assignmentJson(before),
                assignmentJson(after),
                "{}"
        ));
        return after;
    }

    @Transactional
    public RevampEvaluationAssignmentDto reassign(UUID assignmentId, UUID evaluatorUserId, UUID actorUserId, String reason, LocalDateTime dueAt) {
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("Reassignment reason is required");
        }
        RevampSupplierEvaluatorAssignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new EntityNotFoundException("RevampSupplierEvaluatorAssignment", assignmentId));
        if (assignment.getSupplierRegistryProfile() == null || assignment.getSupplierRegistryProfile().getId() == null) {
            throw new EntityNotFoundException("RevampSupplierRegistryProfile", assignmentId);
        }
        if (assignment.getStatus() == EvaluationAssignmentStatus.COMPLETATA || assignment.getCompletedEvaluation() != null) {
            throw new AccessDeniedException("Completed evaluations cannot be reassigned. Super Admin can create a new cycle");
        }
        return assign(assignment.getSupplierRegistryProfile().getId(), evaluatorUserId, actorUserId, reason, dueAt);
    }

    @Transactional(readOnly = true)
    public RevampSupplierEvaluatorAssignment requireAssignedEvaluator(UUID supplierRegistryProfileId, UUID evaluatorUserId) {
        RevampSupplierEvaluatorAssignment assignment = assignmentRepository.findBySupplierRegistryProfileIdAndActiveTrue(supplierRegistryProfileId)
                .orElseThrow(() -> new AccessDeniedException("No active evaluation assignment for this supplier"));
        if (assignment.getAssignedEvaluatorUser() == null || !assignment.getAssignedEvaluatorUser().getId().equals(evaluatorUserId)) {
            throw new AccessDeniedException("Only the assigned evaluator can submit evaluations for this supplier");
        }
        if (assignment.getStatus() == EvaluationAssignmentStatus.COMPLETATA || assignment.getCompletedEvaluation() != null) {
            throw new AccessDeniedException("Evaluation already completed. Only Super Admin can create a new cycle");
        }
        return assignment;
    }

    @Transactional
    public RevampEvaluationAssignmentDto saveDraft(UUID assignmentId, SaveEvaluationDraftRequest request, UUID actorUserId) {
        RevampSupplierEvaluatorAssignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new EntityNotFoundException("RevampSupplierEvaluatorAssignment", assignmentId));
        requireCanEditDraft(assignment, actorUserId);
        validateDimensions(request.getDimensions());

        assignment.setDraftOverallScore(request.getOverallScore());
        assignment.setDraftDimensionScoresJson(toJsonNode(request.getDimensions()));
        assignment.setDraftCollaborationType(blankToNull(request.getCollaborationType()));
        assignment.setDraftCollaborationPeriod(blankToNull(request.getCollaborationPeriod()));
        assignment.setDraftReferenceCode(blankToNull(request.getReferenceCode()));
        assignment.setDraftComment(blankToNull(request.getComment()));
        assignment.setStatus(EvaluationAssignmentStatus.IN_COMPILAZIONE);
        RevampEvaluationAssignmentDto dto = toDto(assignmentRepository.save(assignment));

        auditService.append(new RevampAuditEventInputDto(
                "revamp.evaluation.draft_saved",
                "REVAMP_SUPPLIER_REGISTRY_PROFILE",
                dto.supplierRegistryProfileId(),
                actorUserId,
                resolveSingleAdminRole(actorUserId).name(),
                null,
                null,
                null,
                assignmentJson(dto),
                "{}"
        ));
        return dto;
    }

    @Transactional
    public RevampEvaluationAssignmentDto markCompleted(UUID supplierRegistryProfileId, UUID evaluatorUserId, RevampEvaluation evaluation) {
        RevampSupplierEvaluatorAssignment assignment = requireAssignedEvaluator(supplierRegistryProfileId, evaluatorUserId);
        assignment.setCompletedEvaluation(evaluation);
        assignment.setStatus(EvaluationAssignmentStatus.COMPLETATA);
        assignment.setActive(false);
        return toDto(assignmentRepository.save(assignment));
    }

    @Transactional(readOnly = true)
    public RevampSupplierEvaluatorAssignment getAssignmentForSubmit(UUID assignmentId, UUID actorUserId) {
        RevampSupplierEvaluatorAssignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new EntityNotFoundException("RevampSupplierEvaluatorAssignment", assignmentId));
        requireCanEditDraft(assignment, actorUserId);
        return assignment;
    }

    private void requireCanEditDraft(RevampSupplierEvaluatorAssignment assignment, UUID actorUserId) {
        if (!Boolean.TRUE.equals(assignment.getActive())) {
            throw new AccessDeniedException("Evaluation assignment is not active");
        }
        if (assignment.getStatus() == EvaluationAssignmentStatus.COMPLETATA || assignment.getCompletedEvaluation() != null) {
            throw new AccessDeniedException("Evaluation already completed. Only Super Admin can edit completed values");
        }
        if (assignment.getDueAt() != null && assignment.getDueAt().isBefore(LocalDateTime.now())) {
            throw new AccessDeniedException("Evaluation assignment is expired. Extend or reassign it before editing values");
        }
        UUID assignedId = assignment.getAssignedEvaluatorUser() != null ? assignment.getAssignedEvaluatorUser().getId() : null;
        if (assignedId != null && assignedId.equals(actorUserId)) return;
        AdminRole actorRole = governanceAuthorizationService.requireAnyRole(
                actorUserId,
                AdminRole.SUPER_ADMIN,
                AdminRole.REVISORE
        );
        if (actorRole == AdminRole.SUPER_ADMIN) return;
        throw new AccessDeniedException("Only the assigned evaluator can edit this evaluation draft");
    }

    private Set<AdminRole> assignableRoles(AdminRole actorRole) {
        if (actorRole == AdminRole.SUPER_ADMIN) {
            return EnumSet.of(AdminRole.SUPER_ADMIN, AdminRole.RESPONSABILE_ALBO, AdminRole.REVISORE);
        }
        if (actorRole == AdminRole.RESPONSABILE_ALBO) {
            return EnumSet.of(AdminRole.RESPONSABILE_ALBO, AdminRole.REVISORE);
        }
        return EnumSet.noneOf(AdminRole.class);
    }

    private User activeAdminUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User", userId));
        if (user.getRole() != UserRole.ADMIN || !Boolean.TRUE.equals(user.getIsActive()) || user.getDeletedAt() != null) {
            throw new AccessDeniedException("User is not an active admin");
        }
        return user;
    }

    private AdminRole resolveSingleAdminRole(UUID userId) {
        activeAdminUser(userId);
        List<RevampUserAdminRole> roles = userAdminRoleRepository.findByUserId(userId);
        if (roles.size() != 1) {
            throw new AccessDeniedException("Invalid evaluator governance role configuration");
        }
        AdminRole role = roles.get(0).getAdminRole();
        if (role == AdminRole.VIEWER) {
            throw new AccessDeniedException("VIEWER cannot be assigned as evaluator");
        }
        return role;
    }

    private RevampEvaluationAssignmentDto toDto(RevampSupplierEvaluatorAssignment assignment) {
        User evaluator = assignment.getAssignedEvaluatorUser();
        User actor = assignment.getAssignedByUser();
        AdminRole evaluatorRole = evaluator != null ? resolveSingleAdminRole(evaluator.getId()) : null;
        return new RevampEvaluationAssignmentDto(
                assignment.getId(),
                assignment.getSupplierRegistryProfile() != null ? assignment.getSupplierRegistryProfile().getId() : null,
                evaluator != null ? evaluator.getId() : null,
                evaluator != null ? evaluator.getFullName() : null,
                evaluator != null ? evaluator.getEmail() : null,
                evaluatorRole,
                actor != null ? actor.getId() : null,
                actor != null ? actor.getFullName() : null,
                assignment.getAssignedAt(),
                assignment.getDueAt(),
                effectiveStatus(assignment),
                assignment.getCompletedEvaluation() != null ? assignment.getCompletedEvaluation().getId() : null,
                Boolean.TRUE.equals(assignment.getActive())
        );
    }

    private RevampEvaluationAssignmentRowDto toRow(RevampSupplierRegistryProfile profile, RevampSupplierEvaluatorAssignment assignment) {
        if (assignment == null) {
            return new RevampEvaluationAssignmentRowDto(
                    null,
                    profile.getId(),
                    profile.getDisplayName() != null ? profile.getDisplayName() : (profile.getSupplierUser() != null ? profile.getSupplierUser().getFullName() : null),
                    profile.getRegistryType() != null ? profile.getRegistryType().name() : null,
                    EvaluationAssignmentStatus.DA_ASSEGNARE,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    Map.of(),
                    null,
                    null,
                    null,
                    null,
                    false
            );
        }
        RevampEvaluationAssignmentDto dto = toDto(assignment);
        return new RevampEvaluationAssignmentRowDto(
                assignment.getId(),
                profile.getId(),
                profile.getDisplayName() != null ? profile.getDisplayName() : (profile.getSupplierUser() != null ? profile.getSupplierUser().getFullName() : null),
                profile.getRegistryType() != null ? profile.getRegistryType().name() : null,
                dto.status(),
                dto.assignedEvaluatorUserId(),
                dto.assignedEvaluatorName(),
                dto.assignedEvaluatorEmail(),
                dto.assignedEvaluatorRole(),
                dto.assignedByUserId(),
                dto.assignedByName(),
                dto.assignedAt(),
                dto.dueAt(),
                assignment.getReason(),
                assignment.getReassignmentReason(),
                dto.completedEvaluationId(),
                assignment.getDraftOverallScore(),
                fromJsonNode(assignment.getDraftDimensionScoresJson()),
                assignment.getDraftCollaborationType(),
                assignment.getDraftCollaborationPeriod(),
                assignment.getDraftReferenceCode(),
                assignment.getDraftComment(),
                dto.active()
        );
    }

    private String assignmentJson(RevampEvaluationAssignmentDto dto) {
        if (dto == null) return null;
        return """
                {"assignmentId":"%s","assignedEvaluatorUserId":"%s","assignedEvaluatorName":"%s","assignedEvaluatorRole":"%s","status":"%s","dueAt":"%s"}
                """.formatted(
                dto.assignmentId(),
                dto.assignedEvaluatorUserId(),
                escape(dto.assignedEvaluatorName()),
                dto.assignedEvaluatorRole(),
                dto.status(),
                dto.dueAt()
        ).trim();
    }

    private boolean filterByScope(RevampEvaluationAssignmentRowDto row, String scope, UUID actorUserId, AdminRole actorRole) {
        if (actorRole == AdminRole.REVISORE && !"MINE".equals(scope)) {
            return actorUserId != null && actorUserId.equals(row.assignedEvaluatorUserId());
        }
        return switch (scope) {
            case "MINE" -> actorUserId != null && actorUserId.equals(row.assignedEvaluatorUserId());
            case "UNASSIGNED" -> row.status() == EvaluationAssignmentStatus.DA_ASSEGNARE;
            case "DUE_SOON" -> row.dueAt() != null
                    && row.status() != EvaluationAssignmentStatus.COMPLETATA
                    && !row.dueAt().isBefore(LocalDateTime.now())
                    && row.dueAt().isBefore(LocalDateTime.now().plusDays(3));
            case "OVERDUE" -> row.status() == EvaluationAssignmentStatus.SCADUTA;
            case "COMPLETED" -> row.status() == EvaluationAssignmentStatus.COMPLETATA;
            default -> true;
        };
    }

    private EvaluationAssignmentStatus effectiveStatus(RevampSupplierEvaluatorAssignment assignment) {
        if (assignment.getStatus() == EvaluationAssignmentStatus.COMPLETATA || assignment.getCompletedEvaluation() != null) {
            return EvaluationAssignmentStatus.COMPLETATA;
        }
        if (assignment.getDueAt() != null && assignment.getDueAt().isBefore(LocalDateTime.now())) {
            return EvaluationAssignmentStatus.SCADUTA;
        }
        return assignment.getStatus() != null ? assignment.getStatus() : EvaluationAssignmentStatus.ASSEGNATA;
    }

    private void validateDimensions(Map<String, Short> dimensions) {
        if (dimensions == null) return;
        for (Short value : dimensions.values()) {
            if (value != null && (value < 1 || value > 5)) {
                throw new IllegalArgumentException("Dimension scores must be between 1 and 5");
            }
        }
    }

    private JsonNode toJsonNode(Map<String, Short> dimensions) {
        if (dimensions == null || dimensions.isEmpty()) return null;
        return objectMapper.valueToTree(dimensions);
    }

    private Map<String, Short> fromJsonNode(JsonNode node) {
        if (node == null || node.isNull()) return Map.of();
        try {
            Map<?, ?> raw = objectMapper.treeToValue(node, Map.class);
            Map<String, Short> result = new LinkedHashMap<>();
            raw.forEach((key, value) -> {
                if (key == null || value == null) return;
                if (value instanceof Number number) {
                    result.put(String.valueOf(key), number.shortValue());
                }
            });
            return result;
        } catch (JsonProcessingException ex) {
            return Map.of();
        }
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String escape(String value) {
        return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
