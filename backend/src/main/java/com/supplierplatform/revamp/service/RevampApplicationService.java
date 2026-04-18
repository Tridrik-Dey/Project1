package com.supplierplatform.revamp.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.revamp.dto.RevampApplicationSummaryDto;
import com.supplierplatform.revamp.dto.RevampAuditEventInputDto;
import com.supplierplatform.revamp.dto.RevampSectionSnapshotDto;
import com.supplierplatform.revamp.enums.ApplicationStatus;
import com.supplierplatform.revamp.enums.RegistryType;
import com.supplierplatform.revamp.enums.SourceChannel;
import com.supplierplatform.revamp.mapper.RevampApplicationMapper;
import com.supplierplatform.revamp.model.RevampApplication;
import com.supplierplatform.revamp.model.RevampApplicationSection;
import com.supplierplatform.revamp.model.RevampInvite;
import com.supplierplatform.revamp.repository.RevampApplicationRepository;
import com.supplierplatform.revamp.repository.RevampApplicationSectionRepository;
import com.supplierplatform.revamp.repository.RevampInviteRepository;
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
public class RevampApplicationService {

    private final RevampApplicationRepository applicationRepository;
    private final RevampApplicationSectionRepository applicationSectionRepository;
    private final RevampInviteRepository inviteRepository;
    private final UserRepository userRepository;
    private final RevampApplicationMapper applicationMapper;
    private final RevampProtocolCodeService protocolCodeService;
    private final RevampAuditService auditService;
    private final RevampSectionPayloadValidator sectionPayloadValidator;
    private final RevampAttachmentService attachmentService;
    private final RevampDraftPayloadUpConverter draftPayloadUpConverter;
    private final ObjectMapper objectMapper;

    @Transactional
    public RevampApplicationSummaryDto createDraft(
            UUID applicantUserId,
            RegistryType registryType,
            SourceChannel sourceChannel,
            UUID inviteId
    ) {
        User applicant = userRepository.findById(applicantUserId)
                .orElseThrow(() -> new EntityNotFoundException("User", applicantUserId));

        RevampApplication application = new RevampApplication();
        application.setApplicantUser(applicant);
        application.setRegistryType(registryType);
        application.setSourceChannel(sourceChannel);
        application.setStatus(ApplicationStatus.DRAFT);
        application.setCurrentRevision(1);

        if (inviteId != null) {
            RevampInvite invite = inviteRepository.findById(inviteId)
                    .orElseThrow(() -> new EntityNotFoundException("RevampInvite", inviteId));
            application.setInvite(invite);
        }

        RevampApplication saved = applicationRepository.save(application);
        String actorRole = applicant.getRole() != null ? applicant.getRole().name() : null;
        auditService.append(new RevampAuditEventInputDto(
                "revamp.application.created",
                "REVAMP_APPLICATION",
                saved.getId(),
                applicantUserId,
                actorRole,
                null,
                null,
                "{\"status\":null}",
                "{\"status\":\"DRAFT\"}",
                "{\"source\":\"" + sourceChannel.name() + "\"}"
        ));
        return applicationMapper.toSummary(saved);
    }

    @Transactional(readOnly = true)
    public RevampApplicationSummaryDto getSummary(UUID applicationId) {
        return applicationMapper.toSummary(getApplication(applicationId));
    }

