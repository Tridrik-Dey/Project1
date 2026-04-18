package com.supplierplatform.supplier.entity;

import com.supplierplatform.category.ServiceCategory;
import com.supplierplatform.document.SupplierDocument;
import com.supplierplatform.review.ValidationReview;
import com.supplierplatform.status.StatusHistory;
import com.supplierplatform.supplier.enums.*;
import com.supplierplatform.user.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "supplier_profiles")
@EntityListeners(AuditingEntityListener.class)
public class SupplierProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "company_name")
    private String companyName;

    @Column(name = "trading_name")
    private String tradingName;

    @Enumerated(EnumType.STRING)
    @Column(name = "company_type")
    private CompanyType companyType;

    @Column(name = "registration_number")
    private String registrationNumber;

    @Column(name = "vat_number")
    private String vatNumber;

    @Column(name = "tax_id")
    private String taxId;

    @Column(name = "country_of_incorporation")
    private String countryOfIncorporation;

    @Column(name = "incorporation_date")
    private LocalDate incorporationDate;

    @Column(name = "website")
    private String website;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "employee_count_range")
    private EmployeeCountRange employeeCountRange;

    @Enumerated(EnumType.STRING)
    @Column(name = "annual_revenue_range")
    private AnnualRevenueRange annualRevenueRange;

    @Column(name = "address_line1")
    private String addressLine1;

    @Column(name = "address_line2")
    private String addressLine2;

    @Column(name = "city")
    private String city;

    @Column(name = "state_province")
    private String stateProvince;

    @Column(name = "postal_code")
    private String postalCode;

    @Column(name = "country")
    private String country;

    @Enumerated(EnumType.STRING)
    @Column(name = "preferred_language", nullable = false)
    @Builder.Default
    private PreferredLanguage preferredLanguage = PreferredLanguage.IT;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private SupplierStatus status;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @Column(name = "revision_notes", columnDefinition = "TEXT")
    private String revisionNotes;

    @Column(name = "is_critical_edit_pending")
    @Builder.Default
    private Boolean isCriticalEditPending = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewer_id")
    private User reviewer;

    @Column(name = "last_reviewed_at")
    private LocalDateTime lastReviewedAt;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @OneToMany(mappedBy = "supplier", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<SupplierContact> contacts = new ArrayList<>();

    @OneToMany(mappedBy = "supplier", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<SupplierDocument> documents = new ArrayList<>();

    @OneToMany(mappedBy = "supplier", fetch = FetchType.LAZY)
    @Builder.Default
    private List<ValidationReview> reviews = new ArrayList<>();

    @OneToMany(mappedBy = "supplier", fetch = FetchType.LAZY)
    @Builder.Default
    private List<StatusHistory> statusHistories = new ArrayList<>();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "supplier_service_categories",
            joinColumns = @JoinColumn(name = "supplier_id"),
            inverseJoinColumns = @JoinColumn(name = "category_id")
    )
    @Builder.Default
    private Set<ServiceCategory> categories = new HashSet<>();

    @CreatedDate
    @Column(name = "created_at", updatable = false, nullable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
