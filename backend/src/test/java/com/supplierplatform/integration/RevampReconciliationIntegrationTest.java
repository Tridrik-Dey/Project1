package com.supplierplatform.integration;

import com.supplierplatform.document.DocumentType;
import com.supplierplatform.document.SupplierDocument;
import com.supplierplatform.document.SupplierDocumentRepository;
import com.supplierplatform.review.ReviewAction;
import com.supplierplatform.review.ValidationReview;
import com.supplierplatform.review.ValidationReviewRepository;
import com.supplierplatform.revamp.enums.ApplicationStatus;
import com.supplierplatform.revamp.enums.RegistryType;
import com.supplierplatform.revamp.enums.ReviewCaseStatus;
import com.supplierplatform.revamp.enums.ReviewDecision;
import com.supplierplatform.revamp.enums.SourceChannel;
import com.supplierplatform.revamp.model.RevampApplication;
import com.supplierplatform.revamp.model.RevampReviewCase;
import com.supplierplatform.revamp.repository.RevampApplicationRepository;
import com.supplierplatform.revamp.repository.RevampApplicationSectionRepository;
import com.supplierplatform.revamp.repository.RevampAuditEventRepository;
import com.supplierplatform.revamp.repository.RevampIntegrationRequestRepository;
import com.supplierplatform.revamp.repository.RevampInviteRepository;
import com.supplierplatform.revamp.repository.RevampReviewCaseRepository;
import com.supplierplatform.status.StatusHistory;
import com.supplierplatform.status.StatusHistoryRepository;
import com.supplierplatform.supplier.SupplierProfileRepository;
import com.supplierplatform.supplier.enums.CompanyType;
import com.supplierplatform.supplier.entity.SupplierProfile;
import com.supplierplatform.supplier.enums.SupplierStatus;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRepository;
import com.supplierplatform.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
class RevampReconciliationIntegrationTest {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private SupplierProfileRepository supplierProfileRepository;
    @Autowired
    private SupplierDocumentRepository supplierDocumentRepository;
    @Autowired
    private ValidationReviewRepository validationReviewRepository;
    @Autowired
    private StatusHistoryRepository statusHistoryRepository;
    @Autowired
    private RevampReviewCaseRepository reviewCaseRepository;
    @Autowired
    private RevampApplicationRepository applicationRepository;
    @Autowired
    private RevampApplicationSectionRepository applicationSectionRepository;
    @Autowired
    private RevampIntegrationRequestRepository integrationRequestRepository;
    @Autowired
    private RevampInviteRepository inviteRepository;
    @Autowired
    private RevampAuditEventRepository auditEventRepository;

