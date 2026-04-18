package com.supplierplatform.revamp.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.revamp.dto.RevampApplicationSummaryDto;
import com.supplierplatform.revamp.dto.RevampAuditEventInputDto;
import com.supplierplatform.revamp.enums.ApplicationStatus;
import com.supplierplatform.revamp.enums.RegistryType;
import com.supplierplatform.revamp.enums.SourceChannel;
import com.supplierplatform.revamp.mapper.RevampApplicationMapper;
import com.supplierplatform.revamp.model.RevampApplication;
import com.supplierplatform.revamp.model.RevampApplicationSection;
import com.supplierplatform.revamp.repository.RevampApplicationRepository;
import com.supplierplatform.revamp.repository.RevampApplicationSectionRepository;
import com.supplierplatform.revamp.repository.RevampInviteRepository;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class RevampApplicationServiceTest {

    @Mock
    private RevampApplicationRepository applicationRepository;
    @Mock
    private RevampApplicationSectionRepository applicationSectionRepository;
    @Mock
    private RevampInviteRepository inviteRepository;
    @Mock
    private UserRepository userRepository;
    @Spy
    private RevampApplicationMapper applicationMapper = new RevampApplicationMapper();
    @Mock
    private RevampProtocolCodeService protocolCodeService;
    @Mock
    private RevampAuditService auditService;
    @Mock
    private RevampSectionPayloadValidator sectionPayloadValidator;
    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private RevampApplicationService applicationService;

    @Test
    void createDraftCreatesDraftStatus() {
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(applicationRepository.save(any(RevampApplication.class))).thenAnswer(invocation -> {
            RevampApplication app = invocation.getArgument(0);
            app.setId(UUID.randomUUID());
            return app;
        });

        RevampApplicationSummaryDto dto = applicationService.createDraft(
                userId,
                RegistryType.ALBO_A,
                SourceChannel.PUBLIC,
                null
        );

        assertNotNull(dto.id());
        assertEquals(userId, dto.applicantUserId());
        assertEquals("ALBO_A", dto.registryType());
        assertEquals("PUBLIC", dto.sourceChannel());
        assertEquals("DRAFT", dto.status());
        assertEquals(1, dto.currentRevision());
        verify(auditService).append(any(RevampAuditEventInputDto.class));
    }

    @Test
    void submitAssignsProtocolAndSubmittedStatus() {
        UUID appId = UUID.randomUUID();
        User user = new User();
        user.setId(UUID.randomUUID());

        RevampApplication app = new RevampApplication();
        app.setId(appId);
        app.setApplicantUser(user);
        app.setRegistryType(RegistryType.ALBO_A);
        app.setSourceChannel(SourceChannel.PUBLIC);
        app.setStatus(ApplicationStatus.DRAFT);
        app.setCurrentRevision(1);

        when(applicationRepository.findById(appId)).thenReturn(Optional.of(app));
        when(protocolCodeService.nextProtocolCode(RegistryType.ALBO_A)).thenReturn("A-2026-1234");
        when(applicationRepository.save(any(RevampApplication.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RevampApplicationSummaryDto dto = applicationService.submit(appId);

        assertEquals("SUBMITTED", dto.status());
        assertEquals("A-2026-1234", dto.protocolCode());
        assertNotNull(dto.submittedAt());
        verify(auditService).append(any(RevampAuditEventInputDto.class));
    }

    @Test
    void submitThrowsIfApplicationMissing() {
        UUID appId = UUID.randomUUID();
        when(applicationRepository.findById(appId)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> applicationService.submit(appId));
    }

    @Test
    void saveLatestSectionUsesValidatorAndPersistsNormalizedPayload() throws Exception {
        UUID appId = UUID.randomUUID();
        User user = new User();
        user.setId(UUID.randomUUID());

        RevampApplication app = new RevampApplication();
        app.setId(appId);
        app.setApplicantUser(user);
        app.setRegistryType(RegistryType.ALBO_B);
        app.setSourceChannel(SourceChannel.PUBLIC);
        app.setStatus(ApplicationStatus.DRAFT);
        app.setCurrentRevision(1);

        JsonNode normalized = objectMapper.readTree("""
            {"employeeRange":"E_10_49","atecoPrimary":"85.59","operatingRegions":"Lombardia"}
            """);

        when(applicationRepository.findById(appId)).thenReturn(Optional.of(app));
        when(applicationSectionRepository.findByApplicationIdAndSectionKeyAndIsLatestTrue(appId, "S2"))
                .thenReturn(Optional.empty());
        when(applicationSectionRepository.findTopByApplicationIdAndSectionKeyOrderBySectionVersionDesc(appId, "S2"))
                .thenReturn(Optional.empty());
        when(sectionPayloadValidator.validateAndNormalize(eq(RegistryType.ALBO_B), eq("S2"), any(JsonNode.class), eq(true), any()))
                .thenReturn(normalized);
        when(applicationSectionRepository.save(any(RevampApplicationSection.class))).thenAnswer(invocation -> {
            RevampApplicationSection section = invocation.getArgument(0);
            section.setId(UUID.randomUUID());
            return section;
        });

        String payload = "{\"employeeRange\":\"16_50\",\"atecoPrimary\":\"85.59\",\"operatingRegions\":\"Lombardia\"}";
        var snapshot = applicationService.saveLatestSection(appId, "S2", payload, true);

        assertNotNull(snapshot.id());
        assertEquals("S2", snapshot.sectionKey());
        assertEquals(1, snapshot.sectionVersion());
        assertNotNull(snapshot.payloadJson());
        assertTrue(snapshot.payloadJson().contains("\"E_10_49\""));
        verify(sectionPayloadValidator).validateAndNormalize(eq(RegistryType.ALBO_B), eq("S2"), any(JsonNode.class), eq(true), any());
    }
}

