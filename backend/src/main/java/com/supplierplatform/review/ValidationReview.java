package com.supplierplatform.review;

import com.supplierplatform.supplier.entity.SupplierProfile;
import com.supplierplatform.supplier.enums.SupplierStatus;
import com.supplierplatform.user.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "validation_reviews")
@EntityListeners(AuditingEntityListener.class)
public class ValidationReview {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id", nullable = false)
    private SupplierProfile supplier;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewer_id", nullable = false)
    private User reviewer;

    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false)
    private ReviewAction action;

    @Column(name = "comment", columnDefinition = "TEXT")
    private String comment;

    @Column(name = "internal_note", columnDefinition = "TEXT")
    private String internalNote;

    @Enumerated(EnumType.STRING)
    @Column(name = "previous_status")
    private SupplierStatus previousStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "new_status")
    private SupplierStatus newStatus;

    @CreatedDate
    @Column(name = "created_at", updatable = false, nullable = false)
    private LocalDateTime createdAt;
}
