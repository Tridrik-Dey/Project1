package com.supplierplatform.revamp.mapper;

import com.supplierplatform.revamp.dto.RevampReviewCaseSummaryDto;
import com.supplierplatform.revamp.model.RevampIntegrationRequest;
import com.supplierplatform.revamp.model.RevampReviewCase;
import com.supplierplatform.revamp.repository.RevampIntegrationRequestRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class RevampReviewCaseMapper {

    private RevampIntegrationRequestRepository integrationRequestRepository;

    public RevampReviewCaseMapper() {
    }

    @Autowired
    public RevampReviewCaseMapper(RevampIntegrationRequestRepository integrationRequestRepository) {
        this.integrationRequestRepository = integrationRequestRepository;
    }

    public RevampReviewCaseSummaryDto toSummary(RevampReviewCase reviewCase) {
        RevampIntegrationRequest latestIntegrationRequest = reviewCase.getId() == null || integrationRequestRepository == null
                ? null
                : integrationRequestRepository.findFirstByReviewCaseIdOrderByCreatedAtDesc(reviewCase.getId());
        return new RevampReviewCaseSummaryDto(
                reviewCase.getId(),
                reviewCase.getApplication() != null ? reviewCase.getApplication().getId() : null,
                reviewCase.getStatus() != null ? reviewCase.getStatus().name() : null,
                reviewCase.getDecision() != null ? reviewCase.getDecision().name() : null,
                reviewCase.getAssignedToUser() != null ? reviewCase.getAssignedToUser().getId() : null,
                reviewCase.getAssignedToUser() != null ? reviewCase.getAssignedToUser().getFullName() : null,
                reviewCase.getAssignedAt(),
                reviewCase.getSlaDueAt(),
                reviewCase.getVerifiedByUser() != null ? reviewCase.getVerifiedByUser().getId() : null,
                reviewCase.getVerifiedByUser() != null ? reviewCase.getVerifiedByUser().getFullName() : null,
                reviewCase.getVerifiedAt(),
                reviewCase.getVerificationNote(),
                reviewCase.getVerificationOutcome() != null ? reviewCase.getVerificationOutcome().name() : null,
                reviewCase.getDecidedByUser() != null ? reviewCase.getDecidedByUser().getId() : null,
                reviewCase.getDecidedByUser() != null ? reviewCase.getDecidedByUser().getFullName() : null,
                reviewCase.getDecidedAt(),
                latestIntegrationRequest != null && latestIntegrationRequest.getStatus() != null
                        ? latestIntegrationRequest.getStatus().name()
                        : null,
                latestIntegrationRequest != null ? latestIntegrationRequest.getSupplierRespondedAt() : null,
                reviewCase.getUpdatedAt()
        );
    }
}
