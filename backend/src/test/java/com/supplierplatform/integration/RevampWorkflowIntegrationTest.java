package com.supplierplatform.integration;

import com.supplierplatform.document.SupplierDocumentRepository;
import com.supplierplatform.review.ValidationReviewRepository;
import com.supplierplatform.revamp.dto.RevampApplicationSummaryDto;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.enums.InviteStatus;
import com.supplierplatform.revamp.enums.RegistryType;
import com.supplierplatform.revamp.enums.SourceChannel;
import com.supplierplatform.revamp.model.RevampApplication;
import com.supplierplatform.revamp.model.RevampApplicationSection;
import com.supplierplatform.revamp.model.RevampInvite;
import com.supplierplatform.revamp.model.RevampOtpChallenge;
import com.supplierplatform.revamp.repository.RevampApplicationRepository;
import com.supplierplatform.revamp.repository.RevampApplicationSectionRepository;
import com.supplierplatform.revamp.repository.RevampApplicationAttachmentRepository;
import com.supplierplatform.revamp.repository.RevampAuditEventRepository;
import com.supplierplatform.revamp.repository.RevampEvaluationDimensionRepository;
import com.supplierplatform.revamp.repository.RevampEvaluationRepository;
import com.supplierplatform.revamp.repository.RevampIntegrationRequestRepository;
import com.supplierplatform.revamp.repository.RevampInviteRepository;
import com.supplierplatform.revamp.repository.RevampNotificationEventRepository;
import com.supplierplatform.revamp.repository.RevampOtpChallengeRepository;
import com.supplierplatform.revamp.repository.RevampReviewCaseRepository;
import com.supplierplatform.revamp.repository.RevampSupplierRegistryProfileDetailRepository;
import com.supplierplatform.revamp.repository.RevampSupplierRegistryProfileRepository;
import com.supplierplatform.revamp.repository.RevampUserAdminRoleRepository;
import com.supplierplatform.revamp.service.RevampApplicationService;
import com.supplierplatform.revamp.service.RevampInviteService;
import com.supplierplatform.revamp.service.RevampOtpChallengeService;
import com.supplierplatform.revamp.service.RevampReviewWorkflowService;
import com.supplierplatform.revamp.service.RevampSupplierProfileService;
import com.supplierplatform.status.StatusHistoryRepository;
import com.supplierplatform.supplier.SupplierContactRepository;
import com.supplierplatform.supplier.SupplierProfileRepository;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRepository;
import com.supplierplatform.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
class RevampWorkflowIntegrationTest {

    @Autowired
    private RevampInviteService inviteService;

    @Autowired
    private RevampApplicationService applicationService;
    @Autowired
    private RevampOtpChallengeService otpChallengeService;

    @Autowired
    private RevampInviteRepository inviteRepository;

    @Autowired
    private RevampApplicationRepository applicationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RevampApplicationSectionRepository applicationSectionRepository;
    @Autowired
    private RevampApplicationAttachmentRepository applicationAttachmentRepository;

    @Autowired
    private RevampAuditEventRepository auditEventRepository;
    @Autowired
    private RevampIntegrationRequestRepository integrationRequestRepository;
    @Autowired
    private RevampReviewCaseRepository reviewCaseRepository;
    @Autowired
    private RevampEvaluationDimensionRepository evaluationDimensionRepository;
    @Autowired
    private RevampEvaluationRepository evaluationRepository;
    @Autowired
    private RevampSupplierRegistryProfileDetailRepository supplierRegistryProfileDetailRepository;
    @Autowired
    private RevampSupplierRegistryProfileRepository supplierRegistryProfileRepository;
    @Autowired
    private RevampNotificationEventRepository notificationEventRepository;
    @Autowired
    private RevampOtpChallengeRepository otpChallengeRepository;
    @Autowired
    private RevampUserAdminRoleRepository userAdminRoleRepository;
    @Autowired
    private ValidationReviewRepository validationReviewRepository;
    @Autowired
    private StatusHistoryRepository statusHistoryRepository;
    @Autowired
    private SupplierDocumentRepository supplierDocumentRepository;
    @Autowired
    private SupplierContactRepository supplierContactRepository;
    @Autowired
    private SupplierProfileRepository supplierProfileRepository;
    @Autowired
    private RevampReviewWorkflowService reviewWorkflowService;
    @Autowired
    private RevampSupplierProfileService supplierProfileService;

