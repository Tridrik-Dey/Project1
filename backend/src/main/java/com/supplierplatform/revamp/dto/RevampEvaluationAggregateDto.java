package com.supplierplatform.revamp.dto;

import java.util.UUID;

public record RevampEvaluationAggregateDto(
        UUID supplierRegistryProfileId,
        long totalEvaluations,
        long activeEvaluations,
        double averageOverallScore
) {
}
