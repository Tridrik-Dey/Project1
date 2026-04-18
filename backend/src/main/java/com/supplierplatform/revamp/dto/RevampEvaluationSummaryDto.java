package com.supplierplatform.revamp.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record RevampEvaluationSummaryDto(
        UUID id,
        UUID supplierRegistryProfileId,
        UUID evaluatorUserId,
        short overallScore,
        boolean annulled,
        LocalDateTime createdAt
) {
}

