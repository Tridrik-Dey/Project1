package com.supplierplatform.revamp.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record RevampReviewCaseSummaryDto(
        UUID id,
        UUID applicationId,
        String status,
        String decision,
        UUID assignedToUserId,
        String assignedToDisplayName,
        LocalDateTime assignedAt,
        LocalDateTime slaDueAt,
        LocalDateTime updatedAt
) {
}
