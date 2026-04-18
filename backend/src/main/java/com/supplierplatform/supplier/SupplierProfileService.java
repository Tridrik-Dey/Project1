package com.supplierplatform.supplier;

import com.supplierplatform.category.ServiceCategory;
import com.supplierplatform.category.ServiceCategoryRepository;
import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.supplier.dto.*;
import com.supplierplatform.supplier.entity.SupplierProfile;
import com.supplierplatform.supplier.enums.PreferredLanguage;
import com.supplierplatform.supplier.enums.SupplierStatus;
import com.supplierplatform.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class SupplierProfileService {
    private final SupplierProfileRepository supplierProfileRepository;
    private final ServiceCategoryRepository serviceCategoryRepository;
    private final SupplierStatusService supplierStatusService;
    private final SupplierProfileSubmissionValidator submissionValidator;
    private final SupplierProfileMapper supplierProfileMapper;
    private final SupplierContactService supplierContactService;

    @Transactional(readOnly = true)
    public SupplierProfileResponse getProfileByUserId(UUID userId) {
        SupplierProfile profile = supplierProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new EntityNotFoundException("SupplierProfile for user", userId));
        return supplierProfileMapper.toResponse(profile);
    }

    @Transactional(readOnly = true)
    public SupplierProfileResponse getProfileById(UUID id) {
        SupplierProfile profile = supplierProfileRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("SupplierProfile", id));
        return supplierProfileMapper.toResponse(profile);
    }

    @Transactional
    public SupplierProfile createProfile(User user) {
        SupplierProfile profile = SupplierProfile.builder()
                .user(user)
                .preferredLanguage(PreferredLanguage.IT)
                .status(SupplierStatus.DRAFT)
                .isCriticalEditPending(false)
                .build();
        return supplierProfileRepository.save(profile);
    }

    @Transactional
    public SupplierProfileResponse updateProfile(UUID supplierId, SupplierProfileRequest request, User actor) {
        SupplierProfile profile = supplierProfileRepository.findById(supplierId)
                .orElseThrow(() -> new EntityNotFoundException("SupplierProfile", supplierId));
        assertSupplierCanEdit(profile);
        log.info("Updating supplier profile supplierId={} actorId={}", supplierId, actor != null ? actor.getId() : null);

        boolean criticalFieldChanged = isCriticalFieldChanged(profile, request);

        profile.setCompanyName(request.getCompanyName());
        profile.setTradingName(request.getTradingName());
        profile.setCompanyType(request.getCompanyType());
        profile.setTaxId(request.getTaxId());
        profile.setVatNumber(request.getVatNumber());
        profile.setRegistrationNumber(request.getRegistrationNumber());
        profile.setCountryOfIncorporation(request.getCountryOfIncorporation());
        profile.setIncorporationDate(request.getIncorporationDate());
        profile.setWebsite(request.getWebsite());
        profile.setDescription(request.getDescription());
        profile.setEmployeeCountRange(request.getEmployeeCountRange());
        profile.setAnnualRevenueRange(request.getAnnualRevenueRange());
        profile.setAddressLine1(request.getAddressLine1());
        profile.setAddressLine2(request.getAddressLine2());
        profile.setCity(request.getCity());
        profile.setStateProvince(request.getStateProvince());
        profile.setPostalCode(request.getPostalCode());
        profile.setCountry(request.getCountry());
        profile.setPreferredLanguage(request.getPreferredLanguage() != null
                ? request.getPreferredLanguage()
                : (profile.getPreferredLanguage() != null ? profile.getPreferredLanguage() : PreferredLanguage.IT));

        if (criticalFieldChanged &&
                (profile.getStatus() == SupplierStatus.ACTIVE || profile.getStatus() == SupplierStatus.APPROVED)) {
            supplierStatusService.triggerCriticalEditReview(profile, actor);
        } else {
            supplierProfileRepository.save(profile);
        }
        log.info(
                "Supplier profile updated supplierId={} status={} criticalFieldChanged={}",
                supplierId,
                profile.getStatus(),
                criticalFieldChanged
        );

        return supplierProfileMapper.toResponse(profile);
    }

    @Transactional
    public SupplierProfileResponse submitProfile(UUID supplierId, User actor) {
        SupplierProfile profile = supplierProfileRepository.findById(supplierId)
                .orElseThrow(() -> new EntityNotFoundException("SupplierProfile", supplierId));
        assertOwnership(profile, actor);
        submissionValidator.validateCompletenessForSubmission(profile);
        supplierStatusService.submit(profile, actor);
        log.info(
                "Supplier profile submitted supplierId={} actorId={} newStatus={}",
                supplierId,
                actor != null ? actor.getId() : null,
                profile.getStatus()
        );
        return supplierProfileMapper.toResponse(profile);
    }

    @Transactional
    public SupplierProfileResponse assignCategories(UUID supplierId, List<UUID> categoryIds, User actor) {
        SupplierProfile profile = supplierProfileRepository.findById(supplierId)
                .orElseThrow(() -> new EntityNotFoundException("SupplierProfile", supplierId));
        assertOwnership(profile, actor);
        assertSupplierCanEdit(profile);

        Set<ServiceCategory> categories = new HashSet<>(serviceCategoryRepository.findAllById(categoryIds));
        profile.setCategories(categories);
        supplierProfileRepository.save(profile);
        return supplierProfileMapper.toResponse(profile);
    }

    @Transactional
    public SupplierProfileResponse addContact(UUID supplierId, SupplierContactRequest request, User actor) {
        SupplierProfile profile = supplierProfileRepository.findById(supplierId)
                .orElseThrow(() -> new EntityNotFoundException("SupplierProfile", supplierId));
        assertOwnership(profile, actor);
        assertSupplierCanEdit(profile);

        supplierContactService.addContact(profile, request);
        return supplierProfileMapper.toResponse(profile);
    }

    @Transactional
    public void removeContact(UUID contactId, User actor) {
        var contact = supplierContactService.getById(contactId);
        SupplierProfile profile = contact.getSupplier();
        assertOwnership(profile, actor);
        assertSupplierCanEdit(profile);
        supplierContactService.delete(contact);
    }

    private boolean isCriticalFieldChanged(SupplierProfile profile, SupplierProfileRequest request) {
        boolean companyNameChanged = !isEqual(profile.getCompanyName(), request.getCompanyName());
        boolean taxIdChanged = !isEqual(profile.getTaxId(), request.getTaxId());
        boolean registrationNumberChanged = !isEqual(profile.getRegistrationNumber(), request.getRegistrationNumber());
        boolean companyTypeChanged = profile.getCompanyType() != request.getCompanyType();
        return companyNameChanged || taxIdChanged || registrationNumberChanged || companyTypeChanged;
    }

    private boolean isEqual(String a, String b) {
        if (a == null && b == null) return true;
        if (a == null || b == null) return false;
        return a.equals(b);
    }

    private void assertOwnership(SupplierProfile profile, User actor) {
        if (profile.getUser() == null || !profile.getUser().getId().equals(actor.getId())) {
            throw new IllegalStateException("You can only edit your own supplier profile");
        }
    }

    private void assertSupplierCanEdit(SupplierProfile profile) {
        SupplierStatus status = profile.getStatus();
        if (status != SupplierStatus.DRAFT && status != SupplierStatus.NEEDS_REVISION) {
            throw new IllegalStateException(
                    "Profile cannot be edited in status: " + status + ". Allowed only in DRAFT or NEEDS_REVISION.");
        }
    }

    public SupplierProfileResponse toResponse(SupplierProfile profile) {
        return supplierProfileMapper.toResponse(profile);
    }
}
