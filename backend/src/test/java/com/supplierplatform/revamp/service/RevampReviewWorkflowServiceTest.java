package com.supplierplatform.revamp.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.supplierplatform.revamp.dto.RevampReviewCaseSummaryDto;
import com.supplierplatform.revamp.dto.RevampAuditEventInputDto;
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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RevampReviewWorkflowServiceTest {

    @Mock
    private RevampReviewCaseRepository reviewCaseRepository;
    @Mock
    private RevampApplicationRepository applicationRepository;
    @Mock
    private RevampIntegrationRequestRepository integrationRequestRepository;
    @Mock
    private UserRepository userRepository;
    @Spy
    private RevampReviewCaseMapper reviewCaseMapper = new RevampReviewCaseMapper();
    @Mock
    private RevampAuditService auditService;
    @Mock
    private RevampProfileProjectionService profileProjectionService;
    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private RevampReviewWorkflowService reviewWorkflowService;

    @Test
    void requestIntegrationMovesStatusesAndStoresRequest() {
        UUID reviewCaseId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();

        RevampApplication app = new RevampApplication();
        app.setId(UUID.randomUUID());
        app.setStatus(ApplicationStatus.UNDER_REVIEW);

        RevampReviewCase reviewCase = new RevampReviewCase();
        reviewCase.setId(reviewCaseId);
        reviewCase.setApplication(app);
        reviewCase.setStatus(ReviewCaseStatus.IN_PROGRESS);

        User requester = new User();
        requester.setId(requesterId);

        when(reviewCaseRepository.findById(reviewCaseId)).thenReturn(Optional.of(reviewCase));
        when(userRepository.findById(requesterId)).thenReturn(Optional.of(requester));
        when(integrationRequestRepository.save(any(RevampIntegrationRequest.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(reviewCaseRepository.save(any(RevampReviewCase.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(applicationRepository.save(any(RevampApplication.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RevampReviewCaseSummaryDto dto = reviewWorkflowService.requestIntegration(
                reviewCaseId,
                requesterId,
                LocalDateTime.now().plusDays(7),
                "Missing DURC",
                "[\"durc\"]"
        );

        assertEquals("WAITING_SUPPLIER_RESPONSE", dto.status());
        assertEquals(ApplicationStatus.INTEGRATION_REQUIRED, app.getStatus());

        ArgumentCaptor<RevampIntegrationRequest> captor = ArgumentCaptor.forClass(RevampIntegrationRequest.class);
        verify(integrationRequestRepository).save(captor.capture());
        assertEquals(IntegrationRequestStatus.OPEN, captor.getValue().getStatus());
        verify(auditService).append(any(RevampAuditEventInputDto.class));
    }

    @Test
    void decideApprovedUpdatesApplicationAndReviewCase() {
        UUID reviewCaseId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();

        RevampApplication app = new RevampApplication();
        app.setId(UUID.randomUUID());
        app.setStatus(ApplicationStatus.UNDER_REVIEW);

        RevampReviewCase reviewCase = new RevampReviewCase();
        reviewCase.setId(reviewCaseId);
        reviewCase.setApplication(app);
        reviewCase.setStatus(ReviewCaseStatus.IN_PROGRESS);

        User actor = new User();
        actor.setId(actorId);

        when(reviewCaseRepository.findById(reviewCaseId)).thenReturn(Optional.of(reviewCase));
        when(userRepository.findById(actorId)).thenReturn(Optional.of(actor));
        when(applicationRepository.save(any(RevampApplication.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(reviewCaseRepository.save(any(RevampReviewCase.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RevampReviewCaseSummaryDto dto = reviewWorkflowService.decide(
                reviewCaseId,
                ReviewDecision.APPROVED,
                "All good",
                actorId
        );

        assertEquals("DECIDED", dto.status());
        assertEquals("APPROVED", dto.decision());
        assertEquals(ApplicationStatus.APPROVED, app.getStatus());
        assertNotNull(app.getApprovedAt());
        verify(profileProjectionService).projectApprovedApplication(app.getId());
        verify(auditService).append(any(RevampAuditEventInputDto.class));
    }
}

