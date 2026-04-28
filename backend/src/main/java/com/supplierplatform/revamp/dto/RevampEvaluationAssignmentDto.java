package com.supplierplatform.revamp.dto;

import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.enums.EvaluationAssignmentStatus;

import java.time.LocalDateTime;
import java.util.UUID;

public record RevampEvaluationAssignmentDto(
        UUID assignmentId,
        UUID supplierRegistryProfileId,
        UUID assignedEvaluatorUserId,
        String assignedEvaluatorName,
        String assignedEvaluatorEmail,
        AdminRole assignedEvaluatorRole,
        UUID assignedByUserId,
        String assignedByName,
        LocalDateTime assignedAt,
        LocalDateTime dueAt,
        EvaluationAssignmentStatus status,
        UUID completedEvaluationId,
        boolean active
) {
}
