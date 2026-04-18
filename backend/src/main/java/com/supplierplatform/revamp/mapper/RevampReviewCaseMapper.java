package com.supplierplatform.revamp.mapper;

import com.supplierplatform.revamp.dto.RevampReviewCaseSummaryDto;
import com.supplierplatform.revamp.model.RevampReviewCase;
import org.springframework.stereotype.Component;

@Component
public class RevampReviewCaseMapper {

    public RevampReviewCaseSummaryDto toSummary(RevampReviewCase reviewCase) {
        return new RevampReviewCaseSummaryDto(
                reviewCase.getId(),
                reviewCase.getApplication() != null ? reviewCase.getApplication().getId() : null,
                reviewCase.getStatus() != null ? reviewCase.getStatus().name() : null,
                reviewCase.getDecision() != null ? reviewCase.getDecision().name() : null,
                reviewCase.getAssignedToUser() != null ? reviewCase.getAssignedToUser().getId() : null,
                reviewCase.getAssignedToUser() != null ? reviewCase.getAssignedToUser().getFullName() : null,
                reviewCase.getAssignedAt(),
                reviewCase.getSlaDueAt(),
                reviewCase.getUpdatedAt()
        );
    }
}
