package com.supplierplatform.review;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ValidationReviewRepository extends JpaRepository<ValidationReview, UUID> {

    List<ValidationReview> findBySupplierIdOrderByCreatedAtDesc(UUID supplierId);

    Optional<ValidationReview> findFirstBySupplierIdOrderByCreatedAtDesc(UUID supplierId);
}