    @Transactional(readOnly = true)
    public List<RevampApplicationSummaryDto> listForApplicant(UUID applicantUserId) {
        return applicationRepository.findByApplicantUserId(applicantUserId).stream()
                .map(applicationMapper::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public RevampApplicationSummaryDto getLatestForApplicant(UUID applicantUserId) {
        return applicationRepository.findFirstByApplicantUserIdOrderByUpdatedAtDesc(applicantUserId)
                .map(applicationMapper::toSummary)
                .orElse(null);
    }

    @Transactional
    public RevampSectionSnapshotDto saveLatestSection(
            UUID applicationId,
            String sectionKey,
            String payloadJson,
            boolean completed
    ) {
        RevampApplication application = getApplication(applicationId);

        applicationSectionRepository.findByApplicationIdAndSectionKeyAndIsLatestTrue(applicationId, sectionKey)
                .ifPresent(existing -> {
                    existing.setIsLatest(false);
                    applicationSectionRepository.save(existing);
                });

        int nextVersion = applicationSectionRepository
                .findTopByApplicationIdAndSectionKeyOrderBySectionVersionDesc(applicationId, sectionKey)
                .map(s -> s.getSectionVersion() + 1)
                .orElse(1);

        RevampApplicationSection section = new RevampApplicationSection();
        section.setApplication(application);
        section.setSectionKey(sectionKey);
        section.setSectionVersion(nextVersion);
        JsonNode rawPayload = parseJsonRequired(payloadJson, "payloadJson");
        JsonNode validatedPayload = sectionPayloadValidator.validateAndNormalize(
                application.getRegistryType(),
                sectionKey,
                rawPayload,
                completed,
                () -> applicationSectionRepository
                        .findByApplicationIdAndSectionKeyAndIsLatestTrue(applicationId, "S3A")
                        .map(RevampApplicationSection::getPayloadJson)
        );
        JsonNode enrichedPayload = attachmentService.syncAndEnrich(application, sectionKey, validatedPayload);
        section.setPayloadJson(enrichedPayload);
        section.setCompleted(completed);
        section.setIsLatest(true);
        section.setValidatedAt(LocalDateTime.now());

        RevampApplicationSection saved = applicationSectionRepository.save(section);
        return applicationMapper.toSectionSnapshot(saved);
    }

    @Transactional(readOnly = true)
    public List<RevampSectionSnapshotDto> getLatestSections(UUID applicationId) {
        RevampApplication application = getApplication(applicationId);
        return applicationSectionRepository.findByApplicationIdAndIsLatestTrue(applicationId).stream()
                .map(section -> {
                    JsonNode converted = draftPayloadUpConverter.convertForDraftRead(
                            application.getRegistryType(),
                            section.getSectionKey(),
                            section.getPayloadJson()
                    );
                    return new RevampSectionSnapshotDto(
                            section.getId(),
                            section.getApplication() != null ? section.getApplication().getId() : null,
                            section.getSectionKey(),
                            section.getSectionVersion(),
                            Boolean.TRUE.equals(section.getCompleted()),
                            converted == null ? null : converted.toString(),
                            section.getUpdatedAt()
                    );
                })
                .toList();
    }

    @Transactional
    public RevampApplicationSummaryDto submit(UUID applicationId) {
        RevampApplication application = getApplication(applicationId);
        ApplicationStatus status = application.getStatus();
        ApplicationStatus beforeStatus = status;

        if (status != ApplicationStatus.DRAFT && status != ApplicationStatus.INTEGRATION_REQUIRED) {
            throw new IllegalStateException("Application cannot be submitted from status: " + status);
        }

        application.setStatus(ApplicationStatus.SUBMITTED);
        application.setSubmittedAt(LocalDateTime.now());
        if (application.getProtocolCode() == null || application.getProtocolCode().isBlank()) {
            application.setProtocolCode(protocolCodeService.nextProtocolCode(application.getRegistryType()));
        }

        RevampApplication saved = applicationRepository.save(application);
        String actorRole = saved.getApplicantUser() != null && saved.getApplicantUser().getRole() != null
                ? saved.getApplicantUser().getRole().name()
                : null;
        auditService.append(new RevampAuditEventInputDto(
                "revamp.application.submitted",
                "REVAMP_APPLICATION",
                saved.getId(),
                saved.getApplicantUser() != null ? saved.getApplicantUser().getId() : null,
                actorRole,
                null,
                null,
                "{\"status\":\"" + beforeStatus.name() + "\"}",
                "{\"status\":\"" + saved.getStatus().name() + "\"}",
                "{\"protocolCode\":\"" + saved.getProtocolCode() + "\"}"
        ));
        return applicationMapper.toSummary(saved);
    }

    private RevampApplication getApplication(UUID applicationId) {
        return applicationRepository.findById(applicationId)
                .orElseThrow(() -> new EntityNotFoundException("RevampApplication", applicationId));
    }

    private JsonNode parseJsonRequired(String raw, String fieldName) {
        String normalized = (raw == null || raw.isBlank()) ? "{}" : raw;
        try {
            return objectMapper.readTree(normalized);
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("Invalid JSON for " + fieldName, ex);
        }
    }
}
