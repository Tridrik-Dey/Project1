package com.supplierplatform.supplier;

import com.supplierplatform.supplier.dto.SupplierContactResponse;
import com.supplierplatform.supplier.dto.SupplierProfileResponse;
import com.supplierplatform.supplier.entity.SupplierProfile;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class SupplierProfileMapper {

    private final SupplierContactRepository supplierContactRepository;

    public SupplierProfileResponse toResponse(SupplierProfile profile) {
        List<SupplierContactResponse> contactResponses = supplierContactRepository
                .findBySupplierId(profile.getId())
                .stream()
                .map(c -> SupplierContactResponse.builder()
                        .id(c.getId())
                        .contactType(c.getContactType())
                        .fullName(c.getFullName())
                        .jobTitle(c.getJobTitle())
                        .email(c.getEmail())
                        .phone(c.getPhone())
                        .isPrimary(c.getIsPrimary())
                        .createdAt(c.getCreatedAt())
                        .build())
                .collect(Collectors.toList());

        Set<SupplierProfileResponse.CategoryInfo> categoryInfos = profile.getCategories() == null
                ? new HashSet<>()
                : profile.getCategories().stream()
                .filter(cat -> Boolean.TRUE.equals(cat.getIsActive()))
                .map(cat -> SupplierProfileResponse.CategoryInfo.builder()
                        .id(cat.getId())
                        .code(cat.getCode())
                        .name(cat.getName())
                        .build())
                .collect(Collectors.toSet());

        String reviewerName = profile.getReviewer() != null ? profile.getReviewer().getFullName() : null;

        return SupplierProfileResponse.builder()
                .id(profile.getId())
                .userId(profile.getUser() != null ? profile.getUser().getId() : null)
                .companyName(profile.getCompanyName())
                .companyType(profile.getCompanyType())
                .taxId(profile.getTaxId())
                .vatNumber(profile.getVatNumber())
                .registrationNumber(profile.getRegistrationNumber())
                .tradingName(profile.getTradingName())
                .countryOfIncorporation(profile.getCountryOfIncorporation())
                .incorporationDate(profile.getIncorporationDate())
                .website(profile.getWebsite())
                .description(profile.getDescription())
                .employeeCountRange(profile.getEmployeeCountRange())
                .annualRevenueRange(profile.getAnnualRevenueRange())
                .addressLine1(profile.getAddressLine1())
                .addressLine2(profile.getAddressLine2())
                .city(profile.getCity())
                .stateProvince(profile.getStateProvince())
                .postalCode(profile.getPostalCode())
                .country(profile.getCountry())
                .preferredLanguage(profile.getPreferredLanguage())
                .status(profile.getStatus())
                .rejectionReason(profile.getRejectionReason())
                .revisionNotes(profile.getRevisionNotes())
                .isCriticalEditPending(profile.getIsCriticalEditPending())
                .reviewerName(reviewerName)
                .lastReviewedAt(profile.getLastReviewedAt())
                .submittedAt(profile.getSubmittedAt())
                .createdAt(profile.getCreatedAt())
                .updatedAt(profile.getUpdatedAt())
                .contacts(contactResponses)
                .categories(categoryInfos)
                .build();
    }
}
