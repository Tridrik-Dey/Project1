package com.supplierplatform.revamp.dto;

import java.util.Map;
import java.util.UUID;

public record RevampEvaluationAggregateDto(
        UUID supplierRegistryProfileId,
        long totalEvaluations,
        long activeEvaluations,
        double averageOverallScore,
        Map<Integer, Long> scoreDistribution
) {
    public RevampEvaluationAggregateDto(
            UUID supplierRegistryProfileId,
            long totalEvaluations,
            long activeEvaluations,
            double averageOverallScore
    ) {
        this(supplierRegistryProfileId, totalEvaluations, activeEvaluations, averageOverallScore, emptyDistribution());
    }

    public static Map<Integer, Long> emptyDistribution() {
        return Map.of(1, 0L, 2, 0L, 3, 0L, 4, 0L, 5, 0L);
    }
}