    @BeforeEach
    void cleanDatabase() {
        applicationSectionRepository.deleteAll();
        applicationAttachmentRepository.deleteAll();
        integrationRequestRepository.deleteAll();
        reviewCaseRepository.deleteAll();
        evaluationDimensionRepository.deleteAll();
        evaluationRepository.deleteAll();
        supplierRegistryProfileDetailRepository.deleteAll();
        supplierRegistryProfileRepository.deleteAll();
        notificationEventRepository.deleteAll();
        otpChallengeRepository.deleteAll();
        applicationRepository.deleteAll();
        inviteRepository.deleteAll();
        auditEventRepository.deleteAll();
        userAdminRoleRepository.deleteAll();
        validationReviewRepository.deleteAll();
        statusHistoryRepository.deleteAll();
        supplierDocumentRepository.deleteAll();
        supplierContactRepository.deleteAll();
        supplierProfileRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void inviteFlowConsumesTokenAndStartsInviteDraft() {
        User admin = createUser("admin.integration@test.com", UserRole.ADMIN);
        User supplier = createUser("supplier.integration@test.com", UserRole.SUPPLIER);

        RevampInvite created = inviteService.createInvite(
                RegistryType.ALBO_A,
                "supplier.integration@test.com",
                "Supplier Integration",
                admin.getId(),
                LocalDateTime.now().plusDays(30),
                "integration test invite"
        );

        RevampInvite opened = inviteService.markOpened(created.getToken());
        assertEquals(InviteStatus.OPENED, opened.getStatus());

        RevampInvite consumed = inviteService.markConsumed(created.getId());
        assertEquals(InviteStatus.CONSUMED, consumed.getStatus());
        assertNotNull(consumed.getConsumedAt());

        RevampApplicationSummaryDto draft = applicationService.createDraft(
                supplier.getId(),
                RegistryType.ALBO_A,
                SourceChannel.INVITE,
                created.getId()
        );

        assertEquals("DRAFT", draft.status());
        assertEquals("INVITE", draft.sourceChannel());
        assertEquals("ALBO_A", draft.registryType());

        Optional<RevampApplication> persisted = applicationRepository.findById(draft.id());
        assertTrue(persisted.isPresent());
        assertNotNull(persisted.get().getInvite());
        assertEquals(created.getId(), persisted.get().getInvite().getId());
        assertFalse(auditEventRepository.findByEntityTypeAndEntityIdOrderByOccurredAtDesc("REVAMP_INVITE", created.getId()).isEmpty());
    }

    @Test
    void publicFlowSubmitsAndAssignsProtocolCode() {
        User supplier = createUser("supplier.publicflow@test.com", UserRole.SUPPLIER);

        RevampApplicationSummaryDto draft = applicationService.createDraft(
                supplier.getId(),
                RegistryType.ALBO_B,
                SourceChannel.PUBLIC,
                null
        );

        applicationService.saveLatestSection(
                draft.id(),
                "S1",
                """
                {
                  "companyName":"ACME",
                  "legalForm":"SRL",
                  "vatNumber":"12345678901",
                  "reaNumber":"MI-1234567",
                  "cciaaProvince":"MI",
                  "incorporationDate":"2020-01",
                  "legalAddress":{"street":"Via Roma 1","city":"Milano","cap":"20100","province":"MI"},
                  "institutionalEmail":"info@acme.it",
                  "phone":"+3902123456",
                  "legalRepresentative":{"name":"Mario Rossi","taxCode":"RSSMRA80A01F205X","role":"Amministratore"},
                  "operationalContact":{"name":"Ops Team","role":"PM","email":"ops@acme.it","phone":"+3902000111"}
                }
                """,
                true
        );
        applicationService.saveLatestSection(
                draft.id(),
                "S4",
                """
                {
                  "iso9001":"YES",
                  "accreditationSummary":"Accreditata Regione Lombardia",
                  "attachments":[
                    {"documentType":"VISURA_CAMERALE","fileName":"visura.pdf","storageKey":"s3://docs/visura.pdf","expiresAt":"2099-12-31"},
                    {"documentType":"DURC","fileName":"durc.pdf","storageKey":"s3://docs/durc.pdf","expiresAt":"2000-01-01"},
                    {"documentType":"CERTIFICATION","fileName":"iso9001.pdf","storageKey":"s3://docs/iso9001.pdf"}
                  ]
                }
                """,
                true
        );

        RevampApplicationSummaryDto submitted = applicationService.submit(draft.id());

        assertEquals("SUBMITTED", submitted.status());
        assertNotNull(submitted.submittedAt());
        assertNotNull(submitted.protocolCode());
        assertTrue(submitted.protocolCode().matches("^B-\\d{4}-\\d{4}$"));

        Optional<RevampApplication> persisted = applicationRepository.findById(draft.id());
        assertTrue(persisted.isPresent());
        assertFalse(persisted.get().getProtocolCode().isBlank());
        assertEquals(3, applicationAttachmentRepository.findByApplicationIdAndSectionKey(draft.id(), "S4").size());
        String s4Payload = applicationSectionRepository
                .findByApplicationIdAndSectionKeyAndIsLatestTrue(draft.id(), "S4")
                .map(section -> section.getPayloadJson().toString())
                .orElse("");
        assertTrue(s4Payload.contains("\"expired\":true"));
        assertTrue(s4Payload.contains("\"expiringSoon\":false"));
        assertFalse(auditEventRepository.findByEntityTypeAndEntityIdOrderByOccurredAtDesc("REVAMP_APPLICATION", draft.id()).isEmpty());
    }

    @Test
    void declarationOtpVerificationBindsSnapshotHashToS5SectionVersion() {
        User supplier = createUser("supplier.otpbind@test.com", UserRole.SUPPLIER);
        RevampApplicationSummaryDto draft = applicationService.createDraft(
                supplier.getId(),
                RegistryType.ALBO_A,
                SourceChannel.PUBLIC,
                null
        );

        applicationService.saveLatestSection(
                draft.id(),
                "S5",
                """
                {
                  "truthfulnessDeclaration": true,
                  "noConflictOfInterest": true,
                  "noCriminalConvictions": true,
                  "privacyAccepted": true,
                  "ethicalCodeAccepted": true,
                  "qualityEnvSafetyAccepted": true,
                  "alboDataProcessingConsent": true,
                  "marketingConsent": false,
                  "dlgs81ComplianceWhenInPresence": false,
                  "otpVerified": false
                }
                """,
                false
        );

        var dispatched = otpChallengeService.dispatchDeclarationSignatureOtp(draft.id(), supplier);
        RevampOtpChallenge challenge = otpChallengeRepository.findById(dispatched.challengeId()).orElseThrow();
        challenge.setOtpHash(sha256("123456"));
        otpChallengeRepository.save(challenge);

        var verified = otpChallengeService.verifyChallenge(challenge.getId(), "123456", supplier);
        assertTrue(verified.verified());

        RevampApplicationSection s5Section = applicationSectionRepository
                .findByApplicationIdAndSectionKeyAndIsLatestTrue(draft.id(), "S5")
                .orElseThrow();
        String payload = s5Section.getPayloadJson().toString();
        assertTrue(payload.contains("\"declarationSnapshotHash\""));
        assertTrue(payload.contains("\"declarationSnapshotSectionVersion\":" + s5Section.getSectionVersion()));
        assertTrue(payload.contains("\"otpVerified\":true"));
        assertTrue(payload.contains(challenge.getId().toString()));
    }

    @Test
    void approvalDecisionProjectsSupplierProfileAndDetailFromLatestSections() {
        User supplier = createUser("supplier.projection@test.com", UserRole.SUPPLIER);
        User admin = createUser("admin.projection@test.com", UserRole.ADMIN);

        RevampApplicationSummaryDto draft = applicationService.createDraft(
                supplier.getId(),
                RegistryType.ALBO_B,
                SourceChannel.PUBLIC,
                null
        );

        applicationService.saveLatestSection(
                draft.id(),
                "S1",
                """
                {
                  "companyName":"Alpha Formazione S.r.l.",
                  "legalForm":"SRL",
                  "vatNumber":"12345678901",
                  "reaNumber":"MI-1234567",
                  "cciaaProvince":"MI",
                  "incorporationDate":"2018-06",
                  "legalAddress":{"street":"Via Roma 1","city":"Milano","cap":"20100","province":"MI"},
                  "institutionalEmail":"info@alpha.it",
                  "phone":"+3902123456",
                  "legalRepresentative":{"name":"Mario Rossi","taxCode":"RSSMRA80A01F205X","role":"Amministratore"},
                  "operationalContact":{"name":"Laura Bianchi","email":"ops@alpha.it","phone":"+3902111111"}
                }
                """,
                true
        );
        applicationService.saveLatestSection(
                draft.id(),
                "S2",
                """
                {
                  "employeeRange":"E_10_49",
                  "atecoPrimary":"85.59",
                  "revenueBand":"R_100_500K",
                  "operatingRegions":[{"region":"Lombardia","provincesCsv":"MI,MB"}]
                }
                """,
                true
        );
        applicationService.saveLatestSection(
                draft.id(),
                "S3",
                """
                {
                  "servicesByCategory":{
                    "CAT_A":["TRAINING_DESIGN"]
                  },
                  "descriptionsByCategory":{
                    "CAT_A":"Progettazione e docenza percorsi formativi"
                  }
                }
                """,
                true
        );

        applicationService.submit(draft.id());
        var reviewCase = reviewWorkflowService.openCase(draft.id(), admin.getId(), LocalDateTime.now().plusDays(5));
        reviewWorkflowService.decide(reviewCase.id(), com.supplierplatform.revamp.enums.ReviewDecision.APPROVED, "ok", admin.getId());

        var profile = supplierRegistryProfileRepository.findByApplicationId(draft.id()).orElseThrow();
        assertEquals("Alpha Formazione S.r.l.", profile.getDisplayName());
        assertTrue(Boolean.TRUE.equals(profile.getIsVisible()));
        assertEquals(com.supplierplatform.revamp.enums.RegistryProfileStatus.APPROVED, profile.getStatus());

        var detail = supplierRegistryProfileDetailRepository.findByProfileId(profile.getId()).orElseThrow();
        assertEquals("85.59", detail.getSearchAtecoPrimary());
        assertTrue(detail.getProjectedJson().toString().contains("\"servicesByCategory\""));
        assertTrue(detail.getProjectedJson().toString().contains("\"publicCardView\""));
        assertTrue(detail.getProjectedJson().toString().contains("\"adminCardView\""));
    }

    @Test
    void getLatestSectionsUpConvertsLegacyDraftPayloadKeys() {
        User supplier = createUser("supplier.legacydraft@test.com", UserRole.SUPPLIER);
        RevampApplicationSummaryDto draft = applicationService.createDraft(
                supplier.getId(),
                RegistryType.ALBO_A,
                SourceChannel.PUBLIC,
                null
        );

        applicationService.saveLatestSection(
                draft.id(),
                "S3A",
                """
                {
                  "thematicAreasCsv":"Digital Learning",
                  "yearsExperience":"5-10 anni",
                  "presentation":"Esperienza legacy"
                }
                """,
                false
        );
        applicationService.saveLatestSection(
                draft.id(),
                "S4",
                """
                {
                  "operationalCapacity":"Capacita",
                  "referencesSummary":"Legacy Ref"
                }
                """,
                false
        );

        var sections = applicationService.getLatestSections(draft.id());
        String s3Payload = sections.stream().filter(s -> "S3A".equalsIgnoreCase(s.sectionKey())).findFirst().orElseThrow().payloadJson();
        String s4Payload = sections.stream().filter(s -> "S4".equalsIgnoreCase(s.sectionKey())).findFirst().orElseThrow().payloadJson();
        assertTrue(s3Payload.contains("\"competencies\""));
        assertTrue(s3Payload.contains("Digital Learning"));
        assertTrue(s4Payload.contains("\"references\""));
        assertTrue(s4Payload.contains("Legacy Ref"));
    }

    @Test
    void getLatestSectionsUpConvertsLegacyPayloadAfterSubmission() {
        User supplier = createUser("supplier.legacysubmitted@test.com", UserRole.SUPPLIER);
        RevampApplicationSummaryDto draft = applicationService.createDraft(
                supplier.getId(),
                RegistryType.ALBO_A,
                SourceChannel.PUBLIC,
                null
        );

        applicationService.saveLatestSection(
                draft.id(),
                "S1",
                """
                {
                  "firstName":"Mario",
                  "lastName":"Rossi",
                  "birthDate":"1980-01-01",
                  "birthPlace":"Milano",
                  "taxCode":"RSSMRA80A01F205X",
                  "addressLine":"Via Roma 1",
                  "city":"Milano",
                  "postalCode":"20100",
                  "province":"MI",
                  "phone":"+3902000001",
                  "email":"mario.rossi@example.com"
                }
                """,
                true
        );
        applicationService.saveLatestSection(
                draft.id(),
                "S3A",
                """
                {
                  "thematicAreasCsv":"HR",
                  "yearsExperience":"5-10 anni",
                  "presentation":"Legacy area"
                }
                """,
                false
        );

        applicationService.submit(draft.id());
        var sections = applicationService.getLatestSections(draft.id());
        String s3Payload = sections.stream().filter(s -> "S3A".equalsIgnoreCase(s.sectionKey())).findFirst().orElseThrow().payloadJson();
        assertTrue(s3Payload.contains("\"competencies\""));
        assertTrue(s3Payload.contains("Legacy area"));
    }

    @Test
    void adminProfileSearchUsesProjectedDetailFilters() {
        User admin = createUser("admin.searchfilters@test.com", UserRole.ADMIN);

        RevampApplicationSummaryDto alfa = createApprovedAlboBApplication(
                "supplier.alfa@test.com",
                "Alpha Formazione S.r.l.",
                "85.59",
                "Lombardia",
                "CAT_A",
                "Accreditata Regione Lombardia",
                admin.getId()
        );

        createApprovedAlboBApplication(
                "supplier.beta@test.com",
                "Beta Consulting S.r.l.",
                "62.02",
                "Lazio",
                "CAT_C",
                "ISO 27001",
                admin.getId()
        );

        var page = supplierProfileService.listAdminProfiles(
                RegistryType.ALBO_B,
                null,
                "Alpha",
                "85.59",
                "Lombardia",
                "CAT_A",
                "Accreditata",
                PageRequest.of(0, 20),
                AdminRole.SUPER_ADMIN
        );

        assertEquals(1, page.getTotalElements());
        assertEquals(alfa.id(), page.getContent().get(0).applicationId());
        assertNotNull(page.getContent().get(0).adminCardView());
        assertNotNull(page.getContent().get(0).publicCardView());
    }

    @Test
    void fullAlboAMaxDepthSubmissionPersistsCanonicalSectionsAndAttachments() {
        User supplier = createUser("supplier.alboa.full@test.com", UserRole.SUPPLIER);
        RevampApplicationSummaryDto draft = applicationService.createDraft(
                supplier.getId(),
                RegistryType.ALBO_A,
                SourceChannel.PUBLIC,
                null
        );

        applicationService.saveLatestSection(
                draft.id(),
                "S1",
                """
                {
                  "firstName":"Mario",
                  "lastName":"Rossi",
                  "birthDate":"1980-01-01",
                  "birthPlace":"Milano",
                  "taxCode":"RSSMRA80A01F205X",
                  "vatNumber":"12345678901",
                  "taxRegime":"ORDINARIO",
                  "addressLine":"Via Roma 1",
                  "secondaryPhone":"+3902333444",
                  "secondaryEmail":"m.rossi.secondary@example.com",
                  "pec":"mario.rossi@pec.it",
                  "website":"https://mariorossi.example.com",
                  "linkedin":"https://linkedin.com/in/mario-rossi",
                  "city":"Milano",
                  "province":"MI",
                  "postalCode":"20100",
                  "phone":"+3902123456",
                  "email":"mario.rossi@example.com"
                }
                """,
                true
        );
        applicationService.saveLatestSection(
                draft.id(),
                "S2",
                """
                {
                  "professionalType":"DOCENTE_FORMATORE",
                  "atecoCode":"85.59.20",
                  "secondaryProfessionalTypes":["CONSULENTE","MENTOR"]
                }
                """,
                true
        );
        applicationService.saveLatestSection(
                draft.id(),
                "S3A",
                """
                {
                  "education":{"highestTitle":"Laurea magistrale","studyArea":"Scienze della formazione","graduationYear":"2008"},
                  "certifications":[
                    {"name":"AIF Trainer","issuer":"AIF","year":"2020"},
                    {"name":"SCRUM","issuer":"Scrum.org","year":"2022"}
                  ],
                  "competencies":[
                    {"theme":"Digital Learning","details":"LMS, SCORM, authoring tools","yearsBand":"Y8_15"},
                    {"theme":"HR","details":"Recruiting e performance","yearsBand":"Y8_15"}
                  ],
                  "paTeachingExperience":true,
                  "consultingAreasCsv":"Formazione,Coaching",
                  "territoryRegionsCsv":"Lombardia,Piemonte",
                  "territoryProvincesCsv":"MI,TO",
                  "languages":[
                    {"language":"Italiano","qcerLevel":"C2"},
                    {"language":"Inglese","qcerLevel":"C1"}
                  ],
                  "teachingLanguagesCsv":"Italiano,Inglese",
                  "digitalToolsCsv":"Moodle,Articulate,Teams",
                  "professionalNetworksCsv":"AIF,ASFOR",
                  "availability":{"travelAvailable":true,"dailyRateRange":"600-800","hourlyRateRange":"90-120"},
                  "experiences":[
                    {"clientName":"Cliente 1","clientSector":"Servizi","interventionType":"Docenza","mainTheme":"Digital Learning","periodFrom":"2024-01","periodTo":"2024-03","durationHours":"24","participantsCount":"20","deliveryMode":"IN_PRESENCE","fundedIntervention":false,"fundName":""},
                    {"clientName":"Cliente 2","clientSector":"Manufacturing","interventionType":"Docenza","mainTheme":"HR","periodFrom":"2024-04","periodTo":"2024-05","durationHours":"16","participantsCount":"15","deliveryMode":"BLENDED","fundedIntervention":true,"fundName":"Fondo Sociale"},
                    {"clientName":"Cliente 3","clientSector":"Retail","interventionType":"Coaching","mainTheme":"Leadership","periodFrom":"2024-06","periodTo":"2024-07","durationHours":"12","participantsCount":"10","deliveryMode":"ONLINE","fundedIntervention":false,"fundName":""},
                    {"clientName":"Cliente 4","clientSector":"IT","interventionType":"Docenza","mainTheme":"Soft skills","periodFrom":"2024-08","periodTo":"2024-09","durationHours":"20","participantsCount":"18","deliveryMode":"IN_PRESENCE","fundedIntervention":false,"fundName":""},
                    {"clientName":"Cliente 5","clientSector":"PA","interventionType":"Docenza","mainTheme":"Comunicazione","periodFrom":"2024-10","periodTo":"2024-11","durationHours":"14","participantsCount":"22","deliveryMode":"BLENDED","fundedIntervention":true,"fundName":"PNRR"}
                  ]
                }
                """,
                true
        );
        applicationService.saveLatestSection(
                draft.id(),
                "S4",
                """
                {
                  "operationalCapacity":"Gestione completa percorsi aula/blended e supporto LMS.",
                  "references":[
                    {"fullName":"Laura Bianchi","organizationRole":"HR Director","email":"laura@example.com","phone":"+39021111"},
                    {"fullName":"Paolo Verdi","organizationRole":"L&D Manager","email":"paolo@example.com","phone":"+39022222"}
                  ],
                  "attachments":[
                    {"documentType":"CV","fileName":"cv.pdf","storageKey":"s3://docs/cv.pdf","expiresAt":"2099-12-31"},
                    {"documentType":"CERTIFICATION","fileName":"cert.pdf","storageKey":"s3://docs/cert.pdf","expiresAt":"2099-12-31"}
                  ]
                }
                """,
                true
        );
        applicationService.saveLatestSection(
                draft.id(),
                "S5",
                """
                {
                  "truthfulnessDeclaration": true,
                  "noConflictOfInterest": true,
                  "noCriminalConvictions": true,
                  "privacyAccepted": true,
                  "ethicalCodeAccepted": true,
                  "qualityEnvSafetyAccepted": true,
                  "alboDataProcessingConsent": true,
                  "marketingConsent": false,
                  "dlgs81ComplianceWhenInPresence": true,
                  "otpVerified": true,
                  "otpChallengeId": "test-challenge"
                }
                """,
                true
        );

        RevampApplicationSummaryDto submitted = applicationService.submit(draft.id());
        assertEquals("SUBMITTED", submitted.status());
        assertTrue(submitted.protocolCode().matches("^A-\\d{4}-\\d{4}$"));

        RevampApplicationSection s3a = applicationSectionRepository
                .findByApplicationIdAndSectionKeyAndIsLatestTrue(draft.id(), "S3A")
                .orElseThrow();
        assertTrue(s3a.getPayloadJson().toString().contains("\"experiences\""));
        assertTrue(s3a.getPayloadJson().toString().contains("\"competencies\""));
        assertEquals(2, applicationAttachmentRepository.findByApplicationIdAndSectionKey(draft.id(), "S4").size());
    }

    @Test
    void fullAlboBSubmissionWithAttachmentsAndDeclarationsPersistsExpectedState() {
        User supplier = createUser("supplier.albob.full@test.com", UserRole.SUPPLIER);
        RevampApplicationSummaryDto draft = applicationService.createDraft(
                supplier.getId(),
                RegistryType.ALBO_B,
                SourceChannel.PUBLIC,
                null
        );

        applicationService.saveLatestSection(
                draft.id(),
                "S1",
                """
                {
                  "companyName":"Delta Training S.r.l.",
                  "legalForm":"SRL",
                  "vatNumber":"12345678901",
                  "taxCodeIfDifferent":"12345678901",
                  "reaNumber":"MI-1234567",
                  "cciaaProvince":"MI",
                  "incorporationDate":"2017-05",
                  "legalAddress":{"street":"Via Torino 10","city":"Milano","cap":"20100","province":"MI"},
                  "operationalHeadquarter":{"street":"Via Torino 10","city":"Milano","cap":"20100","province":"MI"},
                  "institutionalEmail":"info@delta.it",
                  "pec":"delta@pec.it",
                  "phone":"+3902876543",
                  "website":"https://delta.it",
                  "legalRepresentative":{"name":"Giulia Bianchi","taxCode":"BNCGLI80A01F205X","role":"CEO"},
                  "operationalContact":{"name":"Marco Verdi","role":"Operations","email":"ops@delta.it","phone":"+3902876000"}
                }
                """,
                true
        );
        applicationService.saveLatestSection(
                draft.id(),
                "S2",
                """
                {
                  "employeeRange":"16_50",
                  "revenueBand":"R_500K_2M",
                  "atecoPrimary":"85.59",
                  "atecoSecondary":["70.22","62.01"],
                  "operatingRegions":[
                    {"region":"Lombardia","provincesCsv":"MI,MB"},
                    {"region":"Piemonte","provincesCsv":"TO,CN"}
                  ],
                  "regionalTrainingAccreditation":{"isAccredited":true,"regionsCsv":"Lombardia,Piemonte","accreditationNumber":"ACR-123"},
                  "thirdSectorType":"IMPRESA_SOCIALE",
                  "runtsNumber":"RUNTS-9988"
                }
                """,
                true
        );
        applicationService.saveLatestSection(
                draft.id(),
                "S3",
                """
                {
                  "servicesByCategory":{
                    "CAT_A":["TRAINING_DESIGN","ONLINE_SYNC"],
                    "CAT_C":["AI_AUTOMATION"]
                  },
                  "descriptionsByCategory":{
                    "CAT_A":"Progettazione e delivery percorsi formativi digitali e blended",
                    "CAT_C":"Automazione processi con AI e integrazioni HR"
                  }
                }
                """,
                true
        );
        applicationService.saveLatestSection(
                draft.id(),
                "S4",
                """
                {
                  "iso9001":"YES",
                  "accreditationSummary":"Accreditata Regione Lombardia e Piemonte",
                  "attachments":[
                    {"documentType":"VISURA_CAMERALE","fileName":"visura.pdf","storageKey":"s3://docs/visura.pdf","expiresAt":"2099-12-31"},
                    {"documentType":"DURC","fileName":"durc.pdf","storageKey":"s3://docs/durc.pdf","expiresAt":"2099-12-31"},
                    {"documentType":"CERTIFICATION","fileName":"iso9001.pdf","storageKey":"s3://docs/iso9001.pdf","expiresAt":"2099-12-31"}
                  ]
                }
                """,
                true
        );
        applicationService.saveLatestSection(
                draft.id(),
                "S5",
                """
                {
                  "truthfulnessDeclaration": true,
                  "noConflictOfInterest": true,
                  "noCriminalConvictions": true,
                  "privacyAccepted": true,
                  "ethicalCodeAccepted": true,
                  "qualityEnvSafetyAccepted": true,
                  "alboDataProcessingConsent": true,
                  "marketingConsent": false,
                  "antimafiaDeclaration": true,
                  "dlgs231Declaration": true,
                  "model231Adopted": false,
                  "fiscalContributionRegularity": true,
                  "gdprComplianceAndDpo": true,
                  "otpVerified": true,
                  "otpChallengeId": "test-challenge-b"
                }
                """,
                true
        );

        RevampApplicationSummaryDto submitted = applicationService.submit(draft.id());
        assertEquals("SUBMITTED", submitted.status());
        assertTrue(submitted.protocolCode().matches("^B-\\d{4}-\\d{4}$"));
        assertEquals(3, applicationAttachmentRepository.findByApplicationIdAndSectionKey(draft.id(), "S4").size());
        RevampApplicationSection s5 = applicationSectionRepository
                .findByApplicationIdAndSectionKeyAndIsLatestTrue(draft.id(), "S5")
                .orElseThrow();
        assertTrue(s5.getPayloadJson().toString().contains("\"antimafiaDeclaration\":true"));
        assertTrue(s5.getPayloadJson().toString().contains("\"gdprComplianceAndDpo\":true"));
    }

    @Test
    void adminReviewIntegrationRequestStoresMissingDocumentGuidanceAndTransitionsStatuses() {
        User supplier = createUser("supplier.integration.guidance@test.com", UserRole.SUPPLIER);
        User admin = createUser("admin.integration.guidance@test.com", UserRole.ADMIN);

        RevampApplicationSummaryDto draft = applicationService.createDraft(
                supplier.getId(),
                RegistryType.ALBO_B,
                SourceChannel.PUBLIC,
                null
        );
        applicationService.saveLatestSection(
                draft.id(),
                "S1",
                """
                {
                  "companyName":"Gamma Consulting S.r.l.",
                  "legalForm":"SRL",
                  "vatNumber":"12345678901",
                  "reaNumber":"MI-1234567",
                  "cciaaProvince":"MI",
                  "incorporationDate":"2018-01",
                  "legalAddress":{"street":"Via Roma 1","city":"Milano","cap":"20100","province":"MI"},
                  "institutionalEmail":"info@gamma.it",
                  "phone":"+3902111222",
                  "legalRepresentative":{"name":"Mario Rossi","taxCode":"RSSMRA80A01F205X","role":"Amministratore"},
                  "operationalContact":{"name":"Ops Team","email":"ops@gamma.it","phone":"+3902111333"}
                }
                """,
                true
        );
        applicationService.saveLatestSection(
                draft.id(),
                "S2",
                """
                {
                  "employeeRange":"16_50",
                  "atecoPrimary":"85.59",
                  "revenueBand":"R_100_500K",
                  "operatingRegions":[{"region":"Lombardia","provincesCsv":"MI,MB"}]
                }
                """,
                true
        );
        applicationService.saveLatestSection(
                draft.id(),
                "S3",
                """
                {
                  "servicesByCategory":{"CAT_A":["TRAINING_DESIGN"]},
                  "descriptionsByCategory":{"CAT_A":"Servizi formativi aziendali"}
                }
                """,
                true
        );
        applicationService.saveLatestSection(
                draft.id(),
                "S4",
                """
                {
                  "iso9001":"YES",
                  "accreditationSummary":"Accreditata Regione Lombardia",
                  "attachments":[
                    {"documentType":"VISURA_CAMERALE","fileName":"visura.pdf","storageKey":"s3://docs/visura.pdf","expiresAt":"2099-12-31"},
                    {"documentType":"DURC","fileName":"durc.pdf","storageKey":"s3://docs/durc.pdf","expiresAt":"2099-12-31"},
                    {"documentType":"CERTIFICATION","fileName":"cert.pdf","storageKey":"s3://docs/cert.pdf","expiresAt":"2099-12-31"}
                  ]
                }
                """,
                true
        );
        applicationService.saveLatestSection(
                draft.id(),
                "S5",
                """
                {
                  "truthfulnessDeclaration": true,
                  "noConflictOfInterest": true,
                  "noCriminalConvictions": true,
                  "privacyAccepted": true,
                  "ethicalCodeAccepted": true,
                  "qualityEnvSafetyAccepted": true,
                  "alboDataProcessingConsent": true,
                  "marketingConsent": false,
                  "antimafiaDeclaration": true,
                  "dlgs231Declaration": true,
                  "model231Adopted": false,
                  "fiscalContributionRegularity": true,
                  "gdprComplianceAndDpo": true,
                  "otpVerified": true
                }
                """,
                true
        );
        applicationService.submit(draft.id());

        var reviewCase = reviewWorkflowService.openCase(draft.id(), admin.getId(), LocalDateTime.now().plusDays(5));
        var updated = reviewWorkflowService.requestIntegration(
                reviewCase.id(),
                admin.getId(),
                LocalDateTime.now().plusDays(7),
                "Integrare documentazione mancante e correggere incongruenze.",
                """
                [
                  {"documentType":"DURC","instruction":"Caricare DURC aggiornato e firmato."},
                  {"field":"servicesByCategory.CAT_A","instruction":"Dettagliare meglio ambito e risultati attesi."}
                ]
                """
        );
        assertEquals("WAITING_SUPPLIER_RESPONSE", updated.status());

        RevampApplication persisted = applicationRepository.findById(draft.id()).orElseThrow();
        assertEquals(com.supplierplatform.revamp.enums.ApplicationStatus.INTEGRATION_REQUIRED, persisted.getStatus());
        var latest = reviewWorkflowService.getLatestIntegrationRequest(reviewCase.id());
        assertNotNull(latest);
        assertTrue(latest.requestMessage().contains("Integrare documentazione"));
        assertTrue(latest.requestedItemsJson().toString().contains("DURC"));
        assertTrue(latest.requestedItemsJson().toString().contains("servicesByCategory.CAT_A"));
    }

    private RevampApplicationSummaryDto createApprovedAlboBApplication(
            String supplierEmail,
            String companyName,
            String atecoPrimary,
            String region,
            String serviceCategory,
            String accreditationSummary,
            UUID adminUserId
    ) {
        User supplier = createUser(supplierEmail, UserRole.SUPPLIER);
        RevampApplicationSummaryDto draft = applicationService.createDraft(
                supplier.getId(),
                RegistryType.ALBO_B,
                SourceChannel.PUBLIC,
                null
        );

        applicationService.saveLatestSection(
                draft.id(),
                "S1",
                """
                {
                  "companyName":"%s",
                  "legalForm":"SRL",
                  "vatNumber":"12345678901",
                  "reaNumber":"MI-1234567",
                  "cciaaProvince":"MI",
                  "incorporationDate":"2018-06",
                  "legalAddress":{"street":"Via Roma 1","city":"Milano","cap":"20100","province":"MI"},
                  "institutionalEmail":"info@alpha.it",
                  "phone":"+3902123456",
                  "legalRepresentative":{"name":"Mario Rossi","taxCode":"RSSMRA80A01F205X","role":"Amministratore"},
                  "operationalContact":{"name":"Laura Bianchi","email":"ops@alpha.it","phone":"+3902111111"}
                }
                """.formatted(companyName),
                true
        );
        applicationService.saveLatestSection(
                draft.id(),
                "S2",
                """
                {
                  "employeeRange":"E_10_49",
                  "atecoPrimary":"%s",
                  "revenueBand":"R_100_500K",
                  "operatingRegions":[{"region":"%s","provincesCsv":"MI,MB"}]
                }
                """.formatted(atecoPrimary, region),
                true
        );
        applicationService.saveLatestSection(
                draft.id(),
                "S3",
                """
                {
                  "servicesByCategory":{"%s":["TRAINING_DESIGN"]},
                  "descriptionsByCategory":{"%s":"Descrizione servizi"}
                }
                """.formatted(serviceCategory, serviceCategory),
                true
        );
        applicationService.saveLatestSection(
                draft.id(),
                "S4",
                """
                {
                  "iso9001":"YES",
                  "accreditationSummary":"%s",
                  "attachments":[
                    {"documentType":"VISURA_CAMERALE","fileName":"visura.pdf","storageKey":"s3://docs/visura.pdf","expiresAt":"2099-12-31"},
                    {"documentType":"DURC","fileName":"durc.pdf","storageKey":"s3://docs/durc.pdf","expiresAt":"2099-12-31"},
                    {"documentType":"CERTIFICATION","fileName":"cert.pdf","storageKey":"s3://docs/cert.pdf","expiresAt":"2099-12-31"}
                  ]
                }
                """.formatted(accreditationSummary),
                true
        );

        applicationService.submit(draft.id());
        var reviewCase = reviewWorkflowService.openCase(draft.id(), adminUserId, LocalDateTime.now().plusDays(5));
        reviewWorkflowService.decide(reviewCase.id(), com.supplierplatform.revamp.enums.ReviewDecision.APPROVED, "ok", adminUserId);
        return draft;
    }

    private User createUser(String email, UserRole role) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash("hash");
        user.setFullName("Integration User " + UUID.randomUUID());
        user.setRole(role);
        user.setIsActive(true);
        return userRepository.save(user);
    }

    private String sha256(String value) {
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hashed) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}

