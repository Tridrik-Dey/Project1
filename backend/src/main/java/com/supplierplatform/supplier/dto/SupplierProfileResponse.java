package com.supplierplatform.supplier.dto;

import com.supplierplatform.supplier.enums.AnnualRevenueRange;
import com.supplierplatform.supplier.enums.CompanyType;
import com.supplierplatform.supplier.enums.EmployeeCountRange;
import com.supplierplatform.supplier.enums.PreferredLanguage;
import com.supplierplatform.supplier.enums.SupplierStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SupplierProfileResponse {

    private UUID id;
    private UUID userId;
    private String companyName;
    private String tradingName;
    private CompanyType companyType;
    private String registrationNumber;
    private String vatNumber;
    private String taxId;
    private String countryOfIncorporation;
    private LocalDate incorporationDate;
    private String website;
    private String description;
    private EmployeeCountRange employeeCountRange;
    private AnnualRevenueRange annualRevenueRange;
    private String addressLine1;
    private String addressLine2;
    private String city;
    private String stateProvince;
    private String postalCode;
    private String country;
    private PreferredLanguage preferredLanguage;
    private SupplierStatus status;
    private String rejectionReason;
    private String revisionNotes;
    private Boolean isCriticalEditPending;
    private String reviewerName;
    private LocalDateTime lastReviewedAt;
    private LocalDateTime submittedAt;
    private Boolean isNew;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<SupplierContactResponse> contacts;
    private Set<CategoryInfo> categories;

    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CategoryInfo {
        private UUID id;
        private String code;
        private String name;
    }
}