    @BeforeEach
    void cleanDatabase() {
        integrationRequestRepository.deleteAll();
        reviewCaseRepository.deleteAll();
        applicationSectionRepository.deleteAll();
        applicationRepository.deleteAll();
        inviteRepository.deleteAll();
        auditEventRepository.deleteAll();

        validationReviewRepository.deleteAll();
        statusHistoryRepository.deleteAll();
        supplierDocumentRepository.deleteAll();
        supplierProfileRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void reconciliationChecksStatusDocumentAndReviewParity() {
        User supplierUser = saveUser("supplier.recon@test.com", UserRole.SUPPLIER);
        User adminUser = saveUser("admin.recon@test.com", UserRole.ADMIN);

        SupplierProfile legacyProfile = new SupplierProfile();
        legacyProfile.setUser(supplierUser);
        legacyProfile.setCompanyName("Recon SRL");
        legacyProfile.setCompanyType(CompanyType.LLC);
        legacyProfile.setRegistrationNumber("REG-" + UUID.randomUUID());
        legacyProfile.setTaxId("TAX-" + UUID.randomUUID());
        legacyProfile.setCountryOfIncorporation("IT");
        legacyProfile.setAddressLine1("Via Roma 1");
        legacyProfile.setCity("Milano");
        legacyProfile.setPostalCode("20100");
        legacyProfile.setCountry("IT");
        legacyProfile.setStatus(SupplierStatus.APPROVED);
        legacyProfile = supplierProfileRepository.save(legacyProfile);

        SupplierDocument legacyDoc = new SupplierDocument();
        legacyDoc.setSupplier(legacyProfile);
        legacyDoc.setDocumentType(DocumentType.COMPANY_PROFILE);
        legacyDoc.setOriginalFilename("company-profile.pdf");
        legacyDoc.setStorageKey("docs/company-profile.pdf");
        legacyDoc.setMimeType("application/pdf");
        legacyDoc.setFileSizeBytes(1024L);
        legacyDoc.setUploadedBy(supplierUser);
        supplierDocumentRepository.save(legacyDoc);

        StatusHistory statusHistory = new StatusHistory();
        statusHistory.setSupplier(legacyProfile);
        statusHistory.setFromStatus(SupplierStatus.PENDING);
        statusHistory.setToStatus(SupplierStatus.APPROVED);
        statusHistory.setChangedBy(adminUser);
        statusHistoryRepository.save(statusHistory);

        ValidationReview legacyReview = new ValidationReview();
        legacyReview.setSupplier(legacyProfile);
        legacyReview.setReviewer(adminUser);
        legacyReview.setAction(ReviewAction.APPROVED);
        legacyReview.setPreviousStatus(SupplierStatus.PENDING);
        legacyReview.setNewStatus(SupplierStatus.APPROVED);
        validationReviewRepository.save(legacyReview);

        RevampApplication revampApplication = new RevampApplication();
        revampApplication.setApplicantUser(supplierUser);
        revampApplication.setRegistryType(RegistryType.ALBO_A);
        revampApplication.setSourceChannel(SourceChannel.PUBLIC);
        revampApplication.setStatus(ApplicationStatus.APPROVED);
        revampApplication.setLegacySupplierProfile(legacyProfile);
        revampApplication = applicationRepository.save(revampApplication);

        RevampReviewCase revampCase = new RevampReviewCase();
        revampCase.setApplication(revampApplication);
        revampCase.setStatus(ReviewCaseStatus.DECIDED);
        revampCase.setDecision(ReviewDecision.APPROVED);
        reviewCaseRepository.save(revampCase);

        ApplicationStatus expectedFromLegacyStatus = mapLegacyStatus(legacyProfile.getStatus());
        assertEquals(expectedFromLegacyStatus, revampApplication.getStatus(), "Legacy status to v2 status parity");

        long linkedDocs = supplierDocumentRepository.findBySupplierId(legacyProfile.getId()).size();
        assertTrue(linkedDocs > 0, "Document linkage parity check");

        ReviewDecision expectedDecision = mapLegacyReviewAction(legacyReview.getAction());
        assertEquals(expectedDecision, revampCase.getDecision(), "Review history parity check");
    }

    private User saveUser(String email, UserRole role) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash("hash");
        user.setFullName("Recon User " + UUID.randomUUID());
        user.setRole(role);
        user.setIsActive(true);
        return userRepository.save(user);
    }

    private ApplicationStatus mapLegacyStatus(SupplierStatus legacyStatus) {
        return switch (legacyStatus) {
            case DRAFT -> ApplicationStatus.DRAFT;
            case PENDING -> ApplicationStatus.SUBMITTED;
            case NEEDS_REVISION -> ApplicationStatus.INTEGRATION_REQUIRED;
            case APPROVED, ACTIVE -> ApplicationStatus.APPROVED;
            case INACTIVE -> ApplicationStatus.SUSPENDED;
            case REJECTED -> ApplicationStatus.REJECTED;
        };
    }

    private ReviewDecision mapLegacyReviewAction(ReviewAction action) {
        return switch (action) {
            case APPROVED -> ReviewDecision.APPROVED;
            case REJECTED -> ReviewDecision.REJECTED;
            case REVISION_REQUESTED -> ReviewDecision.INTEGRATION_REQUIRED;
        };
    }
}

