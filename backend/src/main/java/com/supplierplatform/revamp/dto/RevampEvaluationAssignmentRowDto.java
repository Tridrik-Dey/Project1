package com.supplierplatform.revamp.dto;

import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.enums.EvaluationAssignmentStatus;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

public record RevampEvaluationAssignmentRowDto(
        UUID assignmentId,
        UUID supplierRegistryProfileId,
        String supplierName,
        String supplierType,
        EvaluationAssignmentStatus status,
        UUID assignedEvaluatorUserId,
        String assignedEvaluatorName,
        String assignedEvaluatorEmail,
        AdminRole assignedEvaluatorRole,
        UUID assignedByUserId,
        String assignedByName,
        LocalDateTime assignedAt,
        LocalDateTime dueAt,
        String reason,
        String reassignmentReason,
        UUID completedEvaluationId,
        Short draftOverallScore,
        Map<String, Short> draftDimensions,
        String draftCollaborationType,
        String draftCollaborationPeriod,
        String draftReferenceCode,
        String draftComment,
        boolean active
) {
}
