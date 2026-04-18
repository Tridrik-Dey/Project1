package com.supplierplatform.revamp.dto;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

public record RevampEvaluationOverviewRowDto(
        UUID evaluationId,
        UUID supplierRegistryProfileId,
        String supplierName,
        String supplierType,
        LocalDateTime createdAt,
        String collaborationType,
        String collaborationPeriod,
        String referenceCode,
        String comment,
        String evaluatorDisplay,
        double averageScore,
        Map<String, Double> dimensionScores
) {
}

