package com.supplierplatform.revamp.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.revamp.dto.RevampAuditEventInputDto;
import com.supplierplatform.revamp.dto.RevampIntegrationRequestSummaryDto;
import com.supplierplatform.revamp.dto.RevampReviewCaseSummaryDto;
import com.supplierplatform.revamp.enums.ApplicationStatus;
import com.supplierplatform.revamp.enums.IntegrationRequestStatus;
import com.supplierplatform.revamp.enums.ReviewCaseStatus;
import com.supplierplatform.revamp.enums.ReviewDecision;
import com.supplierplatform.revamp.mapper.RevampReviewCaseMapper;
import com.supplierplatform.revamp.model.RevampApplication;
import com.supplierplatform.revamp.model.RevampIntegrationRequest;
import com.supplierplatform.revamp.model.RevampReviewCase;
import com.supplierplatform.revamp.repository.RevampApplicationRepository;
import com.supplierplatform.revamp.repository.RevampIntegrationRequestRepository;
import com.supplierplatform.revamp.repository.RevampReviewCaseRepository;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RevampReviewWorkflowService {

    private final RevampReviewCaseRepository reviewCaseRepository;
    private final RevampApplicationRepository applicationRepository;
    private final RevampIntegrationRequestRepository integrationRequestRepository;
    private final UserRepository userRepository;
    private final RevampReviewCaseMapper reviewCaseMapper;
    private final RevampAuditService auditService;
    private final RevampProfileProjectionService profileProjectionService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<RevampReviewCaseSummaryDto> getQueue() {
        return reviewCaseRepository.findAll().stream()
                .filter(caseItem -> caseItem.getStatus() != ReviewCaseStatus.DECIDED && caseItem.getStatus() != ReviewCaseStatus.CLOSED)
                .map(reviewCaseMapper::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RevampReviewCaseSummaryDto> getHistory(UUID applicationId) {
        return reviewCaseRepository.findByApplicationIdOrderByCreatedAtDesc(applicationId).stream()
                .map(reviewCaseMapper::toSummary)
                .toList();
    }

    @Transactional
    public RevampReviewCaseSummaryDto openCase(UUID applicationId, UUID assignedToUserId, LocalDateTime slaDueAt) {
        RevampApplication application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new EntityNotFoundException("RevampApplication", applicationId));

        RevampReviewCase reviewCase = new RevampReviewCase();
        reviewCase.setApplication(application);
        reviewCase.setStatus(ReviewCaseStatus.IN_PROGRESS);
        reviewCase.setAssignedAt(LocalDateTime.now());
        reviewCase.setSlaDueAt(slaDueAt);

        if (assignedToUserId != null) {
            User assigned = userRepository.findById(assignedToUserId)
                    .orElseThrow(() -> new EntityNotFoundException("User", assignedToUserId));
            reviewCase.setAssignedToUser(assigned);
        }

        application.setStatus(ApplicationStatus.UNDER_REVIEW);
        applicationRepository.save(application);
        RevampReviewCase savedCase = reviewCaseRepository.save(reviewCase);
        auditService.append(new RevampAuditEventInputDto(
                "revamp.review.opened",
                "REVAMP_APPLICATION",
                application.getId(),
                assignedToUserId,
                assignedToUserId != null ? "ADMIN" : null,
                null,
                null,
                "{\"status\":\"DRAFT\"}",
                "{\"status\":\"UNDER_REVIEW\"}",
                "{\"reviewCaseId\":\"" + savedCase.getId() + "\"}"
        ));

        return reviewCaseMapper.toSummary(savedCase);
    }

    @Transactional
    public RevampReviewCaseSummaryDto requestIntegration(
            UUID reviewCaseId,
            UUID requestedByUserId,
            LocalDateTime dueAt,
            String message,
            String requestedItemsJson
    ) {
        RevampReviewCase reviewCase = getReviewCase(reviewCaseId);
        if (reviewCase.getStatus() == ReviewCaseStatus.DECIDED || reviewCase.getStatus() == ReviewCaseStatus.CLOSED) {
            throw new IllegalStateException("Integration request not allowed for finalized review case.");
        }
        RevampIntegrationRequest openExisting = integrationRequestRepository
                .findFirstByReviewCaseIdAndStatusOrderByCreatedAtDesc(reviewCaseId, IntegrationRequestStatus.OPEN);
        if (openExisting != null) {
            throw new IllegalStateException("Open integration request already exists for this review case.");
        }

        RevampIntegrationRequest request = new RevampIntegrationRequest();
        request.setReviewCase(reviewCase);
        request.setDueAt(dueAt);
        request.setRequestMessage(message);
        request.setRequestedItemsJson(parseJsonRequired(requestedItemsJson, "requestedItemsJson"));
        request.setStatus(IntegrationRequestStatus.OPEN);

        if (requestedByUserId != null) {
            User requestedBy = userRepository.findById(requestedByUserId)
                    .orElseThrow(() -> new EntityNotFoundException("User", requestedByUserId));
            request.setRequestedByUser(requestedBy);
        }

        integrationRequestRepository.save(request);

        reviewCase.setStatus(ReviewCaseStatus.WAITING_SUPPLIER_RESPONSE);
        reviewCase.setSlaDueAt(dueAt);
        reviewCaseRepository.save(reviewCase);

        RevampApplication application = reviewCase.getApplication();
        ApplicationStatus beforeStatus = application.getStatus();
        application.setStatus(ApplicationStatus.INTEGRATION_REQUIRED);
        applicationRepository.save(application);
        auditService.append(new RevampAuditEventInputDto(
                "revamp.review.integration_requested",
                "REVAMP_APPLICATION",
                application.getId(),
                requestedByUserId,
                requestedByUserId != null ? "ADMIN" : null,
                null,
                null,
                "{\"status\":\"" + beforeStatus.name() + "\"}",
                "{\"status\":\"" + application.getStatus().name() + "\"}",
                "{\"reviewCaseId\":\"" + reviewCase.getId() + "\"}"
        ));

        return reviewCaseMapper.toSummary(reviewCase);
    }

    @Transactional(readOnly = true)
    public RevampIntegrationRequestSummaryDto getLatestIntegrationRequest(UUID reviewCaseId) {
        RevampIntegrationRequest latest = integrationRequestRepository
                .findFirstByReviewCaseIdOrderByCreatedAtDesc(reviewCaseId);
        if (latest == null) {
            return null;
        }
        return new RevampIntegrationRequestSummaryDto(
                latest.getId(),
                latest.getReviewCase() != null ? latest.getReviewCase().getId() : null,
                latest.getStatus() != null ? latest.getStatus().name() : null,
                latest.getDueAt(),
                latest.getRequestMessage(),
                latest.getRequestedItemsJson(),
                latest.getUpdatedAt()
        );
    }

    @Transactional
    public RevampReviewCaseSummaryDto decide(UUID reviewCaseId, ReviewDecision decision, String reason, UUID decidedByUserId) {
        RevampReviewCase reviewCase = getReviewCase(reviewCaseId);
        if (reviewCase.getStatus() == ReviewCaseStatus.DECIDED || reviewCase.getStatus() == ReviewCaseStatus.CLOSED) {
            throw new IllegalStateException("Review case is already finalized.");
        }
        RevampApplication application = reviewCase.getApplication();
        ApplicationStatus beforeStatus = application.getStatus();

        User decidedBy = null;
        if (decidedByUserId != null) {
            decidedBy = userRepository.findById(decidedByUserId)
                    .orElseThrow(() -> new EntityNotFoundException("User", decidedByUserId));
        }

        reviewCase.setDecision(decision);
        reviewCase.setDecisionReason(reason);
        reviewCase.setDecidedByUser(decidedBy);
        reviewCase.setDecidedAt(LocalDateTime.now());
        reviewCase.setStatus(ReviewCaseStatus.DECIDED);

        switch (decision) {
            case APPROVED -> {
                application.setStatus(ApplicationStatus.APPROVED);
                application.setApprovedAt(LocalDateTime.now());
            }
            case REJECTED -> {
                application.setStatus(ApplicationStatus.REJECTED);
                application.setRejectedAt(LocalDateTime.now());
            }
            case INTEGRATION_REQUIRED -> application.setStatus(ApplicationStatus.INTEGRATION_REQUIRED);
            default -> throw new IllegalStateException("Unhandled review decision: " + decision);
        }

        applicationRepository.save(application);
        if (decision == ReviewDecision.APPROVED) {
            profileProjectionService.projectApprovedApplication(application.getId());
        }
        RevampReviewCase savedCase = reviewCaseRepository.save(reviewCase);
        String actorRole = decidedBy != null && decidedBy.getRole() != null ? decidedBy.getRole().name() : null;
        auditService.append(new RevampAuditEventInputDto(
                "revamp.review.decided",
                "REVAMP_APPLICATION",
                application.getId(),
                decidedByUserId,
                actorRole,
                null,
                reason,
                "{\"status\":\"" + beforeStatus.name() + "\"}",
                "{\"status\":\"" + application.getStatus().name() + "\"}",
                "{\"decision\":\"" + decision.name() + "\",\"reviewCaseId\":\"" + savedCase.getId() + "\"}"
        ));
        return reviewCaseMapper.toSummary(savedCase);
    }

    private RevampReviewCase getReviewCase(UUID reviewCaseId) {
        return reviewCaseRepository.findById(reviewCaseId)
                .orElseThrow(() -> new EntityNotFoundException("RevampReviewCase", reviewCaseId));
    }

    private JsonNode parseJsonRequired(String raw, String fieldName) {
        String normalized = (raw == null || raw.isBlank()) ? "[]" : raw;
        try {
            return objectMapper.readTree(normalized);
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("Invalid JSON for " + fieldName, ex);
        }
    }
}
