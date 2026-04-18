package com.supplierplatform.supplier;

import com.supplierplatform.supplier.entity.SupplierProfile;
import com.supplierplatform.supplier.enums.SupplierStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.time.LocalDateTime;

@Repository
public interface SupplierProfileRepository extends JpaRepository<SupplierProfile, UUID>, JpaSpecificationExecutor<SupplierProfile> {

    Optional<SupplierProfile> findByUserId(UUID userId);

    List<SupplierProfile> findByStatus(SupplierStatus status);

    boolean existsByTaxId(String taxId);

    boolean existsByVatNumber(String vatNumber);

    Page<SupplierProfile> findByStatusIn(List<SupplierStatus> statuses, Pageable pageable);

    long countByStatusAndSubmittedAtAfter(SupplierStatus status, LocalDateTime submittedAt);
}
